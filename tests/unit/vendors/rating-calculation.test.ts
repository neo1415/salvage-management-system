import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { ratings } from '@/lib/db/schema/ratings';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { rateVendor, getVendorAverageRating } from '@/features/vendors/services/rating.service';
import { DeviceType } from '@/lib/utils/audit-logger';
import { eq, sql, or } from 'drizzle-orm';
import fc from 'fast-check';

/**
 * Property 19: Vendor Rating Calculation
 * Validates: Requirements 37.5, 37.6
 * 
 * This property test verifies that:
 * 1. Average rating is calculated correctly from multiple ratings
 * 2. Average rating is always between 1 and 5
 * 3. Average rating updates correctly when new ratings are added
 * 4. Rating calculation handles edge cases (single rating, many ratings)
 */

describe('Property 19: Vendor Rating Calculation', () => {
  // Helper function to create isolated test data for each property test iteration
  async function createTestData() {
    // Create test user (vendor)
    const [user] = await db
      .insert(users)
      .values({
        email: `vendor-${Date.now()}-${Math.random()}@test.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: 'hashed_password',
        role: 'vendor',
        status: 'verified_tier_1',
        fullName: 'Test Vendor',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();

    // Create test vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: user.id,
        tier: 'tier1_bvn',
        status: 'approved',
      })
      .returning();

    // Create test manager
    const [manager] = await db
      .insert(users)
      .values({
        email: `manager-${Date.now()}-${Math.random()}@test.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: 'hashed_password',
        role: 'salvage_manager',
        status: 'verified_tier_1',
        fullName: 'Test Manager',
        dateOfBirth: new Date('1985-01-01'),
      })
      .returning();

    // Create test case
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `CLM-${Date.now()}-${Math.random()}`,
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        marketValue: '1000000',
        estimatedSalvageValue: '300000',
        reservePrice: '210000',
        damageSeverity: 'moderate',
        aiAssessment: {
          labels: ['front damage'],
          confidenceScore: 85,
          damagePercentage: 30,
          processedAt: new Date(),
        },
        gpsLocation: sql`point(6.5244, 3.3792)`,
        locationName: 'Lagos, Nigeria',
        photos: ['https://example.com/photo1.jpg'],
        voiceNotes: [],
        status: 'approved',
        createdBy: manager.id,
      })
      .returning();

    return {
      userId: user.id,
      vendorId: vendor.id,
      managerId: manager.id,
      caseId: testCase.id,
    };
  }

  // Helper function to clean up test data
  async function cleanupTestData(testData: {
    userId: string;
    vendorId: string;
    managerId: string;
    caseId: string;
    auctionIds?: string[];
  }) {
    try {
      // Clean up in correct order to avoid foreign key violations
      // 1. Delete audit logs first
      await db.delete(auditLogs).where(
        or(
          eq(auditLogs.userId, testData.userId),
          eq(auditLogs.userId, testData.managerId)
        )
      );
      
      // 2. Delete ratings
      await db.delete(ratings).where(eq(ratings.vendorId, testData.vendorId));
      
      // 3. Delete auctions
      if (testData.auctionIds && testData.auctionIds.length > 0) {
        for (const auctionId of testData.auctionIds) {
          await db.delete(auctions).where(eq(auctions.id, auctionId));
        }
      }
      
      // 4. Delete vendors
      await db.delete(vendors).where(eq(vendors.id, testData.vendorId));
      
      // 5. Delete cases
      await db.delete(salvageCases).where(eq(salvageCases.id, testData.caseId));
      
      // 6. Delete users
      await db.delete(users).where(eq(users.id, testData.userId));
      await db.delete(users).where(eq(users.id, testData.managerId));
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  it('Property: Average rating is calculated correctly from multiple ratings', { timeout: 120000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate array of 1-10 ratings, each between 1-5 stars
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 10 }),
        async (ratingValues) => {
          // Create isolated test data for this iteration
          const testData = await createTestData();
          const auctionIds: string[] = [];

          try {
            // Create auctions and ratings
            for (let i = 0; i < ratingValues.length; i++) {
              const [auction] = await db
                .insert(auctions)
                .values({
                  caseId: testData.caseId,
                  startTime: new Date(),
                  endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                  originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                  extensionCount: 0,
                  currentBid: null,
                  currentBidder: null,
                  minimumIncrement: '10000',
                  status: 'closed',
                  watchingCount: 0,
                })
                .returning();

              auctionIds.push(auction.id);

              await rateVendor({
                vendorId: testData.vendorId,
                auctionId: auction.id,
                ratedBy: testData.managerId,
                overallRating: ratingValues[i],
                categoryRatings: {
                  paymentSpeed: ratingValues[i],
                  communication: ratingValues[i],
                  pickupPunctuality: ratingValues[i],
                },
                ipAddress: '192.168.1.1',
                deviceType: DeviceType.MOBILE,
                userAgent: 'test-agent',
              });
            }

            // Calculate expected average
            const expectedAverage = ratingValues.reduce((sum, val) => sum + val, 0) / ratingValues.length;

            // Get actual average from service
            const result = await getVendorAverageRating(testData.vendorId);

            // Verify average is calculated correctly (within 0.01 tolerance for floating point)
            expect(result.success).toBe(true);
            expect(result.totalRatings).toBe(ratingValues.length);
            expect(Math.abs(result.averageRating - expectedAverage)).toBeLessThan(0.01);

            // Verify average is within valid range
            expect(result.averageRating).toBeGreaterThanOrEqual(1);
            expect(result.averageRating).toBeLessThanOrEqual(5);

            // Verify vendor record is updated
            const [vendor] = await db
              .select()
              .from(vendors)
              .where(eq(vendors.id, testData.vendorId));

            const vendorRating = parseFloat(vendor.rating);
            expect(Math.abs(vendorRating - expectedAverage)).toBeLessThan(0.01);
          } finally {
            // Clean up test data for this iteration
            await cleanupTestData({ ...testData, auctionIds });
          }
        }
      ),
      { numRuns: 5 } // Reduced from 10 to 5 for faster execution
    );
  });

  it('Property: Average rating is always between 1 and 5', { timeout: 120000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 20 }),
        async (ratingValues) => {
          // Create isolated test data for this iteration
          const testData = await createTestData();
          const auctionIds: string[] = [];

          try {
            // Create auctions and ratings
            for (let i = 0; i < ratingValues.length; i++) {
              const [auction] = await db
                .insert(auctions)
                .values({
                  caseId: testData.caseId,
                  startTime: new Date(),
                  endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                  originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                  extensionCount: 0,
                  currentBid: null,
                  currentBidder: null,
                  minimumIncrement: '10000',
                  status: 'closed',
                  watchingCount: 0,
                })
                .returning();

              auctionIds.push(auction.id);

              await rateVendor({
                vendorId: testData.vendorId,
                auctionId: auction.id,
                ratedBy: testData.managerId,
                overallRating: ratingValues[i],
                categoryRatings: {
                  paymentSpeed: ratingValues[i],
                  communication: ratingValues[i],
                  pickupPunctuality: ratingValues[i],
                },
                ipAddress: '192.168.1.1',
                deviceType: DeviceType.MOBILE,
                userAgent: 'test-agent',
              });
            }

            // Get average rating
            const result = await getVendorAverageRating(testData.vendorId);

            // Invariant: Average rating must always be between 1 and 5
            expect(result.averageRating).toBeGreaterThanOrEqual(1);
            expect(result.averageRating).toBeLessThanOrEqual(5);
          } finally {
            // Clean up test data for this iteration
            await cleanupTestData({ ...testData, auctionIds });
          }
        }
      ),
      { numRuns: 5 } // Reduced from 10 to 5 for faster execution
    );
  });

  it('Property: Single rating equals average rating', { timeout: 90000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        async (rating) => {
          // Create isolated test data for this iteration
          const testData = await createTestData();
          const auctionIds: string[] = [];

          try {
            // Create auction
            const [auction] = await db
              .insert(auctions)
              .values({
                caseId: testData.caseId,
                startTime: new Date(),
                endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                extensionCount: 0,
                currentBid: null,
                currentBidder: null,
                minimumIncrement: '10000',
                status: 'closed',
                watchingCount: 0,
              })
              .returning();

            auctionIds.push(auction.id);

            // Rate vendor
            await rateVendor({
              vendorId: testData.vendorId,
              auctionId: auction.id,
              ratedBy: testData.managerId,
              overallRating: rating,
              categoryRatings: {
                paymentSpeed: rating,
                communication: rating,
                pickupPunctuality: rating,
              },
              ipAddress: '192.168.1.1',
              deviceType: DeviceType.MOBILE,
              userAgent: 'test-agent',
            });

            // Get average rating
            const result = await getVendorAverageRating(testData.vendorId);

            // For a single rating, average should equal the rating
            expect(result.averageRating).toBe(rating);
            expect(result.totalRatings).toBe(1);
          } finally {
            // Clean up test data for this iteration
            await cleanupTestData({ ...testData, auctionIds });
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  it('Property: Adding new rating updates average correctly', { timeout: 120000 }, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 2, maxLength: 5 }),
        async (ratingValues) => {
          // Create isolated test data for this iteration
          const testData = await createTestData();
          const auctionIds: string[] = [];

          try {
            // Add first rating
            const [auction1] = await db
              .insert(auctions)
              .values({
                caseId: testData.caseId,
                startTime: new Date(),
                endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                extensionCount: 0,
                currentBid: null,
                currentBidder: null,
                minimumIncrement: '10000',
                status: 'closed',
                watchingCount: 0,
              })
              .returning();

            auctionIds.push(auction1.id);

            await rateVendor({
              vendorId: testData.vendorId,
              auctionId: auction1.id,
              ratedBy: testData.managerId,
              overallRating: ratingValues[0],
              categoryRatings: {
                paymentSpeed: ratingValues[0],
                communication: ratingValues[0],
                pickupPunctuality: ratingValues[0],
              },
              ipAddress: '192.168.1.1',
              deviceType: DeviceType.MOBILE,
              userAgent: 'test-agent',
            });

            const result1 = await getVendorAverageRating(testData.vendorId);
            const avg1 = result1.averageRating;

            // Add second rating
            const [auction2] = await db
              .insert(auctions)
              .values({
                caseId: testData.caseId,
                startTime: new Date(),
                endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                extensionCount: 0,
                currentBid: null,
                currentBidder: null,
                minimumIncrement: '10000',
                status: 'closed',
                watchingCount: 0,
              })
              .returning();

            auctionIds.push(auction2.id);

            await rateVendor({
              vendorId: testData.vendorId,
              auctionId: auction2.id,
              ratedBy: testData.managerId,
              overallRating: ratingValues[1],
              categoryRatings: {
                paymentSpeed: ratingValues[1],
                communication: ratingValues[1],
                pickupPunctuality: ratingValues[1],
              },
              ipAddress: '192.168.1.1',
              deviceType: DeviceType.MOBILE,
              userAgent: 'test-agent',
            });

            const result2 = await getVendorAverageRating(testData.vendorId);
            const avg2 = result2.averageRating;

            // Calculate expected average
            const expectedAvg = (ratingValues[0] + ratingValues[1]) / 2;

            // Verify average updated correctly
            expect(Math.abs(avg2 - expectedAvg)).toBeLessThan(0.01);
            expect(result2.totalRatings).toBe(2);

            // Verify new average is different from first (unless both ratings are the same)
            if (ratingValues[0] !== ratingValues[1]) {
              expect(avg2).not.toBe(avg1);
            }
          } finally {
            // Clean up test data for this iteration
            await cleanupTestData({ ...testData, auctionIds });
          }
        }
      ),
      { numRuns: 4 } // Reduced from 8 to 4 for faster execution
    );
  });
});
