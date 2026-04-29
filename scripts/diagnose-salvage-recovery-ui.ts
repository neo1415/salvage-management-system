/**
 * Diagnose Salvage Recovery Report UI Issue
 * 
 * The page shows ₦0 in summary cards but has data in the tables below.
 * This script checks if the API is returning correct data structure.
 */

import { RevenueAnalysisService } from '@/features/reports/financial/services/revenue-analysis.service';
import { ReportFilters } from '@/features/reports/types';

async function diagnoseSalvageRecoveryUI() {
  console.log('🔍 Diagnosing Salvage Recovery Report UI Issue...\n');

  // Use the same date range as shown in the screenshot
  const filters: ReportFilters = {
    startDate: '2026-04-01',
    endDate: '2026-04-28',
  };

  console.log('📅 Date Range:', filters.startDate, 'to', filters.endDate);
  console.log('');

  try {
    const report = await RevenueAnalysisService.generateReport(filters);

    console.log('✅ API Response Structure:');
    console.log('');
    console.log('📊 Summary Object:');
    console.log(JSON.stringify(report.summary, null, 2));
    console.log('');

    console.log('📈 By Asset Type (first 3):');
    console.log(JSON.stringify(report.byAssetType.slice(0, 3), null, 2));
    console.log('');

    console.log('🗺️ By Region (first 3):');
    console.log(JSON.stringify(report.byRegion?.slice(0, 3), null, 2));
    console.log('');

    console.log('📋 Item Breakdown Count:', report.itemBreakdown.length);
    console.log('💰 Registration Fees Count:', report.registrationFees.length);
    console.log('📉 Trend Data Points:', report.trend.length);
    console.log('');

    // Check if summary values match what's shown in the tables
    const totalFromAssetTypes = report.byAssetType.reduce((sum, a) => sum + a.salvageRecovered, 0);
    const totalFromRegions = report.byRegion?.reduce((sum, r) => sum + r.salvageRecovered, 0) || 0;

    console.log('🔢 Verification:');
    console.log('  Summary Total Salvage:', report.summary.totalSalvageRecovered);
    console.log('  Sum from Asset Types:', totalFromAssetTypes);
    console.log('  Sum from Regions:', totalFromRegions);
    console.log('  Match:', report.summary.totalSalvageRecovered === totalFromAssetTypes);
    console.log('');

    // Check if the issue is in the data structure
    if (report.summary.totalSalvageRecovered === 0 && totalFromAssetTypes > 0) {
      console.log('❌ ISSUE FOUND: Summary shows ₦0 but asset type data exists!');
      console.log('   This is a calculation bug in the service layer.');
    } else if (report.summary.totalSalvageRecovered > 0) {
      console.log('✅ Summary data is correct. Issue is likely in the frontend component.');
    } else {
      console.log('⚠️ No data found for this date range.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

diagnoseSalvageRecoveryUI();
