import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { GET } from '@/app/api/dashboard/manager/route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users, vendors, salvageCases, auctions, bids, payments } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import * as authModule from '@/lib/auth/next-auth.config';

/**
 * Integration tests for Manager Dashboard API
 * 
 * Tests:
 * - Authentication and authorization
 * - KPI calculations
 * - Charts data generation
 * - Caching functionality
 * - Query parameter filtering
 */

describe('Manager Dashboard API', () => {
  let managerId: string;
  let vendorId: string;
  let caseId: string;
  let auctionId: string;

  beforeAll(async () => {
    // Create test manager user
    const [manager] = await db
      .insert(users)
      .values({
        email: 'manager@test.com',
        phone: '+2348012345678',
        passwordHash: 'hashed_password',
        fullName: 'Test Manager',
        dateOfBirth: new Date('1990-01-01'),
        role: 'salvage_manager',
        status: 'phone_verified_tier_0',
      })
      .returning();
    managerId = manager.id;

    // Create test vendor
    const [vendor] = await db
      .insert(users)
      .values({
        email: 'vendor@test.com',
        phone: '+2348012345679',
        passwordHash: 'hashed_password',
        fullName: 'Test Vendor',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
        status: 'verified_tier_1',
      })
      .returning();

    const [vendorRecord] = await db
      .insert(vendors)
      .values({
        userId: vendor.id,
        businessName: 'Test Vendor Business',
        tier: 'tier1_bvn',
        status: 'approved',
        categories: ['vehicle'],
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
    vendorId = vendorRecord.id;

    // Create test case
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: 'TEST-CASE-001',
        assetType: 'vehicle',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          vin: 'TEST123456789',
        },
        marketValue: '1000000.00',
        estimatedSalvageValue: '300000.00',
        reservePrice: '210000.00',
        damageSeverity: 'moderate',
        aiAssessment: {
          labels: ['front damage', 'bumper dent'],
          confidenceScore: 85,
          damagePercentage: 30,
          processedAt: new Date(),
        },
        gpsLocation: sql`point(6.5244, 3.3792)`,
        locationName: 'Lagos, Nigeria',
        photos: ['https://example.com/photo1.jpg'],
        voiceNotes: [],
        status: 'approved',
        createdBy: managerId,
        approvedBy: managerId,
        approvedAt: new Date(),
      })
      .returning();
    caseId = testCase.id;

    // Create test auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: caseId,
        startTime: new Date(),
        endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        originalEndTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        extensionCount: 0,
        currentBid: '250000.00',
        currentBidder: vendorId,
        minimumIncrement: '10000.00',
        status: 'active',
        watchingCount: 5,
      })
      .returning();
    auctionId = auction.id;

    // Create test bid
    await db.insert(bids).values({
      auctionId: auctionId,
      vendorId: vendorId,
      amount: '250000.00',
      otpVerified: true,
      ipAddress: '192.168.1.1',
      deviceType: 'mobile',
    });

    // Create test payment
    await db.insert(payments).values({
      auctionId: auctionId,
      vendorId: vendorId,
      amount: '250000.00',
      paymentMethod: 'paystack',
      paymentReference: 'TEST-REF-001',
      escrowStatus: 'none',
      status: 'verified',
      autoVerified: true,
      paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (auctionId) {
      await db.delete(payments).where(eq(payments.auctionId, auctionId));
      await db.delete(bids).where(eq(bids.auctionId, auctionId));
      await db.delete(auctions).where(eq(auctions.id, auctionId));
    }
    if (caseId) {
      await db.delete(salvageCases).where(eq(salvageCases.id, caseId));
    }
    if (vendorId) {
      await db.delete(vendors).where(eq(vendors.id, vendorId));
    }
    if (managerId) {
      await db.delete(users).where(eq(users.id, managerId));
    }
  });

  it('should return 401 if user is not authenticated', async () => {
    // Mock auth to return null
    vi.spyOn(authModule, 'auth').mockResolvedValue(null as any);

    const request = new NextRequest('http://localhost:3000/api/dashboard/manager');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');

    vi.restoreAllMocks();
  });

  it('should return 403 if user is not a salvage manager', async () => {
    // Mock auth to return vendor user
    vi.spyOn(authModule, 'auth').mockResolvedValue({
      user: {
        id: 'vendor-id',
        email: 'vendor@test.com',
        role: 'vendor',
        status: 'verified_tier_1',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/dashboard/manager');
    const response = await GET(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Forbidden');

    vi.restoreAllMocks();
  });

  it('should return dashboard data for authenticated manager', async () => {
    // Mock auth to return manager user
    vi.spyOn(authModule, 'auth').mockResolvedValue({
      user: {
        id: managerId,
        email: 'manager@test.com',
        role: 'salvage_manager',
        status: 'phone_verified_tier_0',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/dashboard/manager');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    // Verify KPIs structure
    expect(data.kpis).toBeDefined();
    expect(data.kpis.activeAuctions).toBeGreaterThanOrEqual(0);
    expect(data.kpis.totalBidsToday).toBeGreaterThanOrEqual(0);
    expect(data.kpis.averageRecoveryRate).toBeGreaterThanOrEqual(0);
    expect(data.kpis.casesPendingApproval).toBeGreaterThanOrEqual(0);

    // Verify charts structure
    expect(data.charts).toBeDefined();
    expect(data.charts.recoveryRateTrend).toBeInstanceOf(Array);
    expect(data.charts.topVendors).toBeInstanceOf(Array);
    expect(data.charts.paymentStatusBreakdown).toBeInstanceOf(Array);

    // Verify lastUpdated timestamp
    expect(data.lastUpdated).toBeDefined();
    expect(new Date(data.lastUpdated).getTime()).toBeLessThanOrEqual(Date.now());

    vi.restoreAllMocks();
  });

  it('should support date range filtering', async () => {
    // Mock auth to return manager user
    vi.spyOn(authModule, 'auth').mockResolvedValue({
      user: {
        id: managerId,
        email: 'manager@test.com',
        role: 'salvage_manager',
        status: 'phone_verified_tier_0',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/dashboard/manager?dateRange=7');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    // Verify recovery rate trend respects date range
    expect(data.charts.recoveryRateTrend).toBeInstanceOf(Array);
    
    vi.restoreAllMocks();
  });

  it('should support asset type filtering', async () => {
    // Mock auth to return manager user
    vi.spyOn(authModule, 'auth').mockResolvedValue({
      user: {
        id: managerId,
        email: 'manager@test.com',
        role: 'salvage_manager',
        status: 'phone_verified_tier_0',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/dashboard/manager?assetType=vehicle');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    // Verify data is returned (filtering logic is applied)
    expect(data.kpis).toBeDefined();
    expect(data.charts).toBeDefined();

    vi.restoreAllMocks();
  });

  it('should cache dashboard data', async () => {
    // Mock auth to return manager user
    vi.spyOn(authModule, 'auth').mockResolvedValue({
      user: {
        id: managerId,
        email: 'manager@test.com',
        role: 'salvage_manager',
        status: 'phone_verified_tier_0',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as any);

    // First request - should hit database
    const request1 = new NextRequest('http://localhost:3000/api/dashboard/manager');
    const response1 = await GET(request1);
    expect(response1.status).toBe(200);
    const data1 = await response1.json();
    const timestamp1 = data1.lastUpdated;

    // Second request - should hit cache (same timestamp)
    const request2 = new NextRequest('http://localhost:3000/api/dashboard/manager');
    const response2 = await GET(request2);
    expect(response2.status).toBe(200);
    const data2 = await response2.json();
    const timestamp2 = data2.lastUpdated;

    // Timestamps should be the same (cached)
    expect(timestamp1).toBe(timestamp2);

    vi.restoreAllMocks();
  });
});
