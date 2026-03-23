#!/usr/bin/env tsx

/**
 * Final Database Index Optimization Script
 * 
 * This script optimizes database indexes for the Universal AI Internet Search System
 * using the correct column names from the schema.
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

async function optimizeIndexesFinal() {
  console.log('🚀 Final Database Index Optimization for Universal AI Internet Search System');
  console.log('');

  try {
    // 1. Create composite indexes for market data cache
    console.log('📊 Step 1: Optimizing market data cache indexes...');
    
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
      CREATE INDEX IF NOT EXISTS "idx_market_data_stale_fresh" 
      ON "market_data_cache" (property_type, stale_at) 
      WHERE stale_at > NOW()
    `;
    
    console.log('✅ Market data cache indexes optimized');

    // 2. Create analytics performance indexes (using correct column names)
    console.log('📈 Step 2: Creating analytics performance indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_perf_period_response" 
      ON "search_performance_metrics" (period_start DESC, avg_response_time_ms)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_usage_date_searches" 
      ON "search_usage_analytics" (analytics_date DESC, vehicle_searches DESC)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_quality_date_confidence" 
      ON "search_quality_metrics" (quality_date DESC, avg_confidence_score DESC)
    `;
    
    console.log('✅ Analytics performance indexes created');

    // 3. Create API cost monitoring indexes
    console.log('💰 Step 3: Creating API cost monitoring indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_api_cost_date_total" 
      ON "api_cost_analytics" (cost_date DESC, total_cost_usd DESC)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_api_cost_quota_usage" 
      ON "api_cost_analytics" (cost_date, quota_utilization_rate)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_api_cost_budget_alerts" 
      ON "api_cost_analytics" (budget_alert_triggered, cost_date) 
      WHERE budget_alert_triggered = true
    `;
    
    console.log('✅ API cost monitoring indexes created');

    // 4. Create background job processing indexes
    console.log('⚙️ Step 4: Creating background job processing indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_background_jobs_status_created" 
      ON "background_jobs" (status, created_at ASC)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_background_jobs_pending" 
      ON "background_jobs" (created_at ASC) 
      WHERE status = 'pending'
    `;
    
    console.log('✅ Background job processing indexes created');

    // 5. Create search trend analysis indexes
    console.log('📊 Step 5: Creating search trend analysis indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_trend_date_period" 
      ON "search_trend_analytics" (trend_date DESC, trend_period)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_trend_volume" 
      ON "search_trend_analytics" (trend_date, total_search_volume DESC)
    `;
    
    console.log('✅ Search trend analysis indexes created');

    // 6. Create specialized JSONB indexes for search patterns
    console.log('🔍 Step 6: Creating specialized JSONB indexes...');
    
    // Only create if the columns exist (safe approach)
    try {
      await sql`
        CREATE INDEX IF NOT EXISTS "idx_search_usage_brands" 
        ON "search_usage_analytics" USING GIN (most_common_brands)
      `;
      
      await sql`
        CREATE INDEX IF NOT EXISTS "idx_search_trend_vehicles" 
        ON "search_trend_analytics" USING GIN (trending_vehicles)
      `;
      
      console.log('✅ JSONB indexes created');
    } catch (error) {
      console.log('⚠️  JSONB indexes skipped (columns may not exist yet)');
    }

    // 7. Update table statistics
    console.log('📊 Step 7: Updating table statistics...');
    
    const tables = [
      'market_data_cache',
      'market_data_sources', 
      'background_jobs'
    ];
    
    // Analytics tables (may not exist yet)
    const analyticsTables = [
      'search_performance_metrics',
      'search_usage_analytics',
      'search_quality_metrics',
      'api_cost_analytics',
      'search_trend_analytics'
    ];
    
    for (const table of tables) {
      await sql`ANALYZE ${sql(table)}`;
      console.log(`  ✓ Analyzed ${table}`);
    }
    
    for (const table of analyticsTables) {
      try {
        await sql`ANALYZE ${sql(table)}`;
        console.log(`  ✓ Analyzed ${table}`);
      } catch (error) {
        console.log(`  ⚠️  Skipped ${table} (table may not exist)`);
      }
    }
    
    console.log('✅ Table statistics updated');

    // 8. Verify index creation and provide summary
    console.log('🔍 Step 8: Verifying index creation...');
    
    const newIndexes = await sql`
      SELECT 
        indexname,
        tablename,
        pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
      FROM pg_indexes 
      WHERE tablename IN ('market_data_cache', 'background_jobs')
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname
    `;
    
    console.log('\n📋 Market Data & Background Job Indexes:');
    for (const index of newIndexes) {
      console.log(`  ✓ ${index.indexname} (${index.index_size})`);
    }

    // Check analytics indexes if they exist
    try {
      const analyticsIndexes = await sql`
        SELECT 
          indexname,
          tablename,
          pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
        FROM pg_indexes 
        WHERE tablename IN ('search_performance_metrics', 'search_usage_analytics', 'api_cost_analytics')
          AND indexname LIKE 'idx_%'
        ORDER BY tablename, indexname
      `;
      
      if (analyticsIndexes.length > 0) {
        console.log('\n📈 Analytics Indexes:');
        for (const index of analyticsIndexes) {
          console.log(`  ✓ ${index.indexname} (${index.index_size})`);
        }
      }
    } catch (error) {
      console.log('\n⚠️  Analytics indexes verification skipped (tables may not exist)');
    }

    console.log('\n🎉 Database Index Optimization Completed Successfully!');
    console.log('');
    console.log('📊 Optimization Summary:');
    console.log('  • Created composite indexes for efficient cache lookups');
    console.log('  • Added performance indexes for analytics queries');
    console.log('  • Optimized background job queue processing');
    console.log('  • Enhanced API cost monitoring capabilities');
    console.log('  • Updated table statistics for query optimization');
    console.log('');
    console.log('🚀 Performance Benefits:');
    console.log('  • Faster property hash + type lookups');
    console.log('  • Efficient time-series analytics queries');
    console.log('  • Optimized background job processing');
    console.log('  • Quick budget alert monitoring');
    console.log('');
    console.log('💡 Monitoring Recommendations:');
    console.log('  • Monitor index usage with pg_stat_user_indexes');
    console.log('  • Review query performance regularly');
    console.log('  • Update statistics weekly as data grows');
    console.log('  • Consider partitioning for large analytics tables');

  } catch (error) {
    console.error('❌ Index optimization failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the optimization
optimizeIndexesFinal().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});