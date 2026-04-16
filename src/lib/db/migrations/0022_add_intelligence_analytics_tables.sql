-- Migration: Add AI-Powered Marketplace Intelligence Analytics Tables
-- Description: Creates asset performance, attribute performance, temporal patterns, geographic patterns, vendor segments, session analytics, conversion funnel, and schema evolution tables
-- Date: 2025-01-21

-- ============================================================================
-- ASSET PERFORMANCE ANALYTICS TABLE
-- ============================================================================

CREATE TABLE asset_performance_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type asset_type NOT NULL,
  make VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  damage_severity damage_severity,
  total_auctions INTEGER NOT NULL DEFAULT 0,
  total_bids INTEGER NOT NULL DEFAULT 0,
  avg_bids_per_auction NUMERIC(8, 2),
  avg_final_price NUMERIC(12, 2),
  avg_sell_through_rate NUMERIC(5, 4),
  avg_time_to_sell INTEGER,
  demand_score INTEGER NOT NULL DEFAULT 0 CHECK (demand_score >= 0 AND demand_score <= 100),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Asset performance indexes
CREATE INDEX idx_asset_perf_asset_type ON asset_performance_analytics(asset_type);
CREATE INDEX idx_asset_perf_make_model ON asset_performance_analytics(make, model);
CREATE INDEX idx_asset_perf_demand_score ON asset_performance_analytics(demand_score DESC);
CREATE INDEX idx_asset_perf_period ON asset_performance_analytics(period_start, period_end);

-- ============================================================================
-- ATTRIBUTE PERFORMANCE ANALYTICS TABLE
-- ============================================================================

CREATE TABLE attribute_performance_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type asset_type NOT NULL,
  attribute_type VARCHAR(50) NOT NULL,
  attribute_value VARCHAR(100) NOT NULL,
  total_auctions INTEGER NOT NULL DEFAULT 0,
  avg_price_premium NUMERIC(12, 2),
  avg_bid_count NUMERIC(8, 2),
  popularity_score INTEGER NOT NULL DEFAULT 0 CHECK (popularity_score >= 0 AND popularity_score <= 100),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Attribute performance indexes
CREATE INDEX idx_attr_perf_asset_type ON attribute_performance_analytics(asset_type);
CREATE INDEX idx_attr_perf_attribute ON attribute_performance_analytics(attribute_type, attribute_value);
CREATE INDEX idx_attr_perf_popularity ON attribute_performance_analytics(popularity_score DESC);
CREATE INDEX idx_attr_perf_period ON attribute_performance_analytics(period_start, period_end);

-- ============================================================================
-- TEMPORAL PATTERNS ANALYTICS TABLE
-- ============================================================================

CREATE TABLE temporal_patterns_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type asset_type,
  hour_of_day INTEGER CHECK (hour_of_day >= 0 AND hour_of_day <= 23),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  month_of_year INTEGER CHECK (month_of_year >= 1 AND month_of_year <= 12),
  avg_bid_count NUMERIC(8, 2),
  avg_final_price NUMERIC(12, 2),
  avg_vendor_activity NUMERIC(8, 2),
  peak_activity_score INTEGER NOT NULL DEFAULT 0 CHECK (peak_activity_score >= 0 AND peak_activity_score <= 100),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Temporal patterns indexes
CREATE INDEX idx_temporal_asset_type ON temporal_patterns_analytics(asset_type);
CREATE INDEX idx_temporal_hour ON temporal_patterns_analytics(hour_of_day);
CREATE INDEX idx_temporal_day ON temporal_patterns_analytics(day_of_week);
CREATE INDEX idx_temporal_month ON temporal_patterns_analytics(month_of_year);
CREATE INDEX idx_temporal_peak_score ON temporal_patterns_analytics(peak_activity_score DESC);
CREATE INDEX idx_temporal_period ON temporal_patterns_analytics(period_start, period_end);

-- ============================================================================
-- GEOGRAPHIC PATTERNS ANALYTICS TABLE
-- ============================================================================

CREATE TABLE geographic_patterns_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region VARCHAR(100) NOT NULL,
  gps_center POINT,
  asset_type asset_type,
  total_auctions INTEGER NOT NULL DEFAULT 0,
  avg_final_price NUMERIC(12, 2),
  price_variance NUMERIC(12, 2),
  avg_vendor_count NUMERIC(8, 2),
  demand_score INTEGER NOT NULL DEFAULT 0 CHECK (demand_score >= 0 AND demand_score <= 100),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Geographic patterns indexes
CREATE INDEX idx_geo_region ON geographic_patterns_analytics(region);
CREATE INDEX idx_geo_asset_type ON geographic_patterns_analytics(asset_type);
CREATE INDEX idx_geo_demand_score ON geographic_patterns_analytics(demand_score DESC);
CREATE INDEX idx_geo_period ON geographic_patterns_analytics(period_start, period_end);

-- ============================================================================
-- VENDOR SEGMENTS TABLE
-- ============================================================================

CREATE TABLE vendor_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL UNIQUE,
  price_segment VARCHAR(50),
  category_segment VARCHAR(50),
  activity_segment VARCHAR(50),
  avg_bid_to_value_ratio NUMERIC(5, 4),
  preferred_asset_types JSONB,
  preferred_price_range JSONB,
  bids_per_week NUMERIC(8, 2),
  overall_win_rate NUMERIC(5, 4),
  last_bid_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Vendor segments indexes
CREATE INDEX idx_vendor_segments_vendor_id ON vendor_segments(vendor_id);
CREATE INDEX idx_vendor_segments_all ON vendor_segments(price_segment, category_segment, activity_segment);
CREATE INDEX idx_vendor_segments_activity ON vendor_segments(activity_segment);

-- ============================================================================
-- SESSION ANALYTICS TABLE
-- ============================================================================

CREATE TABLE session_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL UNIQUE,
  vendor_id UUID,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration_seconds INTEGER,
  pages_viewed INTEGER NOT NULL DEFAULT 0,
  auctions_viewed INTEGER NOT NULL DEFAULT 0,
  bids_placed INTEGER NOT NULL DEFAULT 0,
  bounce_rate NUMERIC(5, 4),
  avg_time_per_page INTEGER,
  conversion_rate NUMERIC(5, 4),
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Session analytics indexes
CREATE INDEX idx_session_analytics_session_id ON session_analytics(session_id);
CREATE INDEX idx_session_analytics_vendor_id ON session_analytics(vendor_id);
CREATE INDEX idx_session_analytics_start_time ON session_analytics(start_time DESC);

-- ============================================================================
-- CONVERSION FUNNEL ANALYTICS TABLE
-- ============================================================================

CREATE TABLE conversion_funnel_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type asset_type,
  total_views INTEGER NOT NULL DEFAULT 0,
  total_watches INTEGER NOT NULL DEFAULT 0,
  total_bids INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  view_to_watch_rate NUMERIC(5, 4),
  watch_to_bid_rate NUMERIC(5, 4),
  bid_to_win_rate NUMERIC(5, 4),
  overall_conversion_rate NUMERIC(5, 4),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Conversion funnel indexes
CREATE INDEX idx_conversion_asset_type ON conversion_funnel_analytics(asset_type);
CREATE INDEX idx_conversion_period ON conversion_funnel_analytics(period_start, period_end);

-- ============================================================================
-- SCHEMA EVOLUTION LOG TABLE
-- ============================================================================

CREATE TABLE schema_evolution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_name VARCHAR(100) NOT NULL,
  change_details JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP,
  applied_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Schema evolution indexes
CREATE INDEX idx_schema_evolution_change_type ON schema_evolution_log(change_type);
CREATE INDEX idx_schema_evolution_status ON schema_evolution_log(status);
CREATE INDEX idx_schema_evolution_created_at ON schema_evolution_log(created_at DESC);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_asset_perf_updated_at
  BEFORE UPDATE ON asset_performance_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attr_perf_updated_at
  BEFORE UPDATE ON attribute_performance_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_temporal_updated_at
  BEFORE UPDATE ON temporal_patterns_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_geo_updated_at
  BEFORE UPDATE ON geographic_patterns_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendor_segments_updated_at
  BEFORE UPDATE ON vendor_segments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversion_updated_at
  BEFORE UPDATE ON conversion_funnel_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
