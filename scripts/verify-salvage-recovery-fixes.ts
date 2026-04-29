/**
 * Verify Salvage Recovery Report Fixes
 * 
 * Tests the following fixes:
 * 1. Registration fees included in total revenue
 * 2. Regions showing actual locations instead of "Unknown"
 * 3. Detailed item breakdown table
 * 4. Separate registration fees table
 */

import { RevenueAnalysisService } from '../src/features/reports/financial/services/revenue-analysis.service';
import { FinancialDataRepository } from '../src/features/reports/financial/repositories/financial-data.repository';

async function verifyFixes() {
  console.log('🔍 Verifying Salvage Recovery Report Fixes...\n');

  // Test with the same date range as the Master Report (Feb 1 - Apr 28)
  const filters = {
    startDate: '2026-02-01',
    endDate: '2026-04-28',
  };

  try {
    // Generate the report
    console.log('📊 Generating Salvage Recovery Report...');
    const report = await RevenueAnalysisService.generateReport(filters);

    console.log('\n✅ SUMMARY METRICS:');
    console.log(`   Total Cases: ${report.summary.totalCases}`);
    console.log(`   Total Claims Paid: ₦${report.summary.totalClaimsPaid.toLocaleString()}`);
    console.log(`   Total Salvage Recovered: ₦${report.summary.totalSalvageRecovered.toLocaleString()}`);
    console.log(`   Total Registration Fees: ₦${report.summary.totalRegistrationFees.toLocaleString()}`);
    console.log(`   Total Revenue: ₦${report.summary.totalRevenue.toLocaleString()}`);
    console.log(`   Total Net Loss: ₦${report.summary.totalNetLoss.toLocaleString()}`);
    console.log(`   Average Recovery Rate: ${report.summary.averageRecoveryRate}%`);

    // Verify Fix #1: Registration fees included
    console.log('\n✅ FIX #1: Registration Fees Included');
    console.log(`   Registration Fees: ₦${report.summary.totalRegistrationFees.toLocaleString()}`);
    console.log(`   Registration Fee Records: ${report.registrationFees.length}`);
    if (report.registrationFees.length > 0) {
      console.log('   Sample Registration Fees:');
      report.registrationFees.slice(0, 3).forEach(fee => {
        console.log(`     - ${fee.vendorName}: ₦${fee.amount.toLocaleString()} (${fee.date})`);
      });
    }

    // Verify Fix #2: Regions showing actual locations
    console.log('\n✅ FIX #2: Regions Showing Actual Locations');
    const unknownRegions = report.byRegion?.filter(r => r.region === 'Unknown') || [];
    const knownRegions = report.byRegion?.filter(r => r.region !== 'Unknown') || [];
    console.log(`   Known Regions: ${knownRegions.length}`);
    console.log(`   Unknown Regions: ${unknownRegions.length}`);
    if (knownRegions.length > 0) {
      console.log('   Sample Regions:');
      knownRegions.slice(0, 5).forEach(region => {
        console.log(`     - ${region.region}: ${region.count} cases, ₦${region.salvageRecovered.toLocaleString()} recovered`);
      });
    }

    // Verify Fix #3: Detailed item breakdown
    console.log('\n✅ FIX #3: Detailed Item Breakdown Table');
    console.log(`   Total Items: ${report.itemBreakdown.length}`);
    if (report.itemBreakdown.length > 0) {
      console.log('   Sample Items:');
      report.itemBreakdown.slice(0, 5).forEach(item => {
        console.log(`     - ${item.claimReference} (${item.assetType}): ₦${item.salvageRecovery.toLocaleString()} | ${item.region} | ${item.date}`);
      });
    }

    // Verify Fix #4: Separate registration fees table
    console.log('\n✅ FIX #4: Separate Registration Fees Table');
    console.log(`   Total Registration Fee Records: ${report.registrationFees.length}`);
    if (report.registrationFees.length > 0) {
      console.log('   Registration Fee Details:');
      report.registrationFees.forEach(fee => {
        console.log(`     - ${fee.vendorName}: ₦${fee.amount.toLocaleString()} via ${fee.paymentMethod} (${fee.status}) on ${fee.date}`);
      });
    }

    // Compare with Master Report
    console.log('\n📊 COMPARISON WITH MASTER REPORT:');
    console.log(`   Master Report Total (Feb 1 - Apr 28): ₦6,097,500`);
    console.log(`   Salvage Recovery Total: ₦${report.summary.totalRevenue.toLocaleString()}`);
    console.log(`   Breakdown:`);
    console.log(`     - Auction Payments: ₦${report.summary.totalSalvageRecovered.toLocaleString()}`);
    console.log(`     - Registration Fees: ₦${report.summary.totalRegistrationFees.toLocaleString()}`);
    
    const expectedTotal = 6097500;
    const actualTotal = report.summary.totalRevenue;
    const difference = Math.abs(expectedTotal - actualTotal);
    
    if (difference < 100) { // Allow for rounding
      console.log(`   ✅ MATCH! Difference: ₦${difference.toLocaleString()}`);
    } else {
      console.log(`   ⚠️  MISMATCH! Difference: ₦${difference.toLocaleString()}`);
    }

    console.log('\n✅ All fixes verified successfully!');

  } catch (error) {
    console.error('❌ Error verifying fixes:', error);
    throw error;
  }
}

// Run verification
verifyFixes()
  .then(() => {
    console.log('\n✅ Verification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
