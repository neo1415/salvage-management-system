-- Migration: Add Comprehensive Reporting System Tables
-- Date: 2026-04-14
-- Task: Task 2 - Database Schema for Reporting System

-- ============================================================================
-- Report Templates Table
-- Stores reusable report configurations
-- ============================================================================
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL, -- 'financial', 'operational', 'user_performance', 'compliance', 'executive', 'master'
  description TEXT,
  config JSONB NOT NULL, -- Report configuration (filters, metrics, etc.)
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_report_templates_type ON report_templates(type);
CREATE INDEX idx_report_templates_created_by ON report_templates(created_by);

-- ============================================================================
-- Scheduled Reports Table
-- Manages automated report generation and distribution
-- ============================================================================
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type VARCHAR(100) NOT NULL, -- 'recovery-summary', 'vendor-rankings', etc.
  frequency VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly'
  schedule_config JSONB NOT NULL, -- Cron expression, day of week/month, time, etc.
  recipients JSONB NOT NULL, -- Array of email addresses
  filters JSONB, -- Report filters (date range, asset types, etc.)
  format VARCHAR(20) NOT NULL DEFAULT 'pdf', -- 'pdf', 'excel', 'csv'
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'paused', 'failed'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scheduled_reports_user ON scheduled_reports(user_id);
CREATE INDEX idx_scheduled_reports_next_run ON scheduled_reports(next_run);
CREATE INDEX idx_scheduled_reports_status ON scheduled_reports(status);

-- ============================================================================
-- Report Cache Table
-- Caches generated report data for performance
-- ============================================================================
CREATE TABLE IF NOT EXISTS report_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_key VARCHAR(255) UNIQUE NOT NULL, -- Hash of report type + filters
  report_type VARCHAR(100) NOT NULL,
  filters JSONB,
  report_data JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_report_cache_key ON report_cache(report_key);
CREATE INDEX idx_report_cache_expires ON report_cache(expires_at);
CREATE INDEX idx_report_cache_type ON report_cache(report_type);

-- ============================================================================
-- Report Audit Log Table
-- Tracks all report generation and access for compliance
-- ============================================================================
CREATE TABLE IF NOT EXISTS report_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  report_type VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'generate', 'export', 'schedule', 'share'
  filters JSONB,
  export_format VARCHAR(20), -- 'pdf', 'excel', 'csv', 'json'
  ip_address VARCHAR(45),
  user_agent TEXT,
  execution_time_ms INTEGER, -- Performance tracking
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_report_audit_user ON report_audit_log(user_id);
CREATE INDEX idx_report_audit_created ON report_audit_log(created_at);
CREATE INDEX idx_report_audit_type ON report_audit_log(report_type);
CREATE INDEX idx_report_audit_action ON report_audit_log(action);

-- ============================================================================
-- Report Favorites Table
-- Allows users to save favorite reports for quick access
-- ============================================================================
CREATE TABLE IF NOT EXISTS report_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type VARCHAR(100) NOT NULL,
  filters JSONB,
  name VARCHAR(255), -- Custom name for the favorite
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_report_favorites_user ON report_favorites(user_id);
CREATE UNIQUE INDEX idx_report_favorites_unique ON report_favorites(user_id, report_type, ((filters)::text));

-- ============================================================================
-- Performance Indexes on Existing Tables
-- Optimize queries for reporting
-- ============================================================================

-- Salvage Cases indexes for reporting
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON salvage_cases(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_status ON salvage_cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_asset_type ON salvage_cases(asset_type);
CREATE INDEX IF NOT EXISTS idx_cases_adjuster ON salvage_cases(adjuster_id);
CREATE INDEX IF NOT EXISTS idx_cases_market_value ON salvage_cases(market_value);

-- Auctions indexes for reporting
CREATE INDEX IF NOT EXISTS idx_auctions_created_at ON auctions(created_at);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_winner ON auctions.winner_id);
CREATE INDEX IF NOT EXISTS idx_auctions_current_bid ON auctions(current_bid);
CREATE INDEX IF NOT EXISTS idx_auctions_case_id ON auctions(case_id);

-- Payments indexes for reporting
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_amount ON payments(amount);
CREATE INDEX IF NOT EXISTS idx_payments_vendor ON payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payments_verified_at ON payments(verified_at);

-- Bids indexes for reporting
CREATE INDEX IF NOT EXISTS idx_bids_created_at ON bids(created_at);
CREATE INDEX IF NOT EXISTS idx_bids_vendor ON bids(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bids_auction ON bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_amount ON bids(amount);

-- Vendors indexes for reporting
CREATE INDEX IF NOT EXISTS idx_vendors_tier ON vendors(tier);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_rating ON vendors(rating);
CREATE INDEX IF NOT EXISTS idx_vendors_created_at ON vendors(created_at);

-- Users indexes for reporting
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE report_templates IS 'Stores reusable report configurations for quick access';
COMMENT ON TABLE scheduled_reports IS 'Manages automated report generation and email distribution';
COMMENT ON TABLE report_cache IS 'Caches generated report data to improve performance';
COMMENT ON TABLE report_audit_log IS 'Tracks all report access for compliance and security';
COMMENT ON TABLE report_favorites IS 'Stores user favorite reports for quick access';

COMMENT ON COLUMN report_cache.report_key IS 'MD5 hash of report_type + filters for unique identification';
COMMENT ON COLUMN report_cache.expires_at IS 'Cache expiration time (typically 5-15 minutes)';
COMMENT ON COLUMN report_audit_log.execution_time_ms IS 'Report generation time in milliseconds for performance monitoring';
COMMENT ON COLUMN scheduled_reports.schedule_config IS 'Contains cron expression, day of week/month, time, timezone';
COMMENT ON COLUMN scheduled_reports.recipients IS 'Array of email addresses to receive the report';
