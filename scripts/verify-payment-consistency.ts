/**
 * Verify Payment Data Consistency Across Reports
 * 
 * Tests that vendor spending, salvage recovery, and payment analytics
 * all show consistent payment totals after fixes
 */

import 'dotenv/config';
import { FinancialDataRepository } from '../src/features/reports/financial/repositories/financial-data.repository';
import { VendorSpendingService } from '../src/features/reports/financial/services/vendor-spending.service';
import { RevenueAnalysisService } from '../src/features/reports/financial/services/revenue-analysis.service';
import { PaymentAnalyticsService } from '../src/features/reports/financial/services/payment-analytics.service';

async function verifyConsistency() {
  console.log('=== Verifying Payment Data Consistency ===\n');

  // Use same date range for all reports
  const filters = {
    startDate: '2026-03-16',
    endDate: '2026-04-15',
  };

  try {
    // 1. Vendor Spending Report
    console.log('1. VENDOR SPENDING REPORT');
    const vendorReport = await VendorSpendingService.generateReport(filters);
    console.log(`   Total Vendors: ${vendorReport.summary.totalVendors}`);
    console.log(`   Total Spent: ₦${vendorReport.summary.totalSpent.toLocaleString()}`);
    console.log(`   (Only verified payments with auctionId)\n`);

    // 2. Salvage Recovery Report
    console.log('2. SALVAGE RECOVERY REPORT');
    const revenueReport = await RevenueAnalysisService.generateReport(filters);
    console.log(`   Total Cases: ${revenueReport.summary.totalCases}`);
    console.log(`   Total Salvage Recovered: ₦${revenueReport.summary.totalSalvageRecovered.toLocaleString()}`);
    console.log(`   (Only verified payment amounts, no bids)\n`);

    // 3. Payment Analytics Report
    console.log('3. PAYMENT ANALYTICS REPORT');
    const paymentReport = await PaymentAnalyticsService.generateReport(filters);
    console.log(`   Total Payments: ${paymentReport.summary.totalPayments}`);
    console.log(`   Total Amount: ₦${paymentReport.summary.totalAmount.toLocaleString()}`);
    console.log(`   Success Rate: ${paymentReport.summary.successRate}%`);
    console.log(`   (Only auction payments, all statuses)\n`);

    // 4. Breakdown by status
    console.log('4. PAYMENT BREAKDOWN BY STATUS');
    for (const status of paymentReport.byStatus) {
      console.log(`   ${status.status}: ${status.count} payments, ₦${status.totalAmount.toLocaleString()}`);
    }
    console.log();

    // 5. Consistency Check
    console.log('=== CONSISTENCY CHECK ===');
    
    const vendorTotal = vendorReport.summary.totalSpent;
    const salvageTotal = revenueReport.summary.totalSalvageRecovered;
    const paymentTotal = paymentReport.summary.totalAmount;

    console.log(`Vendor Spending:    ₦${vendorTotal.toLocaleString()} (verified only)`);
    console.log(`Salvage Recovery:   ₦${salvageTotal.toLocaleString()} (verified only)`);
    console.log(`Payment Analytics:  ₦${paymentTotal.toLocaleString()} (all auction payments)`);
    console.log();

    // Check if vendor spending matches salvage recovery (both should be verified only)
    if (Math.abs(vendorTotal - salvageTotal) < 1) {
      console.log('✅ Vendor Spending and Salvage Recovery MATCH (verified payments)');
    } else {
      console.log('❌ Vendor Spending and Salvage Recovery DO NOT MATCH');
      console.log(`   Difference: ₦${Math.abs(vendorTotal - salvageTotal).toLocaleString()}`);
    }

    // Payment analytics should be higher (includes pending/overdue)
    const verifiedStatus = paymentReport.byStatus.find(s => s.status === 'verified');
    const verifiedTotal = verifiedStatus?.totalAmount || 0;
    
    console.log();
    console.log(`Payment Analytics (verified only): ₦${verifiedTotal.toLocaleString()}`);
    
    if (Math.abs(vendorTotal - verifiedTotal) < 1) {
      console.log('✅ All three reports show consistent VERIFIED payment totals');
    } else {
      console.log('❌ Verified payment totals still inconsistent');
      console.log(`   Difference: ₦${Math.abs(vendorTotal - verifiedTotal).toLocaleString()}`);
    }

    console.log();
    console.log('=== EXPECTED BEHAVIOR ===');
    console.log('• Vendor Spending = Salvage Recovery = Payment Analytics (verified only)');
    console.log('• Payment Analytics total includes pending/overdue payments');
    console.log('• All three reports now use only actual payment amounts (no bids)');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

verifyConsistency()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
