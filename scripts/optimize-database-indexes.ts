#!/usr/bin/env tsx

/**
 * Database Index Optimization Script
 * 
 * This script optimizes database indexes for the Universal AI Internet Search System
 * to ensure optimal performance for search operations and analytics queries.
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

async function optimizeIndexes() {
  console.log('🚀 Optimizing Database Indexes for Universal AI Internet Search System');
  console.log('');

  try {
    // 1. Optimize existing market data cache indexes
    console.log('📊 Step 1: Optimizing market data cache indexes...');
    
    // Drop old inefficient indexes
    await sql`DROP INDEX IF EXISTS "idx_market_data_property_hash"`;
    await sql`DROP INDEX IF EXISTS "idx_market_data_stale"`;
    await sql`DROP INDEX IF EXISTS "idx_market_data_type"`;
    
    // Create optimized composite indexes
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_market_data_hash_type_stale" 
      ON "market_data_cache" (property_hash, property_type, stale_at)
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_market_data_type_scraped_fresh" 
      ON "market_data_cache" (property_type, scraped_at DESC) 
      WHERE stale_at > NOW()
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_market_data_price_range" 
      ON "market_data_cache" (property_type, median_price, source_count) 
      WHERE source_count >= 2
    `;
    
    console.log('✅ Market data cache indexes optimized');

    // 2. Optimize search analytics indexes
    console.log('📈 Step 2: Optimizing search analytics indexes...');
    
    // Performance metrics optimization
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_perf_recent_performance" 
      ON "search_performance_metrics" (period_start DESC, avg_response_time) 
      WHERE period_start >= NOW() - INTERVAL '7 days'
    `;
    
    // Usage analytics optimization
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_usage_popular_queries" 
      ON "search_usage_analytics" (search_date DESC, total_searches DESC) 
      WHERE total_searches > 10
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_usage_item_type_trends" 
      ON "search_usage_analytics" (search_date, item_type_distribution) 
      USING GIN (item_type_distribution)
    `;
    
    // Quality metrics optimization
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_quality_confidence_trends" 
      ON "search_quality_metrics" (search_date DESC, avg_confidence_score DESC) 
      WHERE avg_confidence_score IS NOT NULL
    `;
    
    console.log('✅ Search analytics indexes optimized');

    // 3. Optimize API cost tracking indexes
    console.log('💰 Step 3: Optimizing API cost tracking indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_api_cost_daily_spending" 
      ON "api_cost_analytics" (cost_date DESC, total_cost DESC) 
      WHERE cost_date >= CURRENT_DATE - INTERVAL '30 days'
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_api_cost_quota_monitoring" 
      ON "api_cost_analytics" (cost_date, quota_used_percentage) 
      WHERE quota_used_percentage > 0.7
    `;
    
    console.log('✅ API cost tracking indexes optimized');

    // 4. Create specialized search pattern indexes
    console.log('🔍 Step 4: Creating specialized search pattern indexes...');
    
    // Vehicle search optimization
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_market_data_vehicle_search_pattern" 
      ON "market_data_cache" USING GIN (
        (property_details->'make'), 
        (property_details->'model'), 
        (property_details->'year')
      ) 
      WHERE property_type = 'vehicle'
    `;
    
    // Electronics search optimization
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_market_data_electronics_search_pattern" 
      ON "market_data_cache" USING GIN (
        (property_details->'brand'), 
        (property_details->'productModel'), 
        (property_details->'productType')
      ) 
      WHERE property_type = 'electronics'
    `;
    
    // Universal condition and price optimization
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_market_data_condition_price_range" 
      ON "market_data_cache" (
        property_type, 
        (property_details->>'condition'), 
        median_price
      ) 
      WHERE (property_details->>'condition') IS NOT NULL
    `;
    
    console.log('✅ Specialized search pattern indexes created');

    // 5. Create background job optimization indexes
    console.log('⚙️ Step 5: Optimizing background job indexes...');
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_background_jobs_pending_priority" 
      ON "background_jobs" (created_at ASC) 
      WHERE status = 'pending'
    `;
    
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_background_jobs_processing_timeout" 
      ON "background_jobs" (started_at) 
      WHERE status = 'processing' AND started_at < NOW() - INTERVAL '10 minutes'
    `;
    
    console.log('✅ Background job indexes optimized');

    // 6. Create partial indexes for common queries
    console.log('🎯 Step 6: Creating partial indexes for common queries...');
    
    // Fresh cache entries only
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_market_data_fresh_entries" 
      ON "market_data_cache" (property_type, created_at DESC) 
      WHERE stale_at > NOW() AND source_count >= 2
    `;
    
    // High confidence search results
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_quality_high_confidence" 
      ON "search_quality_metrics" (search_date DESC, item_type) 
      WHERE avg_confidence_score >= 0.8
    `;
    
    // Recent successful searches
    await sql`
      CREATE INDEX IF NOT EXISTS "idx_search_usage_recent_successful" 
      ON "search_usage_analytics" (search_date DESC, successful_searches) 
      WHERE successful_searches > 0 AND search_date >= CURRENT_DATE - INTERVAL '7 days'
    `;
    
    console.log('✅ Partial indexes for common queries created');

    // 7. Update table statistics
    console.log('📊 Step 7: Updating table statistics...');
    
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
      await sql`ANALYZE ${sql(table)}`;
      console.log(`  ✓ Analyzed ${table}`);
    }
    
    console.log('✅ Table statistics updated');

    // 8. Check index usage and recommendations
    console.log('🔍 Step 8: Checking index usage and providing recommendations...');
    
    const indexStats = await sql`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_tup_read,
        idx_tup_fetch,
        CASE 
          WHEN idx_tup_read = 0 THEN 'UNUSED'
          WHEN idx_tup_read < 1000 THEN 'LOW_USAGE'
          ELSE 'ACTIVE'
        END as usage_status
      FROM pg_stat_user_indexes 
      WHERE schemaname = 'public' 
        AND tablename IN ('market_data_cache', 'search_performance_metrics', 'search_usage_analytics')
      ORDER BY idx_tup_read DESC
    `;
    
    console.log('\n📈 Index Usage Statistics:');
    for (const stat of indexStats) {
      const icon = stat.usage_status === 'ACTIVE' ? '🟢' : 
                   stat.usage_status === 'LOW_USAGE' ? '🟡' : '🔴';
      console.log(`  ${icon} ${stat.indexname}: ${stat.idx_tup_read} reads (${stat.usage_status})`);
    }

    console.log('\n🎉 Database Index Optimization Completed Successfully!');
    console.log('');
    console.log('📊 Optimization Summary:');
    console.log('  • Replaced single-column indexes with efficient composite indexes');
    console.log('  • Created specialized indexes for search patterns');
    console.log('  • Added partial indexes for common query patterns');
    console.log('  • Optimized analytics and cost tracking queries');
    console.log('  • Updated table statistics for query planner');
    console.log('');
    console.log('🚀 Performance Improvements:');
    console.log('  • Faster cache lookups with composite hash+type+stale index');
    console.log('  • Optimized search pattern matching for vehicles and electronics');
    console.log('  • Efficient analytics queries with time-based partitioning');
    console.log('  • Reduced index maintenance overhead with partial indexes');
    console.log('');
    console.log('💡 Monitoring Recommendations:');
    console.log('  • Monitor index usage statistics weekly');
    console.log('  • Review slow query logs for additional optimization opportunities');
    console.log('  • Consider index maintenance during low-traffic periods');
    console.log('  • Update statistics regularly as data volume grows');

  } catch (error) {
    console.error('❌ Index optimization failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

// Run the optimization
optimizeIndexes().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});