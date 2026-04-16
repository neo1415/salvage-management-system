/**
 * Fraud Detection Service Integration Tests
 * Task 4.5.5: Add integration tests for fraud detection system
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { FraudDetectionService } from '@/features/intelligence/services/fraud-detection.service';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { fraudAlerts } from '@/lib/db/schema/intelligence';
import { eq } from 'drizzle-orm';

describe('FraudDetectionService Integration Tests', () => {
  let fraudService: FraudDetectionService;
  let testUserId: string;
  let testVendorId: string;
  let testAdjusterId: string;
  let testCaseId: string;
  let testAuctionId: string;

  beforeAll(async () => {
    fraudService = new FraudDetectionService();

    // Create test user
    const [user] = await db
      .insert(users)
      .values({
        email: `fraud-test-${Date.now()}@test.com`,
        name: 'Fraud Test User',
        role: 'user',
        status: 'active',
      })
      .returning({ id: users.id });
    testUserId = user.id;

    // Create test vendor
    const [vendor] = await db
      .insert(vendors)
      .values({
        userId: testUserId,
        businessName: 'Test Vendor',
        businessType: 'individual',
        status: 'active',
      })
      .returning({ id: vendors.id });
    testVendorId = vendor.id;

    // Create test adjuster
    const [adjuster] = await db
      .insert(users)
      .values({
        email: `adjuster-test-${Date.now()}@test.com`,
        name: 'Test Adjuster',
        role: 'adjuster',
        status: 'active',
      })
      .returning({ id: users.id });
    testAdjusterId = adjuster.id;

    // Create test case
    const [testCase] = await db
      .insert(salvageCases)
      .values({
        userId: testUserId,
        adjusterId: testAdjusterId,
        caseNumber: `FRAUD-TEST-${Date.now()}`,
        assetType: 'vehicle',
        assetDetails: {
          make: 'Toyota',
          model: 'Camry',
          year: '2020',
          color: 'Silver',
        },
        damageSeverity: 'moderate',
        marketValue: '5000000',
        estimatedSalvageValue: '2000000',
        status: 'approved',
      })
      .returning({ id: salvageCases.id });
    testCaseId = testCase.id;

    // Create test auction
    const [auction] = await db
      .insert(auctions)
      .values({
        caseId: testCaseId,
        startingBid: 1500000,
        minimumBid: 1500000,
        startTime: new Date(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'active',
      })
      .returning({ id: auctions.id });
    testAuctionId = auction.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testAuctionId) {
      await db.delete(bids).where(eq(bids.auctionId, testAuctionId));
      await db.delete(auctions).where(eq(auctions.id, testAuctionId));
    }
    if (testCaseId) {
      await db.delete(salvageCases).where(eq(salvageCases.id, testCaseId));
    }
    if (testVendorId) {
      await db.delete(vendors).where(eq(vendors.id, testVendorId));
    }
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testAdjusterId) {
      await db.delete(users).where(eq(users.id, testAdjusterId));
    }
    
    // Cleanup fraud alerts
    await db.delete(fraudAlerts).where(eq(fraudAlerts.entityId, testAuctionId));
    await db.delete(fraudAlerts).where(eq(fraudAlerts.entityId, testCaseId));
  });

  describe('Shill Bidding Detection', () => {
    it('should detect consecutive bids from same vendor', async () => {
      // Create consecutive bids
      for (let i = 0; i < 4; i++) {
        await db.insert(bids).values({
          auctionId: testAuctionId,
          vendorId: testVendorId,
          amount: (1500000 + i * 50000).toString(),
          status: 'active',
        });
      }

      const result = await fraudService.detectShillBidding(testAuctionId);

      expect(result.isShillBidding).toBe(false); // Risk score should be 30, below threshold
      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.flagReasons.length).toBeGreaterThan(0);
      expect(result.suspiciousPatterns.length).toBeGreaterThan(0);
    });

    it('should detect IP/device collusion', async () => {
      // Create second vendor
      const [user2] = await db
        .insert(users)
        .values({
          email: `fraud-test-2-${Date.now()}@test.com`,
          name: 'Fraud Test User 2',
          role: 'user',
          status: 'active',
        })
        .returning({ id: users.id });

      const [vendor2] = await db
        .insert(vendors)
        .values({
          userId: user2.id,
          businessName: 'Test Vendor 2',
          businessType: 'individual',
          status: 'active',
        })
        .returning({ id: vendors.id });

      // Create bids from same IP
      await db.insert(bids).values({
        auctionId: testAuctionId,
        vendorId: testVendorId,
        amount: '1600000',
        status: 'active',
        metadata: { ipAddress: '192.168.1.1', deviceFingerprint: 'abc123' },
      });

      await db.insert(bids).values({
        auctionId: testAuctionId,
        vendorId: vendor2.id,
        amount: '1650000',
        status: 'active',
        metadata: { ipAddress: '192.168.1.1', deviceFingerprint: 'abc123' },
      });

      const result = await fraudService.detectShillBidding(testAuctionId);

      expect(result.riskScore).toBeGreaterThan(30);
      expect(result.flagReasons.some(r => r.includes('same IP'))).toBe(true);

      // Cleanup
      await db.delete(vendors).where(eq(vendors.id, vendor2.id));
      await db.delete(users).where(eq(users.id, user2.id));
    });
  });

  describe('Claim Pattern Fraud Detection', () => {
    it('should detect repeat claimants', async () => {
      // Create multiple cases for same user
      const caseIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const [testCase] = await db
          .insert(salvageCases)
          .values({
            userId: testUserId,
            adjusterId: testAdjusterId,
            caseNumber: `FRAUD-REPEAT-${Date.now()}-${i}`,
            assetType: 'vehicle',
            assetDetails: {
              make: 'Toyota',
              model: 'Camry',
              year: '2020',
            },
            damageSeverity: 'moderate',
            marketValue: '5000000',
            estimatedSalvageValue: '2000000',
            status: 'approved',
            damagedParts: ['front_bumper', 'hood', 'headlight'],
          })
          .returning({ id: salvageCases.id });
        caseIds.push(testCase.id);
      }

      const result = await fraudService.analyzeClaimPatterns(testCaseId);

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.flagReasons.some(r => r.includes('claims in past 12 months'))).toBe(true);

      // Cleanup
      for (const id of caseIds) {
        await db.delete(salvageCases).where(eq(salvageCases.id, id));
      }
    });

    it('should detect similar damage patterns', async () => {
      // Create case with similar damage
      const [similarCase] = await db
        .insert(salvageCases)
        .values({
          userId: testUserId,
          adjusterId: testAdjusterId,
          caseNumber: `FRAUD-SIMILAR-${Date.now()}`,
          assetType: 'vehicle',
          assetDetails: {
            make: 'Toyota',
            model: 'Camry',
            year: '2020',
          },
          damageSeverity: 'moderate',
          marketValue: '5000000',
          estimatedSalvageValue: '2000000',
          status: 'approved',
          damagedParts: ['front_bumper', 'hood', 'headlight'],
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        })
        .returning({ id: salvageCases.id });

      // Update test case with same damage pattern
      await db
        .update(salvageCases)
        .set({
          damagedParts: ['front_bumper', 'hood', 'headlight'],
        })
        .where(eq(salvageCases.id, testCaseId));

      const result = await fraudService.analyzeClaimPatterns(testCaseId);

      expect(result.similarClaims.length).toBeGreaterThan(0);

      // Cleanup
      await db.delete(salvageCases).where(eq(salvageCases.id, similarCase.id));
    });
  });

  describe('Vendor-Adjuster Collusion Detection', () => {
    it('should detect high win rates for vendor-adjuster pairs', async () => {
      // Create multiple auctions with same vendor winning
      const auctionIds: string[] = [];
      for (let i = 0; i < 6; i++) {
        const [testCase] = await db
          .insert(salvageCases)
          .values({
            userId: testUserId,
            adjusterId: testAdjusterId,
            caseNumber: `COLLUSION-${Date.now()}-${i}`,
            assetType: 'vehicle',
            assetDetails: { make: 'Toyota', model: 'Camry', year: '2020' },
            damageSeverity: 'moderate',
            marketValue: '5000000',
            estimatedSalvageValue: '2000000',
            status: 'approved',
          })
          .returning({ id: salvageCases.id });

        const [auction] = await db
          .insert(auctions)
          .values({
            caseId: testCase.id,
            startingBid: 1500000,
            minimumBid: 1500000,
            currentBid: 1800000,
            currentBidder: testVendorId,
            startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            endTime: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
            status: 'closed',
          })
          .returning({ id: auctions.id });

        auctionIds.push(auction.id);
      }

      const result = await fraudService.detectCollusion(testVendorId, testAdjusterId);

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.collusionPairs.length).toBeGreaterThan(0);

      // Cleanup
      for (const id of auctionIds) {
        const [auction] = await db
          .select({ caseId: auctions.caseId })
          .from(auctions)
          .where(eq(auctions.id, id));
        await db.delete(auctions).where(eq(auctions.id, id));
        if (auction) {
          await db.delete(salvageCases).where(eq(salvageCases.id, auction.caseId));
        }
      }
    });
  });

  describe('Fraud Alert Creation', () => {
    it('should create fraud alert and broadcast to admins', async () => {
      const alertId = await fraudService.createFraudAlert(
        'auction',
        testAuctionId,
        75,
        ['Test fraud reason 1', 'Test fraud reason 2'],
        { testData: true }
      );

      expect(alertId).toBeDefined();

      // Verify alert was created
      const [alert] = await db
        .select()
        .from(fraudAlerts)
        .where(eq(fraudAlerts.id, alertId));

      expect(alert).toBeDefined();
      expect(alert.entityType).toBe('auction');
      expect(alert.entityId).toBe(testAuctionId);
      expect(alert.riskScore).toBe(75);
      expect(alert.status).toBe('pending');
    });
  });
});
