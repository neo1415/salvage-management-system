/**
 * Check Intelligence Data Status
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkData() {
  console.log('🔍 Checking Intelligence Data Status\n');
  console.log('='.repeat(60));
  
  const tables = [
    'predictions',
    'recommendations', 
    'interactions',
    'vendor_segments',
    'asset_performance_analytics',
    'attribute_performance_analytics',
    'temporal_patterns_analytics',
    'geographic_patterns_analytics',
    'ml_training_datasets',
    'session_analytics',
    'conversion_funnel_analytics',
  ];

  for (const table of tables) {
    try {
      const result: any = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table}`));
      const count = result[0]?.count || result.rows?.[0]?.count || 0;
      const status = count > 0 ? '✅' : '❌';
      console.log(`${status} ${table.padEnd(40)} ${count} rows`);
    } catch (error: any) {
      console.log(`❌ ${table.padEnd(40)} ERROR: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

checkData().then(() => process.exit(0)).catch(console.error);
