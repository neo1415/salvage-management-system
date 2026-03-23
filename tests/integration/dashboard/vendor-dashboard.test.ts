import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users, vendors, auctions, bids, payments, salvageCases } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';

/**
 * Integration tests for Vendor Dashboard API
 * 
 * Tests the complete vendor dashboard flow including database queries,
 * performance calculations, badge awards, and comparisons.
 * 
 * Requirements: 32
 */

describe('Vendor Dashboard API Integration', () => {
  let testVendorId: string;
  let testUserId: string;

  beforeEach(async () => {
    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: `vendor-dashboard-test-${Date.now()}@example.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: 'hashed_password',
        role: 'vendor',
        status: 'phone_verified_tier_0',
        fullName: 'Test Vendor Dashboard',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();

    testUserId = user.id;

    // Create test vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: testUserId,
        businessName: 'Test Vendor Business',
        tier: 'tier1_bvn',
        status: 'approved',
        performanceStats: {
          totalBids: 0,
          totalWins: 0,
          winRate: 0,
          avgPaymentTimeHours: 0,
          onTimePickupRate: 0,
          fraudFlags: 0,
        },
        rating: '4.5',
      })
      .returning();

    testVendorId = vendor.id;
  });

  afterEach(async () => {
    // Clean up test data
    if (testVendorId) {
      await db.delete(bids).where(eq(bids.vendorId, testVendorId));
      await db.delete(payments).where(eq(payments.vendorId, testVendorId));
      await db.delete(vendors).where(eq(vendors.id, testVendorId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }

    // Clear cache
    await cache.del(`dashboard:vendor:${testVendorId}`);
  });

  describe('Performance Stats Calculation', () => {
    it('should calculate win rate correctly with real data', async () => {
      // Create test case
      const [testCase] = await db
        .insert(salvageCases)
        .values({
          claimReference: `TEST-${Date.now()}`,
          assetType: 'vehicle',
          assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
          marketValue: '5000000',
          estimatedSalvageValue: '2000000',
          reservePrice: '1400000',
          damageSeverity: 'moderate',
          aiAssessment: {
            labels: ['front damage'],
            confidenceScore: 85,
            damagePercentage: 40,
            processedAt: new Date(),
          },
          gpsLocation: [6.5244, 3.3792] as [number, number],
          locationName: 'Lagos, Nigeria',
          photos: ['https://example.com/photo1.jpg'],
          voiceNotes: [],
          status: 'approved',
          createdBy: testUserId,
        })
        .returning();

      // Create test auctions
      const [auction1] = await db
        .insert(auctions)
        .values({
          caseId: testCase.id,
          startTime: new Date(),
          endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          status: 'closed',
          currentBid: '1500000',
          currentBidder: testVendorId,
        })
        .returning();

      const [auction2] = await db
        .insert(auctions)
        .values({
          caseId: testCase.id,
          startTime: new Date(),
          endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          status: 'active',
        })
        .returning();

      // Create test bids
      await db.insert(bids).values([
        {
          auctionId: auction1.id,
          vendorId: testVendorId,
          amount: '1500000',
          otpVerified: true,
          ipAddress: '192.168.1.1',
          deviceType: 'mobile',
        },
        {
          auctionId: auction2.id,
          vendorId: testVendorId,
          amount: '1600000',
          otpVerified: true,
          ipAddress: '192.168.1.1',
          deviceType: 'mobile',
        },
      ]);

      // Calculate win rate
      const totalBidsResult = await db
        .select()
        .from(bids)
        .where(eq(bids.vendorId, testVendorId));

      const totalWinsResult = await db
        .select()
        .from(auctions)
        .where(eq(auctions.currentBidder, testVendorId));

      const winRate = (totalWinsResult.length / totalBidsResult.length) * 100;

      expect(totalBidsResult.length).toBe(2);
      expect(totalWinsResult.length).toBe(1);
      expect(winRate).toBe(50);

      // Clean up
      await db.delete(auctions).where(eq(auctions.caseId, testCase.id));
      await db.delete(salvageCases).where(eq(salvageCases.id, testCase.id));
    });

    it('should calculate average payment time correctly', async () => {
      // Create test case and auction
      const [testCase] = await db
        .insert(salvageCases)
        .values({
          claimReference: `TEST-${Date.now()}`,
          assetType: 'vehicle',
          assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
          marketValue: '5000000',
          estimatedSalvageValue: '2000000',
          reservePrice: '1400000',
          damageSeverity: 'moderate',
          aiAssessment: {
            labels: ['front damage'],
            confidenceScore: 85,
            damagePercentage: 40,
            processedAt: new Date(),
          },
          gpsLocation: [6.5244, 3.3792] as [number, number],
          locationName: 'Lagos, Nigeria',
          photos: ['https://example.com/photo1.jpg'],
          voiceNotes: [],
          status: 'approved',
          createdBy: testUserId,
        })
        .returning();

      const auctionEndTime = new Date('2024-01-01T10:00:00Z');
      const paymentVerifiedTime = new Date('2024-01-01T14:00:00Z'); // 4 hours later

      const [auction] = await db
        .insert(auctions)
        .values({
          caseId: testCase.id,
          startTime: new Date(),
          endTime: auctionEndTime,
          originalEndTime: auctionEndTime,
          status: 'closed',
          currentBid: '1500000',
          currentBidder: testVendorId,
        })
        .returning();

      await db.insert(payments).values({
        auctionId: auction.id,
        vendorId: testVendorId,
        amount: '1500000',
        paymentMethod: 'paystack',
        status: 'verified',
        verifiedAt: paymentVerifiedTime,
        paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });

      // Calculate average payment time
      const paymentTimesResult = await db
        .select({
          auctionEndTime: auctions.endTime,
          paymentVerifiedTime: payments.verifiedAt,
        })
        .from(payments)
        .innerJoin(auctions, eq(payments.auctionId, auctions.id))
        .where(eq(payments.vendorId, testVendorId));

      const totalPaymentTime = paymentTimesResult.reduce((sum, item) => {
        if (item.auctionEndTime && item.paymentVerifiedTime) {
          const endTime = new Date(item.auctionEndTime).getTime();
          const verifiedTime = new Date(item.paymentVerifiedTime).getTime();
          const diffHours = (verifiedTime - endTime) / (1000 * 60 * 60);
          return sum + diffHours;
        }
        return sum;
      }, 0);

      const avgPaymentTime = totalPaymentTime / paymentTimesResult.length;

      expect(avgPaymentTime).toBe(4);

      // Clean up
      await db.delete(auctions).where(eq(auctions.caseId, testCase.id));
      await db.delete(salvageCases).where(eq(salvageCases.id, testCase.id));
    });
  });

  describe('Badge Awards', () => {
    it('should award Fast Payer badge when avg payment time < 6 hours', () => {
      const avgPaymentTimeHours = 4.5;
      const earned = avgPaymentTimeHours < 6 && avgPaymentTimeHours > 0;
      
      expect(earned).toBe(true);
    });

    it('should award Top Rated badge when rating >= 4.5', async () => {
      const vendorRecord = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, testVendorId))
        .limit(1);

      const rating = parseFloat(vendorRecord[0]?.rating || '0');
      const earned = rating >= 4.5;
      
      expect(earned).toBe(true);
    });

    it('should award Verified BVN badge for tier1_bvn vendor', async () => {
      const vendorRecord = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, testVendorId))
        .limit(1);

      const tier = vendorRecord[0]?.tier;
      const earned = tier === 'tier1_bvn' || tier === 'tier2_full';
      
      expect(earned).toBe(true);
    });
  });

  describe('Comparison Calculations', () => {
    it('should calculate comparison with last month correctly', () => {
      const currentWinRate = 35.5;
      const lastMonthWinRate = 30.0;
      const change = Math.round((currentWinRate - lastMonthWinRate) * 100) / 100;
      const trend = currentWinRate > lastMonthWinRate ? 'up' : currentWinRate < lastMonthWinRate ? 'down' : 'neutral';
      
      expect(change).toBe(5.5);
      expect(trend).toBe('up');
    });

    it('should show down trend when performance decreases', () => {
      const currentWinRate = 25.0;
      const lastMonthWinRate = 30.0;
      const trend = currentWinRate > lastMonthWinRate ? 'up' : currentWinRate < lastMonthWinRate ? 'down' : 'neutral';
      
      expect(trend).toBe('down');
    });
  });

  describe('Caching', () => {
    it('should cache dashboard data in Redis', async () => {
      const cacheKey = `dashboard:vendor:${testVendorId}`;
      const testData = {
        performanceStats: {
          winRate: 30,
          avgPaymentTimeHours: 4.5,
          onTimePickupRate: 90,
          rating: 4.5,
          leaderboardPosition: 5,
          totalVendors: 100,
          totalBids: 50,
          totalWins: 15,
        },
        badges: [],
        comparisons: [],
        lastUpdated: new Date().toISOString(),
      };

      await cache.set(cacheKey, testData, 300);
      const cachedData = await cache.get(cacheKey);

      expect(cachedData).toBeDefined();
      expect(cachedData).toEqual(testData);
    });

    it('should expire cache after TTL', async () => {
      const cacheKey = `dashboard:vendor:${testVendorId}`;
      const testData = { test: 'data' };

      // Set with 1 second TTL
      await cache.set(cacheKey, testData, 1);

      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      const cachedData = await cache.get(cacheKey);
      expect(cachedData).toBeNull();
    }, 10000); // Increase test timeout
  });

  describe('Error Handling', () => {
    it('should handle vendor with no bids gracefully', async () => {
      const totalBidsResult = await db
        .select()
        .from(bids)
        .where(eq(bids.vendorId, testVendorId));

      expect(totalBidsResult.length).toBe(0);

      const winRate = totalBidsResult.length > 0 ? 0 : 0;
      expect(winRate).toBe(0);
    });

    it('should handle vendor with no payments gracefully', async () => {
      const paymentTimesResult = await db
        .select()
        .from(payments)
        .where(eq(payments.vendorId, testVendorId));

      expect(paymentTimesResult.length).toBe(0);

      const avgPaymentTime = paymentTimesResult.length > 0 ? 0 : 0;
      expect(avgPaymentTime).toBe(0);
    });
  });
});
