/**
 * Test Script: Master Report Vendor Section
 * 
 * Tests the Master Report API to verify vendor performance numbers are correct.
 */

import { MasterReportService } from '@/features/reports/executive/services/master-report.service';

async function test() {
  console.log('🔍 MASTER REPORT VENDOR SECTION TEST\n');
  console.log('=' .repeat(80));

  const filters = {
    startDate: '2024-01-01',
    endDate: '2026-12-31',
  };

  console.log('\n📊 Generating Master Report...');
  const report = await MasterReportService.generateComprehensiveReport(filters);

  console.log('\n📊 EXECUTIVE SUMMARY:');
  console.log('-'.repeat(80));
  console.log(`   Total Revenue: ₦${report.executiveSummary.totalRevenue.toLocaleString()}`);
  console.log(`   Total Cases: ${report.executiveSummary.totalCases}`);
  console.log(`   Auction Success Rate: ${report.executiveSummary.auctionSuccessRate}%`);

  console.log('\n📊 VENDOR PERFORMANCE:');
  console.log('-'.repeat(80));
  
  let totalVendorSpending = 0;
  for (const vendor of report.performance.vendors) {
    totalVendorSpending += vendor.totalSpent;
    console.log(`   ${vendor.businessName}:`);
    console.log(`      Total Spent: ₦${vendor.totalSpent.toLocaleString()}`);
    console.log(`      Auctions Won: ${vendor.auctionsWon}`);
    console.log(`      Win Rate: ${vendor.winRate}%`);
    console.log(`      Payment Rate: ${vendor.paymentRate}%`);
  }
  
  console.log('\n   TOTAL VENDOR SPENDING:', `₦${totalVendorSpending.toLocaleString()}`);

  console.log('\n' + '='.repeat(80));
  console.log('🎯 CONSISTENCY CHECK:');
  console.log(`   Total Revenue: ₦${report.executiveSummary.totalRevenue.toLocaleString()}`);
  console.log(`   Total Vendor Spending: ₦${totalVendorSpending.toLocaleString()}`);
  console.log(`   Difference: ₦${Math.abs(totalVendorSpending - report.executiveSummary.totalRevenue).toLocaleString()}`);
  
  if (totalVendorSpending <= report.executiveSummary.totalRevenue) {
    console.log('\n   ✅ SUCCESS: Vendor spending does NOT exceed total revenue!');
    const registrationFees = report.executiveSummary.totalRevenue - totalVendorSpending;
    if (registrationFees > 0) {
      console.log(`   ℹ️  Note: ₦${registrationFees.toLocaleString()} is from registration fees`);
    }
  } else {
    console.log('\n   ❌ ISSUE: Vendor spending exceeds total revenue!');
  }
  
  console.log('='.repeat(80));
}

test()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
