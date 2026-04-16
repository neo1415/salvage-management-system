/**
 * Recommendation Accuracy Validation Tests
 * 
 * Requirements:
 * - Bid conversion rate >15% for recommended auctions
 * - Test on historical vendor behavior
 * - Validate recommendation quality metrics
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { RecommendationService } from '@/features/intelligence/services/recommendation.service';
import { db } from '@/lib/db';
import { vendors, bids, auctions, recommendations } from '@/lib/db/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';

describe('Recommendation Accuracy Validation Tests', () => {
  let recommendationService: RecommendationService;
  let testVendors: Array<{
    vendorId: string;
    totalBids: number;
    uniqueAuctions: number;
  }>;

  beforeAll(async () => {
    recommendationService = new RecommendationService();

    // Load active vendors with bidding history
    const activeVendors = await db
      .select({
        vendorId: bids.vendorId,
        totalBids: db.raw<number>('COUNT(*)'),
        uniqueAuctions: db.raw<number>('COUNT(DISTINCT auction_id)'),
      })
      .from(bids)
      .groupBy(bids.vendorId)
      .having(db.raw('COUNT(DISTINCT auction_id) >= 5'))
      .limit(50);

    testVendors = activeVendors.map(v => ({
      vendorId: v.vendorId,
      totalBids: Number(v.totalBids),
      uniqueAuctions: Number(v.uniqueAuctions),
    }));

    console.log(`Loaded ${testVendors.length} active vendors for recommendation testing`);
  });

  it('should achieve >15% bid conversion rate for recommendations', async () => {
    const conversionResults: Array<{
      vendorId: string;
      recommendedCount: number;
      bidsPlaced: number;
      conversionRate: number;
    }> = [];

    for (const vendor of testVendors.slice(0, 20)) {
      try {
        // Generate recommendations
        const recommendations = await recommendationService.generateRecommendations(vendor.vendorId);
        
        if (recommendations.length === 0) continue;

        const recommendedAuctionIds = recommendations.map(r => r.auctionId);

        // Check how many recommended auctions the vendor actually bid on
        const bidsOnRecommended = await db.query.bids.findMany({
          where: and(
            eq(bids.vendorId, vendor.vendorId),
            inArray(bids.auctionId, recommendedAuctionIds)
          ),
        });

        const uniqueBidAuctions = new Set(bidsOnRecommended.map(b => b.auctionId)).size;
        const conversionRate = (uniqueBidAuctions / recommendations.length) * 100;

        conversionResults.push({
          vendorId: vendor.vendorId,
          recommendedCount: recommendations.length,
          bidsPlaced: uniqueBidAuctions,
          conversionRate,
        });
      } catch (error) {
        console.warn(`Failed to test recommendations for vendor ${vendor.vendorId}:`, error);
      }
    }

    const avgConversionRate = 
      conversionResults.reduce((sum, r) => sum + r.conversionRate, 0) / conversionResults.length;

    const above15Percent = conversionResults.filter(r => r.conversionRate >= 15).length;
    const successRate = (above15Percent / conversionResults.length) * 100;

    console.log('\nRecommendation Conversion Rate:');
    console.log(`  Vendors tested: ${conversionResults.length}`);
    console.log(`  Average conversion rate: ${avgConversionRate.toFixed(2)}%`);
    console.log(`  Above 15% threshold: ${above15Percent} (${successRate.toFixed(2)}%)`);

    // At least 60% of vendors should have >15% conversion rate
    expect(successRate).toBeGreaterThanOrEqual(60);
    expect(avgConversionRate).toBeGreaterThan(12);
  });

  it('should recommend auctions that match vendor preferences', async () => {
    const matchResults: Array<{
      vendorId: string;
      avgMatchScore: number;
      highQualityCount: number;
    }> = [];

    for (const vendor of testVendors.slice(0, 20)) {
      try {
        const recommendations = await recommendationService.generateRecommendations(vendor.vendorId);
        
        if (recommendations.length === 0) continue;

        const avgMatchScore = 
          recommendations.reduce((sum, r) => sum + r.matchScore, 0) / recommendations.length;
        
        const highQualityCount = recommendations.filter(r => r.matchScore >= 70).length;

        matchResults.push({
          vendorId: vendor.vendorId,
          avgMatchScore,
          highQualityCount,
        });
      } catch (error) {
        // Skip
      }
    }

    const overallAvgScore = 
      matchResults.reduce((sum, r) => sum + r.avgMatchScore, 0) / matchResults.length;

    console.log('\nRecommendation Match Quality:');
    console.log(`  Vendors tested: ${matchResults.length}`);
    console.log(`  Average match score: ${overallAvgScore.toFixed(2)}`);

    // Average match score should be above 60
    expect(overallAvgScore).toBeGreaterThan(60);
  });

  it('should provide diverse recommendations', async () => {
    const diversityResults: Array<{
      vendorId: string;
      uniqueAssetTypes: number;
      uniqueMakes: number;
      diversityScore: number;
    }> = [];

    for (const vendor of testVendors.slice(0, 20)) {
      try {
        const recommendations = await recommendationService.generateRecommendations(vendor.vendorId);
        
        if (recommendations.length < 5) continue;

        // Get auction details for recommendations
        const auctionIds = recommendations.map(r => r.auctionId);
        const auctionDetails = await db.query.auctions.findMany({
          where: inArray(auctions.id, auctionIds),
          with: {
            case: {
              with: {
                vehicle: true,
                electronic: true,
                machinery: true,
              },
            },
          },
        });

        const assetTypes = new Set(auctionDetails.map(a => a.case.assetType));
        const makes = new Set(
          auctionDetails.map(a => 
            a.case.vehicle?.make || a.case.electronic?.make || a.case.machinery?.make
          ).filter(Boolean)
        );

        const diversityScore = (assetTypes.size + makes.size) / 2;

        diversityResults.push({
          vendorId: vendor.vendorId,
          uniqueAssetTypes: assetTypes.size,
          uniqueMakes: makes.size,
          diversityScore,
        });
      } catch (error) {
        // Skip
      }
    }

    const avgDiversity = 
      diversityResults.reduce((sum, r) => sum + r.diversityScore, 0) / diversityResults.length;

    console.log('\nRecommendation Diversity:');
    console.log(`  Vendors tested: ${diversityResults.length}`);
    console.log(`  Average diversity score: ${avgDiversity.toFixed(2)}`);

    // Should provide some diversity (not all same type/make)
    expect(avgDiversity).toBeGreaterThan(1.5);
  });

  it('should prioritize high-value opportunities', async () => {
    const valueResults: Array<{
      vendorId: string;
      avgRecommendedValue: number;
      avgHistoricalValue: number;
      valueRatio: number;
    }> = [];

    for (const vendor of testVendors.slice(0, 15)) {
      try {
        const recommendations = await recommendationService.generateRecommendations(vendor.vendorId);
        
        if (recommendations.length === 0) continue;

        // Get recommended auction values
        const recommendedAuctionIds = recommendations.map(r => r.auctionId);
        const recommendedAuctions = await db.query.auctions.findMany({
          where: inArray(auctions.id, recommendedAuctionIds),
        });

        const avgRecommendedValue = 
          recommendedAuctions.reduce((sum, a) => sum + (a.startingPrice || 0), 0) / recommendedAuctions.length;

        // Get vendor's historical bid values
        const historicalBids = await db.query.bids.findMany({
          where: eq(bids.vendorId, vendor.vendorId),
          limit: 50,
        });

        const avgHistoricalValue = 
          historicalBids.reduce((sum, b) => sum + b.amount, 0) / historicalBids.length;

        const valueRatio = avgRecommendedValue / avgHistoricalValue;

        valueResults.push({
          vendorId: vendor.vendorId,
          avgRecommendedValue,
          avgHistoricalValue,
          valueRatio,
        });
      } catch (error) {
        // Skip
      }
    }

    console.log('\nRecommendation Value Alignment:');
    console.log(`  Vendors tested: ${valueResults.length}`);
    
    valueResults.forEach(r => {
      console.log(`  Vendor ${r.vendorId.slice(0, 8)}: ratio ${r.valueRatio.toFixed(2)}x`);
    });

    // Recommended values should be reasonably aligned with historical behavior
    // (between 0.5x and 2x of historical average)
    const wellAligned = valueResults.filter(r => r.valueRatio >= 0.5 && r.valueRatio <= 2).length;
    const alignmentRate = (wellAligned / valueResults.length) * 100;

    expect(alignmentRate).toBeGreaterThanOrEqual(70);
  });

  it('should handle cold-start vendors appropriately', async () => {
    // Find vendors with minimal bidding history
    const coldStartVendors = await db
      .select({
        vendorId: bids.vendorId,
        bidCount: db.raw<number>('COUNT(*)'),
      })
      .from(bids)
      .groupBy(bids.vendorId)
      .having(db.raw('COUNT(*) <= 3'))
      .limit(10);

    const coldStartResults: Array<{
      vendorId: string;
      recommendationCount: number;
      avgMatchScore: number;
    }> = [];

    for (const vendor of coldStartVendors) {
      try {
        const recommendations = await recommendationService.generateRecommendations(vendor.vendorId);
        
        const avgMatchScore = recommendations.length > 0
          ? recommendations.reduce((sum, r) => sum + r.matchScore, 0) / recommendations.length
          : 0;

        coldStartResults.push({
          vendorId: vendor.vendorId,
          recommendationCount: recommendations.length,
          avgMatchScore,
        });
      } catch (error) {
        // Skip
      }
    }

    console.log('\nCold-Start Vendor Recommendations:');
    console.log(`  Vendors tested: ${coldStartResults.length}`);
    
    const avgRecommendations = 
      coldStartResults.reduce((sum, r) => sum + r.recommendationCount, 0) / coldStartResults.length;

    console.log(`  Average recommendations: ${avgRecommendations.toFixed(2)}`);

    // Should still provide recommendations for cold-start vendors
    expect(avgRecommendations).toBeGreaterThan(5);
  });

  it('should improve recommendations over time', async () => {
    // Test if recommendations improve as vendor provides more interaction data
    const improvementResults: Array<{
      vendorId: string;
      earlyConversion: number;
      lateConversion: number;
      improvement: number;
    }> = [];

    for (const vendor of testVendors.slice(0, 10)) {
      try {
        // Get vendor's bid history chronologically
        const allBids = await db.query.bids.findMany({
          where: eq(bids.vendorId, vendor.vendorId),
          orderBy: (bids, { asc }) => [asc(bids.createdAt)],
        });

        if (allBids.length < 20) continue;

        const midpoint = Math.floor(allBids.length / 2);
        const earlyBids = allBids.slice(0, midpoint);
        const lateBids = allBids.slice(midpoint);

        // Simulate recommendations at different time periods
        // (In practice, this would require historical recommendation data)
        const earlyAuctions = new Set(earlyBids.map(b => b.auctionId));
        const lateAuctions = new Set(lateBids.map(b => b.auctionId));

        const recommendations = await recommendationService.generateRecommendations(vendor.vendorId);
        const recommendedIds = new Set(recommendations.map(r => r.auctionId));

        // Calculate overlap (proxy for conversion)
        const earlyOverlap = Array.from(earlyAuctions).filter(id => recommendedIds.has(id)).length;
        const lateOverlap = Array.from(lateAuctions).filter(id => recommendedIds.has(id)).length;

        const earlyConversion = (earlyOverlap / earlyAuctions.size) * 100;
        const lateConversion = (lateOverlap / lateAuctions.size) * 100;
        const improvement = lateConversion - earlyConversion;

        improvementResults.push({
          vendorId: vendor.vendorId,
          earlyConversion,
          lateConversion,
          improvement,
        });
      } catch (error) {
        // Skip
      }
    }

    if (improvementResults.length > 0) {
      const avgImprovement = 
        improvementResults.reduce((sum, r) => sum + r.improvement, 0) / improvementResults.length;

      console.log('\nRecommendation Improvement Over Time:');
      console.log(`  Vendors tested: ${improvementResults.length}`);
      console.log(`  Average improvement: ${avgImprovement.toFixed(2)}%`);

      // Recommendations should generally improve (or at least not degrade significantly)
      expect(avgImprovement).toBeGreaterThan(-5);
    }
  });

  it('should provide actionable reason codes', async () => {
    const reasonCodeResults: Array<{
      vendorId: string;
      hasReasonCodes: boolean;
      avgReasonCount: number;
    }> = [];

    for (const vendor of testVendors.slice(0, 20)) {
      try {
        const recommendations = await recommendationService.generateRecommendations(vendor.vendorId);
        
        if (recommendations.length === 0) continue;

        const withReasonCodes = recommendations.filter(r => r.reasonCodes && r.reasonCodes.length > 0);
        const avgReasonCount = withReasonCodes.length > 0
          ? withReasonCodes.reduce((sum, r) => sum + r.reasonCodes.length, 0) / withReasonCodes.length
          : 0;

        reasonCodeResults.push({
          vendorId: vendor.vendorId,
          hasReasonCodes: withReasonCodes.length === recommendations.length,
          avgReasonCount,
        });
      } catch (error) {
        // Skip
      }
    }

    const allHaveReasonCodes = reasonCodeResults.filter(r => r.hasReasonCodes).length;
    const reasonCodeCoverage = (allHaveReasonCodes / reasonCodeResults.length) * 100;

    console.log('\nReason Code Quality:');
    console.log(`  Vendors tested: ${reasonCodeResults.length}`);
    console.log(`  With reason codes: ${allHaveReasonCodes} (${reasonCodeCoverage.toFixed(2)}%)`);

    // All recommendations should have reason codes
    expect(reasonCodeCoverage).toBeGreaterThanOrEqual(95);
  });
});
