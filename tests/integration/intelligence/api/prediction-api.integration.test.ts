/**
 * Integration Tests for Prediction API Endpoints
 * Task 12.2.1: Write integration tests for prediction API endpoints
 * 
 * Tests the GET /api/auctions/[id]/prediction endpoint with real database interactions,
 * authentication, caching, and PredictionService integration.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/auctions/[id]/prediction/route';
import { db } from '@/lib/db';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { bids } from '@/lib/db/schema/bids';
import { predictions } from '@/lib/db/schema/intelligence';
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

describe('Prediction API Integration Tests', () => {
  let testAuctionId: string;
  let testCaseId: string;
  let testAuctionIds: string[] = [];
  let testCaseIds: string[] = [];
  let testUserId: string;
  let testVendorUserId: string;
  let testVendorId: string;

  beforeAll(async () => {
    // Create test user
    const userResult = await db.insert(users).values({
      email: 'test-adjuster-api-integration@example.com',
      phone: `+1${Date.now().toString().slice(-10)}`,
      fullName: 'Test Adjuster API Integration',
      dateOfBirth: new Date('1990-01-01'),
      role: 'claims_adjuster',
      status: 'verified_tier_1',
      passwordHash: 'test-hash',
    }).returning({ id: users.id });

    testUserId = userResult[0].id;

    // Create test vendor user
    const vendorUserResult = await db.insert(users).values({
      email: 'test-vendor-api-integration@example.com',
      phone: `+1${(Date.now() + 1).toString().slice(-10)}`,
      fullName: 'Test Vendor API Integration',
      dateOfBirth: new Date('1990-01-01'),
      role: 'vendor',
      status: 'verified_tier_1',
      passwordHash: 'test-hash',
    }).returning({ id: users.id });

    testVendorUserId = vendorUserResult[0].id;

    // Create vendor record
    const vendorResult = await db.insert(vendors).values({
      userId: testVendorUserId,
      businessName: 'Test Vendor Business',
      tier: 'tier1_bvn',
      status: 'approved',
      categories: ['vehicle'],
    }).returning({ id: vendors.id });

    testVendorId = vendorResult[0].id;

    // Create test salvage case
    const caseResult = await db.insert(salvageCases).values({
      createdBy: testUserId,
      claimReference: `TEST-CLAIM-${Date.now()}`,
      assetType: 'vehicle',
      assetDetails: {
        make: 'Toyota',
        model: 'Camry',
        year: '2020',
        color: 'Black',
        trim: 'LE',
      },
      damageSeverity: 'minor',
      marketValue: '500000',
      estimatedSalvageValue: '400000',
      reservePrice: '350000',
      gpsLocation: sql`point(0, 0)`,
      locationName: 'Test Location',
      photos: [],
    }).returning({ id: salvageCases.id });

    testCaseId = caseResult[0].id;
    testCaseIds.push(testCaseId);

    // Create test auction
    const auctionResult = await db.insert(auctions).values({
      caseId: testCaseId,
      startTime: new Date(),
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      originalEndTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'active',
      watchingCount: 5,
    }).returning({ id: auctions.id });

    testAuctionId = auctionResult[0].id;
    testAuctionIds.push(testAuctionId);

    // Create historical similar auctions for similarity matching
    for (let i = 0; i < 5; i++) {
      const historicalCase = await db.insert(salvageCases).values({
        createdBy: testUserId,
        claimReference: `TEST-CLAIM-HIST-${Date.now()}-${i}`,
        assetType: 'vehicle',
        assetDetails: {
          make: 'Toyota',
          model: i < 3 ? 'Camry' : 'Corolla',
          year: '2019',
          color: i < 2 ? 'Black' : 'White',
          trim: 'LE',
        },
        damageSeverity: 'minor',
        marketValue: (480000 + i * 20000).toString(),
        estimatedSalvageValue: (380000 + i * 15000).toString(),
        reservePrice: (330000 + i * 10000).toString(),
        gpsLocation: sql`point(0, 0)`,
        locationName: 'Test Location',
        photos: [],
      }).returning({ id: salvageCases.id });

      testCaseIds.push(historicalCase[0].id);

      const historicalAuction = await db.insert(auctions).values({
        caseId: historicalCase[0].id,
        startTime: new Date(Date.now() - (30 + i * 10) * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - (23 + i * 10) * 24 * 60 * 60 * 1000),
        originalEndTime: new Date(Date.now() - (23 + i * 10) * 24 * 60 * 60 * 1000),
        status: 'closed',
        currentBid: (400000 + i * 25000).toString(),
        currentBidder: testVendorId,
      }).returning({ id: auctions.id });

      testAuctionIds.push(historicalAuction[0].id);

      // Create bids for historical auctions
      await db.insert(bids).values({
        auctionId: historicalAuction[0].id,
        vendorId: testVendorId,
        amount: (400000 + i * 25000).toString(),
        ipAddress: '127.0.0.1',
        deviceType: 'desktop',
      });
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testAuctionIds.length > 0) {
      for (const auctionId of testAuctionIds) {
        await db.delete(bids).where(eq(bids.auctionId, auctionId));
        await db.delete(predictions).where(eq(predictions.auctionId, auctionId));
        await db.delete(auctions).where(eq(auctions.id, auctionId));
      }
    }

    if (testCaseIds.length > 0) {
      for (const caseId of testCaseIds) {
        await db.delete(salvageCases).where(eq(salvageCases.id, caseId));
      }
    }

    // Clear Redis cache
    if (testAuctionId) {
      await deleteCached(`prediction:${testAuctionId}`);
    }

    // Clear audit logs
    await db.delete(auditLogs).where(eq(auditLogs.entityId, testAuctionId));

    // Delete test user
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testVendorId) {
      await db.delete(vendors).where(eq(vendors.id, testVendorId));
    }
    if (testVendorUserId) {
      await db.delete(users).where(eq(users.id, testVendorUserId));
    }
  });

  beforeEach(async () => {
    // Clear cache before each test
    if (testAuctionId) {
      await deleteCached(`prediction:${testAuctionId}`);
    }
    // Clear predictions before each test
    await db.delete(predictions).where(eq(predictions.auctionId, testAuctionId));
  });

  describe('Authentication and Authorization', () => {
    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue(null);

      const request = new NextRequest(
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );

      const response = await GET(request, { params: { id: testAuctionId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should allow authenticated vendor to access predictions', async () => {
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
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );

      const response = await GET(request, { params: { id: testAuctionId } });
      
      expect(response.status).toBe(200);
    });

    it('should allow authenticated adjuster to access predictions', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: 'test-adjuster-1', 
          email: 'adjuster@example.com', 
          role: 'adjuster' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );

      const response = await GET(request, { params: { id: testAuctionId } });
      
      expect(response.status).toBe(200);
    });
  });

  describe('Request Validation', () => {
    it('should return 400 for invalid auction ID format', async () => {
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
        'http://localhost:3000/api/auctions/invalid-id/prediction'
      );

      const response = await GET(request, { params: { id: 'invalid-id' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid auction ID format');
    });

    it('should return 404 when auction not found', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: 'test-vendor-1', 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const nonExistentId = '123e4567-e89b-12d3-a456-426614174999';
      const request = new NextRequest(
        `http://localhost:3000/api/auctions/${nonExistentId}/prediction`
      );

      const response = await GET(request, { params: { id: nonExistentId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Auction not found');
    });
  });

  describe('Successful Prediction Generation', () => {
    it('should return 200 with prediction data for valid request', async () => {
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
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );

      const response = await GET(request, { params: { id: testAuctionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.auctionId).toBe(testAuctionId);
      expect(data.data.predictedPrice).toBeGreaterThan(0);
      expect(data.data.lowerBound).toBeLessThanOrEqual(data.data.predictedPrice);
      expect(data.data.upperBound).toBeGreaterThanOrEqual(data.data.predictedPrice);
      expect(data.data.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(data.data.confidenceScore).toBeLessThanOrEqual(1);
      expect(['high', 'medium', 'low']).toContain(data.data.confidenceLevel);
      expect(data.data.method).toBeDefined();
      expect(data.data.timestamp).toBeDefined();
    });

    it('should include all required prediction fields', async () => {
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
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );

      const response = await GET(request, { params: { id: testAuctionId } });
      const data = await response.json();

      expect(data.data).toHaveProperty('auctionId');
      expect(data.data).toHaveProperty('predictedPrice');
      expect(data.data).toHaveProperty('lowerBound');
      expect(data.data).toHaveProperty('upperBound');
      expect(data.data).toHaveProperty('confidenceScore');
      expect(data.data).toHaveProperty('confidenceLevel');
      expect(data.data).toHaveProperty('method');
      expect(data.data).toHaveProperty('sampleSize');
      expect(data.data).toHaveProperty('metadata');
      expect(data.data).toHaveProperty('algorithmVersion');
      expect(data.data).toHaveProperty('timestamp');
    });

    it('should use historical method when sufficient data exists', async () => {
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
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );

      const response = await GET(request, { params: { id: testAuctionId } });
      const data = await response.json();

      expect(data.data.method).toBe('ensemble');
      expect(data.data.sampleSize).toBeGreaterThan(0);
    });
  });

  describe('Integration with PredictionService', () => {
    it('should store prediction in database', async () => {
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
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );

      await GET(request, { params: { id: testAuctionId } });

      // Verify prediction was stored
      const storedPredictions = await db
        .select()
        .from(predictions)
        .where(eq(predictions.auctionId, testAuctionId))
        .limit(1);

      expect(storedPredictions.length).toBe(1);
      expect(storedPredictions[0].auctionId).toBe(testAuctionId);
      expect(storedPredictions[0].predictedPrice).toBeGreaterThan(0);
    });

    it('should log prediction view to audit logs', async () => {
      const { auth } = await import('@/lib/auth');
      const userId = 'test-vendor-audit-1';
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: userId, 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );

      await GET(request, { params: { id: testAuctionId } });

      // Verify audit log was created
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.entityId, testAuctionId))
        .limit(1);

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].userId).toBe(userId);
      expect(logs[0].actionType).toBe('prediction_viewed');
      expect(logs[0].entityType).toBe('auction');
      expect(logs[0].entityId).toBe(testAuctionId);
    });
  });

  describe('Caching Behavior', () => {
    it('should cache prediction results', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: 'test-vendor-1', 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request1 = new NextRequest(
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );

      // First request
      const startTime1 = Date.now();
      const response1 = await GET(request1, { params: { id: testAuctionId } });
      const duration1 = Date.now() - startTime1;
      const data1 = await response1.json();

      // Second request (should hit cache)
      const request2 = new NextRequest(
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );
      const startTime2 = Date.now();
      const response2 = await GET(request2, { params: { id: testAuctionId } });
      const duration2 = Date.now() - startTime2;
      const data2 = await response2.json();

      // Both should return same prediction
      expect(data1.data.predictedPrice).toBe(data2.data.predictedPrice);
      
      // Second request should be faster (cached)
      expect(duration2).toBeLessThan(duration1);
    });
  });

  describe('Error Handling', () => {
    it('should handle insufficient data gracefully', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: 'test-vendor-1', 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      // Create auction with no historical data
      const uniqueCase = await db.insert(salvageCases).values({
        createdBy: testUserId,
        claimReference: `TEST-CLAIM-UNIQUE-${Date.now()}`,
        assetType: 'machinery',
        assetDetails: {
          make: 'Caterpillar',
          model: 'D9T',
          year: '2021',
        },
        damageSeverity: 'severe',
        marketValue: '15000000',
        estimatedSalvageValue: '8000000',
        reservePrice: '7000000',
        gpsLocation: sql`point(0, 0)`,
        locationName: 'Test Location',
        photos: [],
      }).returning({ id: salvageCases.id });

      const uniqueAuction = await db.insert(auctions).values({
        caseId: uniqueCase[0].id,
        startTime: new Date(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        originalEndTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'active',
        watchingCount: 2,
      }).returning({ id: auctions.id });

      const request = new NextRequest(
        `http://localhost:3000/api/auctions/${uniqueAuction[0].id}/prediction`
      );

      const response = await GET(request, { params: { id: uniqueAuction[0].id } });
      const data = await response.json();

      // Should still return 200 with fallback prediction
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.predictedPrice).toBeGreaterThan(0);

      // Cleanup
      await db.delete(predictions).where(eq(predictions.auctionId, uniqueAuction[0].id));
      await db.delete(auctions).where(eq(auctions.id, uniqueAuction[0].id));
      await db.delete(salvageCases).where(eq(salvageCases.id, uniqueCase[0].id));
    });

    it('should return 500 on unexpected server error', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: 'test-vendor-1', 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      // Use a malformed UUID that passes validation but causes DB error
      const malformedId = '00000000-0000-0000-0000-000000000000';
      const request = new NextRequest(
        `http://localhost:3000/api/auctions/${malformedId}/prediction`
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
          id: 'test-vendor-1', 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );

      const response = await GET(request, { params: { id: testAuctionId } });
      const data = await response.json();

      // Verify response structure
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('data');
      expect(typeof data.success).toBe('boolean');
      expect(typeof data.data).toBe('object');
    });

    it('should return ISO timestamp format', async () => {
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
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );

      const response = await GET(request, { params: { id: testAuctionId } });
      const data = await response.json();

      // Verify timestamp is valid ISO string
      expect(data.data.timestamp).toBeDefined();
      expect(() => new Date(data.data.timestamp)).not.toThrow();
      expect(new Date(data.data.timestamp).toISOString()).toBe(data.data.timestamp);
    });

    it('should return numeric values in correct format', async () => {
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
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );

      const response = await GET(request, { params: { id: testAuctionId } });
      const data = await response.json();

      // Verify numeric fields
      expect(typeof data.data.predictedPrice).toBe('number');
      expect(typeof data.data.lowerBound).toBe('number');
      expect(typeof data.data.upperBound).toBe('number');
      expect(typeof data.data.confidenceScore).toBe('number');
      expect(typeof data.data.sampleSize).toBe('number');
    });
  });

  describe('Performance', () => {
    it('should respond within 200ms for cached predictions', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: 'test-vendor-1', 
          email: 'vendor@example.com', 
          role: 'vendor' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      // First request to populate cache
      const request1 = new NextRequest(
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );
      await GET(request1, { params: { id: testAuctionId } });

      // Second request (cached)
      const request2 = new NextRequest(
        `http://localhost:3000/api/auctions/${testAuctionId}/prediction`
      );
      const startTime = Date.now();
      const response = await GET(request2, { params: { id: testAuctionId } });
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200);
    });
  });
});
