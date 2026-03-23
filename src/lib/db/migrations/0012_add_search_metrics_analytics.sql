-- Migration: Add Search Metrics and Analytics Tables
-- Date: 2024
-- Description: Creates comprehensive analytics tables for the Universal AI Internet Search System
--              to track search performance, usage patterns, API costs, and system metrics.
--              These tables support real-time dashboards and data-driven optimization.
--
-- Tables Created:
--   1. search_performance_metrics - Real-time search performance tracking
--   2. search_usage_analytics - User behavior and search pattern analytics
--   3. search_quality_metrics - Search result quality and confidence tracking
--   4. api_cost_analytics - Detailed API usage and cost monitoring
--   5. search_trend_analytics - Business intelligence and market trend data
--
-- Purpose: Enable comprehensive monitoring, reporting, and optimization of search system

-- ============================================================================
-- 1. Search Performance Metrics Table
-- ============================================================================
-- Real-time tracking of search performance for monitoring and alerting
CREATE TABLE IF NOT EXISTS "search_performance_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	
	-- Time period tracking
	"metric_timestamp" timestamp NOT NULL DEFAULT now(),
	"period_type" varchar(10) NOT NULL, -- 'minute', 'hour', 'day'
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	
	-- Performance metrics
	"total_searches" integer DEFAULT 0 NOT NULL,
	"successful_searches" integer DEFAULT 0 NOT NULL,
	"failed_searches" integer DEFAULT 0 NOT NULL,
	"timeout_searches" integer DEFAULT 0 NOT NULL,
	"avg_response_time_ms" numeric(8, 2) DEFAULT 0,
	"p95_response_time_ms" numeric(8, 2) DEFAULT 0,
	"p99_response_time_ms" numeric(8, 2) DEFAULT 0,
	
	-- Cache performance
	"cache_hits" integer DEFAULT 0 NOT NULL,
	"cache_misses" integer DEFAULT 0 NOT NULL,
	"cache_hit_rate" numeric(5, 2) DEFAULT 0, -- 0-100%
	
	-- Data source breakdown
	"internet_searches" integer DEFAULT 0 NOT NULL,
	"database_fallbacks" integer DEFAULT 0 NOT NULL,
	"cache_responses" integer DEFAULT 0 NOT NULL,
	
	-- Error tracking
	"api_errors" integer DEFAULT 0 NOT NULL,
	"rate_limit_errors" integer DEFAULT 0 NOT NULL,
	"parsing_errors" integer DEFAULT 0 NOT NULL,
	"validation_errors" integer DEFAULT 0 NOT NULL,
	
	-- Timestamps
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
-- Indexes for search_performance_metrics
CREATE INDEX IF NOT EXISTS "idx_search_perf_timestamp" ON "search_performance_metrics" ("metric_timestamp");
CREATE INDEX IF NOT EXISTS "idx_search_perf_period" ON "search_performance_metrics" ("period_type", "period_start");
CREATE INDEX IF NOT EXISTS "idx_search_perf_created" ON "search_performance_metrics" ("created_at");

-- ============================================================================
-- 2. Search Usage Analytics Table
-- ============================================================================
-- Track user behavior patterns and search usage for business intelligence
CREATE TABLE IF NOT EXISTS "search_usage_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	
	-- Time tracking
	"analytics_date" date NOT NULL,
	"hour_of_day" integer, -- 0-23 for hourly analytics
	
	-- Item type analytics
	"vehicle_searches" integer DEFAULT 0,
	"electronics_searches" integer DEFAULT 0,
	"appliance_searches" integer DEFAULT 0,
	"property_searches" integer DEFAULT 0,
	"jewelry_searches" integer DEFAULT 0,
	"furniture_searches" integer DEFAULT 0,
	"machinery_searches" integer DEFAULT 0,
	"other_searches" integer DEFAULT 0,
	
	-- Search pattern analytics
	"unique_queries" integer DEFAULT 0,
	"repeat_queries" integer DEFAULT 0,
	"avg_query_length" numeric(5, 2) DEFAULT 0,
	"most_common_brands" jsonb DEFAULT '[]'::jsonb,
	"most_common_models" jsonb DEFAULT '[]'::jsonb,
	
	-- User behavior
	"peak_search_hour" integer, -- Hour with most searches
	"avg_searches_per_session" numeric(5, 2) DEFAULT 0,
	"search_abandonment_rate" numeric(5, 2) DEFAULT 0, -- % of searches not completed
	
	-- Geographic patterns (if available)
	"top_locations" jsonb DEFAULT '[]'::jsonb,
	"location_search_patterns" jsonb DEFAULT '{}'::jsonb,
	
	-- Timestamps
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	
	-- Unique constraint for daily analytics
	CONSTRAINT "unique_usage_analytics_date" UNIQUE("analytics_date", "hour_of_day")
);

-- Indexes for search_usage_analytics
CREATE INDEX IF NOT EXISTS "idx_search_usage_date" ON "search_usage_analytics" ("analytics_date");
CREATE INDEX IF NOT EXISTS "idx_search_usage_hour" ON "search_usage_analytics" ("analytics_date", "hour_of_day");
CREATE INDEX IF NOT EXISTS "idx_search_usage_brands" ON "search_usage_analytics" USING GIN ("most_common_brands");
CREATE INDEX IF NOT EXISTS "idx_search_usage_locations" ON "search_usage_analytics" USING GIN ("top_locations");
-- ============================================================================
-- 3. Search Quality Metrics Table
-- ============================================================================
-- Track search result quality, confidence scores, and accuracy metrics
CREATE TABLE IF NOT EXISTS "search_quality_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	
	-- Time tracking
	"quality_date" date NOT NULL,
	"item_type" varchar(20) NOT NULL,
	
	-- Quality metrics
	"total_searches" integer DEFAULT 0 NOT NULL,
	"high_confidence_searches" integer DEFAULT 0, -- confidence > 80%
	"medium_confidence_searches" integer DEFAULT 0, -- confidence 50-80%
	"low_confidence_searches" integer DEFAULT 0, -- confidence < 50%
	"avg_confidence_score" numeric(5, 2) DEFAULT 0,
	
	-- Result quality
	"avg_results_per_search" numeric(5, 2) DEFAULT 0,
	"avg_prices_found" numeric(5, 2) DEFAULT 0,
	"price_extraction_success_rate" numeric(5, 2) DEFAULT 0, -- % of searches with valid prices
	
	-- Source quality
	"reliable_sources_count" integer DEFAULT 0, -- Known good sources (Jiji, Cars45, etc.)
	"unknown_sources_count" integer DEFAULT 0,
	"source_diversity_score" numeric(5, 2) DEFAULT 0, -- How many different sources used
	
	-- Accuracy tracking (when feedback available)
	"user_feedback_count" integer DEFAULT 0,
	"positive_feedback" integer DEFAULT 0,
	"negative_feedback" integer DEFAULT 0,
	"accuracy_score" numeric(5, 2) DEFAULT 0, -- Based on user feedback
	
	-- Price validation
	"outlier_prices_filtered" integer DEFAULT 0,
	"price_validation_failures" integer DEFAULT 0,
	"avg_price_variance" numeric(8, 2) DEFAULT 0, -- Variance in extracted prices
	
	-- Timestamps
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	
	-- Unique constraint
	CONSTRAINT "unique_quality_metrics_date_type" UNIQUE("quality_date", "item_type")
);

-- Indexes for search_quality_metrics
CREATE INDEX IF NOT EXISTS "idx_search_quality_date" ON "search_quality_metrics" ("quality_date");
CREATE INDEX IF NOT EXISTS "idx_search_quality_type" ON "search_quality_metrics" ("item_type");
CREATE INDEX IF NOT EXISTS "idx_search_quality_confidence" ON "search_quality_metrics" ("avg_confidence_score");
CREATE INDEX IF NOT EXISTS "idx_search_quality_accuracy" ON "search_quality_metrics" ("accuracy_score");
-- ============================================================================
-- 4. API Cost Analytics Table
-- ============================================================================
-- Detailed tracking of API usage, costs, and rate limiting for budget management
CREATE TABLE IF NOT EXISTS "api_cost_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	
	-- Time tracking
	"cost_date" date NOT NULL,
	"api_provider" varchar(20) NOT NULL DEFAULT 'serper',
	
	-- Usage metrics
	"total_requests" integer DEFAULT 0 NOT NULL,
	"successful_requests" integer DEFAULT 0 NOT NULL,
	"failed_requests" integer DEFAULT 0 NOT NULL,
	"rate_limited_requests" integer DEFAULT 0 NOT NULL,
	
	-- Cost tracking
	"total_cost_usd" numeric(10, 4) DEFAULT 0,
	"avg_cost_per_request" numeric(8, 4) DEFAULT 0,
	"projected_monthly_cost" numeric(10, 4) DEFAULT 0,
	
	-- Quota management
	"quota_used" integer DEFAULT 0,
	"quota_limit" integer DEFAULT 2500, -- Serper.dev free tier
	"quota_utilization_rate" numeric(5, 2) DEFAULT 0, -- % of quota used
	"days_until_quota_reset" integer DEFAULT 30,
	
	-- Efficiency metrics
	"cost_per_successful_search" numeric(8, 4) DEFAULT 0,
	"cost_savings_from_cache" numeric(10, 4) DEFAULT 0, -- Estimated savings
	"cache_hit_cost_avoidance" integer DEFAULT 0, -- Requests avoided by cache
	
	-- Budget alerts
	"budget_alert_threshold" numeric(5, 2) DEFAULT 80, -- % threshold for alerts
	"budget_alert_triggered" boolean DEFAULT false,
	"projected_overage_amount" numeric(10, 4) DEFAULT 0,
	
	-- Timestamps
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	
	-- Unique constraint
	CONSTRAINT "unique_cost_analytics_date_provider" UNIQUE("cost_date", "api_provider")
);

-- Indexes for api_cost_analytics
CREATE INDEX IF NOT EXISTS "idx_api_cost_date" ON "api_cost_analytics" ("cost_date");
CREATE INDEX IF NOT EXISTS "idx_api_cost_provider" ON "api_cost_analytics" ("api_provider");
CREATE INDEX IF NOT EXISTS "idx_api_cost_quota" ON "api_cost_analytics" ("quota_utilization_rate");
CREATE INDEX IF NOT EXISTS "idx_api_cost_budget_alert" ON "api_cost_analytics" ("budget_alert_triggered", "cost_date");
-- ============================================================================
-- 5. Search Trend Analytics Table
-- ============================================================================
-- Business intelligence data for market trends and popular items
CREATE TABLE IF NOT EXISTS "search_trend_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	
	-- Time tracking
	"trend_date" date NOT NULL,
	"trend_period" varchar(10) NOT NULL, -- 'daily', 'weekly', 'monthly'
	
	-- Trending items
	"trending_vehicles" jsonb DEFAULT '[]'::jsonb, -- [{make, model, search_count, avg_price}]
	"trending_electronics" jsonb DEFAULT '[]'::jsonb,
	"trending_appliances" jsonb DEFAULT '[]'::jsonb,
	"trending_properties" jsonb DEFAULT '[]'::jsonb,
	
	-- Market insights
	"price_trends" jsonb DEFAULT '{}'::jsonb, -- {item_type: {trend: 'up/down/stable', change_pct: number}}
	"popular_conditions" jsonb DEFAULT '{}'::jsonb, -- {condition: search_count}
	"seasonal_patterns" jsonb DEFAULT '{}'::jsonb, -- Seasonal search patterns
	
	-- Search volume trends
	"total_search_volume" integer DEFAULT 0,
	"search_volume_change_pct" numeric(5, 2) DEFAULT 0, -- % change from previous period
	"peak_search_categories" jsonb DEFAULT '[]'::jsonb,
	
	-- Geographic trends
	"regional_search_patterns" jsonb DEFAULT '{}'::jsonb,
	"location_based_price_variations" jsonb DEFAULT '{}'::jsonb,
	
	-- Business metrics
	"conversion_rate" numeric(5, 2) DEFAULT 0, -- % of searches leading to case creation
	"user_engagement_score" numeric(5, 2) DEFAULT 0,
	"search_to_action_time_avg" integer DEFAULT 0, -- Average time from search to action (seconds)
	
	-- Timestamps
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	
	-- Unique constraint
	CONSTRAINT "unique_trend_analytics_date_period" UNIQUE("trend_date", "trend_period")
);

-- Indexes for search_trend_analytics
CREATE INDEX IF NOT EXISTS "idx_search_trend_date" ON "search_trend_analytics" ("trend_date");
CREATE INDEX IF NOT EXISTS "idx_search_trend_period" ON "search_trend_analytics" ("trend_period");
CREATE INDEX IF NOT EXISTS "idx_search_trend_vehicles" ON "search_trend_analytics" USING GIN ("trending_vehicles");
CREATE INDEX IF NOT EXISTS "idx_search_trend_electronics" ON "search_trend_analytics" USING GIN ("trending_electronics");
CREATE INDEX IF NOT EXISTS "idx_search_trend_price_trends" ON "search_trend_analytics" USING GIN ("price_trends");
-- ============================================================================
-- 6. Create Views for Dashboard Reporting
-- ============================================================================

-- Real-time performance dashboard view
CREATE OR REPLACE VIEW "search_performance_dashboard" AS
SELECT 
  spm.period_start,
  spm.period_end,
  spm.total_searches,
  spm.successful_searches,
  ROUND((spm.successful_searches::numeric / NULLIF(spm.total_searches, 0)) * 100, 2) as success_rate,
  spm.avg_response_time_ms,
  spm.cache_hit_rate,
  spm.api_errors,
  spm.rate_limit_errors
FROM search_performance_metrics spm
WHERE spm.period_type = 'hour'
  AND spm.period_start >= NOW() - INTERVAL '24 hours'
ORDER BY spm.period_start DESC;

-- Daily analytics summary view
CREATE OR REPLACE VIEW "daily_search_summary" AS
SELECT 
  sua.analytics_date,
  sua.vehicle_searches + sua.electronics_searches + sua.appliance_searches + 
  sua.property_searches + sua.jewelry_searches + sua.furniture_searches + 
  sua.machinery_searches + sua.other_searches as total_searches,
  sua.vehicle_searches,
  sua.electronics_searches,
  sua.appliance_searches,
  sua.unique_queries,
  sua.repeat_queries,
  sqm.avg_confidence_score,
  sqm.price_extraction_success_rate,
  aca.total_cost_usd,
  aca.quota_utilization_rate
FROM search_usage_analytics sua
LEFT JOIN search_quality_metrics sqm ON sua.analytics_date = sqm.quality_date AND sqm.item_type = 'vehicle'
LEFT JOIN api_cost_analytics aca ON sua.analytics_date = aca.cost_date
WHERE sua.hour_of_day IS NULL -- Daily aggregates only
ORDER BY sua.analytics_date DESC;

-- Cost monitoring view
CREATE OR REPLACE VIEW "cost_monitoring_dashboard" AS
SELECT 
  aca.cost_date,
  aca.total_requests,
  aca.successful_requests,
  aca.total_cost_usd,
  aca.quota_used,
  aca.quota_limit,
  aca.quota_utilization_rate,
  aca.projected_monthly_cost,
  aca.budget_alert_triggered,
  aca.cost_savings_from_cache
FROM api_cost_analytics aca
WHERE aca.cost_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY aca.cost_date DESC;
-- ============================================================================
-- 7. Create Functions for Analytics Data Processing
-- ============================================================================

-- Function to calculate search performance metrics
CREATE OR REPLACE FUNCTION calculate_search_performance_metrics(
  start_time timestamp,
  end_time timestamp,
  period_type varchar(10)
)
RETURNS void AS $$
BEGIN
  INSERT INTO search_performance_metrics (
    period_type,
    period_start,
    period_end,
    total_searches,
    successful_searches,
    failed_searches,
    timeout_searches,
    avg_response_time_ms,
    cache_hits,
    cache_misses,
    internet_searches,
    database_fallbacks,
    cache_responses,
    api_errors,
    rate_limit_errors
  )
  SELECT 
    period_type,
    start_time,
    end_time,
    COUNT(*) as total_searches,
    COUNT(*) FILTER (WHERE status = 'success') as successful_searches,
    COUNT(*) FILTER (WHERE status = 'error') as failed_searches,
    COUNT(*) FILTER (WHERE status = 'timeout') as timeout_searches,
    AVG(response_time_ms) as avg_response_time_ms,
    COUNT(*) FILTER (WHERE data_source = 'cache') as cache_hits,
    COUNT(*) FILTER (WHERE data_source != 'cache') as cache_misses,
    COUNT(*) FILTER (WHERE data_source = 'internet') as internet_searches,
    COUNT(*) FILTER (WHERE data_source = 'database') as database_fallbacks,
    COUNT(*) FILTER (WHERE data_source = 'cache') as cache_responses,
    COUNT(*) FILTER (WHERE error_code LIKE 'API_%') as api_errors,
    COUNT(*) FILTER (WHERE error_code = 'RATE_LIMITED') as rate_limit_errors
  FROM internet_search_logs
  WHERE created_at >= start_time AND created_at < end_time
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Function to update popular search queries
CREATE OR REPLACE FUNCTION update_popular_queries()
RETURNS void AS $$
BEGIN
  INSERT INTO popular_search_queries (
    query_hash,
    query,
    item_type,
    search_count,
    last_searched,
    avg_response_time,
    avg_confidence,
    success_rate
  )
  SELECT 
    search_hash,
    query,
    item_type,
    COUNT(*) as search_count,
    MAX(created_at) as last_searched,
    AVG(response_time_ms) as avg_response_time,
    AVG(confidence) as avg_confidence,
    (COUNT(*) FILTER (WHERE status = 'success')::numeric / COUNT(*)) * 100 as success_rate
  FROM internet_search_logs
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY search_hash, query, item_type
  HAVING COUNT(*) >= 2 -- Only queries searched at least twice
  ON CONFLICT (query_hash) DO UPDATE SET
    search_count = EXCLUDED.search_count,
    last_searched = EXCLUDED.last_searched,
    avg_response_time = EXCLUDED.avg_response_time,
    avg_confidence = EXCLUDED.avg_confidence,
    success_rate = EXCLUDED.success_rate,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
-- ============================================================================
-- 8. Add Audit Log Entry
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
      'name', '0012_add_search_metrics_analytics',
      'description', 'Added comprehensive search metrics and analytics tables for Universal AI Internet Search System',
      'tables_created', jsonb_build_array(
        'search_performance_metrics',
        'search_usage_analytics',
        'search_quality_metrics',
        'api_cost_analytics',
        'search_trend_analytics'
      ),
      'views_created', jsonb_build_array(
        'search_performance_dashboard',
        'daily_search_summary',
        'cost_monitoring_dashboard'
      ),
      'functions_created', jsonb_build_array(
        'calculate_search_performance_metrics',
        'update_popular_queries'
      ),
      'purpose', jsonb_build_object(
        'performance_monitoring', 'Real-time tracking of search performance and response times',
        'usage_analytics', 'User behavior patterns and search trends analysis',
        'quality_metrics', 'Search result quality and confidence scoring',
        'cost_management', 'API usage and budget monitoring with alerts',
        'business_intelligence', 'Market trends and popular item tracking',
        'dashboard_support', 'Views and functions for real-time dashboards'
      ),
      'integration', jsonb_build_object(
        'internet_search_logs', 'Aggregates data from existing search logs',
        'dashboard_apis', 'Supports real-time monitoring dashboards',
        'cost_alerts', 'Enables proactive budget management',
        'optimization', 'Identifies opportunities for cache warming and query optimization'
      )
    )
  ),
  (SELECT id FROM users WHERE role = 'system_admin' LIMIT 1),
  NOW()
WHERE EXISTS (SELECT 1 FROM users WHERE role = 'system_admin');

-- ============================================================================
-- 9. Initialize Sample Data
-- ============================================================================

-- Initialize today's performance metrics
INSERT INTO search_performance_metrics (
  period_type,
  period_start,
  period_end,
  total_searches,
  successful_searches,
  failed_searches
) VALUES (
  'day',
  DATE_TRUNC('day', NOW()),
  DATE_TRUNC('day', NOW()) + INTERVAL '1 day',
  0,
  0,
  0
) ON CONFLICT DO NOTHING;

-- Initialize today's usage analytics
INSERT INTO search_usage_analytics (
  analytics_date,
  vehicle_searches,
  electronics_searches,
  appliance_searches
) VALUES (
  CURRENT_DATE,
  0,
  0,
  0
) ON CONFLICT DO NOTHING;

-- Initialize today's cost analytics
INSERT INTO api_cost_analytics (
  cost_date,
  api_provider,
  quota_limit
) VALUES (
  CURRENT_DATE,
  'serper',
  2500
) ON CONFLICT DO NOTHING;