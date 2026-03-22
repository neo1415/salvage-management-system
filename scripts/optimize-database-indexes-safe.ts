#!/usr/bin/env tsx

/**
 * Safe Database Index Optimization Script
 * 
 * This script safely optimizes database indexes for the Universal AI Internet Search System
 * using only stable, immutable operations.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config();

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = postgres(connectionString);
const db = drizzle(sql);

async function optimizeIndexesSafe() {
  console.log('🚀 Safe Database Index Optimization for Universal AI Internet Search System');
  console.log('');

  try {
    // 1. Create composite indexes for common query patterns
    console.log('📊 Step 1: Creating composite indexes for common queries...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_market_data_hash_type" 
      ON "market_data_cache" (property_hash, property_type)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_market_data_type_scraped" 
      ON "market_data_cache" (property_type, scraped_at DESC)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_market_data_price_range" 
      ON "market_data_cache" (property_type, median_price, source_count)
    `;
    
    console.log('✅ Composite indexes created');

    // 2. Create analytics performance indexes
    console.log('📈 Step 2: Creating analytics performance indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_perf_period_response" 
      ON "search_performance_metrics" (period_start DESC, avg_response_time)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_usage_date_searches" 
      ON "search_usage_analytics" (search_date DESC, total_searches DESC)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_quality_date_confidence" 
      ON "search_quality_metrics" (search_date DESC, avg_confidence_score DESC)
    `;
    
    console.log('✅ Analytics performance indexes created');

    // 3. Create API cost monitoring indexes
    console.log('💰 Step 3: Creating API cost monitoring indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_api_cost_date_total" 
      ON "api_cost_analytics" (cost_date DESC, total_cost DESC)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_api_cost_quota_usage" 
      ON "api_cost_analytics" (cost_date, quota_used_percentage)
    `;
    
    console.log('✅ API cost monitoring indexes created');

    // 4. Create background job processing indexes
    console.log('⚙️ Step 4: Creating background job processing indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_background_jobs_status_created" 
      ON "background_jobs" (status, created_at ASC)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_background_jobs_processing_started" 
      ON "background_jobs" (status, started_at)
    `;
    
    console.log('✅ Background job processing indexes created');

    // 5. Create search trend analysis indexes
    console.log('📊 Step 5: Creating search trend analysis indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_trend_date_period" 
      ON "search_trend_analytics" (trend_date DESC, period_type)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_trend_popular_items" 
      ON "search_trend_analytics" (trend_date, popular_vehicle_makes) 
      USING GIN (popular_vehicle_makes)
    `;
    
    console.log('✅ Search trend analysis indexes created');

    // 6. Update existing indexes for better performance
    console.log('🔧 Step 6: Updating existing indexes...');
    
    // Check if old indexes exist and drop them safely
    const existingIndexes = await sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'market_data_cache' 
        AND indexname IN ('idx_market_data_property_hash', 'idx_market_data_stale', 'idx_market_data_type')
    `;
    
    for (const index of existingIndexes) {
      await sql`DROP INDEX IF EXISTS ${sql(index.indexname)}`;
      console.log(`  ✓ Dropped old index: ${index.indexname}`);
    }
    
    console.log('✅ Existing indexes updated');

    // 7. Analyze tables for updated statistics
    console.log('📊 Step 7: Analyzing tables for updated statistics...');
    
    const tables = [
      'market_data_cache',
      'market_data_sources', 
      'background_jobs',
      'search_performance_metrics',
      'search_usage_analytics',
      'search_quality_metrics',
      'api_cost_analytics',
      'search_trend_analytics'
    ];
    
    for (const table of tables) {
      try {
        await sql`ANALYZE ${sql(table)}`;
        console.log(`  ✓ Analyzed ${table}`);
      } catch (error) {
        console.log(`  ⚠️  Skipped ${table} (table may not exist)`);
      }
    }
    
    console.log('✅ Table statistics updated');

    // 8. Verify index creation
    console.log('🔍 Step 8: Verifying index creation...');
    
    const newIndexes = await sql`
      SELECT 
        indexname,
        tablename,
        indexdef
      FROM pg_indexes 
      WHERE tablename IN ('market_data_cache', 'search_performance_metrics', 'search_usage_analytics', 'api_cost_analytics')
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `;
    
    console.log('\n📋 Created Indexes:');
    let currentTable = '';
    for (const index of newIndexes) {
      if (index.tablename !== currentTable) {
        currentTable = index.tablename;
        console.log(`\n  📊 ${currentTable}:`);
      }
      console.log(`    ✓ ${index.indexname}`);
    }

    console.log('\n🎉 Safe Database Index Optimization Completed Successfully!');
    console.log('');
    console.log('📊 Optimization Summary:');
    console.log('  • Created composite indexes for efficient query patterns');
    console.log('  • Added analytics performance indexes for dashboard queries');
    console.log('  • Optimized API cost monitoring and background job processing');
    console.log('  • Updated table statistics for query planner optimization');
    console.log('');
    console.log('🚀 Performance Benefits:');
    console.log('  • Faster cache lookups with hash+type composite index');
    console.log('  • Efficient time-series queries for analytics dashboards');
    console.log('  • Optimized background job queue processing');
    console.log('  • Improved API cost monitoring query performance');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('  • Monitor query performance with new indexes');
    console.log('  • Review slow query logs for additional optimization opportunities');
    console.log('  • Consider adding more specialized indexes based on usage patterns');

  } catch (error) {
    console.error('❌ Index optimization failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the optimization
optimizeIndexesSafe().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});