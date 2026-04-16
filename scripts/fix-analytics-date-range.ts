/**
 * Fix Analytics Date Range
 * 
 * Re-populate analytics with current date range (last 30 days)
 */

import { AnalyticsAggregationService } from '@/features/intelligence/services/analytics-aggregation.service';
import { subDays } from 'date-fns';

async function fixAnalyticsDateRange() {
  console.log('🔧 FIXING ANALYTICS DATE RANGE\n');
  console.log('='.repeat(70));
  
  const endDate = new Date();
  const startDate = subDays(endDate, 30);
  
  console.log(`📅 New Date Range:`);
  console.log(`   Start: ${startDate.toISOString()}`);
  console.log(`   End: ${endDate.toISOString()}`);
  console.log();
  
  try {
    const aggregationService = new AnalyticsAggregationService();
    
    console.log('🔄 Running Daily Rollup (includes all analytics)...');
    console.log('   This will calculate:');
    console.log('   - Asset Performance');
    console.log('   - Attribute Performance');
    console.log('   - Temporal Patterns (hourly & daily)');
    console.log('   - Geographic Patterns');
    console.log('   - Conversion Funnel');
    console.log();
    
    await aggregationService.runDailyRollup();
    
    console.log('\n🔄 Running Weekly Rollup (vendor segmentation)...');
    await aggregationService.runWeeklyRollup();
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ ANALYTICS RE-POPULATED SUCCESSFULLY!\n');
    console.log('The dashboard should now show data for the last 30 days.');
    console.log('\n💡 TIP: Set up a daily cron job to keep analytics up-to-date:');
    console.log('   POST /api/cron/analytics-aggregation');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixAnalyticsDateRange()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
