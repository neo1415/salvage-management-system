import { FinancialDataRepository } from '@/features/reports/financial/repositories/financial-data.repository';
import { subDays } from 'date-fns';

async function testVendorSpending() {
  console.log('=== Testing Vendor Spending Data ===\n');

  const filters = {
    startDate: subDays(new Date(), 30).toISOString(),
    endDate: new Date().toISOString(),
  };

  const vendorData = await FinancialDataRepository.getVendorSpendingData(filters);

  console.log(`Total vendors found: ${vendorData.length}\n`);

  for (const vendor of vendorData) {
    console.log(`Vendor: ${vendor.vendorName}`);
    console.log(`  ID: ${vendor.vendorId}`);
    console.log(`  Tier: ${vendor.tier}`);
    console.log(`  Total Spent: ₦${vendor.totalSpent.toLocaleString()}`);
    console.log(`  Transactions: ${vendor.transactionCount}`);
    console.log(`  Avg Transaction: ₦${vendor.averageTransaction.toLocaleString()}`);
    console.log(`  First Purchase: ${vendor.firstPurchase.toISOString().split('T')[0]}`);
    console.log(`  Last Purchase: ${vendor.lastPurchase.toISOString().split('T')[0]}`);
    console.log(`  Asset Type Breakdown:`, vendor.assetTypeBreakdown);
    console.log('');
  }

  console.log('\n=== Test Complete ===');
  process.exit(0);
}

testVendorSpending().catch(console.error);
