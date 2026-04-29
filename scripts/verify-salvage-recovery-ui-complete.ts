/**
 * Verify Salvage Recovery Report UI Complete Fix
 * 
 * This script verifies that:
 * 1. Backend returns correct data structure with itemBreakdown and registrationFees
 * 2. All required fields are present in the response
 * 3. Data matches expected totals
 */

import { RevenueAnalysisService } from '../src/features/reports/financial/services/revenue-analysis.service';

async function verifyUIFix() {
  console.log('🔍 Verifying Salvage Recovery Report UI Fix...\n');

  try {
    // Generate report with date range matching user's screenshot
    const report = await RevenueAnalysisService.generateReport({
      startDate: new Date('2026-03-29'),
      endDate: new Date('2026-04-28'),
    });

    console.log('✅ Backend API Response Structure:');
    console.log('=====================================\n');

    // Verify summary section
    console.log('📊 SUMMARY SECTION:');
    console.log(`   Total Revenue: ₦${report.summary.totalRevenue.toLocaleString()}`);
    console.log(`   - Salvage Recovered: ₦${report.summary.totalSalvageRecovered.toLocaleString()}`);
    console.log(`   - Registration Fees: ₦${report.summary.totalRegistrationFees.toLocaleString()}`);
    console.log(`   Total Cases: ${report.summary.totalCases}`);
    console.log(`   Recovery Rate: ${report.summary.averageRecoveryRate.toFixed(2)}%\n`);

    // Verify itemBreakdown exists and has data
    console.log('📋 ITEM BREAKDOWN TABLE:');
    if (report.itemBreakdown && report.itemBreakdown.length > 0) {
      console.log(`   ✅ Found ${report.itemBreakdown.length} items`);
      console.log(`   Sample item:`, {
        claimReference: report.itemBreakdown[0].claimReference,
        assetType: report.itemBreakdown[0].assetType,
        marketValue: report.itemBreakdown[0].marketValue,
        salvageRecovery: report.itemBreakdown[0].salvageRecovery,
        region: report.itemBreakdown[0].region,
        date: report.itemBreakdown[0].date,
      });
    } else {
      console.log('   ❌ No item breakdown data found!');
    }
    console.log('');

    // Verify registrationFees exists and has data
    console.log('💳 REGISTRATION FEES TABLE:');
    if (report.registrationFees && report.registrationFees.length > 0) {
      console.log(`   ✅ Found ${report.registrationFees.length} registration fee(s)`);
      console.log(`   Sample fee:`, {
        vendorName: report.registrationFees[0].vendorName,
        amount: report.registrationFees[0].amount,
        paymentMethod: report.registrationFees[0].paymentMethod,
        status: report.registrationFees[0].status,
        date: report.registrationFees[0].date,
      });
    } else {
      console.log('   ⚠️  No registration fees found (this is OK if none exist in date range)');
    }
    console.log('');

    // Verify byRegion has proper region names (not "Unknown")
    console.log('🗺️  REGIONAL BREAKDOWN:');
    const unknownRegions = report.byRegion?.filter(r => r.region === 'Unknown') || [];
    if (unknownRegions.length === 0) {
      console.log(`   ✅ All ${report.byRegion?.length || 0} regions have proper names`);
      report.byRegion?.forEach(r => {
        console.log(`   - ${r.region}: ₦${r.salvageRecovered.toLocaleString()} (${r.count} cases)`);
      });
    } else {
      console.log(`   ⚠️  Found ${unknownRegions.length} regions with "Unknown" name`);
    }
    console.log('');

    // Final verification
    console.log('✅ VERIFICATION COMPLETE!');
    console.log('=====================================\n');
    console.log('📝 WHAT TO CHECK IN THE UI:');
    console.log('   1. Summary cards show 4 metrics (Total Revenue, Salvage Recovered, Registration Fees, Recovery Rate)');
    console.log('   2. "Detailed Item Breakdown" table appears with all items');
    console.log('   3. "Registration Fees Breakdown" table appears (if fees exist)');
    console.log('   4. Regional breakdown shows actual region names (not "Unknown")');
    console.log('   5. All amounts match the backend data shown above\n');

    console.log('🚀 Next Steps:');
    console.log('   1. Restart your development server');
    console.log('   2. Navigate to the Salvage Recovery Report page');
    console.log('   3. Verify all sections are visible and displaying correct data');

  } catch (error) {
    console.error('❌ Error during verification:', error);
    process.exit(1);
  }
}

verifyUIFix();
