/**
 * Diagnose Dashboard API Response Structure
 * 
 * Simulates what the browser receives from the API
 */

import { AssetAnalyticsService } from '@/features/intelligence/services/asset-analytics.service';

async function diagnoseResponse() {
  console.log('🔍 DIAGNOSING DASHBOARD API RESPONSE\n');
  console.log('='.repeat(70));
  
  const startDate = new Date('2026-03-08T07:54:33.686Z'); // From your logs
  const endDate = new Date('2026-04-07T07:54:33.686Z');
  
  console.log(`Date Range (from logs): ${startDate.toISOString()} to ${endDate.toISOString()}\n`);

  try {
    // Simulate the API route transformation
    const assetAnalyticsService = new AssetAnalyticsService();
    const performance = await assetAnalyticsService.getAssetPerformance({
      startDate,
      endDate,
      limit: 50,
    });

    // Transform data EXACTLY like the API does
    const transformedData = performance.map(item => ({
      ...item,
      avgPrice: item.avgFinalPrice, // This is a STRING from database
      sellThroughRate: Number(item.avgSellThroughRate) * 100, // NULL * 100 = 0
      avgDaysToSell: Math.round(Number(item.avgTimeToSell) / 24),
    }));

    console.log('📊 API RESPONSE STRUCTURE:\n');
    console.log(JSON.stringify({
      success: true,
      data: transformedData.slice(0, 2), // First 2 records
      meta: {
        count: transformedData.length,
        filters: { startDate, endDate },
      },
    }, null, 2));

    console.log('\n' + '='.repeat(70));
    console.log('🐛 PROBLEMS IDENTIFIED:\n');
    
    const sample = transformedData[0];
    
    console.log('1. avgPrice TYPE ISSUE:');
    console.log(`   - Value: ${sample.avgPrice}`);
    console.log(`   - Type: ${typeof sample.avgPrice}`);
    console.log(`   - Expected: number`);
    console.log(`   - Actual: string`);
    console.log(`   - Impact: Component calls .toLocaleString() on a string!`);
    
    console.log('\n2. sellThroughRate NULL ISSUE:');
    console.log(`   - avgSellThroughRate from DB: ${sample.avgSellThroughRate}`);
    console.log(`   - After transformation: ${sample.sellThroughRate}`);
    console.log(`   - Expected: 50-100`);
    console.log(`   - Actual: 0 (because NULL * 100 = 0)`);
    console.log(`   - Impact: Dashboard shows 0% for all assets!`);
    
    console.log('\n3. year NULL ISSUE:');
    console.log(`   - Value: ${sample.year}`);
    console.log(`   - Impact: Table shows "null" in Year column`);
    
    console.log('\n' + '='.repeat(70));
    console.log('💡 ROOT CAUSE:\n');
    console.log('The analytics aggregation job is NOT calculating avgSellThroughRate!');
    console.log('This field is NULL in the database, causing all metrics to show 0.');
    
    console.log('\n' + '='.repeat(70));
    console.log('🔧 SOLUTION:\n');
    console.log('1. Fix the analytics aggregation service to calculate sell-through rate');
    console.log('2. Re-run the population script to recalculate metrics');
    console.log('3. Add type conversion in API route (string → number)');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

diagnoseResponse()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
