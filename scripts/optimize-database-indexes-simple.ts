#!/usr/bin/env tsx

/**
 * Simple Database Index Optimization Script
 * 
 * This script creates essential indexes for the Universal AI Internet Search System
 * without using problematic WHERE clauses or functions.
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

async function optimizeIndexesSimple() {
  console.log('🚀 Simple Database Index Optimization for Universal AI Internet Search System');
  console.log('');

  try {
    // 1. Create essential composite indexes for market data cache
    console.log('📊 Step 1: Creating essential market data cache indexes...');
    
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
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_market_data_stale_check" 
      ON "market_data_cache" (stale_at, property_type)
    `;
    
    console.log('✅ Market data cache indexes created');

    // 2. Create background job processing indexes
    console.log('⚙️ Step 2: Creating background job processing indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_background_jobs_status_created" 
      ON "background_jobs" (status, created_at ASC)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_background_jobs_property_hash" 
      ON "background_jobs" (property_hash, status)
    `;
    
    console.log('✅ Background job processing indexes created');

    // 3. Create analytics indexes (if tables exist)
    console.log('📈 Step 3: Creating analytics indexes...');
    
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS "idx_search_perf_period_start" 
        ON "search_performance_metrics" (period_start DESC)
      `;
      
      await sql`
        CREATE INDEX IF NOT EXISTS "idx_search_perf_response_time" 
        ON "search_performance_metrics" (avg_response_time_ms)
      `;
      
      console.log('  ✓ Performance metrics indexes created');
    } catch (error) {
      console.log('  ⚠️  Performance metrics indexes skipped (table may not exist)');
    }
    
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS "idx_search_usage_date" 
        ON "search_usage_analytics" (analytics_date DESC)
      `;
      
      await sql`
        CREATE INDEX IF NOT EXISTS "idx_search_usage_vehicle_searches" 
        ON "search_usage_analytics" (vehicle_searches DESC)
      `;
      
      console.log('  ✓ Usage analytics indexes created');
    } catch (error) {
      console.log('  ⚠️  Usage analytics indexes skipped (table may not exist)');
    }
    
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS "idx_search_quality_date" 
        ON "search_quality_metrics" (quality_date DESC)
      `;
      
      await sql`
        CREATE INDEX IF NOT EXISTS "idx_search_quality_confidence" 
        ON "search_quality_metrics" (avg_confidence_score DESC)
      `;
      
      console.log('  ✓ Quality metrics indexes created');
    } catch (error) {
      console.log('  ⚠️  Quality metrics indexes skipped (table may not exist)');
    }
    
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS "idx_api_cost_date" 
        ON "api_cost_analytics" (cost_date DESC)
      `;
      
      await sql`
        CREATE INDEX IF NOT EXISTS "idx_api_cost_quota" 
        ON "api_cost_analytics" (quota_utilization_rate DESC)
      `;
      
      console.log('  ✓ API cost analytics indexes created');
    } catch (error) {
      console.log('  ⚠️  API cost analytics indexes skipped (table may not exist)');
    }

    // 4. Update table statistics
    console.log('📊 Step 4: Updating table statistics...');
    
    const coreTablesExist = [
      'market_data_cache',
      'market_data_sources', 
      'background_jobs'
    ];
    
    for (const table of coreTablesExist) {
      await sql`ANALYZE ${sql(table)}`;
      console.log(`  ✓ Analyzed ${table}`);
    }
    
    // Analytics tables (optional)
    const analyticsTables = [
      'search_performance_metrics',
      'search_usage_analytics',
      'search_quality_metrics',
      'api_cost_analytics',
      'search_trend_analytics'
    ];
    
    for (const table of analyticsTables) {
      try {
        await sql`ANALYZE ${sql(table)}`;
        console.log(`  ✓ Analyzed ${table}`);
      } catch (error) {
        console.log(`  ⚠️  Skipped ${table} (table may not exist)`);
      }
    }
    
    console.log('✅ Table statistics updated');

    // 5. Verify created indexes
    console.log('🔍 Step 5: Verifying created indexes...');
    
    const coreIndexes = await sql`
      SELECT 
        indexname,
        tablename,
        pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
      FROM pg_indexes 
      WHERE tablename IN ('market_data_cache', 'background_jobs')
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `;
    
    console.log('\n📋 Core System Indexes:');
    for (const index of coreIndexes) {
      console.log(`  ✓ ${index.indexname} on ${index.tablename} (${index.index_size})`);
    }

    console.log('\n🎉 Database Index Optimization Completed Successfully!');
    console.log('');
    console.log('📊 Optimization Summary:');
    console.log('  • Created composite indexes for efficient cache lookups');
    console.log('  • Added background job processing optimization');
    console.log('  • Created analytics indexes where tables exist');
    console.log('  • Updated table statistics for query planner');
    console.log('');
    console.log('🚀 Performance Benefits:');
    console.log('  • Faster property hash + type lookups');
    console.log('  • Efficient background job queue processing');
    console.log('  • Optimized analytics queries (where available)');
    console.log('  • Improved cache staleness checks');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('  • Monitor query performance with new indexes');
    console.log('  • Add more specialized indexes as usage patterns emerge');
    console.log('  • Consider partitioning for large analytics tables');

  } catch (error) {
    console.error('❌ Index optimization failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the optimization
optimizeIndexesSimple().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});