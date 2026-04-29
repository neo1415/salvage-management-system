/**
 * Test Script: Master Report Documents Section
 * 
 * Tests that the Master Report API now returns correct document metrics
 * after fixing the table mismatch issue.
 */

import { MasterReportService } from '@/features/reports/executive/services/master-report.service';

async function test() {
  console.log('🧪 TESTING MASTER REPORT DOCUMENTS SECTION\n');
  console.log('=' .repeat(80));

  const filters = {
    startDate: '2024-01-01',
    endDate: '2026-12-31',
  };

  console.log('📊 Generating Master Report...');
  console.log(`   Date range: ${filters.startDate} to ${filters.endDate}\n`);

  const report = await MasterReportService.generateComprehensiveReport(filters);

  console.log('📄 OPERATIONAL DATA - DOCUMENTS SECTION:');
  console.log('-'.repeat(80));
  console.log('   Total Generated:', report.operational.documents.totalGenerated);
  console.log('   Completion Rate:', report.operational.documents.completionRate.toFixed(2) + '%');
  console.log('   Avg Time to Complete:', report.operational.documents.avgTimeToComplete.toFixed(2), 'hours');

  console.log('\n📊 FULL OPERATIONAL DATA:');
  console.log('-'.repeat(80));
  console.log('   Cases:');
  console.log('      Total:', report.operational.cases.total);
  console.log('      By Status:', report.operational.cases.byStatus.map(s => `${s.status}: ${s.count}`).join(', '));
  
  console.log('\n   Auctions:');
  console.log('      Total:', report.operational.auctions.total);
  console.log('      Active:', report.operational.auctions.active);
  console.log('      Closed:', report.operational.auctions.closed);
  console.log('      Success Rate:', report.operational.auctions.successRate.toFixed(2) + '%');
  
  console.log('\n   Documents:');
  console.log('      Total Generated:', report.operational.documents.totalGenerated);
  console.log('      Completion Rate:', report.operational.documents.completionRate.toFixed(2) + '%');
  console.log('      Avg Time to Complete:', report.operational.documents.avgTimeToComplete.toFixed(2), 'hours');

  console.log('\n' + '='.repeat(80));
  console.log('🎯 TEST RESULT:');
  if (report.operational.documents.totalGenerated > 0) {
    console.log('   ✅ SUCCESS! Documents section now shows correct data');
    console.log(`   ✅ Total documents: ${report.operational.documents.totalGenerated}`);
    console.log(`   ✅ Completion rate: ${report.operational.documents.completionRate.toFixed(2)}%`);
    console.log('   ✅ Master Report is now accurate');
  } else {
    console.log('   ❌ FAILED! Still showing 0 documents');
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
