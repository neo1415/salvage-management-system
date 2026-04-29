/**
 * Verification Script: Vendor Performance Report Fix
 * 
 * Verifies that Vendor Performance Report now matches Master Report
 */

import { OperationalDataRepository } from '@/features/reports/operational/repositories/operational-data.repository';
import { MasterReportService } from '@/features/reports/executive/services/master-report.service';

async function verify() {
  console.log('🔍 VENDOR PERFORMANCE REPORT FIX VERIFICATION\n');
  console.log('=' .repeat(80));

  const filters = {
    startDate: '2024-03-29',
    endDate: '2026-04-28',
  };

  // 1. Get Master Report data
  console.log('\n📊 MASTER REPORT (Source of Truth):');
  console.log('-'.repeat(80));
  
  const masterReport = await MasterReportService.generateComprehensiveReport(filters);
  const masterVendors = masterReport.performance.vendors.slice(0, 5);
  
  for (const vendor of masterVendors) {
    console.log(`   ${vendor.businessName}:`);
    console.log(`      Participated: ${vendor.auctionsParticipated}`);
    console.log(`      Won: ${vendor.auctionsWon}`);
    console.log(`      Win Rate: ${vendor.winRate}%`);
    console.log(`      Total Spent: ₦${vendor.totalSpent.toLocaleString()}`);
  }

  // 2. Get Vendor Performance Report data (after fix)
  console.log('\n📊 VENDOR PERFORMANCE REPORT (After Fix):');
  console.log('-'.repeat(80));
  
  const vendorData = await OperationalDataRepository.getVendorPerformanceData(filters);
  const topVendors = vendorData.slice(0, 5);
  
  for (const vendor of topVendors) {
    console.log(`   ${vendor.vendorName}:`);
    console.log(`      Bids: ${vendor.totalBids}`);
    console.log(`      Won: ${vendor.totalWins}`);
    console.log(`      Win Rate: ${vendor.winRate}%`);
    console.log(`      Total Spent: ₦${vendor.totalSpent.toLocaleString()}`);
  }

  // 3. Compare the two
  console.log('\n' + '='.repeat(80));
  console.log('🎯 COMPARISON:');
  console.log('-'.repeat(80));
  
  let allMatch = true;
  for (let i = 0; i < Math.min(masterVendors.length, topVendors.length); i++) {
    const master = masterVendors[i];
    const report = topVendors[i];
    
    const spentMatch = Math.abs(master.totalSpent - report.totalSpent) < 1;
    const winRateMatch = Math.abs(master.winRate - report.winRate) < 0.1;
    const winsMatch = master.auctionsWon === report.totalWins;
    
    console.log(`\n   ${master.businessName}:`);
    console.log(`      Total Spent: ${spentMatch ? '✅' : '❌'} (Master: ₦${master.totalSpent.toLocaleString()}, Report: ₦${report.totalSpent.toLocaleString()})`);
    console.log(`      Win Rate: ${winRateMatch ? '✅' : '❌'} (Master: ${master.winRate}%, Report: ${report.winRate}%)`);
    console.log(`      Wins: ${winsMatch ? '✅' : '❌'} (Master: ${master.auctionsWon}, Report: ${report.totalWins})`);
    
    if (!spentMatch || !winRateMatch || !winsMatch) {
      allMatch = false;
    }
  }

  console.log('\n' + '='.repeat(80));
  if (allMatch) {
    console.log('✅ SUCCESS: Vendor Performance Report now matches Master Report!');
  } else {
    console.log('❌ ISSUE: Some values still don\'t match');
  }
  console.log('='.repeat(80));
}

verify()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
