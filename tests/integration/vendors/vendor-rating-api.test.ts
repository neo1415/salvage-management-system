import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { ratings } from '@/lib/db/schema/ratings';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq, sql } from 'drizzle-orm';

/**
 * Integration tests for Vendor Rating API
 * 
 * Tests:
 * - POST /api/vendors/[id]/ratings - Rate a vendor
 * - GET /api/vendors/[id]/ratings - Get vendor ratings
 * 
 * Requirements:
 * - Requirement 37: Vendor Rating System
 * - Enterprise Standards Section 5
 * 
 * Acceptance Criteria:
 * - Validate rating is 1-5 stars
 * - Validate review is ≤500 characters
 * - Update vendor average rating
 * - Create audit log entry
 */
describe('Vendor Rating API Integration Tests', () => {
  let testData: {
    managerId: string;
    vendorId: string;
    auctionId: string;
    caseId: string;
  };

  beforeEach(async () => {
    // Create test manager
    const [manager] = await db
      .insert(users)
      .values({
        email: `manager-${Date.now()}@test.com`,
        phone: `+234${Math.floor(Math.random() * 10000000000)}`,
        passwordHash: 'hashed_password',
        role: 'salvage_manager',
        status: 'phone_verified_tier_0',
        fullName: 'Test Manager',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();

    // Create test vendor user
    const [vendorUser] = await db
      .insert(users)
      .values({
        email: `vendor-${Date.now()}@test.com`,
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
        userId: vendorUser.id,
        businessName: 'Test Vendor Business',
        tier: 'tier1_bvn',
        status: 'approved',
        categories: ['vehicle'],
        rating: '0',
      })
      .returning();

    // Create test case
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `CLM-${Date.now()}`,
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
        gpsLocation: sql`point(6.5244, 3.3792)`, // PostgreSQL point using sql helper
        locationName: 'Lagos, Nigeria',
        photos: ['https://example.com/photo1.jpg'],
        voiceNotes: [],
        status: 'approved',
        createdBy: manager.id,
        approvedBy: manager.id,
        approvedAt: new Date(),
      })
      .returning();

    // Create test auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCase.id,
        startTime: new Date(),
        endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        extensionCount: 0,
        currentBid: '1500000',
        currentBidder: vendor.id,
        minimumIncrement: '10000',
        status: 'closed',
        watchingCount: 0,
      })
      .returning();

    testData = {
      managerId: manager.id,
      vendorId: vendor.id,
      auctionId: auction.id,
      caseId: testCase.id,
    };
  });

  afterEach(async () => {
    // Clean up test data
    if (testData) {
      // Delete in correct order to respect foreign key constraints
      await db.delete(ratings).where(eq(ratings.vendorId, testData.vendorId));
      await db.delete(auctions).where(eq(auctions.id, testData.auctionId));
      await db.delete(salvageCases).where(eq(salvageCases.id, testData.caseId));
      await db.delete(vendors).where(eq(vendors.id, testData.vendorId));
      // Delete audit logs before users (audit_logs has FK to users)
      await db.delete(auditLogs).where(eq(auditLogs.userId, testData.managerId));
      await db.delete(users).where(eq(users.id, testData.managerId));
    }
  });

  it('should successfully rate a vendor with valid data', async () => {
    const ratingData = {
      auctionId: testData.auctionId,
      overallRating: 5,
      categoryRatings: {
        paymentSpeed: 5,
        communication: 4,
        pickupPunctuality: 5,
      },
      review: 'Excellent vendor, very professional',
    };

    // Note: This test would need to mock the session
    // In a real integration test, you would use a test client that handles authentication
    // For now, we're testing the service layer directly

    const { rateVendor } = await import('@/features/vendors/services/rating.service');
    const { DeviceType } = await import('@/lib/utils/audit-logger');

    const result = await rateVendor({
      vendorId: testData.vendorId,
      auctionId: testData.auctionId,
      ratedBy: testData.managerId,
      overallRating: ratingData.overallRating,
      categoryRatings: ratingData.categoryRatings,
      review: ratingData.review,
      ipAddress: '192.168.1.1',
      deviceType: DeviceType.MOBILE,
      userAgent: 'Mozilla/5.0',
    });

    expect(result.success).toBe(true);
    expect(result.ratingId).toBeDefined();
    expect(result.newAverageRating).toBe(5);

    // Verify rating was created in database
    const createdRating = await db
      .select()
      .from(ratings)
      .where(eq(ratings.id, result.ratingId!))
      .limit(1);

    expect(createdRating).toHaveLength(1);
    expect(createdRating[0].overallRating).toBe(5);
    expect(createdRating[0].review).toBe('Excellent vendor, very professional');

    // Verify vendor average rating was updated
    const updatedVendor = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, testData.vendorId))
      .limit(1);

    expect(updatedVendor).toHaveLength(1);
    expect(parseFloat(updatedVendor[0].rating)).toBe(5);
  });

  it('should reject rating with invalid overall rating (< 1)', async () => {
    const { rateVendor } = await import('@/features/vendors/services/rating.service');
    const { DeviceType } = await import('@/lib/utils/audit-logger');

    const result = await rateVendor({
      vendorId: testData.vendorId,
      auctionId: testData.auctionId,
      ratedBy: testData.managerId,
      overallRating: 0, // Invalid: less than 1
      categoryRatings: {
        paymentSpeed: 5,
        communication: 4,
        pickupPunctuality: 5,
      },
      ipAddress: '192.168.1.1',
      deviceType: DeviceType.MOBILE,
      userAgent: 'Mozilla/5.0',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('between 1 and 5');
  });

  it('should reject rating with invalid overall rating (> 5)', async () => {
    const { rateVendor } = await import('@/features/vendors/services/rating.service');
    const { DeviceType } = await import('@/lib/utils/audit-logger');

    const result = await rateVendor({
      vendorId: testData.vendorId,
      auctionId: testData.auctionId,
      ratedBy: testData.managerId,
      overallRating: 6, // Invalid: greater than 5
      categoryRatings: {
        paymentSpeed: 5,
        communication: 4,
        pickupPunctuality: 5,
      },
      ipAddress: '192.168.1.1',
      deviceType: DeviceType.MOBILE,
      userAgent: 'Mozilla/5.0',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('between 1 and 5');
  });

  it('should reject rating with non-integer overall rating', async () => {
    const { rateVendor } = await import('@/features/vendors/services/rating.service');
    const { DeviceType } = await import('@/lib/utils/audit-logger');

    const result = await rateVendor({
      vendorId: testData.vendorId,
      auctionId: testData.auctionId,
      ratedBy: testData.managerId,
      overallRating: 4.5, // Invalid: not an integer
      categoryRatings: {
        paymentSpeed: 5,
        communication: 4,
        pickupPunctuality: 5,
      },
      ipAddress: '192.168.1.1',
      deviceType: DeviceType.MOBILE,
      userAgent: 'Mozilla/5.0',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('integer');
  });

  it('should reject review longer than 500 characters', async () => {
    const { rateVendor } = await import('@/features/vendors/services/rating.service');
    const { DeviceType } = await import('@/lib/utils/audit-logger');

    const longReview = 'a'.repeat(501); // 501 characters

    const result = await rateVendor({
      vendorId: testData.vendorId,
      auctionId: testData.auctionId,
      ratedBy: testData.managerId,
      overallRating: 5,
      categoryRatings: {
        paymentSpeed: 5,
        communication: 4,
        pickupPunctuality: 5,
      },
      review: longReview,
      ipAddress: '192.168.1.1',
      deviceType: DeviceType.MOBILE,
      userAgent: 'Mozilla/5.0',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('500 characters');
  });

  it('should accept review with exactly 500 characters', async () => {
    const { rateVendor } = await import('@/features/vendors/services/rating.service');
    const { DeviceType } = await import('@/lib/utils/audit-logger');

    const maxLengthReview = 'a'.repeat(500); // Exactly 500 characters

    const result = await rateVendor({
      vendorId: testData.vendorId,
      auctionId: testData.auctionId,
      ratedBy: testData.managerId,
      overallRating: 5,
      categoryRatings: {
        paymentSpeed: 5,
        communication: 4,
        pickupPunctuality: 5,
      },
      review: maxLengthReview,
      ipAddress: '192.168.1.1',
      deviceType: DeviceType.MOBILE,
      userAgent: 'Mozilla/5.0',
    });

    expect(result.success).toBe(true);
    expect(result.ratingId).toBeDefined();
  });

  it('should prevent rating the same transaction twice', async () => {
    const { rateVendor } = await import('@/features/vendors/services/rating.service');
    const { DeviceType } = await import('@/lib/utils/audit-logger');

    const ratingData = {
      vendorId: testData.vendorId,
      auctionId: testData.auctionId,
      ratedBy: testData.managerId,
      overallRating: 5,
      categoryRatings: {
        paymentSpeed: 5,
        communication: 4,
        pickupPunctuality: 5,
      },
      review: 'Great vendor',
      ipAddress: '192.168.1.1',
      deviceType: DeviceType.MOBILE,
      userAgent: 'Mozilla/5.0',
    };

    // First rating should succeed
    const result1 = await rateVendor(ratingData);
    expect(result1.success).toBe(true);

    // Second rating for same auction should fail
    const result2 = await rateVendor(ratingData);
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('already been rated');
  });

  it('should correctly update vendor average rating with multiple ratings', { timeout: 15000 }, async () => {
    const { rateVendor } = await import('@/features/vendors/services/rating.service');
    const { DeviceType } = await import('@/lib/utils/audit-logger');

    // Create additional auctions for multiple ratings
    const [auction2] = await db
      .insert(auctions)
      .values({
        caseId: testData.caseId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        extensionCount: 0,
        currentBid: '1500000',
        currentBidder: testData.vendorId,
        minimumIncrement: '10000',
        status: 'closed',
        watchingCount: 0,
      })
      .returning();

    const [auction3] = await db
      .insert(auctions)
      .values({
        caseId: testData.caseId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        extensionCount: 0,
        currentBid: '1500000',
        currentBidder: testData.vendorId,
        minimumIncrement: '10000',
        status: 'closed',
        watchingCount: 0,
      })
      .returning();

    // Rate with 5 stars
    const result1 = await rateVendor({
      vendorId: testData.vendorId,
      auctionId: testData.auctionId,
      ratedBy: testData.managerId,
      overallRating: 5,
      categoryRatings: {
        paymentSpeed: 5,
        communication: 5,
        pickupPunctuality: 5,
      },
      ipAddress: '192.168.1.1',
      deviceType: DeviceType.MOBILE,
      userAgent: 'Mozilla/5.0',
    });

    expect(result1.success).toBe(true);
    expect(result1.newAverageRating).toBe(5);

    // Rate with 3 stars
    const result2 = await rateVendor({
      vendorId: testData.vendorId,
      auctionId: auction2.id,
      ratedBy: testData.managerId,
      overallRating: 3,
      categoryRatings: {
        paymentSpeed: 3,
        communication: 3,
        pickupPunctuality: 3,
      },
      ipAddress: '192.168.1.1',
      deviceType: DeviceType.MOBILE,
      userAgent: 'Mozilla/5.0',
    });

    expect(result2.success).toBe(true);
    // Average of 5 and 3 = 4
    expect(result2.newAverageRating).toBe(4);

    // Rate with 4 stars
    const result3 = await rateVendor({
      vendorId: testData.vendorId,
      auctionId: auction3.id,
      ratedBy: testData.managerId,
      overallRating: 4,
      categoryRatings: {
        paymentSpeed: 4,
        communication: 4,
        pickupPunctuality: 4,
      },
      ipAddress: '192.168.1.1',
      deviceType: DeviceType.MOBILE,
      userAgent: 'Mozilla/5.0',
    });

    expect(result3.success).toBe(true);
    // Average of 5, 3, and 4 = 4
    expect(result3.newAverageRating).toBe(4);

    // Clean up additional auctions
    await db.delete(auctions).where(eq(auctions.id, auction2.id));
    await db.delete(auctions).where(eq(auctions.id, auction3.id));
  });

  it('should accept rating without optional review', async () => {
    const { rateVendor } = await import('@/features/vendors/services/rating.service');
    const { DeviceType } = await import('@/lib/utils/audit-logger');

    const result = await rateVendor({
      vendorId: testData.vendorId,
      auctionId: testData.auctionId,
      ratedBy: testData.managerId,
      overallRating: 4,
      categoryRatings: {
        paymentSpeed: 4,
        communication: 4,
        pickupPunctuality: 4,
      },
      // No review provided
      ipAddress: '192.168.1.1',
      deviceType: DeviceType.MOBILE,
      userAgent: 'Mozilla/5.0',
    });

    expect(result.success).toBe(true);
    expect(result.ratingId).toBeDefined();

    // Verify rating was created without review
    const createdRating = await db
      .select()
      .from(ratings)
      .where(eq(ratings.id, result.ratingId!))
      .limit(1);

    expect(createdRating).toHaveLength(1);
    expect(createdRating[0].review).toBeNull();
  });
});
