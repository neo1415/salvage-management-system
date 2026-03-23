-- Migration: Add Internet Search Analytics Tables
-- Date: 2024
-- Description: Creates database tables for Universal AI Internet Search System analytics,
--              metrics tracking, and performance monitoring. These tables support the
--              24-hour Redis cache strategy with persistent analytics storage.
--
-- Tables Created:
--   1. internet_search_logs - Detailed search operation logs
--   2. internet_search_results - Individual search result details
--   3. internet_search_metrics - Aggregated performance metrics
--   4. popular_search_queries - Frequently searched queries for optimization
--   5. api_usage_tracking - API usage and cost monitoring
--
-- Integration: Works alongside existing market_data_cache and Redis caching
-- Purpose: Long-term analytics, performance monitoring, cost tracking

-- ============================================================================
-- 1. Internet Search Logs Table
-- ============================================================================
-- Tracks all internet search operations for analytics and debugging
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
);

-- Performance indexes for internet_search_logs
CREATE INDEX IF NOT EXISTS "idx_internet_search_hash" ON "internet_search_logs" ("search_hash");
CREATE INDEX IF NOT EXISTS "idx_internet_search_item_type" ON "internet_search_logs" ("item_type");
CREATE INDEX IF NOT EXISTS "idx_internet_search_status" ON "internet_search_logs" ("status");
CREATE INDEX IF NOT EXISTS "idx_internet_search_data_source" ON "internet_search_logs" ("data_source");
CREATE INDEX IF NOT EXISTS "idx_internet_search_created_at" ON "internet_search_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_internet_search_performance" ON "internet_search_logs" ("response_time_ms", "created_at");
CREATE INDEX IF NOT EXISTS "idx_internet_search_confidence" ON "internet_search_logs" ("confidence", "created_at");

-- ============================================================================
-- 2. Internet Search Results Table
-- ============================================================================
-- Stores detailed search results for analysis and debugging
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
);

-- Foreign key constraint
ALTER TABLE "internet_search_results" ADD CONSTRAINT "search_results_log_fk" 
FOREIGN KEY ("search_log_id") REFERENCES "internet_search_logs"("id") ON DELETE cascade;

-- Indexes for internet_search_results
CREATE INDEX IF NOT EXISTS "idx_internet_search_results_log" ON "internet_search_results" ("search_log_id");
CREATE INDEX IF NOT EXISTS "idx_internet_search_results_source" ON "internet_search_results" ("source");
CREATE INDEX IF NOT EXISTS "idx_internet_search_results_price" ON "internet_search_results" ("extracted_price");
CREATE INDEX IF NOT EXISTS "idx_internet_search_results_position" ON "internet_search_results" ("position");

-- ============================================================================
-- 3. Internet Search Metrics Table
-- ============================================================================
-- Aggregated metrics for performance monitoring and analytics
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
);

-- Indexes for internet_search_metrics
CREATE INDEX IF NOT EXISTS "idx_internet_search_metrics_period" ON "internet_search_metrics" ("period_type", "period_start");
CREATE INDEX IF NOT EXISTS "idx_internet_search_metrics_created" ON "internet_search_metrics" ("created_at");

-- ============================================================================
-- 4. Popular Search Queries Table
-- ============================================================================
-- Tracks frequently searched queries for cache warming and optimization
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
);

-- Indexes for popular_search_queries
CREATE INDEX IF NOT EXISTS "idx_popular_queries_hash" ON "popular_search_queries" ("query_hash");
CREATE INDEX IF NOT EXISTS "idx_popular_queries_item_type" ON "popular_search_queries" ("item_type");
CREATE INDEX IF NOT EXISTS "idx_popular_queries_count" ON "popular_search_queries" ("search_count");
CREATE INDEX IF NOT EXISTS "idx_popular_queries_last_searched" ON "popular_search_queries" ("last_searched");
CREATE INDEX IF NOT EXISTS "idx_popular_queries_pre_cache" ON "popular_search_queries" ("should_pre_cache", "last_cached");

-- ============================================================================
-- 5. API Usage Tracking Table
-- ============================================================================
-- Detailed tracking of API usage for cost monitoring and rate limiting
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
);

-- Indexes for api_usage_tracking
CREATE INDEX IF NOT EXISTS "idx_api_usage_provider_date" ON "api_usage_tracking" ("provider", "tracking_date");
CREATE INDEX IF NOT EXISTS "idx_api_usage_tracking_date" ON "api_usage_tracking" ("tracking_date");
CREATE INDEX IF NOT EXISTS "idx_api_usage_quota" ON "api_usage_tracking" ("quota_used", "quota_limit");

-- ============================================================================
-- 6. Add audit log entry for migration
-- ============================================================================
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
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1),
  NOW()
WHERE EXISTS (SELECT 1 FROM users WHERE role = 'super_admin');

-- ============================================================================
-- 7. Create initial API usage tracking entry
-- ============================================================================
-- Initialize tracking for current month to establish baseline
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
  2500, -- Serper.dev free tier limit
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;