/**
 * Check which intelligence tables exist
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function check() {
  console.log('🔍 Checking Intelligence Tables Status\n');
  console.log('='.repeat(60));
  
  try {
    // Check core tables
    console.log('\n📊 Core Tables:');
    const coreTables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('predictions', 'recommendations', 'interactions', 'fraud_alerts', 'algorithm_config')
      ORDER BY table_name
    `);
    const coreRows = Array.isArray(coreTables) ? coreTables : coreTables.rows || [];
    console.log(`   Found ${coreRows.length}/5:`, coreRows.map((r: any) => r.table_name).join(', '));
    
    // Check analytics tables
    console.log('\n📊 Analytics Tables:');
    const analyticsTables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('asset_performance_analytics', 'attribute_performance_analytics', 'temporal_patterns_analytics', 'geographic_patterns_analytics', 'vendor_segments', 'session_analytics', 'conversion_funnel_analytics', 'schema_evolution_log')
      ORDER BY table_name
    `);
    const analyticsRows = Array.isArray(analyticsTables) ? analyticsTables : analyticsTables.rows || [];
    console.log(`   Found ${analyticsRows.length}/8:`, analyticsRows.map((r: any) => r.table_name).join(', '));
    
    // Check ML training tables
    console.log('\n📊 ML Training Tables:');
    const mlTables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ml_training_datasets', 'feature_vectors', 'analytics_rollups', 'prediction_logs', 'recommendation_logs', 'fraud_detection_logs', 'algorithm_config_history')
      ORDER BY table_name
    `);
    const mlRows = Array.isArray(mlTables) ? mlTables : mlTables.rows || [];
    console.log(`   Found ${mlRows.length}/7:`, mlRows.map((r: any) => r.table_name).join(', '));
    
    // Check fraud detection tables
    console.log('\n📊 Fraud Detection Tables:');
    const fraudTables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('photo_hashes', 'photo_hash_index', 'duplicate_photo_matches')
      ORDER BY table_name
    `);
    const fraudRows = Array.isArray(fraudTables) ? fraudTables : fraudTables.rows || [];
    console.log(`   Found ${fraudRows.length}/3:`, fraudRows.map((r: any) => r.table_name).join(', '));
    
    // Check materialized views
    console.log('\n📊 Materialized Views:');
    const views = await db.execute(sql`
      SELECT matviewname 
      FROM pg_matviews 
      WHERE schemaname = 'public' 
      AND matviewname IN ('vendor_bidding_patterns_mv', 'market_conditions_mv')
      ORDER BY matviewname
    `);
    const viewRows = Array.isArray(views) ? views : views.rows || [];
    console.log(`   Found ${viewRows.length}/2:`, viewRows.map((r: any) => r.matviewname).join(', '));
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ Status Check Complete');
    
    const totalExpected = 5 + 8 + 7 + 3 + 2;
    const totalFound = coreRows.length + analyticsRows.length + mlRows.length + fraudRows.length + viewRows.length;
    console.log(`\n📈 Total: ${totalFound}/${totalExpected} objects created`);
    
    if (totalFound === totalExpected) {
      console.log('✅ All intelligence database objects are created!');
    } else {
      console.log(`⚠️  Missing ${totalExpected - totalFound} objects`);
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

check();
