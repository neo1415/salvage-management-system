import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, sql } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';

/**
 * Integration tests for Vendor Leaderboard
 * 
 * Tests the complete leaderboard flow including:
 * - Database queries
 * - Cache management
 * - Ranking logic
 * - Weekly updates
 */

describe('Vendor Leaderboard Integration', () => {
  let testUserIds: string[] = [];
  let testVendorIds: string[] = [];
  let testCaseIds: string[] = [];
  let testAuctionIds: string[] = [];

  beforeAll(async () => {
    // Clean up any existing test data
    await cache.del('leaderboard:monthly');

    // Create test users and vendors
    for (let i = 1; i <= 3; i++) {
      const [user] = await db
        .insert(users)
        .values({
          email: `leaderboard-test-${i}@example.com`,
          phone: `+23480${1000000 + i}`,
          passwordHash: 'hashed_password',
          role: 'vendor',
          status: 'verified_tier_1',
          fullName: `Test Vendor ${i}`,
          dateOfBirth: new Date('1990-01-01'),
        })
        .returning();

      testUserIds.push(user.id);

      const [vendor] = await db
        .insert(vendors)
        .values({
          userId: user.id,
          businessName: `Business ${i}`,
          tier: i === 1 ? 'tier2_full' : 'tier1_bvn',
          status: 'approved',
          performanceStats: {
            totalBids: 10 * i,
            totalWins: 5 * i,
            winRate: 50,
            avgPaymentTimeHours: 4,
            onTimePickupRate: 90 + i,
            fraudFlags: 0,
          },
          rating: `${4 + i * 0.1}`,
        })
        .returning();

      testVendorIds.push(vendor.id);
    }

    // Create test cases and auctions
    for (let i = 0; i < testVendorIds.length; i++) {
      const [testCase] = await db
        .insert(salvageCases)
        .values({
          claimReference: `CLAIM-LEADERBOARD-${i + 1}`,
          assetType: 'vehicle',
          assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
          marketValue: '1000000.00',
          estimatedSalvageValue: '500000.00',
          reservePrice: '350000.00',
          damageSeverity: 'moderate',
          aiAssessment: {
            labels: ['front damage'],
            confidenceScore: 85,
            damagePercentage: 40,
            processedAt: new Date(),
          },
          gpsLocation: sql`point(3.3792, 6.5244)`,
          locationName: 'Lagos, Nigeria',
          photos: ['https://example.com/photo1.jpg'],
          voiceNotes: [],
          status: 'approved',
          createdBy: testUserIds[0],
        })
        .returning();

      testCaseIds.push(testCase.id);

      const [auction] = await db
        .insert(auctions)
        .values({
          caseId: testCase.id,
          startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
          endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          originalEndTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          currentBid: `${(i + 1) * 500000}`,
          currentBidder: testVendorIds[i],
          status: 'closed',
        })
        .returning();

      testAuctionIds.push(auction.id);
    }
  });

  afterAll(async () => {
    // Clean up test data
    for (const auctionId of testAuctionIds) {
      await db.delete(auctions).where(eq(auctions.id, auctionId));
    }
    for (const caseId of testCaseIds) {
      await db.delete(salvageCases).where(eq(salvageCases.id, caseId));
    }
    for (const vendorId of testVendorIds) {
      await db.delete(vendors).where(eq(vendors.id, vendorId));
    }
    for (const userId of testUserIds) {
      await db.delete(users).where(eq(users.id, userId));
    }

    // Clean up cache
    await cache.del('leaderboard:monthly');
  });

  it('should fetch leaderboard from API', async () => {
    const response = await fetch('http://localhost:3000/api/vendors/leaderboard');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('leaderboard');
    expect(data).toHaveProperty('lastUpdated');
    expect(data).toHaveProperty('nextUpdate');
    expect(Array.isArray(data.leaderboard)).toBe(true);
  }, 15000);

  it('should rank vendors correctly by total wins', async () => {
    // Clear cache to force fresh calculation
    await cache.del('leaderboard:monthly');

    const response = await fetch('http://localhost:3000/api/vendors/leaderboard');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.leaderboard.length).toBeGreaterThan(0);

    // Verify ranking order (higher wins should be ranked higher)
    for (let i = 0; i < data.leaderboard.length - 1; i++) {
      expect(data.leaderboard[i].wins).toBeGreaterThanOrEqual(
        data.leaderboard[i + 1].wins
      );
    }
  }, 15000);

  it('should include all required metrics', async () => {
    const response = await fetch('http://localhost:3000/api/vendors/leaderboard');
    const data = await response.json();

    expect(response.status).toBe(200);

    if (data.leaderboard.length > 0) {
      const entry = data.leaderboard[0];
      expect(entry).toHaveProperty('rank');
      expect(entry).toHaveProperty('vendorId');
      expect(entry).toHaveProperty('vendorName');
      expect(entry).toHaveProperty('tier');
      expect(entry).toHaveProperty('totalBids');
      expect(entry).toHaveProperty('wins');
      expect(entry).toHaveProperty('totalSpent');
      expect(entry).toHaveProperty('onTimePickupRate');
      expect(entry).toHaveProperty('rating');
    }
  });

  it('should cache leaderboard after first fetch', async () => {
    // Clear cache
    await cache.del('leaderboard:monthly');

    // First fetch - should calculate
    const response1 = await fetch('http://localhost:3000/api/vendors/leaderboard');
    const data1 = await response1.json();

    // Second fetch - should use cache
    const response2 = await fetch('http://localhost:3000/api/vendors/leaderboard');
    const data2 = await response2.json();

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
    expect(data1.lastUpdated).toBe(data2.lastUpdated); // Same timestamp means cached
  }, 15000);

  it('should refresh leaderboard on POST request', async () => {
    // Get initial leaderboard
    const response1 = await fetch('http://localhost:3000/api/vendors/leaderboard');
    const data1 = await response1.json();

    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Refresh leaderboard
    const refreshResponse = await fetch('http://localhost:3000/api/vendors/leaderboard/refresh', {
      method: 'POST',
    });
    const refreshData = await refreshResponse.json();

    expect(refreshResponse.status).toBe(200);
    expect(refreshData.message).toBe('Leaderboard refreshed successfully');

    // Get updated leaderboard
    const response2 = await fetch('http://localhost:3000/api/vendors/leaderboard');
    const data2 = await response2.json();

    // Timestamps should be different
    expect(data1.lastUpdated).not.toBe(data2.lastUpdated);
  }, 15000);

  it('should limit leaderboard to top 10 vendors', async () => {
    const response = await fetch('http://localhost:3000/api/vendors/leaderboard');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.leaderboard.length).toBeLessThanOrEqual(10);
  }, 15000);

  it('should calculate total spent from closed auctions', async () => {
    // Clear cache
    await cache.del('leaderboard:monthly');

    const response = await fetch('http://localhost:3000/api/vendors/leaderboard');
    const data = await response.json();

    expect(response.status).toBe(200);

    // Find our test vendors in the leaderboard
    const testVendor = data.leaderboard.find(
      (entry: any) => testVendorIds.includes(entry.vendorId)
    );

    if (testVendor) {
      expect(testVendor.totalSpent).toBeDefined();
      expect(parseFloat(testVendor.totalSpent)).toBeGreaterThanOrEqual(0);
    }
  }, 15000);

  it('should only include approved vendors', async () => {
    const response = await fetch('http://localhost:3000/api/vendors/leaderboard');
    const data = await response.json();

    expect(response.status).toBe(200);

    // All vendors in leaderboard should be approved
    for (const entry of data.leaderboard) {
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, entry.vendorId));

      if (vendor) {
        expect(vendor.status).toBe('approved');
      }
    }
  }, 15000);

  it('should include next update timestamp for Monday', async () => {
    const response = await fetch('http://localhost:3000/api/vendors/leaderboard');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nextUpdate).toBeDefined();

    const nextUpdate = new Date(data.nextUpdate);
    expect(nextUpdate.getDay()).toBe(1); // Monday
    expect(nextUpdate.getHours()).toBe(0); // Midnight
    expect(nextUpdate.getMinutes()).toBe(0);
  });
});
