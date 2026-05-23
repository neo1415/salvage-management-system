-- Additive scalability indexes for hot operational paths.
-- Safe to apply on staging first. For large production tables, run during low traffic.

-- Bid placement and fraud-analysis lookups.
CREATE INDEX IF NOT EXISTS idx_bids_auction_vendor_created_at
  ON bids(auction_id, vendor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bids_vendor_created_at
  ON bids(vendor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bids_ip_created_at
  ON bids(ip_address, created_at DESC);

-- Auction dashboards, active lists, and current-bidder checks.
CREATE INDEX IF NOT EXISTS idx_auctions_status_created_at
  ON auctions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auctions_current_bidder
  ON auctions(current_bidder)
  WHERE current_bidder IS NOT NULL;

-- Payment dashboards and winner payment flows.
CREATE INDEX IF NOT EXISTS idx_payments_vendor_status_created_at
  ON payments(vendor_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_auction_vendor_status
  ON payments(auction_id, vendor_id, status)
  WHERE auction_id IS NOT NULL;

-- Document signing/payment deadline checks.
CREATE INDEX IF NOT EXISTS idx_release_forms_auction_vendor_status
  ON release_forms(auction_id, vendor_id, status);

-- Audit timeline/detail views.
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created_at
  ON audit_logs(entity_type, entity_id, created_at DESC);

-- Dojah/provider review queues.
CREATE INDEX IF NOT EXISTS idx_provider_verifications_vendor_type_updated_at
  ON provider_verification_records(vendor_id, verification_type, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_verifications_status_updated_at
  ON provider_verification_records(status, updated_at DESC);

-- Fraud review queues.
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status_risk_created_at
  ON fraud_alerts(status, risk_score DESC, created_at DESC);

-- Notification dropdown/list freshness.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created_at
  ON notifications(user_id, created_at DESC);
