/**
 * Unit Tests for Auction Closure Service (Deposit System)
 * 
 * Tests Requirements:
 * - Requirement 5.1: Identify top N bidders (default 3)
 * - Requirement 5.2: Keep deposits frozen for top N bidders
 * - Requirement 5.3: Unfreeze deposits for bidders ranked below top N
 * - Requirement 5.4: Handle auctions with fewer than N bidders
 * - Requirement 5.5: Update auction status to "closed"
 * - Requirement 5.6: Record winner in auction_winners table with rank
 * 
 * Edge Cases:
 * - Auctions with no bids
 * - Auctions with fewer than N bidders
 * - Auctions with exactly N bidders
 * - Auctions with many bidders (100+)
 * - Multiple bids from same vendor (should use highest)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctionWinners } from '@/lib/db/schema/auction-deposit';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { eq } from 'drizzle-orm';
import { auctionClosureService } from '@/features/auctions/services/auction-closure.service';

describe('AuctionClosureService', () => {
  let testAuctionId: string;
  let testCaseId: string;
  let testUserIds: string[] = [];
  let testVendorIds: string[] = [];

  beforeEach(async () => {
    // Clean up test data
    await db.delete(auctionWinners);
    await db.delete(bids);
    await db.delete(auctions);
    await db.delete(escrowWallets);
    await db.delete(vendors);
    await db.delete(users);
    await db.delete(salvageCases);

    // Create test case
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-CLOSURE-${Date.now()}`,
        assetType: 'vehicle',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          vin: 'VIN123',
        },
        marketValue: '5000000.00',
        estimatedSalvageValue: '2000000.00',
        reservePrice: '1500000.00',
        damageSeverity: 'moderate',
        gpsLocation: [3.3792, 6.5244],
        locationName: 'Lagos, Nigeria',
        photos: ['test-photo.jpg'],
        status: 'approved',
        createdBy: '00000000-0000-0000-0000-000000000001', // Placeholder
      })
      .returning();
    testCaseId = testCase.id;

    // Create test auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCaseId,
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        endTime: new Date(Date.now() - 1000), // 1 second ago (ended)
        originalEndTime: new Date(Date.now() - 1000),
        status: 'active',
        minimumIncrement: '10000.00',
      })
      .returning();
    testAuctionId = auction.id;

    // Create test users and vendors
    testUserIds = [];
    testVendorIds = [];
    for (let i = 0; i < 10; i++) {
      const [user] = await db
        .insert(users)
        .values({
          email: `vendor${i + 1}-${Date.now()}@test.com`,
          phone: `+234${String(i).padStart(10, '0')}`,
          fullName: `Test Vendor ${i + 1}`,
          dateOfBirth: new Date('1990-01-01'),
          role: 'vendor',
          status: 'verified_tier_1',
          passwordHash: 'test-hash',
        })
        .returning();
      testUserIds.push(user.id);

      const [vendor] = await db
        .insert(vendors)
        .values({
          userId: user.id,
          tier: 'tier1_bvn',
          status: 'approved',
        })
        .returning();
      testVendorIds.push(vendor.id);

      // Create escrow wallet for each vendor
      await db.insert(escrowWallets).values({
        vendorId: vendor.id,
        balance: '1000000.00', // ₦1,000,000
        availableBalance: '500000.00', // ₦500,000 available
        frozenAmount: '500000.00', // ₦500,000 frozen
        forfeitedAmount: '0.00',
      });
    }
  });

  describe('closeAuction - Basic Functionality', () => {
    it('should close auction with no bids', async () => {
      // No bids created

      const result = await auctionClosureService.closeAuction(testAuctionId);

      expect(result.success).toBe(true);
      expect(result.auctionId).toBe(testAuctionId);
      expect(result.winnerId).toBeUndefined();
      expect(result.topBiddersCount).toBe(0);
      expect(result.unfrozenBiddersCount).toBe(0);

      // Verify auction status updated to closed
      const [auction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, testAuctionId));
      expect(auction.status).toBe('closed');

      // Verify no winners recorded
      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId));
      expect(winners).toHaveLength(0);
    });

    it('should close auction with 1 bidder (fewer than N)', async () => {
      // Create 1 bid
      await db.insert(bids).values({
        auctionId: testAuctionId,
        vendorId: testVendorIds[0],
        amount: '5000000.00',
        ipAddress: '127.0.0.1',
        deviceType: 'desktop',
      });

      const result = await auctionClosureService.closeAuction(testAuctionId, 3);

      expect(result.success).toBe(true);
      expect(result.winnerId).toBe(testVendorIds[0]);
      expect(result.winningBid).toBe(5000000);
      expect(result.topBiddersCount).toBe(1); // Only 1 bidder, so only 1 kept frozen
      expect(result.unfrozenBiddersCount).toBe(0);

      // Verify winner recorded with rank 1
      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId));
      expect(winners).toHaveLength(1);
      expect(winners[0].vendorId).toBe(testVendorIds[0]);
      expect(winners[0].rank).toBe(1);
      expect(winners[0].status).toBe('active');
    });

    it('should close auction with 2 bidders (fewer than N=3)', async () => {
      // Create 2 bids
      await db.insert(bids).values([
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[0],
          amount: '5000000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[1],
          amount: '4500000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
      ]);

      const result = await auctionClosureService.closeAuction(testAuctionId, 3);

      expect(result.success).toBe(true);
      expect(result.winnerId).toBe(testVendorIds[0]);
      expect(result.topBiddersCount).toBe(2); // Both kept frozen
      expect(result.unfrozenBiddersCount).toBe(0);

      // Verify both recorded as top bidders
      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId));
      expect(winners).toHaveLength(2);
      expect(winners[0].rank).toBe(1);
      expect(winners[1].rank).toBe(2);
    });

    it('should close auction with exactly N=3 bidders', async () => {
      // Create exactly 3 bids
      await db.insert(bids).values([
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[0],
          amount: '5000000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[1],
          amount: '4800000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[2],
          amount: '4600000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
      ]);

      const result = await auctionClosureService.closeAuction(testAuctionId, 3);

      expect(result.success).toBe(true);
      expect(result.winnerId).toBe(testVendorIds[0]);
      expect(result.topBiddersCount).toBe(3); // All 3 kept frozen
      expect(result.unfrozenBiddersCount).toBe(0); // None unfrozen

      // Verify all 3 recorded with correct ranks
      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId));
      expect(winners).toHaveLength(3);
      expect(winners[0].rank).toBe(1);
      expect(winners[1].rank).toBe(2);
      expect(winners[2].rank).toBe(3);
    });

    it('should close auction with 5 bidders (more than N=3)', async () => {
      // Create 5 bids
      await db.insert(bids).values([
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[0],
          amount: '5000000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[1],
          amount: '4800000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[2],
          amount: '4600000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[3],
          amount: '4400000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[4],
          amount: '4200000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
      ]);

      const result = await auctionClosureService.closeAuction(testAuctionId, 3);

      expect(result.success).toBe(true);
      expect(result.winnerId).toBe(testVendorIds[0]);
      expect(result.topBiddersCount).toBe(3); // Top 3 kept frozen
      expect(result.unfrozenBiddersCount).toBe(2); // Bottom 2 unfrozen

      // Verify only top 3 recorded
      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId));
      expect(winners).toHaveLength(3);
      expect(winners[0].vendorId).toBe(testVendorIds[0]);
      expect(winners[1].vendorId).toBe(testVendorIds[1]);
      expect(winners[2].vendorId).toBe(testVendorIds[2]);
    });
  });

  describe('closeAuction - Edge Cases', () => {
    it('should handle auction with 100+ bids from 10 vendors', async () => {
      // Create 100 bids (using 10 vendors, each bidding 10 times)
      const bidValues = [];
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          bidValues.push({
            auctionId: testAuctionId,
            vendorId: testVendorIds[i],
            amount: (5000000 - i * 100000 - j * 10000).toFixed(2),
            ipAddress: '127.0.0.1',
            deviceType: 'desktop' as const,
          });
        }
      }
      await db.insert(bids).values(bidValues);

      const result = await auctionClosureService.closeAuction(testAuctionId, 3);

      expect(result.success).toBe(true);
      expect(result.topBiddersCount).toBe(3);
      expect(result.unfrozenBiddersCount).toBe(7); // 10 unique vendors - 3 top = 7 unfrozen

      // Verify only top 3 recorded
      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId));
      expect(winners).toHaveLength(3);
    });

    it('should use highest bid per vendor when vendor bids multiple times', async () => {
      // Vendor 0 bids 3 times
      await db.insert(bids).values([
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[0],
          amount: '4000000.00', // Lower bid
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[0],
          amount: '5000000.00', // Highest bid
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[0],
          amount: '4500000.00', // Middle bid
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[1],
          amount: '4800000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
      ]);

      const result = await auctionClosureService.closeAuction(testAuctionId, 3);

      expect(result.success).toBe(true);
      expect(result.winnerId).toBe(testVendorIds[0]);
      expect(result.winningBid).toBe(5000000); // Highest bid used

      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId));
      expect(winners).toHaveLength(2);
      expect(winners[0].bidAmount).toBe('5000000.00');
    });

    it('should handle custom topBiddersToKeepFrozen parameter', async () => {
      // Create 10 bids
      const bidValues = [];
      for (let i = 0; i < 10; i++) {
        bidValues.push({
          auctionId: testAuctionId,
          vendorId: testVendorIds[i],
          amount: (5000000 - i * 100000).toFixed(2),
          ipAddress: '127.0.0.1',
          deviceType: 'desktop' as const,
        });
      }
      await db.insert(bids).values(bidValues);

      // Keep top 5 frozen instead of default 3
      const result = await auctionClosureService.closeAuction(testAuctionId, 5);

      expect(result.success).toBe(true);
      expect(result.topBiddersCount).toBe(5);
      expect(result.unfrozenBiddersCount).toBe(5);

      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId));
      expect(winners).toHaveLength(5);
    });

    it('should fail gracefully for non-existent auction', async () => {
      const fakeAuctionId = '00000000-0000-0000-0000-000000000000';

      const result = await auctionClosureService.closeAuction(fakeAuctionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Auction not found');
    });

    it('should fail gracefully for already closed auction', async () => {
      // Update auction to closed status
      await db
        .update(auctions)
        .set({ status: 'closed' })
        .where(eq(auctions.id, testAuctionId));

      const result = await auctionClosureService.closeAuction(testAuctionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });
  });

  describe('getTopBidders', () => {
    it('should return empty array for auction with no winners', async () => {
      const topBidders = await auctionClosureService.getTopBidders(testAuctionId);

      expect(topBidders).toHaveLength(0);
    });

    it('should return top bidders in rank order', async () => {
      // Create bids and close auction
      await db.insert(bids).values([
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[0],
          amount: '5000000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[1],
          amount: '4800000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[2],
          amount: '4600000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
      ]);

      await auctionClosureService.closeAuction(testAuctionId, 3);

      const topBidders = await auctionClosureService.getTopBidders(testAuctionId);

      expect(topBidders).toHaveLength(3);
      expect(topBidders[0].rank).toBe(1);
      expect(topBidders[0].vendorId).toBe(testVendorIds[0]);
      expect(topBidders[0].bidAmount).toBe(5000000);
      expect(topBidders[1].rank).toBe(2);
      expect(topBidders[2].rank).toBe(3);
    });
  });

  describe('getWinner', () => {
    it('should return null for auction with no winner', async () => {
      const winner = await auctionClosureService.getWinner(testAuctionId);

      expect(winner).toBeNull();
    });

    it('should return winner (rank 1) for closed auction', async () => {
      // Create bids and close auction
      await db.insert(bids).values([
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[0],
          amount: '5000000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[1],
          amount: '4800000.00',
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
      ]);

      await auctionClosureService.closeAuction(testAuctionId, 3);

      const winner = await auctionClosureService.getWinner(testAuctionId);

      expect(winner).not.toBeNull();
      expect(winner?.rank).toBe(1);
      expect(winner?.vendorId).toBe(testVendorIds[0]);
      expect(winner?.bidAmount).toBe(5000000);
    });
  });

  describe('Deposit Calculations', () => {
    it('should calculate correct deposit amounts for top bidders', async () => {
      // Create bids
      await db.insert(bids).values([
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[0],
          amount: '5000000.00', // 10% = ₦500,000
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[1],
          amount: '3000000.00', // 10% = ₦300,000
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
        {
          auctionId: testAuctionId,
          vendorId: testVendorIds[2],
          amount: '500000.00', // 10% = ₦50,000 < floor, so ₦100,000
          ipAddress: '127.0.0.1',
          deviceType: 'desktop',
        },
      ]);

      await auctionClosureService.closeAuction(testAuctionId, 3);

      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, testAuctionId));

      expect(winners[0].depositAmount).toBe('500000.00');
      expect(winners[1].depositAmount).toBe('300000.00');
      expect(winners[2].depositAmount).toBe('100000.00'); // Floor applied
    });
  });
});
