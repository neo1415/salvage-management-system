-- Migration: Add AI-Powered Marketplace Intelligence ML Training Tables
-- Description: Creates ML training datasets, feature vectors, analytics rollups, and prediction/recommendation/fraud logs
-- Date: 2025-01-21

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE dataset_type AS ENUM ('price_prediction', 'recommendation', 'fraud_detection');
CREATE TYPE dataset_format AS ENUM ('csv', 'json', 'parquet');
CREATE TYPE rollup_period AS ENUM ('hourly', 'daily', 'weekly', 'monthly');

-- ============================================================================
-- ML TRAINING DATASETS TABLE
-- ============================================================================

CREATE TABLE ml_training_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_type dataset_type NOT NULL,
  dataset_name VARCHAR(255) NOT NULL,
  format dataset_format NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  feature_count INTEGER NOT NULL DEFAULT 0,
  date_range_start TIMESTAMP NOT NULL,
  date_range_end TIMESTAMP NOT NULL,
  train_split NUMERIC(3, 2) NOT NULL DEFAULT 0.70,
  validation_split NUMERIC(3, 2) NOT NULL DEFAULT 0.15,
  test_split NUMERIC(3, 2) NOT NULL DEFAULT 0.15,
  file_path VARCHAR(500),
  file_size INTEGER,
  schema JSONB,
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ML datasets indexes
CREATE INDEX idx_ml_datasets_type ON ml_training_datasets(dataset_type);
CREATE INDEX idx_ml_datasets_created_at ON ml_training_datasets(created_at DESC);
CREATE INDEX idx_ml_datasets_date_range ON ml_training_datasets(date_range_start, date_range_end);

-- ============================================================================
-- FEATURE VECTORS TABLE
-- ============================================================================

CREATE TABLE feature_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  features JSONB NOT NULL,
  normalization_params JSONB,
  version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Feature vectors indexes
CREATE INDEX idx_feature_vectors_entity ON feature_vectors(entity_type, entity_id);
CREATE INDEX idx_feature_vectors_version ON feature_vectors(version);
CREATE INDEX idx_feature_vectors_created_at ON feature_vectors(created_at DESC);

-- ============================================================================
-- ANALYTICS ROLLUPS TABLE
-- ============================================================================

CREATE TABLE analytics_rollups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rollup_period rollup_period NOT NULL,
  asset_type asset_type,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Analytics rollups indexes
CREATE INDEX idx_analytics_rollups_period ON analytics_rollups(rollup_period, period_start);
CREATE INDEX idx_analytics_rollups_asset_type ON analytics_rollups(asset_type);
CREATE INDEX idx_analytics_rollups_created_at ON analytics_rollups(created_at DESC);

-- ============================================================================
-- PREDICTION LOGS TABLE
-- ============================================================================

CREATE TABLE prediction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID NOT NULL,
  auction_id UUID NOT NULL,
  predicted_price NUMERIC(12, 2) NOT NULL,
  actual_price NUMERIC(12, 2),
  confidence_score NUMERIC(5, 4) NOT NULL,
  method VARCHAR(50) NOT NULL,
  algorithm_version VARCHAR(50) NOT NULL,
  calculation_details JSONB,
  accuracy NUMERIC(5, 4),
  absolute_error NUMERIC(12, 2),
  percentage_error NUMERIC(5, 4),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Prediction logs indexes
CREATE INDEX idx_prediction_logs_prediction_id ON prediction_logs(prediction_id);
CREATE INDEX idx_prediction_logs_auction_id ON prediction_logs(auction_id);
CREATE INDEX idx_prediction_logs_method ON prediction_logs(method);
CREATE INDEX idx_prediction_logs_accuracy ON prediction_logs(accuracy);
CREATE INDEX idx_prediction_logs_created_at ON prediction_logs(created_at DESC);

-- ============================================================================
-- RECOMMENDATION LOGS TABLE
-- ============================================================================

CREATE TABLE recommendation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  auction_id UUID NOT NULL,
  match_score NUMERIC(5, 2) NOT NULL,
  collaborative_score NUMERIC(5, 2),
  content_score NUMERIC(5, 2),
  reason_codes JSONB NOT NULL,
  algorithm_version VARCHAR(50) NOT NULL,
  calculation_details JSONB,
  clicked BOOLEAN NOT NULL DEFAULT FALSE,
  clicked_at TIMESTAMP,
  bid_placed BOOLEAN NOT NULL DEFAULT FALSE,
  bid_placed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Recommendation logs indexes
CREATE INDEX idx_recommendation_logs_recommendation_id ON recommendation_logs(recommendation_id);
CREATE INDEX idx_recommendation_logs_vendor_id ON recommendation_logs(vendor_id);
CREATE INDEX idx_recommendation_logs_auction_id ON recommendation_logs(auction_id);
CREATE INDEX idx_recommendation_logs_clicked ON recommendation_logs(clicked) WHERE clicked = TRUE;
CREATE INDEX idx_recommendation_logs_bid_placed ON recommendation_logs(bid_placed) WHERE bid_placed = TRUE;
CREATE INDEX idx_recommendation_logs_created_at ON recommendation_logs(created_at DESC);

-- ============================================================================
-- FRAUD DETECTION LOGS TABLE
-- ============================================================================

CREATE TABLE fraud_detection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fraud_alert_id UUID,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  detection_type VARCHAR(100) NOT NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  flag_reasons JSONB NOT NULL,
  analysis_details JSONB,
  confirmed BOOLEAN,
  confirmed_at TIMESTAMP,
  confirmed_by UUID,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Fraud detection logs indexes
CREATE INDEX idx_fraud_logs_fraud_alert_id ON fraud_detection_logs(fraud_alert_id);
CREATE INDEX idx_fraud_logs_entity ON fraud_detection_logs(entity_type, entity_id);
CREATE INDEX idx_fraud_logs_detection_type ON fraud_detection_logs(detection_type);
CREATE INDEX idx_fraud_logs_risk_score ON fraud_detection_logs(risk_score DESC);
CREATE INDEX idx_fraud_logs_created_at ON fraud_detection_logs(created_at DESC);

-- ============================================================================
-- ALGORITHM CONFIG HISTORY TABLE
-- ============================================================================

CREATE TABLE algorithm_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  old_value JSONB,
  new_value JSONB NOT NULL,
  change_reason TEXT,
  performance_impact JSONB,
  changed_by UUID,
  changed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Algorithm config history indexes
CREATE INDEX idx_algorithm_config_history_config_id ON algorithm_config_history(config_id);
CREATE INDEX idx_algorithm_config_history_config_key ON algorithm_config_history(config_key);
CREATE INDEX idx_algorithm_config_history_changed_at ON algorithm_config_history(changed_at DESC);
