import { FinancialDataRepository } from '@/features/reports/financial/repositories/financial-data.repository';
import { subDays } from 'date-fns';

async function testRevenueQuery() {
  console.log('=== Testing Revenue Data Query ===\n');

  const filters = {
    startDate: subDays(new Date(), 30).toISOString(),
    endDate: new Date().toISOString(),
  };

  const revenueData = await FinancialDataRepository.getRevenueData(filters);

  console.log(`Total revenue records: ${revenueData.length}\n`);

  for (const row of revenueData.slice(0, 5)) {
    console.log(`Case: ${row.claimReference}`);
    console.log(`  Market Value: ₦${parseFloat(row.marketValue).toLocaleString()}`);
    console.log(`  Salvage Recovery: ₦${parseFloat(row.salvageRecovery).toLocaleString()}`);
    console.log(`  Recovery Rate: ${row.recoveryRate}%`);
    console.log(`  Net Loss: ₦${row.netLoss.toLocaleString()}`);
    console.log('');
  }

  // Test profitability data
  console.log('\n=== Testing Profitability Data ===\n');
  const profitData = await FinancialDataRepository.getProfitabilityData(filters);

  console.log('Summary:');
  console.log(`  Total Cases: ${profitData.summary.totalCases}`);
  console.log(`  Total Claims Paid: ₦${profitData.summary.totalClaimsPaid.toLocaleString()}`);
  console.log(`  Total Salvage Recovered: ₦${profitData.summary.totalSalvageRecovered.toLocaleString()}`);
  console.log(`  Average Recovery Rate: ${profitData.summary.averageRecoveryRate}%`);
  console.log('');

  console.log('By Asset Type:');
  for (const [assetType, data] of Object.entries(profitData.byAssetType)) {
    console.log(`  ${assetType}:`);
    console.log(`    Count: ${data.count}`);
    console.log(`    Claims Paid: ₦${data.claimsPaid.toLocaleString()}`);
    console.log(`    Salvage Recovered: ₦${data.salvageRecovered.toLocaleString()}`);
    console.log(`    Recovery Rate: ${data.recoveryRate}%`);
  }

  console.log('\n=== Test Complete ===');
  process.exit(0);
}

testRevenueQuery().catch(console.error);
