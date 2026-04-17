-- Add Fraud Tracking Tables
-- Created: April 16, 2026
-- Purpose: Track fraud attempts, vendor interactions, and recommendations

-- Fraud Attempts Table
CREATE TABLE IF NOT EXISTS fraud_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  user_email VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT,
  attempted_data JSONB NOT NULL,
  matched_data JSONB,
  confidence DECIMAL(3,2),
  timestamp TIMESTAMP NOT NULL,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX fraud_attempts_user_id_idx ON fraud_attempts(user_id);
CREATE INDEX fraud_attempts_type_idx ON fraud_attempts(type);
CREATE INDEX fraud_attempts_ip_address_idx ON fraud_attempts(ip_address);
CREATE INDEX fraud_attempts_timestamp_idx ON fraud_attempts(timestamp);
CREATE INDEX fraud_attempts_reviewed_idx ON fraud_attempts(reviewed);

-- Vendor Interactions Table
CREATE TABLE IF NOT EXISTS vendor_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL,
  auction_id UUID NOT NULL,
  interaction_type VARCHAR(20) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX vendor_interactions_vendor_id_idx ON vendor_interactions(vendor_id);
CREATE INDEX vendor_interactions_auction_id_idx ON vendor_interactions(auction_id);
CREATE INDEX vendor_interactions_timestamp_idx ON vendor_interactions(timestamp);
CREATE INDEX vendor_interactions_type_idx ON vendor_interactions(interaction_type);

-- Vendor Recommendations Table
CREATE TABLE IF NOT EXISTS vendor_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL,
  auction_id UUID NOT NULL,
  match_score DECIMAL(5,2) NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);

CREATE INDEX vendor_recommendations_vendor_id_idx ON vendor_recommendations(vendor_id);
CREATE INDEX vendor_recommendations_auction_id_idx ON vendor_recommendations(auction_id);
CREATE INDEX vendor_recommendations_match_score_idx ON vendor_recommendations(match_score DESC);
CREATE INDEX vendor_recommendations_created_at_idx ON vendor_recommendations(created_at);

-- Add IP tracking columns to bids table
ALTER TABLE bids ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE bids ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(64);

CREATE INDEX IF NOT EXISTS bids_ip_address_idx ON bids(ip_address);
CREATE INDEX IF NOT EXISTS bids_device_fingerprint_idx ON bids(device_fingerprint);

-- Comments
COMMENT ON TABLE fraud_attempts IS 'Stores all fraud attempt details for investigation';
COMMENT ON TABLE vendor_interactions IS 'Tracks vendor interactions with auctions for recommendations';
COMMENT ON TABLE vendor_recommendations IS 'Stores generated recommendations with match scores';
COMMENT ON COLUMN fraud_attempts.type IS 'Type of fraud: duplicate_vehicle_submission, shill_bidding, payment_fraud, etc.';
COMMENT ON COLUMN fraud_attempts.confidence IS 'AI confidence score (0.00-1.00)';
COMMENT ON COLUMN vendor_interactions.interaction_type IS 'Type: view, bid, watch';
COMMENT ON COLUMN vendor_recommendations.match_score IS 'Match score (0-100)';
