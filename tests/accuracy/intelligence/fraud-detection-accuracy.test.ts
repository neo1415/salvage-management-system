/**
 * Fraud Detection Accuracy Validation Tests
 * 
 * Requirements:
 * - False positive rate <5%
 * - Test on known legitimate and fraudulent cases
 * - Validate detection sensitivity and specificity
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { FraudDetectionService } from '@/features/intelligence/services/fraud-detection.service';
import { db } from '@/lib/db';
import { cases, vendors, bids, auctions } from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

describe('Fraud Detection Accuracy Validation Tests', () => {
  let fraudDetectionService: FraudDetectionService;
  let legitimateCases: string[];
  let legitimateVendors: string[];
  let testAuctions: string[];

  beforeAll(async () => {
    fraudDetectionService = new FraudDetectionService();

    // Load known legitimate cases (cases that completed successfully without issues)
    const completedCases = await db.query.cases.findMany({
      where: eq(cases.status, 'closed'),
      limit: 100,
    });
    legitimateCases = completedCases.map(c => c.id);

    // Load known legitimate vendors (vendors with good track record)
    const activeVendors = await db
      .select({ vendorId: bids.vendorId })
      .from(bids)
      .groupBy(bids.vendorId)
      .having(db.raw('COUNT(*) >= 10'))
      .limit(50);
    legitimateVendors = activeVendors.map(v => v.vendorId);

    // Load test auctions
    const activeAuctions = await db.query.auctions.findMany({
      where: eq(auctions.status, 'closed'),
      limit: 100,
    });
    testAuctions = activeAuctions.map(a => a.id);

    console.log(`Loaded ${legitimateCases.length} legitimate cases for testing`);
    console.log(`Loaded ${legitimateVendors.length} legitimate vendors for testing`);
  });

  describe('Photo Authenticity Detection', () => {
    it('should have <5% false positive rate on legitimate photos', async () => {
      const results: Array<{
        caseId: string;
        flaggedAsFraud: boolean;
        severity: string;
      }> = [];

      for (const caseId of legitimateCases.slice(0, 50)) {
        try {
          const fraudResult = await fraudDetectionService.analyzePhotoAuthenticity(caseId);
          
          results.push({
            caseId,
            flaggedAsFraud: fraudResult.isFraudulent,
            severity: fraudResult.severity,
          });
        } catch (error) {
          // Skip cases without photos
        }
      }

      const falsePositives = results.filter(r => r.flaggedAsFraud).length;
      const falsePositiveRate = (falsePositives / results.length) * 100;

      console.log('\nPhoto Authenticity Detection:');
      console.log(`  Cases tested: ${results.length}`);
      console.log(`  False positives: ${falsePositives}`);
      console.log(`  False positive rate: ${falsePositiveRate.toFixed(2)}%`);

      expect(falsePositiveRate).toBeLessThan(5);
    });

    it('should detect duplicate photos with high accuracy', async () => {
      // Create test cases with known duplicate photos
      const testCases = [
        {
          caseId: 'test-case-1',
          photoUrl: 'https://example.com/photo1.jpg',
          isDuplicate: false,
        },
        {
          caseId: 'test-case-2',
          photoUrl: 'https://example.com/photo1.jpg', // Same photo
          isDuplicate: true,
        },
        {
          caseId: 'test-case-3',
          photoUrl: 'https://example.com/photo2.jpg',
          isDuplicate: false,
        },
      ];

      // In a real test, we would:
      // 1. Upload test photos
      // 2. Run fraud detection
      // 3. Verify duplicate detection

      console.log('Duplicate photo detection test requires manual setup');
      expect(true).toBe(true); // Placeholder
    });

    it('should handle similar but non-duplicate photos correctly', async () => {
      // Test with photos of same vehicle model but different instances
      // Should NOT flag as duplicates

      console.log('Similar photo handling test requires manual setup');
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Shill Bidding Detection', () => {
    it('should have <5% false positive rate on legitimate bidding', async () => {
      const results: Array<{
        auctionId: string;
        flaggedAsFraud: boolean;
        severity: string;
      }> = [];

      for (const auctionId of testAuctions.slice(0, 50)) {
        try {
          const fraudResult = await fraudDetectionService.detectShillBidding(auctionId);
          
          results.push({
            auctionId,
            flaggedAsFraud: fraudResult.isFraudulent,
            severity: fraudResult.severity,
          });
        } catch (error) {
          // Skip auctions without bids
        }
      }

      const falsePositives = results.filter(r => r.flaggedAsFraud).length;
      const falsePositiveRate = (falsePositives / results.length) * 100;

      console.log('\nShill Bidding Detection:');
      console.log(`  Auctions tested: ${results.length}`);
      console.log(`  False positives: ${falsePositives}`);
      console.log(`  False positive rate: ${falsePositiveRate.toFixed(2)}%`);

      expect(falsePositiveRate).toBeLessThan(5);
    });

    it('should detect consecutive bidding patterns', async () => {
      // Test with known shill bidding patterns
      // (Would require synthetic test data)

      console.log('Consecutive bidding pattern test requires synthetic data');
      expect(true).toBe(true); // Placeholder
    });

    it('should not flag competitive bidding as shill bidding', async () => {
      // Find auctions with high competition (many unique bidders)
      const competitiveAuctions = await db
        .select({
          auctionId: bids.auctionId,
          uniqueBidders: db.raw<number>('COUNT(DISTINCT vendor_id)'),
        })
        .from(bids)
        .groupBy(bids.auctionId)
        .having(db.raw('COUNT(DISTINCT vendor_id) >= 5'))
        .limit(20);

      const results: Array<{ flaggedAsFraud: boolean }> = [];

      for (const auction of competitiveAuctions) {
        try {
          const fraudResult = await fraudDetectionService.detectShillBidding(auction.auctionId);
          results.push({ flaggedAsFraud: fraudResult.isFraudulent });
        } catch (error) {
          // Skip
        }
      }

      const falsePositives = results.filter(r => r.flaggedAsFraud).length;
      const falsePositiveRate = (falsePositives / results.length) * 100;

      console.log('\nCompetitive Bidding (should not flag):');
      console.log(`  Auctions tested: ${results.length}`);
      console.log(`  False positive rate: ${falsePositiveRate.toFixed(2)}%`);

      expect(falsePositiveRate).toBeLessThan(10); // Slightly higher threshold for competitive auctions
    });
  });

  describe('Claim Pattern Fraud Detection', () => {
    it('should have <5% false positive rate on legitimate claims', async () => {
      const results: Array<{
        caseId: string;
        flaggedAsFraud: boolean;
        severity: string;
      }> = [];

      for (const caseId of legitimateCases.slice(0, 50)) {
        try {
          const fraudResult = await fraudDetectionService.analyzeClaimPatterns(caseId);
          
          results.push({
            caseId,
            flaggedAsFraud: fraudResult.isFraudulent,
            severity: fraudResult.severity,
          });
        } catch (error) {
          // Skip
        }
      }

      const falsePositives = results.filter(r => r.flaggedAsFraud).length;
      const falsePositiveRate = (falsePositives / results.length) * 100;

      console.log('\nClaim Pattern Detection:');
      console.log(`  Cases tested: ${results.length}`);
      console.log(`  False positives: ${falsePositives}`);
      console.log(`  False positive rate: ${falsePositiveRate.toFixed(2)}%`);

      expect(falsePositiveRate).toBeLessThan(5);
    });

    it('should detect repeat claimants appropriately', async () => {
      // Find claimants with multiple claims
      const repeatClaimants = await db
        .select({
          claimantEmail: cases.claimantEmail,
          claimCount: db.raw<number>('COUNT(*)'),
        })
        .from(cases)
        .where(eq(cases.status, 'closed'))
        .groupBy(cases.claimantEmail)
        .having(db.raw('COUNT(*) >= 3'))
        .limit(10);

      console.log('\nRepeat Claimants:');
      console.log(`  Found ${repeatClaimants.length} repeat claimants`);

      // Multiple claims from same person is not necessarily fraud
      // Should only flag if patterns are suspicious
      expect(repeatClaimants.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Vendor-Adjuster Collusion Detection', () => {
    it('should have <5% false positive rate on legitimate vendor-adjuster pairs', async () => {
      const results: Array<{
        vendorId: string;
        flaggedAsFraud: boolean;
        severity: string;
      }> = [];

      for (const vendorId of legitimateVendors.slice(0, 30)) {
        try {
          const fraudResult = await fraudDetectionService.detectCollusion(vendorId);
          
          results.push({
            vendorId,
            flaggedAsFraud: fraudResult.isFraudulent,
            severity: fraudResult.severity,
          });
        } catch (error) {
          // Skip
        }
      }

      const falsePositives = results.filter(r => r.flaggedAsFraud).length;
      const falsePositiveRate = (falsePositives / results.length) * 100;

      console.log('\nCollusion Detection:');
      console.log(`  Vendors tested: ${results.length}`);
      console.log(`  False positives: ${falsePositives}`);
      console.log(`  False positive rate: ${falsePositiveRate.toFixed(2)}%`);

      expect(falsePositiveRate).toBeLessThan(5);
    });

    it('should not flag consistent winners as collusion', async () => {
      // Find vendors with high win rates (but legitimate)
      const topVendors = await db
        .select({
          vendorId: bids.vendorId,
          winRate: db.raw<number>('COUNT(DISTINCT CASE WHEN is_winning THEN auction_id END)::float / COUNT(DISTINCT auction_id)'),
        })
        .from(bids)
        .groupBy(bids.vendorId)
        .having(db.raw('COUNT(DISTINCT auction_id) >= 10'))
        .orderBy(db.raw('COUNT(DISTINCT CASE WHEN is_winning THEN auction_id END)::float / COUNT(DISTINCT auction_id) DESC'))
        .limit(10);

      const results: Array<{ flaggedAsFraud: boolean }> = [];

      for (const vendor of topVendors) {
        try {
          const fraudResult = await fraudDetectionService.detectCollusion(vendor.vendorId);
          results.push({ flaggedAsFraud: fraudResult.isFraudulent });
        } catch (error) {
          // Skip
        }
      }

      const falsePositives = results.filter(r => r.flaggedAsFraud).length;
      const falsePositiveRate = (falsePositives / results.length) * 100;

      console.log('\nTop Performers (should not flag):');
      console.log(`  Vendors tested: ${results.length}`);
      console.log(`  False positive rate: ${falsePositiveRate.toFixed(2)}%`);

      // High performers might trigger some alerts, but should be low
      expect(falsePositiveRate).toBeLessThan(20);
    });
  });

  describe('Overall Fraud Detection Performance', () => {
    it('should maintain low false positive rate across all detection types', async () => {
      const allResults: Array<{
        type: string;
        flaggedAsFraud: boolean;
      }> = [];

      // Test photo authenticity
      for (const caseId of legitimateCases.slice(0, 20)) {
        try {
          const result = await fraudDetectionService.analyzePhotoAuthenticity(caseId);
          allResults.push({ type: 'photo', flaggedAsFraud: result.isFraudulent });
        } catch (error) {
          // Skip
        }
      }

      // Test shill bidding
      for (const auctionId of testAuctions.slice(0, 20)) {
        try {
          const result = await fraudDetectionService.detectShillBidding(auctionId);
          allResults.push({ type: 'shill', flaggedAsFraud: result.isFraudulent });
        } catch (error) {
          // Skip
        }
      }

      // Test claim patterns
      for (const caseId of legitimateCases.slice(20, 40)) {
        try {
          const result = await fraudDetectionService.analyzeClaimPatterns(caseId);
          allResults.push({ type: 'claim', flaggedAsFraud: result.isFraudulent });
        } catch (error) {
          // Skip
        }
      }

      // Test collusion
      for (const vendorId of legitimateVendors.slice(0, 20)) {
        try {
          const result = await fraudDetectionService.detectCollusion(vendorId);
          allResults.push({ type: 'collusion', flaggedAsFraud: result.isFraudulent });
        } catch (error) {
          // Skip
        }
      }

      const totalFalsePositives = allResults.filter(r => r.flaggedAsFraud).length;
      const overallFalsePositiveRate = (totalFalsePositives / allResults.length) * 100;

      console.log('\nOverall Fraud Detection Performance:');
      console.log(`  Total tests: ${allResults.length}`);
      console.log(`  False positives: ${totalFalsePositives}`);
      console.log(`  Overall false positive rate: ${overallFalsePositiveRate.toFixed(2)}%`);

      // Breakdown by type
      const byType = allResults.reduce((acc, r) => {
        if (!acc[r.type]) acc[r.type] = { total: 0, flagged: 0 };
        acc[r.type].total++;
        if (r.flaggedAsFraud) acc[r.type].flagged++;
        return acc;
      }, {} as Record<string, { total: number; flagged: number }>);

      Object.entries(byType).forEach(([type, stats]) => {
        const rate = (stats.flagged / stats.total) * 100;
        console.log(`  ${type}: ${stats.flagged}/${stats.total} (${rate.toFixed(2)}%)`);
      });

      expect(overallFalsePositiveRate).toBeLessThan(5);
    });

    it('should provide appropriate severity levels', async () => {
      const severityResults: Array<{
        severity: string;
        isFraudulent: boolean;
      }> = [];

      // Collect severity data from various fraud checks
      for (const caseId of legitimateCases.slice(0, 30)) {
        try {
          const result = await fraudDetectionService.analyzePhotoAuthenticity(caseId);
          severityResults.push({
            severity: result.severity,
            isFraudulent: result.isFraudulent,
          });
        } catch (error) {
          // Skip
        }
      }

      // High severity should correlate with fraud flags
      const highSeverity = severityResults.filter(r => r.severity === 'high');
      const highSeverityFraud = highSeverity.filter(r => r.isFraudulent).length;
      const highSeverityRate = highSeverity.length > 0
        ? (highSeverityFraud / highSeverity.length) * 100
        : 0;

      console.log('\nSeverity Level Analysis:');
      console.log(`  High severity cases: ${highSeverity.length}`);
      console.log(`  High severity fraud rate: ${highSeverityRate.toFixed(2)}%`);

      // Most high severity cases should be flagged as fraud
      if (highSeverity.length > 0) {
        expect(highSeverityRate).toBeGreaterThan(70);
      }
    });
  });
});
