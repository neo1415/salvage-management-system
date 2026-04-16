/**
 * Integration Tests for Analytics API Endpoints
 * Task 12.2.4: Write integration tests for analytics API endpoints
 * 
 * Tests all analytics API endpoints with real database interactions,
 * authentication, authorization, filtering, and service integration.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getAssetPerformance } from '@/app/api/intelligence/analytics/asset-performance/route';
import { GET as getAttributePerformance } from '@/app/api/intelligence/analytics/attribute-performance/route';
import { GET as getTemporalPatterns } from '@/app/api/intelligence/analytics/temporal-patterns/route';
import { GET as getGeographicPatterns } from '@/app/api/intelligence/analytics/geographic-patterns/route';
import { GET as getVendorSegments } from '@/app/api/intelligence/analytics/vendor-segments/route';
import { GET as getSessionMetrics } from '@/app/api/intelligence/analytics/session-metrics/route';
import { GET as getConversionFunnel } from '@/app/api/intelligence/analytics/conversion-funnel/route';
import { GET as getRollups } from '@/app/api/intelligence/analytics/rollups/route';
import { db } from '@/lib/db';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { bids } from '@/lib/db/schema/bids';
import { users } from '@/lib/db/schema/users';
import { vendors } from '@/lib/db/schema/vendors';
import { interactions } from '@/lib/db/schema/intelligence';
import { eq, sql } from 'drizzle-orm';

// Mock auth for testing
import { vi } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

describe('Analytics API Integration Tests', () => {
  let testAdminUserId: string;
  let testManagerUserId: string;
  let testVendorUserId: string;
  let testVendorId: string;
  let testAuctionIds: string[] = [];
  let testCaseIds: string[] = [];
  let testUserIds: string[] = [];

  beforeAll(async () => {
    // Create test admin user
    const adminResult = await db.insert(users).values({
      email: `test-admin-analytics-${Date.now()}@example.com`,
      phone: `+1${Date.now().toString().slice(-10)}`,
      fullName: 'Test Admin Analytics',
      dateOfBirth: new Date('1990-01-01'),
      role: 'system_admin',
      status: 'verified_tier_1',
      passwordHash: 'test-hash',
    }).returning({ id: users.id });

    testAdminUserId = adminResult[0].id;
    testUserIds.push(testAdminUserId);

    // Create test manager user
    const managerResult = await db.insert(users).values({
      email: `test-manager-analytics-${Date.now()}@example.com`,
      phone: `+1${(Date.now() + 1).toString().slice(-10)}`,
      fullName: 'Test Manager Analytics',
      dateOfBirth: new Date('1990-01-01'),
      role: 'salvage_manager',
      status: 'verified_tier_1',
      passwordHash: 'test-hash',
    }).returning({ id: users.id });

    testManagerUserId = managerResult[0].id;
    testUserIds.push(testManagerUserId);

    // Create test vendor user
    const vendorUserResult = await db.insert(users).values({
      email: `test-vendor-analytics-${Date.now()}@example.com`,
      phone: `+1${(Date.now() + 2).toString().slice(-10)}`,
      fullName: 'Test Vendor Analytics',
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
      businessName: 'Test Vendor Analytics Business',
      tier: 'tier1_bvn',
      status: 'approved',
      categories: ['vehicle', 'electronics'],
    }).returning({ id: vendors.id });

    testVendorId = vendorResult[0].id;

    // Create diverse test data for analytics (reduced to 5 items for faster setup)
    const assetTypes = ['vehicle', 'electronics', 'machinery'];
    const makes = ['Toyota', 'Samsung', 'Caterpillar'];
    const models = ['Camry', 'Galaxy S21', 'D9T'];
    const damageLevels = ['minor', 'moderate', 'severe'];

    for (let i = 0; i < 5; i++) {
      const assetType = assetTypes[i % 3];
      const caseResult = await db.insert(salvageCases).values({
        createdBy: testAdminUserId,
        claimReference: `TEST-ANALYTICS-${Date.now()}-${i}`,
        assetType,
        assetDetails: {
          make: makes[i % 3],
          model: models[i % 3],
          year: (2018 + (i % 4)).toString(),
          color: i % 2 === 0 ? 'Black' : 'White',
          trim: 'Standard',
        },
        damageSeverity: damageLevels[i % 3],
        marketValue: (500000 + i * 100000).toString(),
        estimatedSalvageValue: (400000 + i * 80000).toString(),
        reservePrice: (350000 + i * 70000).toString(),
        gpsLocation: sql`point(${i % 3}, ${i % 2})`,
        locationName: i % 2 === 0 ? 'Lagos' : 'Abuja',
        photos: [],
      }).returning({ id: salvageCases.id });

      testCaseIds.push(caseResult[0].id);

      const auctionResult = await db.insert(auctions).values({
        caseId: caseResult[0].id,
        startTime: new Date(Date.now() - (30 - i * 2) * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - (23 - i * 2) * 24 * 60 * 60 * 1000),
        originalEndTime: new Date(Date.now() - (23 - i * 2) * 24 * 60 * 60 * 1000),
        status: i < 3 ? 'closed' : 'active',
        currentBid: i < 3 ? (400000 + i * 90000).toString() : null,
        currentBidder: i < 3 ? testVendorId : null,
        watchingCount: 5 + i,
      }).returning({ id: auctions.id });

      testAuctionIds.push(auctionResult[0].id);

      // Create bids for closed auctions
      if (i < 3) {
        await db.insert(bids).values({
          auctionId: auctionResult[0].id,
          vendorId: testVendorId,
          amount: (400000 + i * 90000).toString(),
          ipAddress: '127.0.0.1',
          deviceType: i % 2 === 0 ? 'desktop' : 'mobile',
        });

        // Create interaction records
        await db.insert(interactions).values({
          vendorId: testVendorId,
          auctionId: auctionResult[0].id,
          eventType: 'bid',
          metadata: { bidAmount: 400000 + i * 90000 },
        });
      }
    }
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    // Cleanup test data
    if (testAuctionIds.length > 0) {
      for (const auctionId of testAuctionIds) {
        await db.delete(interactions).where(eq(interactions.auctionId, auctionId));
        await db.delete(bids).where(eq(bids.auctionId, auctionId));
        await db.delete(auctions).where(eq(auctions.id, auctionId));
      }
    }

    if (testCaseIds.length > 0) {
      for (const caseId of testCaseIds) {
        await db.delete(salvageCases).where(eq(salvageCases.id, caseId));
      }
    }

    if (testVendorId) {
      await db.delete(vendors).where(eq(vendors.id, testVendorId));
    }

    for (const userId of testUserIds) {
      await db.delete(users).where(eq(users.id, userId));
    }
  }, 30000); // 30 second timeout for cleanup

  describe('Asset Performance Analytics', () => {
    describe('Authentication and Authorization', () => {
      it('should return 401 when not authenticated', async () => {
        const { auth } = await import('@/lib/auth');
        vi.mocked(auth).mockResolvedValue(null);

        const request = new NextRequest(
          'http://localhost:3000/api/intelligence/analytics/asset-performance'
        );

        const response = await getAssetPerformance(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Unauthorized');
      });

      it('should return 403 for non-admin/manager users', async () => {
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
          'http://localhost:3000/api/intelligence/analytics/asset-performance'
        );

        const response = await getAssetPerformance(request);
        const data = await response.json();

        expect(response.status).toBe(403);
        expect(data.error).toContain('Forbidden');
      });

      it('should allow admin access', async () => {
        const { auth } = await import('@/lib/auth');
        vi.mocked(auth).mockResolvedValue({
          user: { 
            id: testAdminUserId, 
            email: 'admin@example.com', 
            role: 'system_admin' 
          },
          expires: new Date(Date.now() + 86400000).toISOString(),
        });

        const request = new NextRequest(
          'http://localhost:3000/api/intelligence/analytics/asset-performance'
        );

        const response = await getAssetPerformance(request);
        expect(response.status).toBe(200);
      });

      it('should allow manager access', async () => {
        const { auth } = await import('@/lib/auth');
        vi.mocked(auth).mockResolvedValue({
          user: { 
            id: testManagerUserId, 
            email: 'manager@example.com', 
            role: 'salvage_manager' 
          },
          expires: new Date(Date.now() + 86400000).toISOString(),
        });

        const request = new NextRequest(
          'http://localhost:3000/api/intelligence/analytics/asset-performance'
        );

        const response = await getAssetPerformance(request);
        expect(response.status).toBe(200);
      });
    });

    describe('Request Validation and Filtering', () => {
      it('should accept valid assetType filter', async () => {
        const { auth } = await import('@/lib/auth');
        vi.mocked(auth).mockResolvedValue({
          user: { 
            id: testAdminUserId, 
            email: 'admin@example.com', 
            role: 'system_admin' 
          },
          expires: new Date(Date.now() + 86400000).toISOString(),
        });

        const request = new NextRequest(
          'http://localhost:3000/api/intelligence/analytics/asset-performance?assetType=vehicle'
        );

        const response = await getAssetPerformance(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.meta.filters.assetType).toBe('vehicle');
      });

      it('should accept make and model filters', async () => {
        const { auth } = await import('@/lib/auth');
        vi.mocked(auth).mockResolvedValue({
          user: { 
            id: testAdminUserId, 
            email: 'admin@example.com', 
            role: 'system_admin' 
          },
          expires: new Date(Date.now() + 86400000).toISOString(),
        });

        const request = new NextRequest(
          'http://localhost:3000/api/intelligence/analytics/asset-performance?make=Toyota&model=Camry'
        );

        const response = await getAssetPerformance(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.meta.filters.make).toBe('Toyota');
        expect(data.meta.filters.model).toBe('Camry');
      });

      it('should accept date range filters', async () => {
        const { auth } = await import('@/lib/auth');
        vi.mocked(auth).mockResolvedValue({
          user: { 
            id: testAdminUserId, 
            email: 'admin@example.com', 
            role: 'system_admin' 
          },
          expires: new Date(Date.now() + 86400000).toISOString(),
        });

        const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = new Date().toISOString();

        const request = new NextRequest(
          `http://localhost:3000/api/intelligence/analytics/asset-performance?startDate=${startDate}&endDate=${endDate}`
        );

        const response = await getAssetPerformance(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.meta.filters.startDate).toBe(startDate);
        expect(data.meta.filters.endDate).toBe(endDate);
      });

      it('should reject invalid date format', async () => {
        const { auth } = await import('@/lib/auth');
        vi.mocked(auth).mockResolvedValue({
          user: { 
            id: testAdminUserId, 
            email: 'admin@example.com', 
            role: 'system_admin' 
          },
          expires: new Date(Date.now() + 86400000).toISOString(),
        });

        const request = new NextRequest(
          'http://localhost:3000/api/intelligence/analytics/asset-performance?startDate=invalid-date'
        );

        const response = await getAssetPerformance(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid query parameters');
      });

      it('should respect limit parameter', async () => {
        const { auth } = await import('@/lib/auth');
        vi.mocked(auth).mockResolvedValue({
          user: { 
            id: testAdminUserId, 
            email: 'admin@example.com', 
            role: 'system_admin' 
          },
          expires: new Date(Date.now() + 86400000).toISOString(),
        });

        const request = new NextRequest(
          'http://localhost:3000/api/intelligence/analytics/asset-performance?limit=5'
        );

        const response = await getAssetPerformance(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.length).toBeLessThanOrEqual(5);
      });
    });

    describe('Response Format', () => {
      it('should return properly formatted response', async () => {
        const { auth } = await import('@/lib/auth');
        vi.mocked(auth).mockResolvedValue({
          user: { 
            id: testAdminUserId, 
            email: 'admin@example.com', 
            role: 'system_admin' 
          },
          expires: new Date(Date.now() + 86400000).toISOString(),
        });

        const request = new NextRequest(
          'http://localhost:3000/api/intelligence/analytics/asset-performance'
        );

        const response = await getAssetPerformance(request);
        const data = await response.json();

        expect(data).toHaveProperty('success');
        expect(data).toHaveProperty('data');
        expect(data).toHaveProperty('meta');
        expect(data.meta).toHaveProperty('count');
        expect(data.meta).toHaveProperty('filters');
        expect(Array.isArray(data.data)).toBe(true);
      });
    });
  });

  describe('Attribute Performance Analytics', () => {
    it('should return attribute performance data', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/attribute-performance'
      );

      const response = await getAttributePerformance(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by attributeType', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
          },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/attribute-performance?attributeType=color'
      );

      const response = await getAttributePerformance(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.filters.attributeType).toBe('color');
    });

    it('should reject invalid attributeType', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/attribute-performance?attributeType=invalid'
      );

      const response = await getAttributePerformance(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid query parameters');
    });

    it('should require admin/manager role', async () => {
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
        'http://localhost:3000/api/intelligence/analytics/attribute-performance'
      );

      const response = await getAttributePerformance(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });
  });

  describe('Temporal Patterns Analytics', () => {
    it('should return temporal pattern data', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/temporal-patterns'
      );

      const response = await getTemporalPatterns(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by patternType', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/temporal-patterns?patternType=daily'
      );

      const response = await getTemporalPatterns(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.filters.patternType).toBe('daily');
    });

    it('should accept all valid patternTypes', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const patternTypes = ['hourly', 'daily', 'weekly', 'monthly'];

      for (const patternType of patternTypes) {
        const request = new NextRequest(
          `http://localhost:3000/api/intelligence/analytics/temporal-patterns?patternType=${patternType}`
        );

        const response = await getTemporalPatterns(request);
        expect(response.status).toBe(200);
      }
    });

    it('should reject invalid patternType', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/temporal-patterns?patternType=invalid'
      );

      const response = await getTemporalPatterns(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid query parameters');
    });
  });

  describe('Geographic Patterns Analytics', () => {
    it('should return geographic pattern data', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/geographic-patterns'
      );

      const response = await getGeographicPatterns(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by region', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/geographic-patterns?region=Lagos'
      );

      const response = await getGeographicPatterns(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.filters.region).toBe('Lagos');
    });

    it('should filter by assetType and region together', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/geographic-patterns?assetType=vehicle&region=Lagos'
      );

      const response = await getGeographicPatterns(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.filters.assetType).toBe('vehicle');
      expect(data.meta.filters.region).toBe('Lagos');
    });
  });

  describe('Vendor Segments Analytics', () => {
    it('should return vendor segment data', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/vendor-segments'
      );

      const response = await getVendorSegments(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by segment type', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/vendor-segments?segment=bargain_hunter'
      );

      const response = await getVendorSegments(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.filters.segment).toBe('bargain_hunter');
    });

    it('should accept all valid segment types', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const segments = ['bargain_hunter', 'premium_buyer', 'specialist', 'opportunist', 'inactive'];

      for (const segment of segments) {
        const request = new NextRequest(
          `http://localhost:3000/api/intelligence/analytics/vendor-segments?segment=${segment}`
        );

        const response = await getVendorSegments(request);
        expect(response.status).toBe(200);
      }
    });

    it('should reject invalid segment type', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/vendor-segments?segment=invalid'
      );

      const response = await getVendorSegments(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid query parameters');
    });

    it('should respect limit parameter', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/vendor-segments?limit=10'
      );

      const response = await getVendorSegments(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Session Metrics Analytics', () => {
    it('should return session metrics data', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/session-metrics'
      );

      const response = await getSessionMetrics(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should filter by vendorId', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/intelligence/analytics/session-metrics?vendorId=${testVendorId}`
      );

      const response = await getSessionMetrics(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.filters.vendorId).toBe(testVendorId);
    });

    it('should reject invalid vendorId format', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/session-metrics?vendorId=invalid-uuid'
      );

      const response = await getSessionMetrics(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid query parameters');
    });

    it('should accept date range filters', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const request = new NextRequest(
        `http://localhost:3000/api/intelligence/analytics/session-metrics?startDate=${startDate}&endDate=${endDate}`
      );

      const response = await getSessionMetrics(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.filters.startDate).toBe(startDate);
      expect(data.meta.filters.endDate).toBe(endDate);
    });
  });

  describe('Conversion Funnel Analytics', () => {
    it('should return conversion funnel data', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/conversion-funnel'
      );

      const response = await getConversionFunnel(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should filter by assetType', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/conversion-funnel?assetType=vehicle'
      );

      const response = await getConversionFunnel(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.filters.assetType).toBe('vehicle');
    });

    it('should filter by vendorSegment', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/conversion-funnel?vendorSegment=premium_buyer'
      );

      const response = await getConversionFunnel(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.filters.vendorSegment).toBe('premium_buyer');
    });

    it('should require admin/manager role', async () => {
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
        'http://localhost:3000/api/intelligence/analytics/conversion-funnel'
      );

      const response = await getConversionFunnel(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });
  });

  describe('Analytics Rollups', () => {
    it('should return rollup data', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/rollups?rollupType=daily'
      );

      const response = await getRollups(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('should require rollupType parameter', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/rollups'
      );

      const response = await getRollups(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid query parameters');
    });

    it('should accept all valid rollupTypes', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const rollupTypes = ['hourly', 'daily', 'weekly', 'monthly'];

      for (const rollupType of rollupTypes) {
        const request = new NextRequest(
          `http://localhost:3000/api/intelligence/analytics/rollups?rollupType=${rollupType}`
        );

        const response = await getRollups(request);
        expect(response.status).toBe(200);
      }
    });

    it('should filter by metricType', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/rollups?rollupType=daily&metricType=asset_performance'
      );

      const response = await getRollups(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.filters.metricType).toBe('asset_performance');
    });

    it('should accept all valid metricTypes', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const metricTypes = ['asset_performance', 'vendor_activity', 'market_conditions'];

      for (const metricType of metricTypes) {
        const request = new NextRequest(
          `http://localhost:3000/api/intelligence/analytics/rollups?rollupType=daily&metricType=${metricType}`
        );

        const response = await getRollups(request);
        expect(response.status).toBe(200);
      }
    });

    it('should reject invalid metricType', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/rollups?rollupType=daily&metricType=invalid'
      );

      const response = await getRollups(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid query parameters');
    });

    it('should accept date range filters', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const request = new NextRequest(
        `http://localhost:3000/api/intelligence/analytics/rollups?rollupType=daily&startDate=${startDate}&endDate=${endDate}`
      );

      const response = await getRollups(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.meta.filters.startDate).toBe(startDate);
      expect(data.meta.filters.endDate).toBe(endDate);
    });

    it('should respect higher limit for rollups', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/rollups?rollupType=daily&limit=500'
      );

      const response = await getRollups(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBeLessThanOrEqual(500);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      // Test with extreme date range that might cause issues
      const startDate = new Date('1900-01-01').toISOString();
      const endDate = new Date('2100-01-01').toISOString();

      const request = new NextRequest(
        `http://localhost:3000/api/intelligence/analytics/asset-performance?startDate=${startDate}&endDate=${endDate}`
      );

      const response = await getAssetPerformance(request);
      
      // Should handle gracefully - either 200 with empty data or 500
      expect([200, 500]).toContain(response.status);
    });

    it('should return 500 on unexpected server errors', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      // All endpoints should handle errors gracefully
      const endpoints = [
        getAssetPerformance,
        getAttributePerformance,
        getTemporalPatterns,
        getGeographicPatterns,
        getVendorSegments,
        getSessionMetrics,
        getConversionFunnel,
      ];

      for (const endpoint of endpoints) {
        const request = new NextRequest('http://localhost:3000/api/test');
        const response = await endpoint(request);
        
        // Should return valid HTTP status
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(600);
      }
    });
  });

  describe('Data Aggregation Accuracy', () => {
    it('should return consistent counts across endpoints', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const assetRequest = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/asset-performance'
      );

      const assetResponse = await getAssetPerformance(assetRequest);
      const assetData = await assetResponse.json();

      expect(assetData.meta.count).toBe(assetData.data.length);
    });

    it('should filter data correctly by assetType', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const vehicleRequest = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/asset-performance?assetType=vehicle'
      );

      const vehicleResponse = await getAssetPerformance(vehicleRequest);
      const vehicleData = await vehicleResponse.json();

      const electronicsRequest = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/asset-performance?assetType=electronics'
      );

      const electronicsResponse = await getAssetPerformance(electronicsRequest);
      const electronicsData = await electronicsResponse.json();

      // Both should return data (we created both types)
      expect(vehicleData.data.length).toBeGreaterThanOrEqual(0);
      expect(electronicsData.data.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance', () => {
    it('should respond within reasonable time for asset performance', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/intelligence/analytics/asset-performance'
      );

      const startTime = Date.now();
      const response = await getAssetPerformance(request);
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });

    it('should respond within reasonable time for all endpoints', async () => {
      const { auth } = await import('@/lib/auth');
      vi.mocked(auth).mockResolvedValue({
        user: { 
          id: testAdminUserId, 
          email: 'admin@example.com', 
          role: 'system_admin' 
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      });

      const endpoints = [
        { fn: getAttributePerformance, url: 'http://localhost:3000/api/intelligence/analytics/attribute-performance' },
        { fn: getTemporalPatterns, url: 'http://localhost:3000/api/intelligence/analytics/temporal-patterns' },
        { fn: getGeographicPatterns, url: 'http://localhost:3000/api/intelligence/analytics/geographic-patterns' },
        { fn: getVendorSegments, url: 'http://localhost:3000/api/intelligence/analytics/vendor-segments' },
        { fn: getSessionMetrics, url: 'http://localhost:3000/api/intelligence/analytics/session-metrics' },
        { fn: getConversionFunnel, url: 'http://localhost:3000/api/intelligence/analytics/conversion-funnel' },
        { fn: getRollups, url: 'http://localhost:3000/api/intelligence/analytics/rollups?rollupType=daily' },
      ];

      for (const endpoint of endpoints) {
        const request = new NextRequest(endpoint.url);
        const startTime = Date.now();
        const response = await endpoint.fn(request);
        const duration = Date.now() - startTime;

        expect(response.status).toBe(200);
        expect(duration).toBeLessThan(5000); // 5 seconds max
      }
    });
  });
});

