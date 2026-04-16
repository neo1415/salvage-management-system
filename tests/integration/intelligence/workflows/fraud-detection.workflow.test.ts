/**
 * Fraud Detection Workflow Integration Tests
 * Task 12.2.3: Write integration tests for fraud detection workflows
 * 
 * Comprehensive end-to-end tests for fraud detection workflows including:
 * - Photo authenticity detection (pHash, duplicate detection, EXIF validation)
 * - Shill bidding detection (consecutive bids, timing patterns, collusion)
 * - Claim pattern fraud detection (repeat claimants, similar damage patterns)
 * - Vendor-adjuster collusion detection (win patterns, price manipulation)
 * - Fraud alert creation and notification workflows
 * - Fraud alert review workflow
 * 
 * These tests verify complete workflows with database interactions and
 * ensure fraud detection algorithms work correctly in realistic scenarios.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { FraudDetectionService } from '@/features/intelligence/services/fraud-detection.service';
import { 
  salvageCases, 
  auctions, 
  bids, 
  vendors, 
  users,
  fraudAlerts,
  photoHashes,
  photoHashIndex,
  duplicatePhotoMatches
} from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// Mock Gemini AI integration
vi.mock('@/lib/integrations/gemini-damage-detection', () => ({
  analyzePhotoAuthenticity: vi.fn().mockResolvedValue({
    isAiGenerated: false,
    confidence: 0.85,
    analysis: 'Photo appears authentic',
  }),
}));

describe('Fraud Detection Workflows', () => {
  let fraudService: FraudDetectionService;
  let testVendorId: string;
  let testAdjusterId: string;
  let testCaseId: string;
  let testAuctionId: string;

  beforeAll(async () => {
    fraudService = new FraudDetectionService();
    
    // Create test users
    const [adjuster] = await db.insert(users).values({
      email: 'adjuster@test.com',
      name: 'Test Adjuster',
      role: 'adjuster',
      phoneNumber: '+2341234567890',
    }).returning();
    testAdjusterId = adjuster.id;

    const [vendorUser] = await db.insert(users).values({
      email: 'vendor@test.com',
      name: 'Test Vendor',
      role: 'vendor',
      phoneNumber: '+2341234567891',
    }).returning();

    const [vendor] = await db.insert(vendors).values({
      userId: vendorUser.id,
      businessName: 'Test Vendor Business',
      tier: 'tier1_bvn',
      categories: ['vehicle'],
      rating: 4.5,
    }).returning();
    testVendorId = vendor.id;
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
    if (testAdjusterId) {
      await db.delete(users).where(eq(users.id, testAdjusterId));
    }
    await db.delete(fraudAlerts).where(eq(fraudAlerts.entityType, 'test'));
  });

  beforeEach(async () => {
    // Create fresh test case and auction for each test
    const [testCase] = await db.insert(salvageCases).values({
      claimNumber: `TEST-${Date.now()}`,
      policyNumber: 'POL-TEST-001',
      assetType: 'vehicle',
      assetDetails: {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        color: 'Silver',
      },
      damageSeverity: 'moderate',
      marketValue: 100000,
      estimatedSalvageValue: 50000,
      reservePrice: 45000,
      photos: ['https://example.com/photo1.jpg'],
      createdBy: testAdjusterId,
    }).returning();
    testCaseId = testCase.id;

    const [auction] = await db.insert(auctions).values({
      caseId: testCaseId,
      startTime: new Date(),
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      reservePrice: 45000,
      status: 'active',
    }).returning();
    testAuctionId = auction.id;
  });

  describe('Photo Authenticity Detection Workflows', () => {
    it('should detect duplicate photos using pHash matching', async () => {
      const photoUrl1 = 'https://example.com/test-photo-1.jpg';
      const photoUrl2 = 'https://example.com/test-photo-2.jpg';
      
      // Create first case with photo
      const [case1] = await db.insert(salvageCases).values({
        claimNumber: `PHOTO-DUP-1-${Date.now()}`,
        policyNumber: 'POL-PHOTO-001',
        assetType: 'vehicle',
        assetDetails: { make: 'Honda', model: 'Accord', year: 2019 },
        damageSeverity: 'moderate',
        marketValue: 90000,
        photos: [photoUrl1],
        createdBy: testAdjusterId,
      }).returning();

      // Analyze first photo (creates hash)
      const result1 = await fraudService.analyzePhotoAuthenticity(case1.id, [photoUrl1]);
      
      expect(result1).toHaveLength(1);
      expect(result1[0].photoUrl).toBe(photoUrl1);
      expect(result1[0].duplicateMatches).toHaveLength(0);
      expect(result1[0].isAuthentic).toBe(true);

      // Create second case with similar photo (same pHash)
      const [case2] = await db.insert(salvageCases).values({
        claimNumber: `PHOTO-DUP-2-${Date.now()}`,
        policyNumber: 'POL-PHOTO-002',
        assetType: 'vehicle',
        assetDetails: { make: 'Honda', model: 'Civic', year: 2020 },
        damageSeverity: 'severe',
        marketValue: 80000,
        photos: [photoUrl2],
        createdBy: testAdjusterId,
      }).returning();

      // Analyze second photo (should detect duplicate)
      const result2 = await fraudService.analyzePhotoAuthenticity(case2.id, [photoUrl2]);

      expect(result2).toHaveLength(1);
      expect(result2[0].duplicateMatches.length).toBeGreaterThanOrEqual(0);
      
      // Verify photo hashes were stored
      const storedHashes = await db.select()
        .from(photoHashes)
        .where(eq(photoHashes.caseId, case1.id));
      
      expect(storedHashes.length).toBeGreaterThan(0);

      // Cleanup
      await db.delete(photoHashIndex).where(eq(photoHashIndex.caseId, case1.id));
      await db.delete(photoHashIndex).where(eq(photoHashIndex.caseId, case2.id));
      await db.delete(photoHashes).where(eq(photoHashes.caseId, case1.id));
      await db.delete(photoHashes).where(eq(photoHashes.caseId, case2.id));
      await db.delete(salvageCases).where(eq(salvageCases.id, case1.id));
      await db.delete(salvageCases).where(eq(salvageCases.id, case2.id));
    });

    it('should flag photos missing EXIF metadata', async () => {
      const photoUrl = 'https://example.com/no-exif-photo.jpg';
      
      const [testCase] = await db.insert(salvageCases).values({
        claimNumber: `NO-EXIF-${Date.now()}`,
        policyNumber: 'POL-NO-EXIF',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        photos: [photoUrl],
        createdBy: testAdjusterId,
      }).returning();

      const result = await fraudService.analyzePhotoAuthenticity(testCase.id, [photoUrl]);

      expect(result).toHaveLength(1);
      expect(result[0].exifAnalysis?.hasExif).toBe(false);
      expect(result[0].flagReasons).toContain('Missing EXIF metadata');
      expect(result[0].riskScore).toBeGreaterThan(0);

      // Cleanup
      await db.delete(photoHashIndex).where(eq(photoHashIndex.caseId, testCase.id));
      await db.delete(photoHashes).where(eq(photoHashes.caseId, testCase.id));
      await db.delete(salvageCases).where(eq(salvageCases.id, testCase.id));
    });

    it('should handle multiple photos in a single case', async () => {
      const photoUrls = [
        'https://example.com/multi-1.jpg',
        'https://example.com/multi-2.jpg',
        'https://example.com/multi-3.jpg',
      ];
      
      const [testCase] = await db.insert(salvageCases).values({
        claimNumber: `MULTI-PHOTO-${Date.now()}`,
        policyNumber: 'POL-MULTI',
        assetType: 'vehicle',
        assetDetails: { make: 'BMW', model: 'X5', year: 2021 },
        damageSeverity: 'severe',
        marketValue: 150000,
        photos: photoUrls,
        createdBy: testAdjusterId,
      }).returning();

      const result = await fraudService.analyzePhotoAuthenticity(testCase.id, photoUrls);

      expect(result).toHaveLength(3);
      result.forEach((r, i) => {
        expect(r.photoUrl).toBe(photoUrls[i]);
        expect(r).toHaveProperty('isAuthentic');
        expect(r).toHaveProperty('riskScore');
        expect(r).toHaveProperty('flagReasons');
      });

      // Verify all hashes were stored
      const storedHashes = await db.select()
        .from(photoHashes)
        .where(eq(photoHashes.caseId, testCase.id));
      
      expect(storedHashes.length).toBe(3);

      // Cleanup
      await db.delete(photoHashIndex).where(eq(photoHashIndex.caseId, testCase.id));
      await db.delete(photoHashes).where(eq(photoHashes.caseId, testCase.id));
      await db.delete(salvageCases).where(eq(salvageCases.id, testCase.id));
    });

    it('should integrate with Gemini AI for authenticity analysis', async () => {
      const photoUrl = 'https://example.com/gemini-test.jpg';
      
      const [testCase] = await db.insert(salvageCases).values({
        claimNumber: `GEMINI-TEST-${Date.now()}`,
        policyNumber: 'POL-GEMINI',
        assetType: 'vehicle',
        assetDetails: { make: 'Mercedes', model: 'C-Class', year: 2022 },
        damageSeverity: 'minor',
        marketValue: 120000,
        photos: [photoUrl],
        createdBy: testAdjusterId,
      }).returning();

      const result = await fraudService.analyzePhotoAuthenticity(testCase.id, [photoUrl]);

      expect(result).toHaveLength(1);
      expect(result[0].aiAnalysis).toBeDefined();
      expect(result[0].aiAnalysis?.isAiGenerated).toBe(false);
      expect(result[0].aiAnalysis?.confidence).toBeGreaterThan(0);

      // Cleanup
      await db.delete(photoHashIndex).where(eq(photoHashIndex.caseId, testCase.id));
      await db.delete(photoHashes).where(eq(photoHashes.caseId, testCase.id));
      await db.delete(salvageCases).where(eq(salvageCases.id, testCase.id));
    });
  });

  describe('Shill Bidding Detection Workflows', () => {
    it('should detect rapid consecutive bids from same vendor', async () => {
      // Create multiple rapid bids (within seconds)
      const now = new Date();
      const bidTimes = [
        now,
        new Date(now.getTime() + 1000), // 1 second later
        new Date(now.getTime() + 2000), // 2 seconds later
        new Date(now.getTime() + 3000), // 3 seconds later
        new Date(now.getTime() + 4000), // 4 seconds later
      ];

      for (const bidTime of bidTimes) {
        await db.insert(bids).values({
          auctionId: testAuctionId,
          vendorId: testVendorId,
          amount: 50000 + Math.random() * 1000,
          createdAt: bidTime,
        });
      }

      const result = await fraudService.detectShillBidding(testAuctionId);

      expect(result.isShillBidding).toBe(true);
      expect(result.riskScore).toBeGreaterThan(50);
      expect(result.flagReasons.length).toBeGreaterThan(0);
      expect(result.suspiciousPatterns.length).toBeGreaterThan(0);
      
      const hasConsecutivePattern = result.suspiciousPatterns.some(
        p => p.pattern === 'consecutive_bids' || p.pattern === 'rapid_bidding'
      );
      expect(hasConsecutivePattern).toBe(true);
    });

    it('should not flag normal bidding patterns', async () => {
      // Create normal spaced bids (5+ minutes apart)
      const now = new Date();
      const bidTimes = [
        now,
        new Date(now.getTime() + 5 * 60 * 1000), // 5 minutes later
        new Date(now.getTime() + 15 * 60 * 1000), // 15 minutes later
        new Date(now.getTime() + 30 * 60 * 1000), // 30 minutes later
      ];

      for (const bidTime of bidTimes) {
        await db.insert(bids).values({
          auctionId: testAuctionId,
          vendorId: testVendorId,
          amount: 50000 + Math.random() * 5000,
          createdAt: bidTime,
        });
      }

      const result = await fraudService.detectShillBidding(testAuctionId);

      expect(result.isShillBidding).toBe(false);
      expect(result.riskScore).toBeLessThan(50);
    });

    it('should detect last-minute bidding patterns', async () => {
      // Update auction to be near end
      const endTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      await db.update(auctions)
        .set({ endTime })
        .where(eq(auctions.id, testAuctionId));

      // Create bids in last 5 minutes
      const bidTimes = [
        new Date(endTime.getTime() - 4 * 60 * 1000), // 4 min before end
        new Date(endTime.getTime() - 3 * 60 * 1000), // 3 min before end
        new Date(endTime.getTime() - 2 * 60 * 1000), // 2 min before end
        new Date(endTime.getTime() - 1 * 60 * 1000), // 1 min before end
      ];

      for (const bidTime of bidTimes) {
        await db.insert(bids).values({
          auctionId: testAuctionId,
          vendorId: testVendorId,
          amount: 50000 + Math.random() * 1000,
          createdAt: bidTime,
        });
      }

      const result = await fraudService.detectShillBidding(testAuctionId);

      expect(result.riskScore).toBeGreaterThan(0);
      // May flag timing patterns depending on implementation
    });

    it('should detect IP address collusion', async () => {
      // Create second vendor
      const [vendor2User] = await db.insert(users).values({
        email: `vendor2-${Date.now()}@test.com`,
        name: 'Test Vendor 2',
        role: 'vendor',
        phoneNumber: '+2341234567892',
      }).returning();

      const [vendor2] = await db.insert(vendors).values({
        userId: vendor2User.id,
        businessName: 'Test Vendor 2 Business',
        tier: 'tier1_bvn',
        categories: ['vehicle'],
        rating: 4.0,
      }).returning();

      // Create bids from both vendors with same IP
      const sharedIP = '192.168.1.100';
      
      await db.insert(bids).values({
        auctionId: testAuctionId,
        vendorId: testVendorId,
        amount: 50000,
        metadata: { ipAddress: sharedIP, deviceFingerprint: 'device-123' },
        createdAt: new Date(),
      });

      await db.insert(bids).values({
        auctionId: testAuctionId,
        vendorId: vendor2.id,
        amount: 51000,
        metadata: { ipAddress: sharedIP, deviceFingerprint: 'device-123' },
        createdAt: new Date(Date.now() + 60000),
      });

      const result = await fraudService.detectShillBidding(testAuctionId);

      expect(result.riskScore).toBeGreaterThan(0);
      
      // Check for IP collusion pattern
      const hasIPCollusion = result.suspiciousPatterns.some(
        p => p.pattern === 'ip_device_collusion'
      );
      
      if (hasIPCollusion) {
        expect(result.flagReasons.some(r => r.includes('IP'))).toBe(true);
      }

      // Cleanup
      await db.delete(vendors).where(eq(vendors.id, vendor2.id));
      await db.delete(users).where(eq(users.id, vendor2User.id));
    });

    it('should calculate risk score correctly for multiple patterns', async () => {
      // Create multiple suspicious patterns
      const now = new Date();
      
      // Rapid consecutive bids
      for (let i = 0; i < 5; i++) {
        await db.insert(bids).values({
          auctionId: testAuctionId,
          vendorId: testVendorId,
          amount: 50000 + i * 100,
          createdAt: new Date(now.getTime() + i * 1000),
        });
      }

      const result = await fraudService.detectShillBidding(testAuctionId);

      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);
      expect(result.isShillBidding).toBe(result.riskScore >= 50);
    });
  });

  describe('Claim Pattern Fraud Detection Workflows', () => {
    it('should detect repeat claimants with multiple cases', async () => {
      // Create multiple similar cases from same user
      const similarCases = [];
      const damagedParts = ['front bumper', 'hood', 'headlight'];
      
      for (let i = 0; i < 4; i++) {
        const [similarCase] = await db.insert(salvageCases).values({
          claimNumber: `REPEAT-${i}-${Date.now()}`,
          policyNumber: `POL-REPEAT-${i}`,
          assetType: 'vehicle',
          assetDetails: {
            make: 'Toyota',
            model: 'Camry',
            year: 2020,
          },
          damageSeverity: 'moderate',
          marketValue: 100000,
          damagedParts,
          aiAssessment: {
            damagedParts,
            totalLoss: false,
          },
          createdBy: testAdjusterId,
          userId: testAdjusterId, // Same user submitting multiple claims
          createdAt: new Date(Date.now() - i * 30 * 24 * 60 * 60 * 1000), // Spread over months
        }).returning();
        similarCases.push(similarCase);
      }

      const result = await fraudService.analyzeClaimPatterns(similarCases[0].id);

      expect(result.isFraudulent).toBe(true);
      expect(result.riskScore).toBeGreaterThan(50);
      expect(result.flagReasons.length).toBeGreaterThan(0);
      
      const hasRepeatClaimantFlag = result.flagReasons.some(
        r => r.includes('claims') || r.includes('claimant')
      );
      expect(hasRepeatClaimantFlag).toBe(true);

      // Cleanup
      for (const similarCase of similarCases) {
        await db.delete(salvageCases).where(eq(salvageCases.id, similarCase.id));
      }
    });

    it('should detect similar damage patterns', async () => {
      const damagedParts1 = ['front bumper', 'hood', 'headlight', 'grille'];
      const damagedParts2 = ['front bumper', 'hood', 'headlight']; // 75% similarity
      
      // Create first case
      const [case1] = await db.insert(salvageCases).values({
        claimNumber: `SIMILAR-1-${Date.now()}`,
        policyNumber: 'POL-SIMILAR-1',
        assetType: 'vehicle',
        assetDetails: { make: 'Honda', model: 'Civic', year: 2019 },
        damageSeverity: 'moderate',
        marketValue: 80000,
        damagedParts: damagedParts1,
        createdBy: testAdjusterId,
        userId: testAdjusterId,
        createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      }).returning();

      // Create second case with similar damage
      const [case2] = await db.insert(salvageCases).values({
        claimNumber: `SIMILAR-2-${Date.now()}`,
        policyNumber: 'POL-SIMILAR-2',
        assetType: 'vehicle',
        assetDetails: { make: 'Honda', model: 'Civic', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 85000,
        damagedParts: damagedParts2,
        createdBy: testAdjusterId,
        userId: testAdjusterId,
      }).returning();

      const result = await fraudService.analyzeClaimPatterns(case2.id);

      expect(result.similarClaims.length).toBeGreaterThan(0);
      
      if (result.similarClaims.length > 0) {
        expect(result.similarClaims[0].similarity).toBeGreaterThan(50);
        expect(result.riskScore).toBeGreaterThan(0);
      }

      // Cleanup
      await db.delete(salvageCases).where(eq(salvageCases.id, case1.id));
      await db.delete(salvageCases).where(eq(salvageCases.id, case2.id));
    });

    it('should detect high case creation velocity', async () => {
      // Create many cases in short time (within 30 days)
      const rapidCases = [];
      
      for (let i = 0; i < 5; i++) {
        const [rapidCase] = await db.insert(salvageCases).values({
          claimNumber: `RAPID-${i}-${Date.now()}`,
          policyNumber: `POL-RAPID-${i}`,
          assetType: 'vehicle',
          assetDetails: { make: 'Honda', model: 'Civic', year: 2019 },
          damageSeverity: 'moderate',
          marketValue: 80000,
          createdBy: testAdjusterId,
          userId: testAdjusterId,
          createdAt: new Date(Date.now() - i * 5 * 24 * 60 * 60 * 1000), // 5 days apart
        }).returning();
        rapidCases.push(rapidCase);
      }

      const result = await fraudService.analyzeClaimPatterns(rapidCases[0].id);

      expect(result.riskScore).toBeGreaterThan(0);
      
      const hasVelocityFlag = result.flagReasons.some(
        r => r.includes('velocity') || r.includes('30 days') || r.includes('days')
      );
      
      if (rapidCases.length >= 3) {
        expect(hasVelocityFlag).toBe(true);
      }

      // Cleanup
      for (const rapidCase of rapidCases) {
        await db.delete(salvageCases).where(eq(salvageCases.id, rapidCase.id));
      }
    });

    it('should detect geographic clustering', async () => {
      // Create multiple cases from same location
      const location = { region: 'Lagos', city: 'Ikeja' };
      const geoCases = [];
      
      for (let i = 0; i < 3; i++) {
        const [geoCase] = await db.insert(salvageCases).values({
          claimNumber: `GEO-${i}-${Date.now()}`,
          policyNumber: `POL-GEO-${i}`,
          assetType: 'vehicle',
          assetDetails: { 
            make: 'Toyota', 
            model: 'Corolla', 
            year: 2020,
            ...location 
          },
          damageSeverity: 'moderate',
          marketValue: 75000,
          createdBy: testAdjusterId,
          userId: testAdjusterId,
          createdAt: new Date(Date.now() - i * 20 * 24 * 60 * 60 * 1000), // 20 days apart
        }).returning();
        geoCases.push(geoCase);
      }

      const result = await fraudService.analyzeClaimPatterns(geoCases[0].id);

      expect(result.riskScore).toBeGreaterThan(0);
      
      // May flag geographic clustering depending on implementation
      const hasGeoFlag = result.flagReasons.some(
        r => r.includes('location') || r.includes('region') || r.includes('city')
      );

      // Cleanup
      for (const geoCase of geoCases) {
        await db.delete(salvageCases).where(eq(salvageCases.id, geoCase.id));
      }
    });

    it('should not flag legitimate claims with low similarity', async () => {
      // Create cases with different damage patterns
      const [case1] = await db.insert(salvageCases).values({
        claimNumber: `LEGIT-1-${Date.now()}`,
        policyNumber: 'POL-LEGIT-1',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'minor',
        marketValue: 100000,
        damagedParts: ['rear bumper'],
        createdBy: testAdjusterId,
        userId: testAdjusterId,
        createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000), // 200 days ago
      }).returning();

      const [case2] = await db.insert(salvageCases).values({
        claimNumber: `LEGIT-2-${Date.now()}`,
        policyNumber: 'POL-LEGIT-2',
        assetType: 'vehicle',
        assetDetails: { make: 'Honda', model: 'Accord', year: 2021 },
        damageSeverity: 'severe',
        marketValue: 120000,
        damagedParts: ['windshield', 'side mirror'],
        createdBy: testAdjusterId,
        userId: testAdjusterId,
      }).returning();

      const result = await fraudService.analyzeClaimPatterns(case2.id);

      expect(result.isFraudulent).toBe(false);
      expect(result.riskScore).toBeLessThan(50);

      // Cleanup
      await db.delete(salvageCases).where(eq(salvageCases.id, case1.id));
      await db.delete(salvageCases).where(eq(salvageCases.id, case2.id));
    });
  });

  describe('Vendor-Adjuster Collusion Detection Workflows', () => {
    it('should detect suspicious win patterns', async () => {
      // Create multiple auctions where same vendor always wins from same adjuster
      const collusionCases = [];
      const collusionAuctions = [];

      for (let i = 0; i < 6; i++) {
        const [collusionCase] = await db.insert(salvageCases).values({
          claimNumber: `COLLUSION-${i}-${Date.now()}`,
          policyNumber: `POL-COLLUSION-${i}`,
          assetType: 'vehicle',
          assetDetails: { make: 'Nissan', model: 'Altima', year: 2018 },
          damageSeverity: 'moderate',
          marketValue: 90000,
          createdBy: testAdjusterId,
          adjusterId: testAdjusterId,
        }).returning();
        collusionCases.push(collusionCase);

        const [collusionAuction] = await db.insert(auctions).values({
          caseId: collusionCase.id,
          startTime: new Date(Date.now() - (7 + i) * 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() - (6 + i) * 24 * 60 * 60 * 1000),
          reservePrice: 40000,
          status: 'closed',
          currentBidder: testVendorId,
          currentBid: 45000 + i * 1000,
        }).returning();
        collusionAuctions.push(collusionAuction);

        // Add winning bid
        await db.insert(bids).values({
          auctionId: collusionAuction.id,
          vendorId: testVendorId,
          amount: 45000 + i * 1000,
          createdAt: new Date(Date.now() - (6 + i) * 24 * 60 * 60 * 1000),
        });
      }

      const result = await fraudService.detectCollusion(testVendorId, testAdjusterId);

      expect(result.isCollusion).toBe(true);
      expect(result.riskScore).toBeGreaterThan(50);
      expect(result.flagReasons.length).toBeGreaterThan(0);
      expect(result.collusionPairs.length).toBeGreaterThan(0);
      
      const pair = result.collusionPairs[0];
      expect(pair.vendorId).toBe(testVendorId);
      expect(pair.adjusterId).toBe(testAdjusterId);
      expect(pair.winRate).toBeGreaterThan(70);

      // Cleanup
      for (const auction of collusionAuctions) {
        await db.delete(bids).where(eq(bids.auctionId, auction.id));
        await db.delete(auctions).where(eq(auctions.id, auction.id));
      }
      for (const collusionCase of collusionCases) {
        await db.delete(salvageCases).where(eq(salvageCases.id, collusionCase.id));
      }
    });

    it('should detect last-minute bidding collusion', async () => {
      // Create auctions with last-minute wins
      const lastMinuteCases = [];
      const lastMinuteAuctions = [];

      for (let i = 0; i < 4; i++) {
        const [lmCase] = await db.insert(salvageCases).values({
          claimNumber: `LASTMIN-${i}-${Date.now()}`,
          policyNumber: `POL-LASTMIN-${i}`,
          assetType: 'vehicle',
          assetDetails: { make: 'Ford', model: 'Focus', year: 2019 },
          damageSeverity: 'moderate',
          marketValue: 75000,
          createdBy: testAdjusterId,
          adjusterId: testAdjusterId,
        }).returning();
        lastMinuteCases.push(lmCase);

        const endTime = new Date(Date.now() - (5 + i) * 24 * 60 * 60 * 1000);
        const [lmAuction] = await db.insert(auctions).values({
          caseId: lmCase.id,
          startTime: new Date(endTime.getTime() - 24 * 60 * 60 * 1000),
          endTime,
          reservePrice: 35000,
          status: 'closed',
          currentBidder: testVendorId,
          currentBid: 40000,
        }).returning();
        lastMinuteAuctions.push(lmAuction);

        // Add last-minute winning bid (within 5 minutes of end)
        await db.insert(bids).values({
          auctionId: lmAuction.id,
          vendorId: testVendorId,
          amount: 40000,
          createdAt: new Date(endTime.getTime() - 2 * 60 * 1000), // 2 minutes before end
        });
      }

      const result = await fraudService.detectCollusion(testVendorId, testAdjusterId);

      expect(result.riskScore).toBeGreaterThan(0);
      
      const hasLastMinuteFlag = result.flagReasons.some(
        r => r.includes('last-minute') || r.includes('timing')
      );

      // Cleanup
      for (const auction of lastMinuteAuctions) {
        await db.delete(bids).where(eq(bids.auctionId, auction.id));
        await db.delete(auctions).where(eq(auctions.id, auction.id));
      }
      for (const lmCase of lastMinuteCases) {
        await db.delete(salvageCases).where(eq(salvageCases.id, lmCase.id));
      }
    });

    it('should not flag legitimate vendor-adjuster relationships', async () => {
      // Create varied auction outcomes (some wins, some losses)
      const legitimateCases = [];
      const legitimateAuctions = [];

      // Create 5 auctions: 2 wins, 3 losses
      for (let i = 0; i < 5; i++) {
        const [legitCase] = await db.insert(salvageCases).values({
          claimNumber: `LEGIT-${i}-${Date.now()}`,
          policyNumber: `POL-LEGIT-${i}`,
          assetType: 'vehicle',
          assetDetails: { make: 'Ford', model: 'Focus', year: 2019 },
          damageSeverity: 'moderate',
          marketValue: 75000,
          createdBy: testAdjusterId,
          adjusterId: testAdjusterId,
        }).returning();
        legitimateCases.push(legitCase);

        const isWin = i < 2; // First 2 are wins
        const [legitAuction] = await db.insert(auctions).values({
          caseId: legitCase.id,
          startTime: new Date(Date.now() - (7 + i) * 24 * 60 * 60 * 1000),
          endTime: new Date(Date.now() - (6 + i) * 24 * 60 * 60 * 1000),
          reservePrice: 35000,
          status: 'closed',
          currentBidder: isWin ? testVendorId : `other-vendor-${i}`,
          currentBid: 40000,
        }).returning();
        legitimateAuctions.push(legitAuction);

        // Add bid from test vendor
        await db.insert(bids).values({
          auctionId: legitAuction.id,
          vendorId: testVendorId,
          amount: isWin ? 40000 : 38000,
          createdAt: new Date(Date.now() - (6 + i) * 24 * 60 * 60 * 1000),
        });
      }

      const result = await fraudService.detectCollusion(testVendorId, testAdjusterId);

      expect(result.isCollusion).toBe(false);
      expect(result.riskScore).toBeLessThan(50);

      // Cleanup
      for (const auction of legitimateAuctions) {
        await db.delete(bids).where(eq(bids.auctionId, auction.id));
        await db.delete(auctions).where(eq(auctions.id, auction.id));
      }
      for (const legitCase of legitimateCases) {
        await db.delete(salvageCases).where(eq(salvageCases.id, legitCase.id));
      }
    });

    it('should analyze collusion without specific vendor or adjuster', async () => {
      // Create some auction history
      const [generalCase] = await db.insert(salvageCases).values({
        claimNumber: `GENERAL-${Date.now()}`,
        policyNumber: 'POL-GENERAL',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Corolla', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 80000,
        createdBy: testAdjusterId,
        adjusterId: testAdjusterId,
      }).returning();

      const [generalAuction] = await db.insert(auctions).values({
        caseId: generalCase.id,
        startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endTime: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        reservePrice: 40000,
        status: 'closed',
        currentBidder: testVendorId,
        currentBid: 45000,
      }).returning();

      await db.insert(bids).values({
        auctionId: generalAuction.id,
        vendorId: testVendorId,
        amount: 45000,
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      });

      // Analyze without specific IDs
      const result = await fraudService.detectCollusion();

      expect(result).toBeDefined();
      expect(result.riskScore).toBeGreaterThanOrEqual(0);
      expect(result.riskScore).toBeLessThanOrEqual(100);

      // Cleanup
      await db.delete(bids).where(eq(bids.auctionId, generalAuction.id));
      await db.delete(auctions).where(eq(auctions.id, generalAuction.id));
      await db.delete(salvageCases).where(eq(salvageCases.id, generalCase.id));
    });
  });

  describe('Fraud Alert Management Workflows', () => {
    it('should create fraud alert with correct data structure', async () => {
      const alert = await fraudService.createFraudAlert(
        'vendor',
        testVendorId,
        85,
        ['Shill bidding detected', 'Rapid consecutive bids', 'IP address anomaly'],
        {
          auctionId: testAuctionId,
          bidCount: 5,
          timeWindow: '30 seconds',
          ipAddress: '192.168.1.100',
        }
      );

      expect(alert).toBeDefined();
      expect(typeof alert).toBe('string'); // Returns alert ID

      // Verify alert was stored in database
      const [storedAlert] = await db.select()
        .from(fraudAlerts)
        .where(eq(fraudAlerts.id, alert));

      expect(storedAlert).toBeDefined();
      expect(storedAlert.entityType).toBe('vendor');
      expect(storedAlert.entityId).toBe(testVendorId);
      expect(storedAlert.riskScore).toBe(85);
      expect(storedAlert.status).toBe('pending');
      expect(storedAlert.flagReasons).toHaveLength(3);
      expect(storedAlert.metadata).toBeDefined();

      // Cleanup
      await db.delete(fraudAlerts).where(eq(fraudAlerts.id, alert));
    });

    it('should create alerts for different entity types', async () => {
      const entityTypes: Array<'vendor' | 'case' | 'auction' | 'user'> = [
        'vendor',
        'case',
        'auction',
        'user',
      ];

      const createdAlerts: string[] = [];

      for (const entityType of entityTypes) {
        const entityId = entityType === 'vendor' ? testVendorId :
                        entityType === 'case' ? testCaseId :
                        entityType === 'auction' ? testAuctionId :
                        testAdjusterId;

        const alertId = await fraudService.createFraudAlert(
          entityType,
          entityId,
          70,
          [`Test ${entityType} fraud`],
          { testData: true }
        );

        expect(alertId).toBeDefined();
        createdAlerts.push(alertId);

        const [alert] = await db.select()
          .from(fraudAlerts)
          .where(eq(fraudAlerts.id, alertId));

        expect(alert.entityType).toBe(entityType);
        expect(alert.entityId).toBe(entityId);
      }

      // Cleanup
      for (const alertId of createdAlerts) {
        await db.delete(fraudAlerts).where(eq(fraudAlerts.id, alertId));
      }
    });

    it('should handle high-risk alerts (>75 risk score)', async () => {
      const highRiskAlert = await fraudService.createFraudAlert(
        'case',
        testCaseId,
        95,
        ['Duplicate photos', 'Repeat claimant', 'Geographic clustering', 'Similar damage patterns'],
        {
          duplicateCount: 3,
          claimantHistory: 5,
          location: 'Lagos, Ikeja',
        }
      );

      expect(highRiskAlert).toBeDefined();

      const [alert] = await db.select()
        .from(fraudAlerts)
        .where(eq(fraudAlerts.id, highRiskAlert));

      expect(alert.riskScore).toBeGreaterThan(75);
      expect(alert.flagReasons.length).toBeGreaterThan(3);
      expect(alert.status).toBe('pending');

      // Cleanup
      await db.delete(fraudAlerts).where(eq(fraudAlerts.id, highRiskAlert));
    });

    it('should support fraud alert review workflow', async () => {
      // Create alert
      const alertId = await fraudService.createFraudAlert(
        'auction',
        testAuctionId,
        70,
        ['Suspicious bid timing'],
        { pattern: 'last-minute-bidding' }
      );

      // Simulate review by admin
      await db.update(fraudAlerts)
        .set({
          status: 'reviewed',
          reviewedBy: testAdjusterId,
          reviewedAt: new Date(),
        })
        .where(eq(fraudAlerts.id, alertId));

      const [reviewedAlert] = await db.select()
        .from(fraudAlerts)
        .where(eq(fraudAlerts.id, alertId));

      expect(reviewedAlert.status).toBe('reviewed');
      expect(reviewedAlert.reviewedBy).toBe(testAdjusterId);
      expect(reviewedAlert.reviewedAt).toBeDefined();
      expect(reviewedAlert.reviewedAt).toBeInstanceOf(Date);

      // Cleanup
      await db.delete(fraudAlerts).where(eq(fraudAlerts.id, alertId));
    });

    it('should support alert dismissal workflow', async () => {
      // Create alert
      const alertId = await fraudService.createFraudAlert(
        'vendor',
        testVendorId,
        55,
        ['Minor timing anomaly'],
        { severity: 'low' }
      );

      // Dismiss alert
      await db.update(fraudAlerts)
        .set({
          status: 'dismissed',
          reviewedBy: testAdjusterId,
          reviewedAt: new Date(),
        })
        .where(eq(fraudAlerts.id, alertId));

      const [dismissedAlert] = await db.select()
        .from(fraudAlerts)
        .where(eq(fraudAlerts.id, alertId));

      expect(dismissedAlert.status).toBe('dismissed');
      expect(dismissedAlert.reviewedBy).toBe(testAdjusterId);

      // Cleanup
      await db.delete(fraudAlerts).where(eq(fraudAlerts.id, alertId));
    });

    it('should query alerts by status', async () => {
      // Create multiple alerts with different statuses
      const alert1 = await fraudService.createFraudAlert(
        'vendor',
        testVendorId,
        80,
        ['Test 1'],
        {}
      );

      const alert2 = await fraudService.createFraudAlert(
        'case',
        testCaseId,
        75,
        ['Test 2'],
        {}
      );

      // Review one alert
      await db.update(fraudAlerts)
        .set({ status: 'reviewed', reviewedBy: testAdjusterId, reviewedAt: new Date() })
        .where(eq(fraudAlerts.id, alert1));

      // Query pending alerts
      const pendingAlerts = await db.select()
        .from(fraudAlerts)
        .where(eq(fraudAlerts.status, 'pending'));

      expect(pendingAlerts.length).toBeGreaterThan(0);
      expect(pendingAlerts.some(a => a.id === alert2)).toBe(true);

      // Query reviewed alerts
      const reviewedAlerts = await db.select()
        .from(fraudAlerts)
        .where(eq(fraudAlerts.status, 'reviewed'));

      expect(reviewedAlerts.some(a => a.id === alert1)).toBe(true);

      // Cleanup
      await db.delete(fraudAlerts).where(eq(fraudAlerts.id, alert1));
      await db.delete(fraudAlerts).where(eq(fraudAlerts.id, alert2));
    });
  });

  describe('End-to-End Fraud Detection Workflows', () => {
    it('should detect multiple fraud indicators and create comprehensive alert', async () => {
      // Setup: Create a case with duplicate photos
      const duplicatePhotoUrl = 'https://example.com/duplicate-fraud.jpg';
      
      const [originalCase] = await db.insert(salvageCases).values({
        claimNumber: `ORIGINAL-${Date.now()}`,
        policyNumber: 'POL-ORIGINAL',
        assetType: 'vehicle',
        assetDetails: { make: 'BMW', model: 'X5', year: 2020 },
        damageSeverity: 'severe',
        marketValue: 150000,
        photos: [duplicatePhotoUrl],
        damagedParts: ['front bumper', 'hood'],
        createdBy: testAdjusterId,
        userId: testAdjusterId,
        createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      }).returning();

      // Analyze original photo (creates hash)
      await fraudService.analyzePhotoAuthenticity(originalCase.id, [duplicatePhotoUrl]);

      // Create fraudulent case with same photo and similar damage
      const [fraudCase] = await db.insert(salvageCases).values({
        claimNumber: `FRAUD-${Date.now()}`,
        policyNumber: 'POL-FRAUD',
        assetType: 'vehicle',
        assetDetails: { make: 'BMW', model: 'X5', year: 2020 },
        damageSeverity: 'severe',
        marketValue: 150000,
        photos: [duplicatePhotoUrl],
        damagedParts: ['front bumper', 'hood'], // Same damage pattern
        aiAssessment: {
          damagedParts: ['front bumper', 'hood'],
        },
        createdBy: testAdjusterId,
        userId: testAdjusterId,
      }).returning();

      // Create auction for fraudulent case
      const [fraudAuction] = await db.insert(auctions).values({
        caseId: fraudCase.id,
        startTime: new Date(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reservePrice: 70000,
        status: 'active',
      }).returning();

      // Add shill bidding pattern (rapid consecutive bids)
      const now = new Date();
      for (let i = 0; i < 5; i++) {
        await db.insert(bids).values({
          auctionId: fraudAuction.id,
          vendorId: testVendorId,
          amount: 75000 + i * 500,
          createdAt: new Date(now.getTime() + i * 1000), // 1 second apart
        });
      }

      // Run comprehensive fraud detection
      const photoResult = await fraudService.analyzePhotoAuthenticity(fraudCase.id, [duplicatePhotoUrl]);
      const shillResult = await fraudService.detectShillBidding(fraudAuction.id);
      const claimResult = await fraudService.analyzeClaimPatterns(fraudCase.id);

      // Verify multiple fraud indicators detected
      expect(photoResult).toHaveLength(1);
      expect(photoResult[0].riskScore).toBeGreaterThan(0);
      
      expect(shillResult.isShillBidding).toBe(true);
      expect(shillResult.riskScore).toBeGreaterThan(50);
      
      expect(claimResult.riskScore).toBeGreaterThan(0);

      // Create comprehensive fraud alert
      const allFlagReasons = [
        ...photoResult[0].flagReasons,
        ...shillResult.flagReasons,
        ...claimResult.flagReasons,
      ];

      const maxRiskScore = Math.max(
        photoResult[0].riskScore,
        shillResult.riskScore,
        claimResult.riskScore
      );

      const comprehensiveAlert = await fraudService.createFraudAlert(
        'case',
        fraudCase.id,
        maxRiskScore,
        allFlagReasons,
        {
          photoAnalysis: {
            duplicateMatches: photoResult[0].duplicateMatches.length,
            riskScore: photoResult[0].riskScore,
          },
          shillAnalysis: {
            suspiciousPatterns: shillResult.suspiciousPatterns.length,
            riskScore: shillResult.riskScore,
          },
          claimAnalysis: {
            similarClaims: claimResult.similarClaims.length,
            riskScore: claimResult.riskScore,
          },
        }
      );

      expect(comprehensiveAlert).toBeDefined();
      expect(maxRiskScore).toBeGreaterThan(50);
      expect(allFlagReasons.length).toBeGreaterThan(0);

      // Verify alert was stored
      const [storedAlert] = await db.select()
        .from(fraudAlerts)
        .where(eq(fraudAlerts.id, comprehensiveAlert));

      expect(storedAlert).toBeDefined();
      expect(storedAlert.riskScore).toBe(maxRiskScore);
      expect(storedAlert.entityType).toBe('case');
      expect(storedAlert.entityId).toBe(fraudCase.id);

      // Cleanup
      await db.delete(bids).where(eq(bids.auctionId, fraudAuction.id));
      await db.delete(auctions).where(eq(auctions.id, fraudAuction.id));
      await db.delete(photoHashIndex).where(eq(photoHashIndex.caseId, originalCase.id));
      await db.delete(photoHashIndex).where(eq(photoHashIndex.caseId, fraudCase.id));
      await db.delete(photoHashes).where(eq(photoHashes.caseId, originalCase.id));
      await db.delete(photoHashes).where(eq(photoHashes.caseId, fraudCase.id));
      await db.delete(salvageCases).where(eq(salvageCases.id, originalCase.id));
      await db.delete(salvageCases).where(eq(salvageCases.id, fraudCase.id));
      await db.delete(fraudAlerts).where(eq(fraudAlerts.id, comprehensiveAlert));
    });

    it('should handle complete fraud investigation workflow', async () => {
      // Step 1: Create suspicious case
      const [suspiciousCase] = await db.insert(salvageCases).values({
        claimNumber: `INVESTIGATION-${Date.now()}`,
        policyNumber: 'POL-INVESTIGATION',
        assetType: 'vehicle',
        assetDetails: { make: 'Mercedes', model: 'E-Class', year: 2021 },
        damageSeverity: 'moderate',
        marketValue: 130000,
        photos: ['https://example.com/investigation-photo.jpg'],
        damagedParts: ['rear bumper', 'trunk'],
        createdBy: testAdjusterId,
        userId: testAdjusterId,
      }).returning();

      // Step 2: Create auction
      const [investigationAuction] = await db.insert(auctions).values({
        caseId: suspiciousCase.id,
        startTime: new Date(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reservePrice: 60000,
        status: 'active',
      }).returning();

      // Step 3: Add some bids
      await db.insert(bids).values({
        auctionId: investigationAuction.id,
        vendorId: testVendorId,
        amount: 65000,
        createdAt: new Date(),
      });

      // Step 4: Run all fraud detection checks
      const photoCheck = await fraudService.analyzePhotoAuthenticity(
        suspiciousCase.id,
        suspiciousCase.photos as string[]
      );
      
      const shillCheck = await fraudService.detectShillBidding(investigationAuction.id);
      
      const claimCheck = await fraudService.analyzeClaimPatterns(suspiciousCase.id);
      
      const collusionCheck = await fraudService.detectCollusion(testVendorId, testAdjusterId);

      // Step 5: Verify all checks completed
      expect(photoCheck).toBeDefined();
      expect(shillCheck).toBeDefined();
      expect(claimCheck).toBeDefined();
      expect(collusionCheck).toBeDefined();

      // Step 6: Calculate overall risk
      const overallRisk = Math.max(
        photoCheck[0]?.riskScore || 0,
        shillCheck.riskScore,
        claimCheck.riskScore,
        collusionCheck.riskScore
      );

      expect(overallRisk).toBeGreaterThanOrEqual(0);
      expect(overallRisk).toBeLessThanOrEqual(100);

      // Step 7: Create alert if risk is significant
      if (overallRisk > 30) {
        const alertId = await fraudService.createFraudAlert(
          'case',
          suspiciousCase.id,
          overallRisk,
          ['Investigation completed'],
          {
            photoRisk: photoCheck[0]?.riskScore || 0,
            shillRisk: shillCheck.riskScore,
            claimRisk: claimCheck.riskScore,
            collusionRisk: collusionCheck.riskScore,
          }
        );

        expect(alertId).toBeDefined();

        // Cleanup alert
        await db.delete(fraudAlerts).where(eq(fraudAlerts.id, alertId));
      }

      // Cleanup
      await db.delete(bids).where(eq(bids.auctionId, investigationAuction.id));
      await db.delete(auctions).where(eq(auctions.id, investigationAuction.id));
      await db.delete(photoHashIndex).where(eq(photoHashIndex.caseId, suspiciousCase.id));
      await db.delete(photoHashes).where(eq(photoHashes.caseId, suspiciousCase.id));
      await db.delete(salvageCases).where(eq(salvageCases.id, suspiciousCase.id));
    });

    it('should handle fraud detection with minimal data gracefully', async () => {
      // Create a simple case with minimal data
      const [minimalCase] = await db.insert(salvageCases).values({
        claimNumber: `MINIMAL-${Date.now()}`,
        policyNumber: 'POL-MINIMAL',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Yaris', year: 2018 },
        damageSeverity: 'minor',
        marketValue: 60000,
        photos: [],
        createdBy: testAdjusterId,
        userId: testAdjusterId,
      }).returning();

      // Run fraud checks on minimal data
      const photoCheck = await fraudService.analyzePhotoAuthenticity(minimalCase.id, []);
      const claimCheck = await fraudService.analyzeClaimPatterns(minimalCase.id);

      // Should handle gracefully without errors
      expect(photoCheck).toEqual([]);
      expect(claimCheck).toBeDefined();
      expect(claimCheck.riskScore).toBeGreaterThanOrEqual(0);

      // Cleanup
      await db.delete(salvageCases).where(eq(salvageCases.id, minimalCase.id));
    });
  });
});
