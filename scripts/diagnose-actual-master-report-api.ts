/**
 * Diagnose ACTUAL Master Report API Response
 * See what the API is REALLY returning
 */

import { MasterReportService } from '@/features/reports/executive/services/master-report.service';

async function diagnoseActualMasterReport() {
  console.log('🔍 DIAGNOSING ACTUAL MASTER REPORT API RESPONSE\n');
  console.log('=' .repeat(80));

  try {
    // Call the ACTUAL service with the date range from the screenshot
    const filters = {
      startDate: '2026-02-01',
      endDate: '2026-04-28',
    };

    console.log('\n📅 Calling MasterReportService.generateComprehensiveReport()');
    console.log(`Date Range: ${filters.startDate} to ${filters.endDate}\n`);

    const report = await MasterReportService.generateComprehensiveReport(filters);

    console.log('=' .repeat(80));
    console.log('📊 EXECUTIVE SUMMARY (What the UI shows)');
    console.log('=' .repeat(80));
    console.log(`Total Revenue: ₦${report.executiveSummary.totalRevenue.toLocaleString()}`);
    console.log(`Revenue Growth: ${report.executiveSummary.revenueGrowth}%`);
    console.log(`Total Cases: ${report.executiveSummary.totalCases}`);
    console.log(`Case Growth: ${report.executiveSummary.caseGrowth}%`);
    console.log(`Auction Success Rate: ${report.executiveSummary.auctionSuccessRate}%`);
    console.log(`Avg Processing Time: ${report.executiveSummary.avgProcessingTime} days`);

    console.log('\n' + '=' .repeat(80));
    console.log('💰 FINANCIAL DATA');
    console.log('=' .repeat(80));
    console.log(`Total Revenue: ₦${report.financial.revenue.total.toLocaleString()}`);
    console.log(`Gross Profit: ₦${report.financial.profitability.grossProfit.toLocaleString()}`);
    console.log(`Net Profit: ₦${report.financial.profitability.netProfit.toLocaleString()}`);
    console.log(`Operational Costs: ₦${report.financial.profitability.operationalCosts.toLocaleString()}`);
    console.log(`Profit Margin: ${report.financial.profitability.profitMargin}%`);

    console.log('\n📈 Revenue by Month:');
    report.financial.revenue.byMonth.forEach(m => {
      console.log(`  ${m.month}: ₦${m.amount.toLocaleString()}`);
    });

    console.log('\n' + '=' .repeat(80));
    console.log('📦 OPERATIONAL DATA');
    console.log('=' .repeat(80));
    console.log(`Total Cases: ${report.operational.cases.total}`);
    console.log(`Total Auctions: ${report.operational.auctions.total}`);
    console.log(`Active Auctions: ${report.operational.auctions.active}`);
    console.log(`Closed Auctions: ${report.operational.auctions.closed}`);
    console.log(`Success Rate: ${report.operational.auctions.successRate}%`);

    console.log('\n📊 Cases by Status:');
    report.operational.cases.byStatus.forEach(s => {
      console.log(`  ${s.status}: ${s.count} (${s.percentage.toFixed(1)}%)`);
    });

    console.log('\n' + '=' .repeat(80));
    console.log('👥 PERFORMANCE DATA');
    console.log('=' .repeat(80));
    console.log(`Total Adjusters: ${report.performance.teamMetrics.totalAdjusters}`);
    console.log(`Avg Quality Score: ${report.performance.teamMetrics.avgQualityScore}`);
    console.log(`Top Performer: ${report.performance.teamMetrics.topPerformer}`);
    console.log(`Active Vendors: ${report.performance.teamMetrics.activeVendors}`);

    console.log('\n👨‍💼 Adjusters:');
    report.performance.adjusters.forEach((adj, i) => {
      console.log(`  ${i + 1}. ${adj.name}`);
      console.log(`     Cases: ${adj.casesProcessed}`);
      console.log(`     Revenue: ₦${adj.revenue.toLocaleString()}`);
      console.log(`     Quality Score: ${adj.qualityScore}`);
    });

    console.log('\n🏢 Vendors (top 5):');
    report.performance.vendors.slice(0, 5).forEach((v, i) => {
      console.log(`  ${i + 1}. ${v.businessName}`);
      console.log(`     Participated: ${v.auctionsParticipated}`);
      console.log(`     Won: ${v.auctionsWon}`);
      console.log(`     Win Rate: ${v.winRate}%`);
      console.log(`     Total Spent: ₦${v.totalSpent.toLocaleString()}`);
    });

    console.log('\n' + '=' .repeat(80));
    console.log('🎯 AUCTION INTELLIGENCE');
    console.log('=' .repeat(80));
    console.log(`Total Bids: ${report.auctionIntelligence.bidding.totalBids}`);
    console.log(`Avg Bids per Auction: ${report.auctionIntelligence.bidding.avgBidsPerAuction}`);
    console.log(`Competition Level: ${report.auctionIntelligence.bidding.competitionLevel}`);
    console.log(`Avg Starting Bid: ₦${report.auctionIntelligence.pricing.avgStartingBid.toLocaleString()}`);
    console.log(`Avg Winning Bid: ₦${report.auctionIntelligence.pricing.avgWinningBid.toLocaleString()}`);
    console.log(`Avg Price Increase: ₦${report.auctionIntelligence.pricing.avgPriceIncrease.toLocaleString()}`);

    console.log('\n' + '=' .repeat(80));
    console.log('🔍 KEY ISSUES IDENTIFIED:');
    console.log('=' .repeat(80));

    // Check for issues
    const issues: string[] = [];

    if (report.executiveSummary.totalRevenue !== report.financial.revenue.total) {
      issues.push(`❌ Revenue mismatch: Executive (₦${report.executiveSummary.totalRevenue.toLocaleString()}) vs Financial (₦${report.financial.revenue.total.toLocaleString()})`);
    }

    if (report.operational.auctions.total > report.operational.cases.total * 2) {
      issues.push(`❌ Auction count (${report.operational.auctions.total}) is way higher than cases (${report.operational.cases.total})`);
    }

    if (report.performance.adjusters.length < 2) {
      issues.push(`❌ Only ${report.performance.adjusters.length} adjuster(s) showing - should be at least 2-3`);
    }

    if (report.financial.profitability.operationalCosts > 0) {
      issues.push(`❌ Operational costs still showing: ₦${report.financial.profitability.operationalCosts.toLocaleString()}`);
    }

    if (report.operational.documents.completionRate === 0) {
      issues.push(`⚠️  Document completion rate is 0%`);
    }

    if (issues.length > 0) {
      issues.forEach(issue => console.log(issue));
    } else {
      console.log('✅ No major issues detected');
    }

    console.log('\n' + '=' .repeat(80));
    console.log('📝 RAW DATA SAMPLE (for debugging):');
    console.log('=' .repeat(80));
    console.log('\nExecutive Summary Object:');
    console.log(JSON.stringify(report.executiveSummary, null, 2));

  } catch (error) {
    console.error('\n❌ ERROR calling Master Report Service:');
    console.error(error);
  }
}

diagnoseActualMasterReport()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
