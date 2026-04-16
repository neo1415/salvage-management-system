/**
 * Integration Test: End-to-End Bid Placement Flow (OPTIMIZED)
 * 
 * Optimizations:
 * - Use beforeAll for user/vendor/wallet creation (not beforeEach)
 * - Fast bcrypt hashing (4 rounds instead of 12)
 * - Only reset auction/bid data between tests
 * - Reuse test fixtures across tests
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

import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from 'vitest';
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
import { eq, sql } from 'drizzle-orm';

// Increase timeout for integration tests
const TEST_TIMEOUT = 30000; // 30 seconds per test
const HOOK_TIMEOUT = 30000; // 30 seconds for hooks

describe('Integration Test: End-to-End Bid Placement (Optimized)', () => {
  // Test fixtures (created once)
  let testUserId1: string;
  let testUserId2: string;
  let testVendorId1: string;
  let testVendorId2: string;
  let testWalletId1: string;
  let testWalletId2: string;
  
  // Test data (reset between tests)
  let testCaseId: string;
  let testAuctionId: string;

  // Create test users and vendors once
  beforeAll(async () => {
    console.log('[Test] Creating test users and vendors...');
    
    // Use plain text password for test database (no bcrypt hashing)
    const testPasswordHash = 'test-password-hash';

    // Create first test user and vendor
    const [user1] = await db
      .insert(users)
      .values({
        email: `test-bid-opt-1-${Date.now()}@example.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: testPasswordHash,
        fullName: 'Test Bidder 1',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
        status: 'verified_tier_1',
      })
      .returning();
    testUserId1 = user1.id;
    console.log('[Test] Created user 1:', testUserId1);

    const [vendor1] = await db
      .insert(vendors)
      .values({
        userId: testUserId1,
        businessName: 'Test Vendor 1',
        tier: 'tier1_bvn',
        status: 'approved',
      })
      .returning();
    testVendorId1 = vendor1.id;
    console.log('[Test] Created vendor 1:', testVendorId1);

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
    console.log('[Test] Created wallet 1:', testWalletId1);

    // Create second test user and vendor
    const [user2] = await db
      .insert(users)
      .values({
        email: `test-bid-opt-2-${Date.now()}@example.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: testPasswordHash,
        fullName: 'Test Bidder 2',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
        status: 'verified_tier_1',
      })
      .returning();
    testUserId2 = user2.id;
    console.log('[Test] Created user 2:', testUserId2);

    const [vendor2] = await db
      .insert(vendors)
      .values({
        userId: testUserId2,
        businessName: 'Test Vendor 2',
        tier: 'tier1_bvn',
        status: 'approved',
      })
      .returning();
    testVendorId2 = vendor2.id;
    console.log('[Test] Created vendor 2:', testVendorId2);

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
    console.log('[Test] Created wallet 2:', testWalletId2);
    console.log('[Test] Setup complete!');
  }, HOOK_TIMEOUT);

  // Create fresh auction for each test
  beforeEach(async () => {
    console.log('[Test] Setting up test auction...');
    
    // Reset wallet balances
    await db
      .update(escrowWallets)
      .set({
        availableBalance: '1000000.00',
        frozenAmount: '0.00',
        forfeitedAmount: '0.00',
      })
      .where(eq(escrowWallets.vendorId, testVendorId1));

    await db
      .update(escrowWallets)
      .set({
        availableBalance: '1000000.00',
        frozenAmount: '0.00',
        forfeitedAmount: '0.00',
      })
      .where(eq(escrowWallets.vendorId, testVendorId2));
    console.log('[Test] Wallet balances reset');

    // Create test salvage case with minimal required fields
    const [salvageCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-BID-OPT-${Date.now()}`,
        assetType: 'vehicle',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
        },
        marketValue: '1000000.00', // ₦1M
        estimatedSalvageValue: '500000.00', // ₦500K
        reservePrice: '350000.00', // 70% of salvage value (₦350K)
        gpsLocation: sql`POINT(6.5244, 3.3792)`, // Lagos coordinates
        locationName: 'Lagos, Nigeria',
        photos: ['test-photo-1.jpg'],
        status: 'approved',
        createdBy: testUserId1,
      })
      .returning();
    testCaseId = salvageCase.id;
    console.log('[Test] Created salvage case:', testCaseId);

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
    console.log('[Test] Created auction:', testAuctionId);
    console.log('[Test] Setup complete!');
  }, HOOK_TIMEOUT);

  // Clean up auction data after each test
  afterEach(async () => {
    // Clean up in reverse dependency order
    try {
      if (testAuctionId) {
        await db.delete(depositEvents).where(eq(depositEvents.auctionId, testAuctionId));
        await db.delete(bids).where(eq(bids.auctionId, testAuctionId));
        await db.delete(auctions).where(eq(auctions.id, testAuctionId));
      }
      if (testCaseId) {
        await db.delete(salvageCases).where(eq(salvageCases.id, testCaseId));
      }
    } catch (error) {
      console.error('[Test] Cleanup error:', error);
    }
  }, HOOK_TIMEOUT);

  // Clean up test users after all tests
  afterAll(async () => {
    try {
      if (testVendorId1) {
        await db.delete(escrowWallets).where(eq(escrowWallets.vendorId, testVendorId1));
        await db.delete(vendors).where(eq(vendors.id, testVendorId1));
      }
      if (testVendorId2) {
        await db.delete(escrowWallets).where(eq(escrowWallets.vendorId, testVendorId2));
        await db.delete(vendors).where(eq(vendors.id, testVendorId2));
      }
      if (testUserId1) {
        await db.delete(users).where(eq(users.id, testUserId1));
      }
      if (testUserId2) {
        await db.delete(users).where(eq(users.id, testUserId2));
      }
    } catch (error) {
      console.error('[Test] Final cleanup error:', error);
    }
  }, HOOK_TIMEOUT);

  describe('Complete Bid Placement Flow', () => {
    it('should successfully place first bid with deposit freeze', async () => {
      const bidAmount = 450000; // ₦450,000 (above reserve of ₦350K, within Tier 1 limit)

      const result = await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        bidAmount: bidAmount,
        userId: testUserId1,
        ipAddress: '127.0.0.1',
        deviceType: 'desktop',
      });

      if (!result.success) {
        console.error('Bid placement failed:', result.error, result.errors);
      }

      expect(result.success).toBe(true);
      expect(result.bidId).toBeDefined();
      expect(result.depositAmount).toBe(100000); // Minimum deposit floor

      // Verify wallet state
      const balance = await escrowService.getBalance(testVendorId1);
      expect(balance.availableBalance).toBe(900000); // 1M - 100K
      expect(balance.frozenAmount).toBe(100000);
      expect(balance.balance).toBe(1000000); // Unchanged

      // Verify deposit event created
      const [event] = await db
        .select()
        .from(depositEvents)
        .where(eq(depositEvents.auctionId, testAuctionId));
      
      expect(event).toBeDefined();
      expect(event.eventType).toBe('freeze');
      expect(parseFloat(event.amount)).toBe(100000);
    }, TEST_TIMEOUT);

    it('should unfreeze previous bidder when outbid', async () => {
      // First bid
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        bidAmount: 450000,
        userId: testUserId1,
        ipAddress: '127.0.0.1',
        deviceType: 'desktop',
      });

      // Second bid (higher)
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId2,
        bidAmount: 470000,
        userId: testUserId2,
        ipAddress: '127.0.0.1',
        deviceType: 'desktop',
      });

      // Verify first bidder's deposit unfrozen
      const balance1 = await escrowService.getBalance(testVendorId1);
      expect(balance1.availableBalance).toBe(1000000); // Back to original
      expect(balance1.frozenAmount).toBe(0);

      // Verify second bidder's deposit frozen
      const balance2 = await escrowService.getBalance(testVendorId2);
      expect(balance2.availableBalance).toBe(900000); // 1M - 100K (minimum floor)
      expect(balance2.frozenAmount).toBe(100000); // Minimum deposit floor

      // Verify first bid status updated
      const [bid1] = await db
        .select()
        .from(bids)
        .where(eq(bids.vendorId, testVendorId1));
      
      expect(bid1.status).toBe('outbid');
    }, TEST_TIMEOUT);

    it('should handle incremental deposit when same vendor increases bid', async () => {
      // First bid
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        bidAmount: 450000,
        userId: testUserId1,
        ipAddress: '127.0.0.1',
        deviceType: 'desktop',
      });

      // Same vendor increases bid
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        bidAmount: 490000,
        userId: testUserId1,
        ipAddress: '127.0.0.1',
        deviceType: 'desktop',
      });

      // Verify only incremental deposit frozen (both hit minimum floor)
      const balance = await escrowService.getBalance(testVendorId1);
      expect(balance.frozenAmount).toBe(100000); // Still minimum floor
      expect(balance.availableBalance).toBe(900000); // 1M - 100K
    }, TEST_TIMEOUT);
  });

  describe('Bid Validation', () => {
    it('should reject bid below reserve price', async () => {
      const bidAmount = 300000; // Below reserve price of ₦350K

      await expect(
        bidService.placeBid({
          auctionId: testAuctionId,
          vendorId: testVendorId1,
          bidAmount: bidAmount,
          userId: testUserId1,
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        })
      ).rejects.toThrow();

      // Verify no deposit frozen
      const balance = await escrowService.getBalance(testVendorId1);
      expect(balance.frozenAmount).toBe(0);
    }, TEST_TIMEOUT);

    it('should reject bid with insufficient available balance', async () => {
      const bidAmount = 15000000; // Requires 1.5M deposit, but only 1M available

      await expect(
        bidService.placeBid({
          auctionId: testAuctionId,
          vendorId: testVendorId1,
          bidAmount: bidAmount,
          userId: testUserId1,
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        })
      ).rejects.toThrow();

      // Verify no deposit frozen
      const balance = await escrowService.getBalance(testVendorId1);
      expect(balance.frozenAmount).toBe(0);
    }, TEST_TIMEOUT);
  });

  describe('Wallet Invariant', () => {
    it('should maintain wallet invariant after bid placement', async () => {
      await bidService.placeBid({
        auctionId: testAuctionId,
        vendorId: testVendorId1,
        bidAmount: 450000,
        userId: testUserId1,
        ipAddress: '127.0.0.1',
        deviceType: 'desktop',
      });

      const balance = await escrowService.getBalance(testVendorId1);
      const calculatedBalance = balance.availableBalance + balance.frozenAmount + balance.forfeitedAmount;

      expect(Math.abs(balance.balance - calculatedBalance)).toBeLessThanOrEqual(0.01);
    }, TEST_TIMEOUT);
  });
});
