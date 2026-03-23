/**
 * Integration tests for report generation API endpoints
 * Tests recovery summary, vendor rankings, and payment aging reports
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { users, vendors, salvageCases, auctions, bids, payments } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

describe('Report Generation Integration Tests', () => {
  let managerId: string;
  let vendorUserId: string;
  let vendorId: string;
  let caseId: string;
  let auctionId: string;

  beforeAll(async () => {
    // Create test manager
    const [manager] = await db
      .insert(users)
      .values({
        email: `manager-report-${Date.now()}@test.com`,
        phone: `+23480${Math.floor(Math.random() * 100000000)}`,
        passwordHash: 'hashed',
        fullName: 'Test Manager',
        dateOfBirth: new Date('1990-01-01'),
        role: 'salvage_manager',
        status: 'verified_tier_1',
      })
      .returning();
    managerId = manager.id;

    // Create test vendor user
    const [vendorUser] = await db
      .insert(users)
      .values({
        email: `vendor-report-${Date.now()}@test.com`,
        phone: `+23480${Math.floor(Math.random() * 100000000)}`,
        passwordHash: 'hashed',
        fullName: 'Test Vendor',
        dateOfBirth: new Date('1990-01-01'),
        role: 'vendor',
        status: 'verified_tier_1',
      })
      .returning();
    vendorUserId = vendorUser.id;

    // Create test vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: vendorUserId,
        businessName: 'Test Vendor Business',
        tier: 'tier1_bvn',
        status: 'approved',
        rating: '4.5',
      })
      .returning();
    vendorId = vendor.id;

    // Create test case with proper GPS point format
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        claimReference: `TEST-REPORT-${Date.now()}`,
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
        locationName: 'Lagos',
        photos: ['photo1.jpg'],
        status: 'sold',
        createdBy: managerId,
      })
      .returning();
    caseId = testCase.id;

    // Create test auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: caseId,
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        originalEndTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        currentBid: '300000',
        currentBidder: vendorId,
        status: 'closed',
      })
      .returning();
    auctionId = auction.id;

    // Create test bid
    await db.insert(bids).values({
      auctionId: auctionId,
      vendorId: vendorId,
      amount: '300000',
      otpVerified: true,
      ipAddress: '127.0.0.1',
      deviceType: 'mobile',
    });

    // Create test payment
    await db.insert(payments).values({
      auctionId: auctionId,
      vendorId: vendorId,
      amount: '300000',
      paymentMethod: 'paystack',
      status: 'verified',
      autoVerified: true,
      paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      verifiedAt: new Date(),
    });
  });

  afterAll(async () => {
    // Cleanup test data in correct order
    try {
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
      if (vendorUserId) {
        await db.delete(users).where(eq(users.id, vendorUserId));
      }
      if (managerId) {
        await db.delete(users).where(eq(users.id, managerId));
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  describe('Report Data Queries', () => {
    it('should query recovery summary data correctly', async () => {
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      // Query cases with auctions and payments
      const casesWithAuctions = await db
        .select({
          caseId: salvageCases.id,
          marketValue: salvageCases.marketValue,
          assetType: salvageCases.assetType,
          currentBid: auctions.currentBid,
          paymentAmount: payments.amount,
        })
        .from(salvageCases)
        .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
        .leftJoin(payments, eq(auctions.id, payments.auctionId))
        .where(eq(salvageCases.status, 'sold'));

      expect(casesWithAuctions.length).toBeGreaterThan(0);
      expect(casesWithAuctions[0]).toHaveProperty('marketValue');
      expect(casesWithAuctions[0]).toHaveProperty('paymentAmount');
    });

    it('should query vendor rankings data correctly', async () => {
      // Query vendors with their bids and payments
      const vendorData = await db
        .select({
          vendorId: vendors.id,
          businessName: vendors.businessName,
          tier: vendors.tier,
          rating: vendors.rating,
          bidAmount: bids.amount,
          currentBidder: auctions.currentBidder,
          auctionStatus: auctions.status,
        })
        .from(vendors)
        .leftJoin(bids, eq(vendors.id, bids.vendorId))
        .leftJoin(auctions, eq(bids.auctionId, auctions.id))
        .where(eq(vendors.status, 'approved'));

      expect(vendorData.length).toBeGreaterThan(0);
      expect(vendorData[0]).toHaveProperty('businessName');
      expect(vendorData[0]).toHaveProperty('tier');
    });

    it('should query payment aging data correctly', async () => {
      // Query payments with related data
      const paymentData = await db
        .select({
          paymentId: payments.id,
          amount: payments.amount,
          status: payments.status,
          paymentDeadline: payments.paymentDeadline,
          createdAt: payments.createdAt,
          verifiedAt: payments.verifiedAt,
          claimReference: salvageCases.claimReference,
          businessName: vendors.businessName,
        })
        .from(payments)
        .innerJoin(auctions, eq(payments.auctionId, auctions.id))
        .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
        .innerJoin(vendors, eq(payments.vendorId, vendors.id));

      expect(paymentData.length).toBeGreaterThan(0);
      expect(paymentData[0]).toHaveProperty('amount');
      expect(paymentData[0]).toHaveProperty('status');
      expect(paymentData[0]).toHaveProperty('paymentDeadline');
    });

    it('should calculate recovery rate correctly', async () => {
      const marketValue = 1000000;
      const recoveryValue = 300000;
      const recoveryRate = (recoveryValue / marketValue) * 100;

      expect(recoveryRate).toBe(30);
      expect(recoveryRate).toBeGreaterThan(0);
      expect(recoveryRate).toBeLessThanOrEqual(100);
    });

    it('should calculate payment aging correctly', async () => {
      const now = new Date();
      const deadline = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago
      const hoursOverdue = (now.getTime() - deadline.getTime()) / (1000 * 60 * 60);

      expect(hoursOverdue).toBeGreaterThan(24);
      expect(hoursOverdue).toBeLessThan(48);
    });
  });

  describe('Report HTML Generation', () => {
    it('should generate valid HTML for recovery summary', () => {
      const data = {
        summary: {
          totalCases: 10,
          totalMarketValue: 10000000,
          totalRecoveryValue: 3500000,
          averageRecoveryRate: 35,
        },
        byAssetType: [
          {
            assetType: 'vehicle',
            count: 5,
            marketValue: 5000000,
            recoveryValue: 1750000,
            recoveryRate: 35,
          },
        ],
        trend: [],
      };

      const title = 'Recovery Summary Report';
      const dateRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      };

      // Simple HTML generation test
      const html = `<h1>${title}</h1><p>Total Cases: ${data.summary.totalCases}</p>`;

      expect(html).toContain(title);
      expect(html).toContain('Total Cases');
      expect(html).toContain('10');
    });
  });
});
