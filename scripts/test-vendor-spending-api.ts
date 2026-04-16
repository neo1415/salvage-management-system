import { VendorSpendingService } from '@/features/reports/financial/services/vendor-spending.service';
import { subDays } from 'date-fns';

async function testVendorSpendingAPI() {
  console.log('=== Testing Vendor Spending Service ===\n');

  const filters = {
    startDate: subDays(new Date(), 30).toISOString(),
    endDate: new Date().toISOString(),
  };

  const report = await VendorSpendingService.generateReport(filters);

  console.log('Summary:');
  console.log(`  Total Vendors: ${report.summary.totalVendors}`);
  console.log(`  Total Spent: ₦${report.summary.totalSpent.toLocaleString()}`);
  console.log(`  Avg Spend/Vendor: ₦${report.summary.averageSpendPerVendor.toLocaleString()}`);
  console.log(`  Top Spender %: ${report.summary.topSpenderPercentage}%`);
  console.log('');

  console.log(`Top Spenders (${report.topSpenders.length}):`);
  for (const vendor of report.topSpenders.slice(0, 5)) {
    console.log(`  ${vendor.vendorName}: ₦${vendor.totalSpent.toLocaleString()} (${vendor.transactionCount} txns)`);
  }
  console.log('');

  console.log(`By Tier (${report.byTier.length}):`);
  for (const tier of report.byTier) {
    console.log(`  ${tier.tier}: ${tier.vendorCount} vendors, ₦${tier.totalSpent.toLocaleString()} (${tier.percentage}%)`);
  }
  console.log('');

  console.log(`By Asset Type (${report.byAssetType.length}):`);
  for (const assetType of report.byAssetType) {
    console.log(`  ${assetType.assetType}: ₦${assetType.totalSpent.toLocaleString()} (${assetType.percentage}%)`);
  }
  console.log('');

  console.log('Spending Concentration:');
  console.log(`  Top 10%: ${report.spendingConcentration.top10Percentage}%`);
  console.log(`  Top 20%: ${report.spendingConcentration.top20Percentage}%`);
  console.log(`  HHI: ${report.spendingConcentration.herfindahlIndex}`);
  console.log('');

  console.log('Lifetime Value:');
  console.log(`  Highest: ${report.lifetimeValue.highest.vendorName} - ₦${report.lifetimeValue.highest.totalSpent.toLocaleString()}`);
  console.log(`  Average: ₦${report.lifetimeValue.average.toLocaleString()}`);
  console.log(`  Median: ₦${report.lifetimeValue.median.toLocaleString()}`);

  console.log('\n=== Test Complete ===');
  process.exit(0);
}

testVendorSpendingAPI().catch(console.error);
