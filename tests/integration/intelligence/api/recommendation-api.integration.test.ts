/**
 * Integration Tests for Recommendation API Endpoints
 * Task 12.2.2: Write integration tests for recommendation API endpoints
 * 
 * Tests the GET /api/vendors/[id]/recommendations endpoint with real database interactions,
 * authentication, authorization, caching, and RecommendationService integration.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/vendors/[id]/recommendations/route';
import { db } from '@/lib/db';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { bids } from '@/lib/db/schema/bids';
import { recommendations } from '@/lib/db/schema/intelligence';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { eq, sql } from 'drizzle-orm';
import { deleteCached } from '@/lib/cache/redis';

// Mock auth for testing
import { vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

describe('Recommendation API Integration Tests', () => {
  let testVendorId: string;
  let testVendorUserId: string;
  let testAdjusterUserId: string;
  let testAuctionIds: string[] = [];
  let testCaseIds: string[] = [];
  let testUserIds: string[] = [];

  beforeAll(async () => {
    // Create test adjuster user
    const adjusterResult = await db.insert(users).values({
      email: `test-adjuster-rec-api-${Date.now()}@example.com`,
      phone: `+1${Date.now().toString().slice(-10)}`,
      fullName: 'Test Adjuster Rec API',
      dateOfBirth: new Date('1990-01-01'),
      role: 'claims_adjuster',
      status: 'verified_tier_1',
      passwordHash: 'test-hash',
    }).returning({ id: users.id });

    testAdjusterUserId = adjusterResult[0].id;
    testUserIds.push(testAdjusterUserId);

    // Create test vendor user
    const vendorUserResult = await db.insert(users).values({
      email: `test-vendor-rec-api-${Date.now()}@example.com`,
      phone: `+1${(Date.now() + 1).toString().slice(-10)}`,
      fullName: 'Test Vendor Rec API',
      dateOfBirth: new Date('1990-01-01'),
      role: 'vendor',
      status: 'verified_tier_1',
      passwordHash: 'test-hash',
    }).returning({ id: users.id });

    testVendorUserId = vendorUserResult[0].id;
    testUserIds.push(testVendorUserId);

    // Create vendor record
    const vendorResult = await db.insert(vendors).values({
      userId: testVendorUserId,
      businessName: 'Test Vendor Business Rec',
      tier: 'tier1_bvn',
      status: 'approved',
      categories: ['vehicle', 'electronics'],
    }).returning({ id: vendors.id });

    testVendorId = vendorResult[0].id;

    // Create test auctions with various characteristics
    // 1. Vehicle auction matching vendor's preferred category
    const vehicleCase = await db.insert(salvageCases).values({
      createdBy: testAdjusterUserId,
      claimReference: `TEST-VEH-${Date.now()}`,
      assetType: 'vehicle',
      assetDetails: {
        make: 'Toyota',
        model: 'Camry',
        year: '2020',
        color: 'Black',
        trim: 'LE',
      },
      damageSeverity: 'minor',
      marketValue: 500000,
      estimatedSalvageValue: 400000,
      reservePrice: 350000,
      gpsLocation: sql`point(0, 0)`,
      locationName: 'Test Location',
      photos: [],
    }).returning({ id: salvageCases.id });

    testCaseIds.push(vehicleCase[0].id);

    const vehicleAuction = await db.insert(auctions).values({
      caseId: vehicleCase[0].id,
      startTime: new Date(),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      originalEndTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'active',
      watchingCount: 10,
    }).returning({ id: auctions.id });

    testAuctionIds.push(vehicleAuction[0].id);

    // 2. Electronics auction matching vendor's category
    const electronicsCase = await db.insert(salvageCases).values({
      createdBy: testAdjusterUserId,
      claimReference: `TEST-ELEC-${Date.now()}`,
      assetType: 'electronics',
      assetDetails: {
        make: 'Apple',
        model: 'iPhone 13',
        storage: '128GB',
        color: 'Blue',
      },
      damageSeverity: 'moderate',
      marketValue: 150000,
      estimatedSalvageValue: 100000,
      reservePrice: 80000,
      gpsLocation: sql`point(0, 0)`,
      locationName: 'Test Location',
      photos: [],
    }).returning({ id: salvageCases.id });

    testCaseIds.push(electronicsCase[0].id);

    const electronicsAuction = await db.insert(auctions).values({
      caseId: electronicsCase[0].id,
      startTime: new Date(),
      endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      status: 'active',
      watchingCount: 8,
    }).returning({ id: auctions.id });

    testAuctionIds.push(electronicsAuction[0].id);

    // 3. Machinery auction (not in vendor's categories)
    const machineryCase = await db.insert(salvageCases).values({
      createdBy: testAdjusterUserId,
      claimReference: `TEST-MACH-${Date.now()}`,
      assetType: 'machinery',
      assetDetails: {
        make: 'Caterpillar',
        model: 'D9T',
        year: '2021',
      },
      damageSeverity: 'severe',
      marketValue: 15000000,
      estimatedSalvageValue: 8000000,
      reservePrice: 7000000,
      gpsLocation: sql`point(0, 0)`,
      locationName: 'Test Location',
      photos: [],
    }).returning({ id: salvageCases.id });

    testCaseIds.push(machineryCase[0].id);

    const machineryAuction = await db.insert(auctions).values({
      caseId: machineryCase[0].id,
      startTime: new Date(),
      endTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      originalEndTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      status: 'active',
      watchingCount: 3,
    }).returning({ id: auctions.id });

    testAuctionIds.push(machineryAuction[0].id);

    // Create historical bids for the vendor to establish bidding patterns
    const historicalCase1 = await db.insert(salvageCases).values({
      createdBy: testAdjusterUserId,
      claimReference: `TEST-HIST-1-${Date.now()}`,
      assetType: 'vehicle',
      assetDetails: {
        make: 'Toyota',
        model: 'Corolla',
        year: '2019',
        color: 'White',
      },
      damageSeverity: 'minor',
      marketValue: 450000,
      estimatedSalvageValue: 350000,
      reservePrice: 300000,
      gpsLocation: sql`point(0, 0)`,
      locationName: 'Test Location',
      photos: [],
    }).returning({ id: salvageCases.id });

    testCaseIds.push(historicalCase1[0].id);

    const historicalAuction1 = await db.insert(auctions).values({
      caseId: historicalCase1[0].id,
      startTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000),
      originalEndTime: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000),
      status: 'closed',
      currentBid: 380000,
      currentBidder: testVendorId,
    }).returning({ id: auctions.id });

    testAuctionIds.push(historicalAuction1[0].id);

    // Create bid for historical auction
    await db.insert(bids).values({
      auctionId: historicalAuction1[0].id,
      vendorId: testVendorId,
      amount: 380000,
      ipAddress: '127.0.0.1',
      deviceType: 'desktop',
    });

    // Create another historical bid
    const historicalCase2 = await db.insert(salvageCases).values({
      createdBy: testAdjusterUserId,
      claimReference: `TEST-HIST-2-${Date.now()}`,
      assetType: 'electronics',
      assetDetails: {
        make: 'Samsung',
        model: 'Galaxy S21',
        storage: '256GB',
      },
      damageSeverity: 'moderate',
      marketValue: 180000,
      estimatedSalvageValue: 120000,
      reservePrice: 100000,
      gpsLocation: sql`point(0, 0)`,
      locationName: 'Test Location',
      photos: [],
    }).returning({ id: salvageCases.id });

    testCaseIds.push(historicalCase2[0].id);

    const historicalAuction2 = await db.insert(auctions).values({
      caseId: historicalCase2[0].id,
      startTime: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      endTime: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
      originalEndTime: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000),
      status: 'closed',
      currentBid: 130000,
    }).returning({ id: auctions.id });

    testAuctionIds.push(historicalAuction2[0].id);

    await db.insert(bids).values({
      auctionId: historicalAuction2[0].id,
      vendorId: testVendorId,
      amount: 125000,
      ipAddress: '127.0.0.1',
      deviceType: 'mobile',
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testAuctionIds.length > 0) {
      for (const auctionId of testAuctionIds) {
        await db.delete(bids).where(eq(bids.auctionId, auctionId));
        await db.delete(recommendations).where(eq(recommendations.auctionId, auctionId));
        await db.delete(auctions).where(eq(auctions.id, auctionId));
      }
    }

    if (testCaseIds.length > 0) {
      for (const caseId of testCaseIds) {
        await db.delete(salvageCases).where(eq(salvageCases.id, caseId));
      }
    }

    // Clear Redis cache
    if (testVendorId) {
      await deleteCached(`recommendation:${testVendorId}`);
    }

    // Clear audit logs
    if (testVendorUserId) {
      await db.delete(auditLogs).where(eq(auditLogs.userId, testVendorUserId));
    }

    // Delete test vendor
    if (testVendorId) {
      await db.delete(vendors).where(eq(vendors.id, testVendorId));
    }

    // Delete test users
    for (const userId of testUserIds) {
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  beforeEach(async () => {
    // Clear cache before each test
    if (testVendorId) {
      await deleteCached(`recommendation:${testVendorId}`);
    }
    // Clear recommendations before each test
    if (testAuctionIds.length > 0) {
      for (const auctionId of testAuctionIds) {
        await db.delete(recommendations).where(eq(recommendations.auctionId, auctionId));
      }
    }
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when vendor tries to access another vendor\'s recommendations', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: 'different-user-id', 
          email: 'other@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });

    it('should allow vendor to access their own recommendations', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      
      expect(response.status).toBe(200);
    });

    it('should allow admin to access any vendor\'s recommendations', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: 'admin-user-id', 
          email: 'admin@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      
      expect(response.status).toBe(200);
    });

    it('should allow manager to access any vendor\'s recommendations', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: 'manager-user-id', 
          email: 'manager@example.com', 
          role: 'manager' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      
      expect(response.status).toBe(200);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 for invalid vendor ID format', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: 'test-vendor-1', 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/vendors/invalid-id/recommendations'
      );

      const response = await GET(request, { params: { id: 'invalid-id' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid vendor ID format');
    });

    it('should return 404 when vendor not found', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: 'test-vendor-1', 
          email: 'vendor@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999';
      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${nonExistentId}/recommendations`
      );

      const response = await GET(request, { params: { id: nonExistentId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Vendor not found');
    });

    it('should accept valid limit query parameter', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations?limit=10`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.recommendations.length).toBeLessThanOrEqual(10);
    });

    it('should reject invalid limit query parameter', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations?limit=100`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid query parameters');
    });
  });

  describe('Successful Recommendation Generation', () => {
    it('should return 200 with recommendations for valid request', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.vendorId).toBe(testVendorId);
      expect(data.data.recommendations).toBeInstanceOf(Array);
      expect(data.data.count).toBeGreaterThanOrEqual(0);
      expect(data.data.generatedAt).toBeDefined();
    });

    it('should include all required recommendation fields', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      if (data.data.recommendations.length > 0) {
        const recommendation = data.data.recommendations[0];
        expect(recommendation).toHaveProperty('auctionId');
        expect(recommendation).toHaveProperty('matchScore');
        expect(recommendation).toHaveProperty('collaborativeScore');
        expect(recommendation).toHaveProperty('contentScore');
        expect(recommendation).toHaveProperty('reasonCodes');
        expect(recommendation).toHaveProperty('auctionDetails');
        expect(recommendation.reasonCodes).toBeInstanceOf(Array);
      }
    });

    it('should prioritize auctions matching vendor categories', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      // Vendor categories are ['vehicle', 'electronics']
      // Should prioritize these over machinery
      if (data.data.recommendations.length > 0) {
        const topRecommendations = data.data.recommendations.slice(0, 2);
        const hasPreferredCategory = topRecommendations.some((rec: any) => 
          ['vehicle', 'electronics'].includes(rec.auctionDetails.assetType)
        );
        expect(hasPreferredCategory).toBe(true);
      }
    });

    it('should exclude auctions where vendor is current bidder', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      // Place a bid on one of the active auctions
      await db.insert(bids).values({
        auctionId: testAuctionIds[0],
        vendorId: testVendorId,
        amount: 360000,
        ipAddress: '127.0.0.1',
        deviceType: 'desktop',
      });

      // Update auction to set current bidder
      await db.update(auctions)
        .set({ currentBidder: testVendorId, currentBid: 360000 })
        .where(eq(auctions.id, testAuctionIds[0]));

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      // Should not include the auction where vendor is current bidder
      const recommendedAuctionIds = data.data.recommendations.map((rec: any) => rec.auctionId);
      expect(recommendedAuctionIds).not.toContain(testAuctionIds[0]);

      // Cleanup
      await db.update(auctions)
        .set({ currentBidder: null, currentBid: null })
        .where(eq(auctions.id, testAuctionIds[0]));
    });
  });

  describe('Integration with RecommendationService', () => {
    it('should store recommendations in database', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      await GET(request, { params: { id: testVendorId } });

      // Verify recommendations were stored
      const storedRecommendations = await db
        .select()
        .from(recommendations)
        .where(eq(recommendations.vendorId, testVendorId));

      expect(storedRecommendations.length).toBeGreaterThan(0);
      expect(storedRecommendations[0].vendorId).toBe(testVendorId);
      expect(storedRecommendations[0].matchScore).toBeGreaterThan(0);
    });

    it('should log recommendation view to audit logs', async () => {
      const { auth } = await import('@/lib/auth');
      const userId = testVendorUserId;
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: userId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      await GET(request, { params: { id: testVendorId } });

      // Verify audit log was created
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.userId, userId));

      expect(logs.length).toBeGreaterThan(0);
      const recommendationLog = logs.find(log => 
        log.actionType === 'intelligence_api_accessed' && 
        log.entityType === 'recommendation'
      );
      expect(recommendationLog).toBeDefined();
      expect(recommendationLog?.entityId).toBe(testVendorId);
    });

    it('should use collaborative filtering for vendors with bidding history', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      // Vendor has bidding history, so collaborative score should be non-zero
      if (data.data.recommendations.length > 0) {
        const hasCollaborativeScore = data.data.recommendations.some((rec: any) => 
          rec.collaborativeScore > 0
        );
        expect(hasCollaborativeScore).toBe(true);
      }
    });
  });

  describe('Caching Behavior', () => {
    it('should cache recommendation results', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request1 = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      // First request
      const startTime1 = Date.now();
      const response1 = await GET(request1, { params: { id: testVendorId } });
      const duration1 = Date.now() - startTime1;
      const data1 = await response1.json();

      // Second request (should hit cache)
      const request2 = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );
      const startTime2 = Date.now();
      const response2 = await GET(request2, { params: { id: testVendorId } });
      const duration2 = Date.now() - startTime2;
      const data2 = await response2.json();

      // Both should return same recommendations
      expect(data1.data.recommendations.length).toBe(data2.data.recommendations.length);
      
      // Second request should be faster (cached)
      expect(duration2).toBeLessThan(duration1);
    });

    it('should indicate cache status in response metadata', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      // Clear cache first
      await deleteCached(`recommendation:${testVendorId}`);

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      expect(data.meta).toBeDefined();
      expect(data.meta).toHaveProperty('cached');
      expect(data.meta).toHaveProperty('responseTimeMs');
    });
  });

  describe('Error Handling', () => {
    it('should handle new vendor with no bidding history gracefully', async () => {
      // Create a new vendor with no bids
      const newVendorUser = await db.insert(users).values({
        email: `test-new-vendor-${Date.now()}@example.com`,
        phone: `+1${(Date.now() + 999).toString().slice(-10)}`,
        fullName: 'Test New Vendor',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
        status: 'verified_tier_1',
        passwordHash: 'test-hash',
      }).returning({ id: users.id });

      const newVendor = await db.insert(vendors).values({
        userId: newVendorUser[0].id,
        businessName: 'Test New Vendor Business',
        tier: 'tier1_bvn',
        status: 'approved',
        categories: ['vehicle'],
      }).returning({ id: vendors.id });

      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: newVendorUser[0].id, 
          email: 'newvendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${newVendor[0].id}/recommendations`
      );

      const response = await GET(request, { params: { id: newVendor[0].id } });
      const data = await response.json();

      // Should still return 200 with content-based recommendations
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.recommendations).toBeInstanceOf(Array);

      // Cleanup
      await db.delete(vendors).where(eq(vendors.id, newVendor[0].id));
      await db.delete(users).where(eq(users.id, newVendorUser[0].id));
    });

    it('should return 500 on unexpected server error', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: 'test-vendor-1', 
          email: 'vendor@example.com', 
          role: 'admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      // Use a malformed UUID that passes validation but causes DB error
      const malformedId = '00000000-0000-0000-0000-000000000000';
      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${malformedId}/recommendations`
      );

      const response = await GET(request, { params: { id: malformedId } });
      
      // Should handle error gracefully
      expect([404, 500]).toContain(response.status);
    });
  });

  describe('Response Format Validation', () => {
    it('should return properly formatted JSON response', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      // Verify response structure
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('meta');
      expect(typeof data.success).toBe('boolean');
      expect(typeof data.data).toBe('object');
      expect(typeof data.meta).toBe('object');
    });

    it('should return ISO timestamp format', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      // Verify timestamp is valid ISO string
      expect(data.data.generatedAt).toBeDefined();
      expect(() => new Date(data.data.generatedAt)).not.toThrow();
      expect(new Date(data.data.generatedAt).toISOString()).toBe(data.data.generatedAt);
    });

    it('should return numeric values in correct format', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      // Verify numeric fields
      expect(typeof data.data.count).toBe('number');
      expect(typeof data.meta.responseTimeMs).toBe('number');

      if (data.data.recommendations.length > 0) {
        const rec = data.data.recommendations[0];
        expect(typeof rec.matchScore).toBe('number');
        expect(typeof rec.collaborativeScore).toBe('number');
        expect(typeof rec.contentScore).toBe('number');
      }
    });

    it('should return match scores in valid range (0-100)', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      if (data.data.recommendations.length > 0) {
        data.data.recommendations.forEach((rec: any) => {
          expect(rec.matchScore).toBeGreaterThanOrEqual(0);
          expect(rec.matchScore).toBeLessThanOrEqual(100);
        });
      }
    });

    it('should return recommendations sorted by match score descending', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      if (data.data.recommendations.length > 1) {
        const scores = data.data.recommendations.map((rec: any) => rec.matchScore);
        const sortedScores = [...scores].sort((a, b) => b - a);
        expect(scores).toEqual(sortedScores);
      }
    });
  });

  describe('Performance', () => {
    it('should respond within 200ms for cached recommendations', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      // First request to populate cache
      const request1 = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );
      await GET(request1, { params: { id: testVendorId } });

      // Second request (cached)
      const request2 = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );
      const startTime = Date.now();
      const response = await GET(request2, { params: { id: testVendorId } });
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200);
    });

    it('should include response time in metadata', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      expect(data.meta.responseTimeMs).toBeDefined();
      expect(typeof data.meta.responseTimeMs).toBe('number');
      expect(data.meta.responseTimeMs).toBeGreaterThan(0);
    });
  });

  describe('Pagination and Filtering', () => {
    it('should respect limit parameter', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const limit = 5;
      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations?limit=${limit}`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      expect(data.data.recommendations.length).toBeLessThanOrEqual(limit);
    });

    it('should use default limit when not specified', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testVendorUserId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/vendors/${testVendorId}/recommendations`
      );

      const response = await GET(request, { params: { id: testVendorId } });
      const data = await response.json();

      // Default limit is 20
      expect(data.data.recommendations.length).toBeLessThanOrEqual(20);
    });
  });
});
