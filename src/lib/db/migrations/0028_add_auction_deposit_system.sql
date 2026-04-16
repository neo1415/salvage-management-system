-- Migration: Add Auction Deposit Bidding System
-- Description: Transforms full-amount freeze model to capital-efficient deposit-based system
-- Adds 7 new tables and extends 2 existing tables (bids, escrow_wallets)

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Winner status enum
DO $$ BEGIN
  CREATE TYPE winner_status AS ENUM (
    'active',
    'failed_to_sign',
    'failed_to_pay',
    'completed'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Document type enum (may already exist from release_forms)
DO $$ BEGIN
  CREATE TYPE document_type AS ENUM (
    'bill_of_sale',
    'liability_waiver'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Document status enum (may already exist from release_forms)
DO $$ BEGIN
  CREATE TYPE document_status AS ENUM (
    'pending',
    'signed',
    'voided'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Extension type enum
DO $$ BEGIN
  CREATE TYPE extension_type AS ENUM (
    'document_signing',
    'payment'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Deposit event type enum
DO $$ BEGIN
  CREATE TYPE deposit_event_type AS ENUM (
    'freeze',
    'unfreeze',
    'forfeit'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Config data type enum
DO $$ BEGIN
  CREATE TYPE config_data_type AS ENUM (
    'number',
    'boolean',
    'string'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- NEW TABLES
-- ============================================================================

-- Auction Winners Table
-- Tracks top bidders and fallback chain
CREATE TABLE auction_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  bid_amount NUMERIC(12, 2) NOT NULL,
  deposit_amount NUMERIC(12, 2) NOT NULL,
  rank INTEGER NOT NULL, -- 1 = winner, 2-3 = fallback candidates
  status winner_status NOT NULL DEFAULT 'active',
  promoted_at TIMESTAMP,
  failed_at TIMESTAMP,
  failure_reason VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Auction Documents Table
-- Stores Bill of Sale and Liability Waiver documents
CREATE TABLE auction_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  type document_type NOT NULL,
  content TEXT NOT NULL,
  status document_status NOT NULL DEFAULT 'pending',
  signed_at TIMESTAMP,
  signature_data TEXT,
  validity_deadline TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Grace Extensions Table
-- Records grace period extensions granted by Finance Officers
CREATE TABLE grace_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES users(id),
  extension_type extension_type NOT NULL,
  duration_hours INTEGER NOT NULL,
  reason TEXT,
  old_deadline TIMESTAMP NOT NULL,
  new_deadline TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Deposit Forfeitures Table
-- Tracks forfeited deposits
CREATE TABLE deposit_forfeitures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  deposit_amount NUMERIC(12, 2) NOT NULL,
  forfeiture_percentage INTEGER NOT NULL,
  forfeited_amount NUMERIC(12, 2) NOT NULL,
  reason VARCHAR(100) NOT NULL,
  transferred_at TIMESTAMP,
  transferred_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- System Configuration Table
-- Stores configurable business rules
CREATE TABLE system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  data_type config_data_type NOT NULL,
  description TEXT,
  min_value NUMERIC(12, 2),
  max_value NUMERIC(12, 2),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- Configuration Change History Table
-- Audit trail for configuration changes
CREATE TABLE config_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter VARCHAR(100) NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES users(id),
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Deposit Events Table
-- Vendor deposit history for transparency
CREATE TABLE deposit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  event_type deposit_event_type NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  balance_after NUMERIC(12, 2) NOT NULL,
  frozen_after NUMERIC(12, 2) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TABLE EXTENSIONS
-- ============================================================================

-- Extend bids table
ALTER TABLE bids 
ADD COLUMN deposit_amount NUMERIC(12, 2),
ADD COLUMN status VARCHAR(50) DEFAULT 'active',
ADD COLUMN is_legacy BOOLEAN DEFAULT false;

-- Extend escrow_wallets table
ALTER TABLE escrow_wallets 
ADD COLUMN forfeited_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- Update existing bids to mark as legacy
UPDATE bids 
SET is_legacy = true 
WHERE deposit_amount IS NULL;

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Auction Winners indexes
CREATE INDEX idx_auction_winners_auction_id ON auction_winners(auction_id);
CREATE INDEX idx_auction_winners_vendor_id ON auction_winners(vendor_id);
CREATE INDEX idx_auction_winners_status ON auction_winners(status);
CREATE INDEX idx_auction_winners_rank ON auction_winners(auction_id, rank);

-- Auction Documents indexes
CREATE INDEX idx_auction_documents_auction_id ON auction_documents(auction_id);
CREATE INDEX idx_auction_documents_vendor_id ON auction_documents(vendor_id);
CREATE INDEX idx_auction_documents_status ON auction_documents(status);
CREATE INDEX idx_auction_documents_type ON auction_documents(auction_id, type);

-- Grace Extensions indexes
CREATE INDEX idx_grace_extensions_auction_id ON grace_extensions(auction_id);
CREATE INDEX idx_grace_extensions_granted_by ON grace_extensions(granted_by);
CREATE INDEX idx_grace_extensions_created_at ON grace_extensions(created_at DESC);

-- Deposit Forfeitures indexes
CREATE INDEX idx_deposit_forfeitures_auction_id ON deposit_forfeitures(auction_id);
CREATE INDEX idx_deposit_forfeitures_vendor_id ON deposit_forfeitures(vendor_id);
CREATE INDEX idx_deposit_forfeitures_transferred_at ON deposit_forfeitures(transferred_at);

-- System Config indexes (parameter already has unique constraint)

-- Config Change History indexes
CREATE INDEX idx_config_change_history_parameter ON config_change_history(parameter);
CREATE INDEX idx_config_change_history_changed_by ON config_change_history(changed_by);
CREATE INDEX idx_config_change_history_created_at ON config_change_history(created_at DESC);

-- Deposit Events indexes
CREATE INDEX idx_deposit_events_vendor_id ON deposit_events(vendor_id);
CREATE INDEX idx_deposit_events_auction_id ON deposit_events(auction_id);
CREATE INDEX idx_deposit_events_created_at ON deposit_events(created_at DESC);
CREATE INDEX idx_deposit_events_vendor_created ON deposit_events(vendor_id, created_at DESC);

-- Bids table new column indexes
CREATE INDEX idx_bids_status ON bids(status) WHERE status IS NOT NULL;
CREATE INDEX idx_bids_is_legacy ON bids(is_legacy) WHERE is_legacy = false;

-- ============================================================================
-- EXTEND AUCTION STATUS ENUM
-- ============================================================================

-- Add new auction statuses for deposit system
ALTER TYPE auction_status ADD VALUE IF NOT EXISTS 'awaiting_documents';
ALTER TYPE auction_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
ALTER TYPE auction_status ADD VALUE IF NOT EXISTS 'deposit_forfeited';
ALTER TYPE auction_status ADD VALUE IF NOT EXISTS 'forfeiture_collected';
ALTER TYPE auction_status ADD VALUE IF NOT EXISTS 'failed_all_fallbacks';
ALTER TYPE auction_status ADD VALUE IF NOT EXISTS 'manual_resolution';
ALTER TYPE auction_status ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE auction_status ADD VALUE IF NOT EXISTS 'completed';

-- ============================================================================
-- DEFAULT CONFIGURATION VALUES
-- ============================================================================

-- Insert default system configuration
INSERT INTO system_config (parameter, value, data_type, description, min_value, max_value) VALUES
  ('deposit_rate', '10', 'number', 'Percentage of bid amount to freeze as deposit (default 10%)', 1, 100),
  ('minimum_deposit_floor', '100000', 'number', 'Minimum deposit amount in Naira (default ₦100,000)', 1000, NULL),
  ('tier1_limit', '500000', 'number', 'Maximum bid amount for Tier 1 vendors (default ₦500,000)', 0, NULL),
  ('minimum_bid_increment', '20000', 'number', 'Minimum increment between bids (default ₦20,000)', 1000, NULL),
  ('document_validity_period', '48', 'number', 'Hours for document signing deadline (default 48 hours)', 1, 168),
  ('max_grace_extensions', '2', 'number', 'Maximum number of grace extensions allowed (default 2)', 0, 10),
  ('grace_extension_duration', '24', 'number', 'Hours added per grace extension (default 24 hours)', 1, 72),
  ('fallback_buffer_period', '24', 'number', 'Hours to wait before triggering fallback (default 24 hours)', 1, 72),
  ('top_bidders_to_keep_frozen', '3', 'number', 'Number of top bidders to keep deposits frozen (default 3)', 1, 10),
  ('forfeiture_percentage', '100', 'number', 'Percentage of deposit to forfeit on payment failure (default 100%)', 0, 100),
  ('payment_deadline_after_signing', '72', 'number', 'Hours to pay after signing documents (default 72 hours)', 1, 168),
  ('deposit_system_enabled', 'true', 'boolean', 'Global feature flag for deposit system', NULL, NULL)
ON CONFLICT (parameter) DO NOTHING;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE auction_winners IS 'Tracks top N bidders and fallback chain for each auction';
COMMENT ON TABLE auction_documents IS 'Stores Bill of Sale and Liability Waiver documents for winners';
COMMENT ON TABLE grace_extensions IS 'Records grace period extensions granted by Finance Officers';
COMMENT ON TABLE deposit_forfeitures IS 'Tracks forfeited deposits when winners fail to pay';
COMMENT ON TABLE system_config IS 'Stores configurable business rules for deposit system';
COMMENT ON TABLE config_change_history IS 'Immutable audit trail for all configuration changes';
COMMENT ON TABLE deposit_events IS 'Vendor-facing deposit history for transparency';

COMMENT ON COLUMN bids.deposit_amount IS 'Deposit frozen for this bid (NULL for legacy bids)';
COMMENT ON COLUMN bids.status IS 'Bid status: active, outbid, winner, failed_to_sign, failed_to_pay, completed';
COMMENT ON COLUMN bids.is_legacy IS 'True for bids placed before deposit system (full-amount freeze)';
COMMENT ON COLUMN escrow_wallets.forfeited_amount IS 'Total forfeited deposits (part of wallet invariant)';

-- ============================================================================
-- WALLET INVARIANT CONSTRAINT
-- ============================================================================

-- Add check constraint to enforce wallet invariant
-- balance = available_balance + frozen_amount + forfeited_amount
ALTER TABLE escrow_wallets 
ADD CONSTRAINT check_wallet_invariant 
CHECK (
  ABS(
    balance::numeric - 
    (available_balance::numeric + frozen_amount::numeric + forfeited_amount::numeric)
  ) < 0.01
);

COMMENT ON CONSTRAINT check_wallet_invariant ON escrow_wallets IS 
'Enforces wallet invariant: balance = availableBalance + frozenAmount + forfeitedAmount';
