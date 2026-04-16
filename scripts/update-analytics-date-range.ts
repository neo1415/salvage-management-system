/**
 * Update Analytics Date Range
 * 
 * Updates the period_start and period_end in existing analytics records
 * to match the current "last 30 days" range that the dashboard uses
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { subDays } from 'date-fns';

async function updateAnalyticsDateRange() {
  console.log('🔧 UPDATING ANALYTICS DATE RANGE\n');
  console.log('='.repeat(70));
  
  const endDate = new Date();
  const startDate = subDays(endDate, 30);
  
  const endDateStr = endDate.toISOString().split('T')[0];
  const startDateStr = startDate.toISOString().split('T')[0];
  
  console.log(`📅 New Date Range:`);
  console.log(`   Start: ${startDateStr}`);
  console.log(`   End: ${endDateStr}`);
  console.log();
  
  try {
    // Update asset_performance_analytics
    console.log('🔄 Updating asset_performance_analytics...');
    await db.execute(sql`
      UPDATE asset_performance_analytics
      SET period_start = ${startDateStr},
          period_end = ${endDateStr},
          updated_at = NOW()
    `);
    console.log('   ✅ Done');
    
    // Update attribute_performance_analytics
    console.log('\n🔄 Updating attribute_performance_analytics...');
    await db.execute(sql`
      UPDATE attribute_performance_analytics
      SET period_start = ${startDateStr},
          period_end = ${endDateStr},
          updated_at = NOW()
    `);
    console.log('   ✅ Done');
    
    // Update temporal_patterns_analytics
    console.log('\n🔄 Updating temporal_patterns_analytics...');
    await db.execute(sql`
      UPDATE temporal_patterns_analytics
      SET period_start = ${startDateStr},
          period_end = ${endDateStr},
          updated_at = NOW()
    `);
    console.log('   ✅ Done');
    
    // Update geographic_patterns_analytics
    console.log('\n🔄 Updating geographic_patterns_analytics...');
    await db.execute(sql`
      UPDATE geographic_patterns_analytics
      SET period_start = ${startDateStr},
          period_end = ${endDateStr},
          updated_at = NOW()
    `);
    console.log('   ✅ Done');
    
    // Update vendor_segments
    console.log('\n🔄 Updating vendor_segments...');
    await db.execute(sql`
      UPDATE vendor_segments
      SET updated_at = NOW()
    `);
    console.log('   ✅ Done');
    
    // Update conversion_funnel_analytics
    console.log('\n🔄 Updating conversion_funnel_analytics...');
    await db.execute(sql`
      UPDATE conversion_funnel_analytics
      SET period_start = ${startDateStr},
          period_end = ${endDateStr}
    `);
    console.log('   ✅ Done');
    
    console.log('\n' + '='.repeat(70));
    console.log('✅ ANALYTICS DATE RANGE UPDATED SUCCESSFULLY!\n');
    console.log('The dashboard should now show data.');
    console.log('\n🔍 Verifying...');
    
    // Verify the update
    const result: any = await db.execute(sql`
      SELECT 
        'asset_performance' as table_name,
        COUNT(*) as count,
        MIN(period_start) as min_start,
        MAX(period_end) as max_end
      FROM asset_performance_analytics
      UNION ALL
      SELECT 
        'attribute_performance',
        COUNT(*),
        MIN(period_start),
        MAX(period_end)
      FROM attribute_performance_analytics
      UNION ALL
      SELECT 
        'temporal_patterns',
        COUNT(*),
        MIN(period_start),
        MAX(period_end)
      FROM temporal_patterns_analytics
      UNION ALL
      SELECT 
        'geographic_patterns',
        COUNT(*),
        MIN(period_start),
        MAX(period_end)
      FROM geographic_patterns_analytics
    `);
    
    console.log('\n📊 Updated Records:');
    for (const row of result) {
      console.log(`   ${row.table_name}: ${row.count} records (${row.min_start} to ${row.max_end})`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

updateAnalyticsDateRange()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
