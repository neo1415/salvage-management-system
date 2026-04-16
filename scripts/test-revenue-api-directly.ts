/**
 * Test Revenue API Directly
 * 
 * Call the revenue analysis service directly to see what data it returns
 */

import { RevenueAnalysisService } from '@/features/reports/financial/services/revenue-analysis.service';
import { ReportFilters } from '@/features/reports/types';

async function testRevenueAPI() {
  console.log('🧪 Testing Revenue Analysis Service...\n');

  try {
    // Create filters for last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const filters: ReportFilters = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };

    console.log('Filters:');
    console.log(`  Start: ${startDate.toISOString().split('T')[0]}`);
    console.log(`  End: ${endDate.toISOString().split('T')[0]}\n`);

    // Call the service
    const report = await RevenueAnalysisService.generateReport(filters);

    console.log('📊 Report Results:\n');
    console.log('Summary:');
    console.log(`  Total Cases: ${report.summary.totalCases}`);
    console.log(`  Total Market Value: ₦${report.summary.totalMarketValue.toLocaleString()}`);
    console.log(`  Total Recovery Value: ₦${report.summary.totalRecoveryValue.toLocaleString()}`);
    console.log(`  Total Profit: ₦${report.summary.totalProfit.toLocaleString()}`);
    console.log(`  Average Recovery Rate: ${report.summary.averageRecoveryRate}%`);
    console.log(`  Profit Margin: ${report.summary.profitMargin}%\n`);

    console.log('By Asset Type:');
    report.byAssetType.forEach(asset => {
      console.log(`  ${asset.assetType}:`);
      console.log(`    Count: ${asset.count}`);
      console.log(`    Recovery Value: ₦${asset.recoveryValue.toLocaleString()}`);
      console.log(`    Recovery Rate: ${asset.recoveryRate}%`);
    });

    console.log('\nBy Region:');
    if (report.byRegion && report.byRegion.length > 0) {
      report.byRegion.forEach(region => {
        console.log(`  ${region.region}:`);
        console.log(`    Count: ${region.count}`);
        console.log(`    Recovery Value: ₦${region.recoveryValue.toLocaleString()}`);
      });
    } else {
      console.log('  No region data');
    }

    console.log('\nTrend Data:');
    console.log(`  ${report.trend.length} data points`);
    if (report.trend.length > 0) {
      console.log(`  First: ${report.trend[0].date} - ₦${report.trend[0].recoveryValue}`);
      console.log(`  Last: ${report.trend[report.trend.length - 1].date} - ₦${report.trend[report.trend.length - 1].recoveryValue}`);
    }

    console.log('\n✅ Service Test Complete!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testRevenueAPI();
