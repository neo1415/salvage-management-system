/**
 * Verify Date Range Mismatch
 */

import { AssetAnalyticsService } from '@/features/intelligence/services/asset-analytics.service';
import { subDays } from 'date-fns';

async function verifyDateRangeMismatch() {
  console.log('🔍 VERIFYING DATE RANGE MISMATCH\n');
  console.log('='.repeat(70));
  
  // What the dashboard uses
  const dashboardStart = subDays(new Date(), 30);
  const dashboardEnd = new Date();
  
  // What's in the database
  const dbStart = new Date('2026-03-07');
  const dbEnd = new Date('2026-04-06');
  
  console.log('📅 DASHBOARD DATE RANGE:');
  console.log(`   Start: ${dashboardStart.toISOString()}`);
  console.log(`   End: ${dashboardEnd.toISOString()}`);
  
  console.log('\n📅 DATABASE DATE RANGE:');
  console.log(`   Start: ${dbStart.toISOString()}`);
  console.log(`   End: ${dbEnd.toISOString()}`);
  
  console.log('\n' + '='.repeat(70));
  
  const assetService = new AssetAnalyticsService();
  
  // Test with dashboard dates
  console.log('\n🧪 TEST 1: Using Dashboard Dates');
  const dashboardResults = await assetService.getAssetPerformance({
    startDate: dashboardStart,
    endDate: dashboardEnd,
    limit: 50,
  });
  console.log(`   Result: ${dashboardResults.length} records`);
  
  // Test with database dates
  console.log('\n🧪 TEST 2: Using Database Dates');
  const dbResults = await assetService.getAssetPerformance({
    startDate: dbStart,
    endDate: dbEnd,
    limit: 50,
  });
  console.log(`   Result: ${dbResults.length} records`);
  
  console.log('\n' + '='.repeat(70));
  console.log('💡 ROOT CAUSE CONFIRMED:\n');
  
  if (dashboardResults.length === 0 && dbResults.length > 0) {
    console.log('✅ DATE RANGE MISMATCH IS THE PROBLEM!');
    console.log('\nThe dashboard is querying for dates that don\'t exist in the database.');
    console.log('The analytics data was populated for a specific date range,');
    console.log('but the dashboard is using "last 30 days" which is different.');
    
    console.log('\n🔧 SOLUTIONS:');
    console.log('1. Re-populate analytics with current date range');
    console.log('2. OR: Set dashboard default dates to match database range');
    console.log('3. OR: Make analytics population run daily via cron job');
  } else {
    console.log('❌ Date range is NOT the issue. Investigating further...');
  }
}

verifyDateRangeMismatch()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
