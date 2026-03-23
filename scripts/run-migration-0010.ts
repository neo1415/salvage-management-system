#!/usr/bin/env tsx

/**
 * Migration Script: 0010 - Add Internet Search Tables
 * 
 * This script runs the database migration to add tables for the Universal AI
 * Internet Search System analytics and monitoring.
 * 
 * Tables Created:
 * - internet_search_logs: Detailed search operation logs
 * - internet_search_results: Individual search result details  
 * - internet_search_metrics: Aggregated performance metrics
 * - popular_search_queries: Frequently searched queries for optimization
 * - api_usage_tracking: API usage and cost monitoring
 * 
 * Usage:
 *   npx tsx scripts/run-migration-0010.ts
 *   
 * Prerequisites:
 * - Database connection configured in .env
 * - Previous migrations (0000-0009) completed
 * - Super admin user exists for audit logging
 */

import { db } from '../src/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function runMigration() {
  console.log('🚀 Starting Migration 0010: Add Internet Search Tables');
  console.log('📊 Purpose: Universal AI Internet Search System analytics and monitoring');
  
  try {
    console.log('⏳ Creating internet_search_logs table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "internet_search_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "search_hash" varchar(64) NOT NULL,
        "query" text NOT NULL,
        "item_type" varchar(20) NOT NULL,
        "item_details" jsonb NOT NULL,
        "status" varchar(20) NOT NULL,
        "result_count" integer DEFAULT 0,
        "prices_found" integer DEFAULT 0,
        "confidence" numeric(5, 2) DEFAULT '0',
        "response_time_ms" integer NOT NULL,
        "data_source" varchar(20) NOT NULL,
        "api_provider" varchar(20) DEFAULT 'serper' NOT NULL,
        "api_cost" numeric(8, 4) DEFAULT '0',
        "error_message" text,
        "error_code" varchar(50),
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    console.log('⏳ Creating indexes for internet_search_logs...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_internet_search_hash" ON "internet_search_logs" ("search_hash")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_internet_search_item_type" ON "internet_search_logs" ("item_type")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_internet_search_status" ON "internet_search_logs" ("status")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_internet_search_data_source" ON "internet_search_logs" ("data_source")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_internet_search_created_at" ON "internet_search_logs" ("created_at")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_internet_search_performance" ON "internet_search_logs" ("response_time_ms", "created_at")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_internet_search_confidence" ON "internet_search_logs" ("confidence", "created_at")`);

    console.log('⏳ Creating internet_search_results table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "internet_search_results" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "search_log_id" uuid NOT NULL,
        "title" text NOT NULL,
        "snippet" text NOT NULL,
        "url" text NOT NULL,
        "source" varchar(100) NOT NULL,
        "extracted_price" numeric(12, 2),
        "currency" varchar(3) DEFAULT 'NGN',
        "price_confidence" numeric(5, 2) DEFAULT '0',
        "position" integer NOT NULL,
        "relevance_score" numeric(5, 2) DEFAULT '0',
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    console.log('⏳ Adding foreign key constraint...');
    await db.execute(sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'search_results_log_fk'
        ) THEN
          ALTER TABLE "internet_search_results" 
          ADD CONSTRAINT "search_results_log_fk" 
          FOREIGN KEY ("search_log_id") REFERENCES "internet_search_logs"("id") ON DELETE cascade;
        END IF;
      END $$
    `);

    console.log('⏳ Creating indexes for internet_search_results...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_internet_search_results_log" ON "internet_search_results" ("search_log_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_internet_search_results_source" ON "internet_search_results" ("source")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_internet_search_results_price" ON "internet_search_results" ("extracted_price")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_internet_search_results_position" ON "internet_search_results" ("position")`);

    console.log('⏳ Creating internet_search_metrics table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "internet_search_metrics" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "period_type" varchar(10) NOT NULL,
        "period_start" timestamp NOT NULL,
        "period_end" timestamp NOT NULL,
        "total_searches" integer DEFAULT 0 NOT NULL,
        "successful_searches" integer DEFAULT 0 NOT NULL,
        "failed_searches" integer DEFAULT 0 NOT NULL,
        "cached_searches" integer DEFAULT 0 NOT NULL,
        "avg_response_time" numeric(8, 2) DEFAULT '0',
        "avg_confidence" numeric(5, 2) DEFAULT '0',
        "avg_prices_found" numeric(5, 2) DEFAULT '0',
        "total_api_calls" integer DEFAULT 0 NOT NULL,
        "total_api_cost" numeric(10, 4) DEFAULT '0',
        "vehicle_searches" integer DEFAULT 0,
        "electronics_searches" integer DEFAULT 0,
        "appliance_searches" integer DEFAULT 0,
        "other_searches" integer DEFAULT 0,
        "cache_hit_rate" numeric(5, 2) DEFAULT '0',
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    console.log('⏳ Creating indexes for internet_search_metrics...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_internet_search_metrics_period" ON "internet_search_metrics" ("period_type", "period_start")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_internet_search_metrics_created" ON "internet_search_metrics" ("created_at")`);

    console.log('⏳ Creating popular_search_queries table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "popular_search_queries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "query_hash" varchar(64) NOT NULL,
        "query" text NOT NULL,
        "item_type" varchar(20) NOT NULL,
        "search_count" integer DEFAULT 1 NOT NULL,
        "last_searched" timestamp DEFAULT now() NOT NULL,
        "avg_response_time" numeric(8, 2) DEFAULT '0',
        "avg_confidence" numeric(5, 2) DEFAULT '0',
        "success_rate" numeric(5, 2) DEFAULT '100',
        "should_pre_cache" boolean DEFAULT false,
        "last_cached" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "popular_search_queries_query_hash_unique" UNIQUE("query_hash")
      )
    `);

    console.log('⏳ Creating indexes for popular_search_queries...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_popular_queries_hash" ON "popular_search_queries" ("query_hash")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_popular_queries_item_type" ON "popular_search_queries" ("item_type")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_popular_queries_count" ON "popular_search_queries" ("search_count")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_popular_queries_last_searched" ON "popular_search_queries" ("last_searched")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_popular_queries_pre_cache" ON "popular_search_queries" ("should_pre_cache", "last_cached")`);

    console.log('⏳ Creating api_usage_tracking table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "api_usage_tracking" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "provider" varchar(20) DEFAULT 'serper' NOT NULL,
        "endpoint" varchar(100) NOT NULL,
        "request_count" integer DEFAULT 0 NOT NULL,
        "success_count" integer DEFAULT 0 NOT NULL,
        "error_count" integer DEFAULT 0 NOT NULL,
        "total_cost" numeric(10, 4) DEFAULT '0',
        "avg_cost_per_request" numeric(8, 4) DEFAULT '0',
        "rate_limit_hits" integer DEFAULT 0,
        "quota_used" integer DEFAULT 0,
        "quota_limit" integer DEFAULT 2500,
        "tracking_date" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      )
    `);

    console.log('⏳ Creating indexes for api_usage_tracking...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_api_usage_provider_date" ON "api_usage_tracking" ("provider", "tracking_date")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_api_usage_tracking_date" ON "api_usage_tracking" ("tracking_date")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_api_usage_quota" ON "api_usage_tracking" ("quota_used", "quota_limit")`);

    console.log('⏳ Adding audit log entry...');
    await db.execute(sql`
      INSERT INTO valuation_audit_logs (
        id,
        action,
        entity_type,
        entity_id,
        changed_fields,
        user_id,
        created_at
      )
      SELECT
        gen_random_uuid(),
        'create',
        'migration',
        gen_random_uuid(),
        jsonb_build_object(
          'migration', jsonb_build_object(
            'name', '0010_add_internet_search_tables',
            'description', 'Added database tables for Universal AI Internet Search System analytics and monitoring',
            'tables_created', jsonb_build_array(
              'internet_search_logs',
              'internet_search_results', 
              'internet_search_metrics',
              'popular_search_queries',
              'api_usage_tracking'
            ),
            'purpose', jsonb_build_object(
              'analytics', 'Long-term search performance tracking',
              'monitoring', 'API usage and cost monitoring',
              'optimization', 'Cache warming and query optimization',
              'debugging', 'Detailed search result analysis'
            ),
            'integration', jsonb_build_object(
              'cache_strategy', '24-hour Redis cache with persistent analytics',
              'existing_tables', 'Works alongside market_data_cache and scraping_logs',
              'api_provider', 'Serper.dev Google Search API'
            )
          )
        ),
        (SELECT id FROM users WHERE role = 'system_admin' LIMIT 1),
        NOW()
      WHERE EXISTS (SELECT 1 FROM users WHERE role = 'system_admin')
    `);

    console.log('⏳ Creating initial API usage tracking entry...');
    await db.execute(sql`
      INSERT INTO api_usage_tracking (
        provider,
        endpoint,
        tracking_date,
        quota_limit,
        created_at,
        updated_at
      )
      VALUES (
        'serper',
        'search',
        DATE_TRUNC('day', NOW()),
        2500,
        NOW(),
        NOW()
      ) ON CONFLICT DO NOTHING
    `);
    
    console.log('✅ Migration 0010 completed successfully!');
    console.log('');
    console.log('📋 Tables Created:');
    console.log('  ✓ internet_search_logs - Search operation tracking');
    console.log('  ✓ internet_search_results - Detailed search results');
    console.log('  ✓ internet_search_metrics - Performance metrics');
    console.log('  ✓ popular_search_queries - Query optimization data');
    console.log('  ✓ api_usage_tracking - API cost monitoring');
    console.log('');
    console.log('🔍 Indexes Created:');
    console.log('  ✓ Performance indexes for fast queries');
    console.log('  ✓ Analytics indexes for reporting');
    console.log('  ✓ Foreign key constraints for data integrity');
    console.log('');
    console.log('📈 Features Enabled:');
    console.log('  ✓ Long-term search analytics');
    console.log('  ✓ API usage and cost tracking');
    console.log('  ✓ Performance monitoring');
    console.log('  ✓ Cache optimization insights');
    console.log('  ✓ Query popularity tracking');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('  1. Verify migration with: npx tsx scripts/verify-migration-0010.ts');
    console.log('  2. Update internet search services to use new analytics tables');
    console.log('  3. Set up monitoring dashboards for new metrics');
    console.log('  4. Configure automated reporting for API usage');
    
  } catch (error) {
    console.error('❌ Migration 0010 failed:', error);
    console.error('');
    console.error('🔧 Troubleshooting:');
    console.error('  1. Check database connection in .env');
    console.error('  2. Ensure previous migrations (0000-0009) are completed');
    console.error('  3. Verify super admin user exists for audit logging');
    console.error('  4. Check database permissions for table creation');
    
    process.exit(1);
  }
}

// Run the migration
runMigration().catch((error) => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});