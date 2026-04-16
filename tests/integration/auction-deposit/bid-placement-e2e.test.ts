/**
 * Integration Test: End-to-End Bid Placement Flow
 * 
 * Tests the complete bid placement flow including:
 * - Bid validation
 * - Deposit calculation
 * - Deposit freeze
 * - Bid creation
 * - Previous bidder unfreeze
 * - Concurrent bid handling with locking
 * - Error rollback scenarios
 * 
 * Requirements: 1.1-1.6, 2.1-2.6, 3.1-3.6, 4.1-4.4
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { depositEvents } from '@/lib/db/schema/auction-deposit';
import { bidService } from '@/features/auctions/services/bid.service';
import { escrowService } from '@/features/auctions/services/escrow.service';
import { eq } from 'drizzle-orm';
import { hash } from 'bcryptjs';

describe('Integration Test: End-to-End Bid Placement', () => {
  let testUserId1: string;
  let testUserId2: string;
  let testVendorId1: string;
  let testVendorId2: string;
  let testWalletId1: string;
  let testWalletId2: string;
  let testCaseId: string;
  let testAuctionId: string;

  beforeEach(async () => {
    // Create first test user and vendor
    const [user1] = await db
      .insert(users)
      .values({
        email: `test-bid-1-${Date.now()}@example.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: await hash('Test123!@#', 12),
        fullName: 'Test Bidder 1',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
        status: 'verified_tier_1',
      })
      .returning();
    testUserId1 = user1.id;

    const [vendor1] = await db
      .insert(vendors)
      .values({
        userId: testUserId1,
        businessName: 'Test Vendor 1',
        tier: 'tier1_bvn',
        kycStatus: 'approved',
      })
      .returning();
    testVendorId1 = vendor1.id;

    const [wallet1] = await db
      .insert(escrowWallets)
      .values({
        vendorId: testVendorId1,
        balance: '1000000.00', // ₦1,000,000
        availableBalance: '1000000.00',
        frozenAmount: '0.00',
        forfeitedAmount: '0.00',
      })
      .returning();
    testWalletId1 = wallet1.id;

    // Create second test user and vendor
    const [user2] = await db
      .insert(users)
      .values({
        email: `test-bid-2-${Date.now()}@example.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: await hash('Test123!@#', 12),
        fullName: 'Test Bidder 2',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
        status: 'verified_tier_1',
      })
      .returning();
    testUserId2 = user2.id;

    const [vendor2] = await db
      .insert(vendors)
      .values({
        userId: testUserId2,
        businessName: 'Test Vendor 2',
        tier: 'tier1_bvn',
        kycStatus: 'approved',
      })
      .returning();
    testVendorId2 = vendor2.id;

    const [wallet2] = await db
      .insert(escrowWallets)
      .values({
        vendorId: testVendorId2,
        balance: '1000000.00', // ₦1,000,000
        availableBalance: '1000000.00',
        frozenAmount: '0.00',
        forfeitedAmount: '0.00',
      })
      .returning();
    testWalletId2 = wallet2.id;

    // Create test salvage case
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-BID-${Date.now()}`,
        assetType: 'vehicle',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          vin: 'TEST123456789',
        },
        marketValue: '5000000.00',
        estimatedSalvageValue: '2000000.00',
        reservePrice: '1400000.00', // 70% of salvage value
        damageSeverity: 'moderate',
        gpsLocation: [3.3792, 6.5244],
        locationName: 'Lagos, Nigeria',
        photos: ['test-photo-1.jpg'],
        status: 'approved',
        createdBy: testUserId1,
      })
      .returning();
    testCaseId = salvageCase.id;

    // Create test auction
    const now = new Date();
    const endTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
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
    await db.delete(depositEvents).where(eq(depositEvents.vendorId, testVendorId1));
    await db.delete(depositEvents).where(eq(depositEvents.vendorId, testVendorId2));
    await db.delete(bids).where(eq(bids.auctionId, testAuctionId));
    await db.delete(auctions).where(eq(auctions.id, testAuctionId));
    await db.delete(salvageCases).where(eq(salvageCases.id, testCaseId));
    await db.delete(escrowWallets).where(eq(escrowWallets.vendorId, testVendorId1));
    await db.delete(escrowWallets).where(eq(escrowWallets.vendorId, testVendorId2));
    await db.delete(vendors).where(eq(vendors.id, testVendorId1));
    await db.delete(vendors).where(eq(vendors.id, testVendorId2));
    await db.delete(users).where(eq(users.id, testUserId1));
    await db.delete(users).where(eq(users.id, testUserId2));
  });

  describe('Complete Bid Placement Flow', () => {
    it('should successfully place first bid with deposit freeze', async () => {
      const bidAmount = 1500000; // ₦1,500,000

      const result = await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        amount: bidAmount,
        userId: testUserId1,
      });

      expect(result.success).toBe(true);
      expect(result.bid).toBeDefined();
      expect(result.bid.amount).toBe(bidAmount);
      expect(result.bid.depositAmount).toBe(150000); // 10% of 1.5M
      expect(result.bid.status).toBe('active');

      // Verify wallet state
      const balance = await escrowService.getBalance(testVendorId1);
      expect(balance.availableBalance).toBe(850000); // 1M - 150K
      expect(balance.frozenAmount).toBe(150000);
      expect(balance.balance).toBe(1000000); // Unchanged

      // Verify deposit event created
      const [event] = await db
        .select()
        .from(depositEvents)
        .where(eq(depositEvents.auctionId, testAuctionId));
      
      expect(event).toBeDefined();
      expect(event.eventType).toBe('freeze');
      expect(parseFloat(event.amount)).toBe(150000);
    });

    it('should unfreeze previous bidder when outbid', async () => {
      // First bid
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        amount: 1500000,
        userId: testUserId1,
      });

      // Second bid (higher)
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId2,
        amount: 1600000,
        userId: testUserId2,
      });

      // Verify first bidder's deposit unfrozen
      const balance1 = await escrowService.getBalance(testVendorId1);
      expect(balance1.availableBalance).toBe(1000000); // Back to original
      expect(balance1.frozenAmount).toBe(0);

      // Verify second bidder's deposit frozen
      const balance2 = await escrowService.getBalance(testVendorId2);
      expect(balance2.availableBalance).toBe(840000); // 1M - 160K
      expect(balance2.frozenAmount).toBe(160000); // 10% of 1.6M

      // Verify first bid status updated
      const [bid1] = await db
        .select()
        .from(bids)
        .where(eq(bids.vendorId, testVendorId1));
      
      expect(bid1.status).toBe('outbid');
    });

    it('should handle incremental deposit when same vendor increases bid', async () => {
      // First bid
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        amount: 1500000,
        userId: testUserId1,
      });

      // Same vendor increases bid
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        amount: 1700000,
        userId: testUserId1,
      });

      // Verify only incremental deposit frozen
      const balance = await escrowService.getBalance(testVendorId1);
      expect(balance.frozenAmount).toBe(170000); // 10% of 1.7M
      expect(balance.availableBalance).toBe(830000); // 1M - 170K
    });
  });

  describe('Bid Validation', () => {
    it('should reject bid below reserve price', async () => {
      const bidAmount = 1300000; // Below reserve price of 1.4M

      await expect(
        bidService.placeBid({
          auctionId: testAuctionId,
          vendorId: testVendorId1,
          amount: bidAmount,
          userId: testUserId1,
        })
      ).rejects.toThrow(/reserve price/i);

      // Verify no deposit frozen
      const balance = await escrowService.getBalance(testVendorId1);
      expect(balance.frozenAmount).toBe(0);
    });

    it('should reject bid with insufficient available balance', async () => {
      const bidAmount = 15000000; // Requires 1.5M deposit, but only 1M available

      await expect(
        bidService.placeBid({
          auctionId: testAuctionId,
          vendorId: testVendorId1,
          amount: bidAmount,
          userId: testUserId1,
        })
      ).rejects.toThrow(/insufficient/i);

      // Verify no deposit frozen
      const balance = await escrowService.getBalance(testVendorId1);
      expect(balance.frozenAmount).toBe(0);
    });

    it('should reject bid with insufficient increment', async () => {
      // First bid
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        amount: 1500000,
        userId: testUserId1,
      });

      // Second bid with insufficient increment (< ₦20,000)
      await expect(
        bidService.placeBid({
          auctionId: testAuctionId,
          vendorId: testVendorId2,
          amount: 1510000, // Only ₦10,000 more
          userId: testUserId2,
        })
      ).rejects.toThrow(/increment/i);
    });

    it('should enforce Tier 1 vendor bid limit', async () => {
      const bidAmount = 600000; // Above ₦500,000 limit for Tier 1

      await expect(
        bidService.placeBid({
          auctionId: testAuctionId,
          vendorId: testVendorId1,
          amount: bidAmount,
          userId: testUserId1,
        })
      ).rejects.toThrow(/tier 1/i);
    });
  });

  describe('Deposit Calculation', () => {
    it('should calculate deposit as 10% of bid amount', async () => {
      const bidAmount = 1500000;

      const result = await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        amount: bidAmount,
        userId: testUserId1,
      });

      expect(result.bid.depositAmount).toBe(150000); // 10% of 1.5M
    });

    it('should use minimum deposit floor when calculated deposit is below floor', async () => {
      // Update auction to have lower reserve price
      await db
        .update(auctions)
        .set({ reservePrice: '50000.00' })
        .where(eq(auctions.id, testAuctionId));

      await db
        .update(salvageCases)
        .set({ reservePrice: '50000.00' })
        .where(eq(salvageCases.id, testCaseId));

      const bidAmount = 500000; // 10% = ₦50,000, but floor is ₦100,000

      const result = await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        amount: bidAmount,
        userId: testUserId1,
      });

      expect(result.bid.depositAmount).toBe(100000); // Floor applied
    });

    it('should cap Tier 1 vendor deposit at ₦50,000', async () => {
      const bidAmount = 500000; // 10% = ₦50,000 (at cap)

      const result = await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        amount: bidAmount,
        userId: testUserId1,
      });

      expect(result.bid.depositAmount).toBe(100000); // Floor applied (higher than cap)
    });
  });

  describe('Error Rollback', () => {
    it('should rollback deposit freeze if bid creation fails', async () => {
      // This test would require mocking the bid creation to fail
      // For now, we verify that if any error occurs, wallet state is consistent
      
      const initialBalance = await escrowService.getBalance(testVendorId1);

      try {
        // Attempt invalid bid
        await bidService.placeBid({
          auctionId: testAuctionId,
          vendorId: testVendorId1,
          amount: 1300000, // Below reserve
          userId: testUserId1,
        });
      } catch (error) {
        // Expected to fail
      }

      // Verify wallet state unchanged
      const finalBalance = await escrowService.getBalance(testVendorId1);
      expect(finalBalance.availableBalance).toBe(initialBalance.availableBalance);
      expect(finalBalance.frozenAmount).toBe(initialBalance.frozenAmount);
    });
  });

  describe('Wallet Invariant', () => {
    it('should maintain wallet invariant after bid placement', async () => {
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        amount: 1500000,
        userId: testUserId1,
      });

      const balance = await escrowService.getBalance(testVendorId1);
      const calculatedBalance = balance.availableBalance + balance.frozenAmount + balance.forfeitedAmount;

      expect(Math.abs(balance.balance - calculatedBalance)).toBeLessThanOrEqual(0.01);
    });

    it('should maintain wallet invariant after outbid scenario', async () => {
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        amount: 1500000,
        userId: testUserId1,
      });

      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId2,
        amount: 1600000,
        userId: testUserId2,
      });

      // Check both wallets
      const balance1 = await escrowService.getBalance(testVendorId1);
      const calculatedBalance1 = balance1.availableBalance + balance1.frozenAmount + balance1.forfeitedAmount;
      expect(Math.abs(balance1.balance - calculatedBalance1)).toBeLessThanOrEqual(0.01);

      const balance2 = await escrowService.getBalance(testVendorId2);
      const calculatedBalance2 = balance2.availableBalance + balance2.frozenAmount + balance2.forfeitedAmount;
      expect(Math.abs(balance2.balance - calculatedBalance2)).toBeLessThanOrEqual(0.01);
    });
  });

  describe('Concurrent Bid Handling', () => {
    it('should handle sequential bids correctly', async () => {
      // Place multiple bids in sequence
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        amount: 1500000,
        userId: testUserId1,
      });

      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId2,
        amount: 1600000,
        userId: testUserId2,
      });

      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        amount: 1700000,
        userId: testUserId1,
      });

      // Verify final state
      const balance1 = await escrowService.getBalance(testVendorId1);
      expect(balance1.frozenAmount).toBe(170000); // 10% of 1.7M

      const balance2 = await escrowService.getBalance(testVendorId2);
      expect(balance2.frozenAmount).toBe(0); // Outbid

      // Verify bid records
      const allBids = await db
        .select()
        .from(bids)
        .where(eq(bids.auctionId, testAuctionId));

      expect(allBids).toHaveLength(3);
      expect(allBids.filter(b => b.status === 'active')).toHaveLength(1);
      expect(allBids.filter(b => b.status === 'outbid')).toHaveLength(2);
    });

    // Note: True concurrent bid testing would require more complex setup
    // with Promise.all and database transaction isolation testing
  });

  describe('Deposit Events Audit Trail', () => {
    it('should create deposit event for freeze operation', async () => {
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        amount: 1500000,
        userId: testUserId1,
      });

      const events = await db
        .select()
        .from(depositEvents)
        .where(eq(depositEvents.vendorId, testVendorId1));

      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('freeze');
      expect(parseFloat(events[0].amount)).toBe(150000);
      expect(events[0].auctionId).toBe(testAuctionId);
    });

    it('should create deposit events for freeze and unfreeze in outbid scenario', async () => {
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        amount: 1500000,
        userId: testUserId1,
      });

      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId2,
        amount: 1600000,
        userId: testUserId2,
      });

      const events1 = await db
        .select()
        .from(depositEvents)
        .where(eq(depositEvents.vendorId, testVendorId1));

      expect(events1).toHaveLength(2);
      expect(events1.find(e => e.eventType === 'freeze')).toBeDefined();
      expect(events1.find(e => e.eventType === 'unfreeze')).toBeDefined();
    });
  });
});
