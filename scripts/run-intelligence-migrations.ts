/**
 * Run AI Marketplace Intelligence Migrations
 * 
 * Executes all 5 intelligence migration files in order:
 * - 0021_add_intelligence_core_tables.sql
 * - 0022_add_intelligence_analytics_tables.sql
 * - 0023_add_intelligence_ml_training_tables.sql
 * - 0024_add_intelligence_fraud_detection_tables.sql
 * - 0025_add_intelligence_materialized_views.sql
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';

const migrations = [
  '0021_add_intelligence_core_tables.sql',
  '0022_add_intelligence_analytics_tables.sql',
  '0023_add_intelligence_ml_training_tables.sql',
  '0024_add_intelligence_fraud_detection_tables.sql',
  '0025_add_intelligence_materialized_views.sql',
];

async function runMigration(filename: string): Promise<void> {
  const migrationPath = path.join(process.cwd(), 'src', 'lib', 'db', 'migrations', filename);
  
  console.log(`\n📄 Reading migration: ${filename}`);
  
  const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
  
  console.log(`⚙️  Executing migration: ${filename}`);
  
  try {
    await db.execute(sql.raw(migrationSQL));
    console.log(`✅ Successfully executed: ${filename}`);
  } catch (error: any) {
    console.error(`❌ Error executing ${filename}:`, error.message);
    throw error;
  }
}

async function verifyMigration(filename: string): Promise<void> {
  console.log(`\n🔍 Verifying migration: ${filename}`);
  
  // Verify based on migration content
  if (filename.includes('core_tables')) {
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('predictions', 'recommendations', 'interactions', 'fraud_alerts', 'algorithm_config')
      ORDER BY table_name
    `);
    const rows = Array.isArray(result) ? result : result.rows || [];
    console.log(`   Found ${rows.length}/5 core tables:`, rows.map((r: any) => r.table_name).join(', '));
  } else if (filename.includes('analytics_tables')) {
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('asset_performance_analytics', 'attribute_performance_analytics', 'temporal_patterns_analytics', 'geographic_patterns_analytics', 'vendor_segments', 'session_analytics', 'conversion_funnel_analytics', 'schema_evolution_log')
      ORDER BY table_name
    `);
    const rows = Array.isArray(result) ? result : result.rows || [];
    console.log(`   Found ${rows.length}/8 analytics tables:`, rows.map((r: any) => r.table_name).join(', '));
  } else if (filename.includes('ml_training_tables')) {
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('ml_training_datasets', 'feature_vectors', 'analytics_rollups', 'prediction_logs', 'recommendation_logs', 'fraud_detection_logs', 'algorithm_config_history')
      ORDER BY table_name
    `);
    const rows = Array.isArray(result) ? result : result.rows || [];
    console.log(`   Found ${rows.length}/7 ML training tables:`, rows.map((r: any) => r.table_name).join(', '));
  } else if (filename.includes('fraud_detection_tables')) {
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('photo_hashes', 'photo_hash_index', 'duplicate_photo_matches')
      ORDER BY table_name
    `);
    const rows = Array.isArray(result) ? result : result.rows || [];
    console.log(`   Found ${rows.length}/3 fraud detection tables:`, rows.map((r: any) => r.table_name).join(', '));
  } else if (filename.includes('materialized_views')) {
    const result = await db.execute(sql`
      SELECT matviewname 
      FROM pg_matviews 
      WHERE schemaname = 'public' 
      AND matviewname IN ('vendor_bidding_patterns_mv', 'market_conditions_mv')
      ORDER BY matviewname
    `);
    const rows = Array.isArray(result) ? result : result.rows || [];
    console.log(`   Found ${rows.length}/2 materialized views:`, rows.map((r: any) => r.matviewname).join(', '));
  }
}

async function main() {
  console.log('🚀 Starting AI Marketplace Intelligence Migrations\n');
  console.log('=' .repeat(60));
  
  try {
    // Test connection
    console.log('🔌 Testing database connection...');
    await db.execute(sql`SELECT NOW()`);
    console.log('✅ Database connection successful\n');
    
    // Run each migration
    for (const migration of migrations) {
      await runMigration(migration);
      await verifyMigration(migration);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All migrations completed successfully!');
    console.log('='.repeat(60));
    
    // Final verification
    console.log('\n📊 Final Database State:');
    const allTables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%intelligence%' OR table_name LIKE '%prediction%' OR table_name LIKE '%recommendation%')
      ORDER BY table_name
    `);
    const tableRows = Array.isArray(allTables) ? allTables : allTables.rows || [];
    console.log(`   Total intelligence-related tables: ${tableRows.length}`);
    
    const allViews = await db.execute(sql`
      SELECT matviewname 
      FROM pg_matviews 
      WHERE schemaname = 'public'
      ORDER BY matviewname
    `);
    const viewRows = Array.isArray(allViews) ? allViews : allViews.rows || [];
    console.log(`   Total materialized views: ${viewRows.length}`);
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

main();
