-- Migration: Add AI-Powered Marketplace Intelligence Core Tables
-- Description: Creates predictions, recommendations, interactions, fraud_alerts, and algorithm_config tables
-- Date: 2025-01-21

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE prediction_method AS ENUM ('historical', 'salvage_value', 'market_value_calc', 'no_prediction');
CREATE TYPE confidence_level AS ENUM ('High', 'Medium', 'Low');
CREATE TYPE interaction_type AS ENUM ('view', 'bid', 'win', 'watch', 'unwatch');
CREATE TYPE fraud_entity_type AS ENUM ('vendor', 'case', 'auction', 'user');
CREATE TYPE fraud_alert_status AS ENUM ('pending', 'reviewed', 'dismissed', 'confirmed');

-- ============================================================================
-- PREDICTIONS TABLE
-- ============================================================================

CREATE TABLE predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  predicted_price NUMERIC(12, 2) NOT NULL,
  lower_bound NUMERIC(12, 2) NOT NULL,
  upper_bound NUMERIC(12, 2) NOT NULL,
  confidence_score NUMERIC(5, 4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  confidence_level confidence_level NOT NULL,
  algorithm_version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
  method prediction_method NOT NULL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  actual_price NUMERIC(12, 2),
  accuracy NUMERIC(5, 4),
  absolute_error NUMERIC(12, 2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Predictions indexes
CREATE INDEX idx_predictions_auction_id ON predictions(auction_id);
CREATE INDEX idx_predictions_created_at ON predictions(created_at DESC);
CREATE INDEX idx_predictions_accuracy ON predictions(accuracy) WHERE accuracy IS NOT NULL;
CREATE INDEX idx_predictions_method ON predictions(method);
CREATE INDEX idx_predictions_confidence ON predictions(confidence_score DESC);

-- ============================================================================
-- RECOMMENDATIONS TABLE
-- ============================================================================

CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  match_score NUMERIC(5, 2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  collaborative_score NUMERIC(5, 2),
  content_score NUMERIC(5, 2),
  popularity_boost NUMERIC(5, 2),
  win_rate_boost NUMERIC(5, 2),
  reason_codes JSONB NOT NULL,
  algorithm_version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
  clicked BOOLEAN NOT NULL DEFAULT FALSE,
  clicked_at TIMESTAMP,
  bid_placed BOOLEAN NOT NULL DEFAULT FALSE,
  bid_placed_at TIMESTAMP,
  bid_amount NUMERIC(12, 2),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Recommendations indexes
CREATE INDEX idx_recommendations_vendor_id ON recommendations(vendor_id);
CREATE INDEX idx_recommendations_auction_id ON recommendations(auction_id);
CREATE INDEX idx_recommendations_match_score ON recommendations(match_score DESC);
CREATE INDEX idx_recommendations_created_at ON recommendations(created_at DESC);
CREATE INDEX idx_recommendations_clicked ON recommendations(clicked) WHERE clicked = TRUE;
CREATE INDEX idx_recommendations_bid_placed ON recommendations(bid_placed) WHERE bid_placed = TRUE;
CREATE INDEX idx_recommendations_vendor_auction ON recommendations(vendor_id, auction_id);

-- ============================================================================
-- INTERACTIONS TABLE
-- ============================================================================

CREATE TABLE interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  event_type interaction_type NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  session_id VARCHAR(100),
  metadata JSONB
);

-- Interactions indexes
CREATE INDEX idx_interactions_vendor_id ON interactions(vendor_id);
CREATE INDEX idx_interactions_auction_id ON interactions(auction_id);
CREATE INDEX idx_interactions_event_type ON interactions(event_type);
CREATE INDEX idx_interactions_timestamp ON interactions(timestamp DESC);
CREATE INDEX idx_interactions_vendor_event ON interactions(vendor_id, event_type);

-- ============================================================================
-- FRAUD ALERTS TABLE
-- ============================================================================

CREATE TABLE fraud_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type fraud_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  flag_reasons JSONB NOT NULL,
  status fraud_alert_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Fraud alerts indexes
CREATE INDEX idx_fraud_alerts_entity ON fraud_alerts(entity_type, entity_id);
CREATE INDEX idx_fraud_alerts_status ON fraud_alerts(status);
CREATE INDEX idx_fraud_alerts_risk_score ON fraud_alerts(risk_score DESC);
CREATE INDEX idx_fraud_alerts_created_at ON fraud_alerts(created_at DESC);

-- ============================================================================
-- ALGORITHM CONFIG TABLE
-- ============================================================================

CREATE TABLE algorithm_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Algorithm config indexes
CREATE INDEX idx_algorithm_config_key ON algorithm_config(config_key);
CREATE INDEX idx_algorithm_config_active ON algorithm_config(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- DEFAULT ALGORITHM CONFIGURATION
-- ============================================================================

INSERT INTO algorithm_config (config_key, config_value, description) VALUES
('prediction.similarity_threshold', '60', 'Minimum similarity score for historical matching'),
('prediction.time_decay_months', '6', 'Months for exponential time decay'),
('prediction.min_sample_size', '5', 'Minimum similar auctions for high confidence'),
('prediction.confidence_base', '0.85', 'Base confidence score for good data'),
('recommendation.collab_weight', '0.60', 'Weight for collaborative filtering'),
('recommendation.content_weight', '0.40', 'Weight for content-based filtering'),
('recommendation.min_match_score', '25', 'Minimum match score threshold'),
('recommendation.cold_start_bid_threshold', '3', 'Bids needed to transition from cold start'),
('market.competition_high_threshold', '1.3', 'Multiplier for high competition detection'),
('market.competition_low_threshold', '0.7', 'Multiplier for low competition detection');

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_algorithm_config_updated_at
  BEFORE UPDATE ON algorithm_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
