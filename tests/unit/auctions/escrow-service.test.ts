/**
 * Unit Tests for Escrow Service
 * Tests wallet operations for auction deposit system
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { depositEvents } from '@/lib/db/schema/auction-deposit';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { escrowService } from '@/features/auctions/services/escrow.service';
import { eq } from 'drizzle-orm';

describe('Escrow Service', () => {
  let testUserId: string;
  let testVendorId: string;
  let testWalletId: string;
  let testCaseId: string;
  let testAuctionId: string;

  beforeEach(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: `test-escrow-${Date.now()}@example.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        fullName: 'Test Escrow User',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
        status: 'verified_tier_1',
        passwordHash: 'test-hash',
      })
      .returning();
    testUserId = user.id;

    // Create test vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: testUserId,
        tier: 'tier1_bvn',
        status: 'approved',
      })
      .returning();
    testVendorId = vendor.id;

    // Create test wallet with initial balance
    const [wallet] = await db
      .insert(escrowWallets)
      .values({
        vendorId: testVendorId,
        balance: '1000000.00', // ₦1,000,000
        availableBalance: '1000000.00',
        frozenAmount: '0.00',
        forfeitedAmount: '0.00',
      })
      .returning();
    testWalletId = wallet.id;

    // Create test salvage case
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-CLAIM-${Date.now()}`,
        assetType: 'vehicle',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          vin: 'TEST123456789',
        },
        marketValue: '5000000.00',
        estimatedSalvageValue: '2000000.00',
        reservePrice: '1500000.00',
        damageSeverity: 'moderate',
        gpsLocation: [3.3792, 6.5244], // Lagos coordinates - [longitude, latitude]
        locationName: 'Lagos, Nigeria',
        photos: ['test-photo-1.jpg'],
        status: 'approved',
        createdBy: testUserId,
      })
      .returning();
    testCaseId = salvageCase.id;

    // Create test auction
    const now = new Date();
    const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCaseId,
        startTime: now,
        endTime: endTime,
        originalEndTime: endTime,
        status: 'active',
      })
      .returning();
    testAuctionId = auction.id;
  });

  afterEach(async () => {
    // Cleanup in reverse order of dependencies
    await db.delete(depositEvents).where(eq(depositEvents.vendorId, testVendorId));
    await db.delete(auctions).where(eq(auctions.id, testAuctionId));
    await db.delete(salvageCases).where(eq(salvageCases.id, testCaseId));
    await db.delete(escrowWallets).where(eq(escrowWallets.vendorId, testVendorId));
    await db.delete(vendors).where(eq(vendors.id, testVendorId));
    await db.delete(users).where(eq(users.id, testUserId));
  });

  describe('freezeDeposit', () => {
    it('should freeze deposit and update wallet balances correctly', async () => {
      const depositAmount = 50000; // ₦50,000

      await escrowService.freezeDeposit(testVendorId, depositAmount, testAuctionId, testUserId);

      const balance = await escrowService.getBalance(testVendorId);

      expect(balance.balance).toBe(1000000); // Total balance unchanged
      expect(balance.availableBalance).toBe(950000); // Decreased by deposit
      expect(balance.frozenAmount).toBe(50000); // Increased by deposit
      expect(balance.forfeitedAmount).toBe(0);
    });

    it('should maintain wallet invariant after freeze', async () => {
      const depositAmount = 100000;

      await escrowService.freezeDeposit(testVendorId, depositAmount, testAuctionId, testUserId);

      const balance = await escrowService.getBalance(testVendorId);
      const calculatedBalance = balance.availableBalance + balance.frozenAmount + balance.forfeitedAmount;

      expect(Math.abs(balance.balance - calculatedBalance)).toBeLessThanOrEqual(0.01);
    });

    it('should create deposit event record', async () => {
      const depositAmount = 75000;

      await escrowService.freezeDeposit(testVendorId, depositAmount, testAuctionId, testUserId);

      const [event] = await db
        .select()
        .from(depositEvents)
        .where(eq(depositEvents.auctionId, testAuctionId))
        .limit(1);

      expect(event).toBeDefined();
      expect(event.eventType).toBe('freeze');
      expect(parseFloat(event.amount)).toBe(depositAmount);
      expect(event.vendorId).toBe(testVendorId);
    });

    it('should throw error if insufficient available balance', async () => {
      const depositAmount = 1500000; // More than available

      await expect(
        escrowService.freezeDeposit(testVendorId, depositAmount, testAuctionId, testUserId)
      ).rejects.toThrow('Insufficient available balance');
    });

    it('should handle multiple freezes correctly', async () => {
      await escrowService.freezeDeposit(testVendorId, 100000, testAuctionId, testUserId);
      await escrowService.freezeDeposit(testVendorId, 150000, testAuctionId, testUserId);

      const balance = await escrowService.getBalance(testVendorId);

      expect(balance.availableBalance).toBe(750000); // 1M - 100K - 150K
      expect(balance.frozenAmount).toBe(250000); // 100K + 150K
      expect(balance.balance).toBe(1000000); // Unchanged
    });
  });

  describe('unfreezeDeposit', () => {
    beforeEach(async () => {
      // Freeze some amount first
      await escrowService.freezeDeposit(testVendorId, 200000, testAuctionId, testUserId);
    });

    it('should unfreeze deposit and update wallet balances correctly', async () => {
      const unfreezeAmount = 200000;

      await escrowService.unfreezeDeposit(testVendorId, unfreezeAmount, testAuctionId, testUserId);

      const balance = await escrowService.getBalance(testVendorId);

      expect(balance.balance).toBe(1000000); // Total balance unchanged
      expect(balance.availableBalance).toBe(1000000); // Back to original
      expect(balance.frozenAmount).toBe(0); // Back to zero
      expect(balance.forfeitedAmount).toBe(0);
    });

    it('should maintain wallet invariant after unfreeze', async () => {
      await escrowService.unfreezeDeposit(testVendorId, 200000, testAuctionId, testUserId);

      const balance = await escrowService.getBalance(testVendorId);
      const calculatedBalance = balance.availableBalance + balance.frozenAmount + balance.forfeitedAmount;

      expect(Math.abs(balance.balance - calculatedBalance)).toBeLessThanOrEqual(0.01);
    });

    it('should create deposit event record', async () => {
      const unfreezeAmount = 200000;

      await escrowService.unfreezeDeposit(testVendorId, unfreezeAmount, testAuctionId, testUserId);

      const events = await db
        .select()
        .from(depositEvents)
        .where(eq(depositEvents.auctionId, testAuctionId));

      const unfreezeEvent = events.find(e => e.eventType === 'unfreeze');

      expect(unfreezeEvent).toBeDefined();
      expect(parseFloat(unfreezeEvent!.amount)).toBe(unfreezeAmount);
    });

    it('should throw error if insufficient frozen amount', async () => {
      const unfreezeAmount = 300000; // More than frozen

      await expect(
        escrowService.unfreezeDeposit(testVendorId, unfreezeAmount, testAuctionId, testUserId)
      ).rejects.toThrow('Insufficient frozen amount');
    });

    it('should handle partial unfreeze correctly', async () => {
      // Frozen: 200000
      await escrowService.unfreezeDeposit(testVendorId, 100000, testAuctionId, testUserId);

      const balance = await escrowService.getBalance(testVendorId);

      expect(balance.availableBalance).toBe(900000); // 800K + 100K
      expect(balance.frozenAmount).toBe(100000); // 200K - 100K
      expect(balance.balance).toBe(1000000);
    });
  });

  describe('getBalance', () => {
    it('should return correct wallet balance details', async () => {
      const balance = await escrowService.getBalance(testVendorId);

      expect(balance.balance).toBe(1000000);
      expect(balance.availableBalance).toBe(1000000);
      expect(balance.frozenAmount).toBe(0);
      expect(balance.forfeitedAmount).toBe(0);
    });

    it('should throw error if wallet not found', async () => {
      const nonExistentVendorId = '00000000-0000-0000-0000-000000000000';

      await expect(
        escrowService.getBalance(nonExistentVendorId)
      ).rejects.toThrow('Wallet not found');
    });

    it('should return updated balance after operations', async () => {
      await escrowService.freezeDeposit(testVendorId, 300000, testAuctionId, testUserId);

      const balance = await escrowService.getBalance(testVendorId);

      expect(balance.availableBalance).toBe(700000);
      expect(balance.frozenAmount).toBe(300000);
    });
  });

  describe('verifyInvariant', () => {
    it('should return true for valid wallet state', async () => {
      const isValid = await escrowService.verifyInvariant(testWalletId);

      expect(isValid).toBe(true);
    });

    it('should return true after freeze operation', async () => {
      await escrowService.freezeDeposit(testVendorId, 100000, testAuctionId, testUserId);

      const isValid = await escrowService.verifyInvariant(testWalletId);

      expect(isValid).toBe(true);
    });

    it('should return true after unfreeze operation', async () => {
      await escrowService.freezeDeposit(testVendorId, 100000, testAuctionId, testUserId);
      await escrowService.unfreezeDeposit(testVendorId, 100000, testAuctionId, testUserId);

      const isValid = await escrowService.verifyInvariant(testWalletId);

      expect(isValid).toBe(true);
    });

    it('should throw error if wallet not found', async () => {
      const nonExistentWalletId = '00000000-0000-0000-0000-000000000000';

      await expect(
        escrowService.verifyInvariant(nonExistentWalletId)
      ).rejects.toThrow('Wallet not found');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero amount freeze', async () => {
      await escrowService.freezeDeposit(testVendorId, 0, testAuctionId, testUserId);

      const balance = await escrowService.getBalance(testVendorId);

      expect(balance.availableBalance).toBe(1000000);
      expect(balance.frozenAmount).toBe(0);
    });

    it('should handle zero amount unfreeze', async () => {
      await escrowService.freezeDeposit(testVendorId, 100000, testAuctionId, testUserId);
      await escrowService.unfreezeDeposit(testVendorId, 0, testAuctionId, testUserId);

      const balance = await escrowService.getBalance(testVendorId);

      expect(balance.frozenAmount).toBe(100000); // Unchanged
    });

    it('should handle exact available balance freeze', async () => {
      await escrowService.freezeDeposit(testVendorId, 1000000, testAuctionId, testUserId);

      const balance = await escrowService.getBalance(testVendorId);

      expect(balance.availableBalance).toBe(0);
      expect(balance.frozenAmount).toBe(1000000);
    });

    it('should handle exact frozen amount unfreeze', async () => {
      await escrowService.freezeDeposit(testVendorId, 500000, testAuctionId, testUserId);
      await escrowService.unfreezeDeposit(testVendorId, 500000, testAuctionId, testUserId);

      const balance = await escrowService.getBalance(testVendorId);

      expect(balance.availableBalance).toBe(1000000);
      expect(balance.frozenAmount).toBe(0);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle sequential freezes on different auctions', async () => {
      await escrowService.freezeDeposit(testVendorId, 100000, testAuctionId, testUserId);
      await escrowService.freezeDeposit(testVendorId, 150000, testAuctionId, testUserId);
      await escrowService.freezeDeposit(testVendorId, 200000, testAuctionId, testUserId);

      const balance = await escrowService.getBalance(testVendorId);

      expect(balance.availableBalance).toBe(550000);
      expect(balance.frozenAmount).toBe(450000);
      expect(balance.balance).toBe(1000000);
    });

    it('should handle mixed freeze and unfreeze operations', async () => {
      await escrowService.freezeDeposit(testVendorId, 200000, testAuctionId, testUserId);
      await escrowService.freezeDeposit(testVendorId, 150000, testAuctionId, testUserId);
      await escrowService.unfreezeDeposit(testVendorId, 200000, testAuctionId, testUserId);

      const balance = await escrowService.getBalance(testVendorId);

      expect(balance.availableBalance).toBe(850000);
      expect(balance.frozenAmount).toBe(150000);
    });
  });
});
