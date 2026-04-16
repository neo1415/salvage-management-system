/**
 * Test Master Report Service
 * Verifies comprehensive master report generation
 */

import { MasterReportService } from '../src/features/reports/executive/services/master-report.service';

async function testMasterReport() {
  console.log('🧪 Testing Master Report Service...\n');

  try {
    const startDate = new Date('2026-02-01').toISOString();
    const endDate = new Date('2026-04-16').toISOString();

    console.log(`📅 Date Range: ${startDate} to ${endDate}\n`);

    const report = await MasterReportService.generateComprehensiveReport({
      startDate,
      endDate,
    });

    console.log('✅ Master Report Generated Successfully!\n');

    // Executive Summary
    console.log('📊 EXECUTIVE SUMMARY:');
    console.log(`  Total Revenue: ₦${report.executiveSummary.totalRevenue.toLocaleString()}`);
    console.log(`  Revenue Growth: ${report.executiveSummary.revenueGrowth.toFixed(1)}%`);
    console.log(`  Total Cases: ${report.executiveSummary.totalCases}`);
    console.log(`  Case Growth: ${report.executiveSummary.caseGrowth.toFixed(1)}%`);
    console.log(`  Auction Success Rate: ${report.executiveSummary.auctionSuccessRate.toFixed(1)}%`);
    console.log(`  Avg Processing Time: ${report.executiveSummary.avgProcessingTime.toFixed(1)} days`);
    console.log(`  System Health: ${report.executiveSummary.systemHealth}\n`);

    // Financial
    console.log('💰 FINANCIAL PERFORMANCE:');
    console.log(`  Total Revenue: ₦${report.financial.revenue.total.toLocaleString()}`);
    console.log(`  Gross Profit: ₦${report.financial.profitability.grossProfit.toLocaleString()}`);
    console.log(`  Net Profit: ₦${report.financial.profitability.netProfit.toLocaleString()}`);
    console.log(`  Profit Margin: ${report.financial.profitability.profitMargin.toFixed(1)}%`);
    console.log(`  Avg Recovery Rate: ${report.financial.recovery.averageRate.toFixed(1)}%`);
    console.log(`  Revenue by Month: ${report.financial.revenue.byMonth.length} months`);
    console.log(`  Revenue by Asset Type: ${report.financial.revenue.byAssetType.length} types`);
    console.log(`  Top Cases: ${report.financial.revenue.topCases.length} cases\n`);

    // Operational
    console.log('⚙️ OPERATIONAL PERFORMANCE:');
    console.log(`  Total Cases: ${report.operational.cases.total}`);
    console.log(`  Cases by Status: ${report.operational.cases.byStatus.length} statuses`);
    console.log(`  Total Auctions: ${report.operational.auctions.total}`);
    console.log(`  Active Auctions: ${report.operational.auctions.active}`);
    console.log(`  Closed Auctions: ${report.operational.auctions.closed}`);
    console.log(`  Auction Success Rate: ${report.operational.auctions.successRate.toFixed(1)}%`);
    console.log(`  Competitive Rate: ${report.operational.auctions.competitiveRate.toFixed(1)}%`);
    console.log(`  Avg Bidders: ${report.operational.auctions.avgBidders.toFixed(1)}`);
    console.log(`  Documents Generated: ${report.operational.documents.totalGenerated}`);
    console.log(`  Document Completion Rate: ${report.operational.documents.completionRate.toFixed(1)}%\n`);

    // Performance
    console.log('👥 TEAM PERFORMANCE:');
    console.log(`  Total Adjusters: ${report.performance.teamMetrics.totalAdjusters}`);
    console.log(`  Avg Quality Score: ${report.performance.teamMetrics.avgQualityScore.toFixed(1)}`);
    console.log(`  Top Performer: ${report.performance.teamMetrics.topPerformer}`);
    console.log(`  Active Vendors: ${report.performance.teamMetrics.activeVendors}`);
    console.log(`  Adjusters Listed: ${report.performance.adjusters.length}`);
    console.log(`  Vendors Listed: ${report.performance.vendors.length}\n`);

    // Auction Intelligence
    console.log('🎯 AUCTION INTELLIGENCE:');
    console.log(`  Total Bids: ${report.auctionIntelligence.bidding.totalBids}`);
    console.log(`  Avg Bids per Auction: ${report.auctionIntelligence.bidding.avgBidsPerAuction.toFixed(1)}`);
    console.log(`  Competition Level: ${report.auctionIntelligence.bidding.competitionLevel}`);
    console.log(`  Peak Bidding Hours: ${report.auctionIntelligence.bidding.peakBiddingHours.length} hours`);
    console.log(`  Avg Starting Bid: ₦${report.auctionIntelligence.pricing.avgStartingBid.toLocaleString()}`);
    console.log(`  Avg Winning Bid: ₦${report.auctionIntelligence.pricing.avgWinningBid.toLocaleString()}`);
    console.log(`  Avg Price Increase: ₦${report.auctionIntelligence.pricing.avgPriceIncrease.toLocaleString()}`);
    console.log(`  Avg Auction Duration: ${report.auctionIntelligence.timing.avgAuctionDuration.toFixed(1)}h`);
    console.log(`  Extension Rate: ${report.auctionIntelligence.timing.extensionRate.toFixed(1)}%`);
    console.log(`  Closure Success Rate: ${report.auctionIntelligence.timing.closureSuccessRate.toFixed(1)}%\n`);

    // System Health
    console.log('🏥 SYSTEM HEALTH:');
    console.log(`  Complete Cases: ${report.systemHealth.dataQuality.completeCases}`);
    console.log(`  Missing Data: ${report.systemHealth.dataQuality.missingData}`);
    console.log(`  Data Quality Score: ${report.systemHealth.dataQuality.dataQualityScore.toFixed(1)}%`);
    console.log(`  Avg API Response Time: ${report.systemHealth.performance.avgApiResponseTime}ms`);
    console.log(`  Error Rate: ${report.systemHealth.performance.errorRate}%`);
    console.log(`  Uptime: ${report.systemHealth.performance.uptime}%`);
    console.log(`  Audit Trail Coverage: ${report.systemHealth.compliance.auditTrailCoverage.toFixed(1)}%`);
    console.log(`  Security Incidents: ${report.systemHealth.compliance.securityIncidents}`);
    console.log(`  Compliance Score: ${report.systemHealth.compliance.complianceScore}\n`);

    // Metadata
    console.log('📋 METADATA:');
    console.log(`  Report Version: ${report.metadata.reportVersion}`);
    console.log(`  Generated At: ${new Date(report.metadata.generatedAt).toLocaleString()}`);
    console.log(`  Date Range: ${new Date(report.metadata.dateRange.start).toLocaleDateString()} - ${new Date(report.metadata.dateRange.end).toLocaleDateString()}\n`);

    console.log('✅ All sections generated successfully!');
    console.log('🎉 Master Report is comprehensive and complete!');

  } catch (error) {
    console.error('❌ Error testing master report:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

testMasterReport();
