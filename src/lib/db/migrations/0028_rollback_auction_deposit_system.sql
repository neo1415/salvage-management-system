-- Rollback Migration: Remove Auction Deposit Bidding System
-- Description: Reverts all changes from 0028_add_auction_deposit_system.sql
-- WARNING: This will delete all deposit system data. Use with caution!

-- ============================================================================
-- REMOVE WALLET INVARIANT CONSTRAINT
-- ============================================================================

ALTER TABLE escrow_wallets 
DROP CONSTRAINT IF EXISTS check_wallet_invariant;

-- ============================================================================
-- REMOVE TABLE EXTENSIONS
-- ============================================================================

-- Remove columns from escrow_wallets table
ALTER TABLE escrow_wallets 
DROP COLUMN IF EXISTS forfeited_amount;

-- Remove columns from bids table
ALTER TABLE bids 
DROP COLUMN IF EXISTS is_legacy,
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS deposit_amount;

-- ============================================================================
-- DROP INDEXES
-- ============================================================================

-- Bids table indexes
DROP INDEX IF EXISTS idx_bids_is_legacy;
DROP INDEX IF EXISTS idx_bids_status;

-- Deposit Events indexes
DROP INDEX IF EXISTS idx_deposit_events_vendor_created;
DROP INDEX IF EXISTS idx_deposit_events_created_at;
DROP INDEX IF EXISTS idx_deposit_events_auction_id;
DROP INDEX IF EXISTS idx_deposit_events_vendor_id;

-- Config Change History indexes
DROP INDEX IF EXISTS idx_config_change_history_created_at;
DROP INDEX IF EXISTS idx_config_change_history_changed_by;
DROP INDEX IF EXISTS idx_config_change_history_parameter;

-- Deposit Forfeitures indexes
DROP INDEX IF EXISTS idx_deposit_forfeitures_transferred_at;
DROP INDEX IF EXISTS idx_deposit_forfeitures_vendor_id;
DROP INDEX IF EXISTS idx_deposit_forfeitures_auction_id;

-- Grace Extensions indexes
DROP INDEX IF EXISTS idx_grace_extensions_created_at;
DROP INDEX IF EXISTS idx_grace_extensions_granted_by;
DROP INDEX IF EXISTS idx_grace_extensions_auction_id;

-- Auction Documents indexes
DROP INDEX IF EXISTS idx_auction_documents_type;
DROP INDEX IF EXISTS idx_auction_documents_status;
DROP INDEX IF EXISTS idx_auction_documents_vendor_id;
DROP INDEX IF EXISTS idx_auction_documents_auction_id;

-- Auction Winners indexes
DROP INDEX IF EXISTS idx_auction_winners_rank;
DROP INDEX IF EXISTS idx_auction_winners_status;
DROP INDEX IF EXISTS idx_auction_winners_vendor_id;
DROP INDEX IF EXISTS idx_auction_winners_auction_id;

-- ============================================================================
-- DROP TABLES
-- ============================================================================

DROP TABLE IF EXISTS deposit_events;
DROP TABLE IF EXISTS config_change_history;
DROP TABLE IF EXISTS system_config;
DROP TABLE IF EXISTS deposit_forfeitures;
DROP TABLE IF EXISTS grace_extensions;
DROP TABLE IF EXISTS auction_documents;
DROP TABLE IF EXISTS auction_winners;

-- ============================================================================
-- DROP ENUMS
-- ============================================================================

DROP TYPE IF EXISTS config_data_type;
DROP TYPE IF EXISTS deposit_event_type;
DROP TYPE IF EXISTS extension_type;
DROP TYPE IF EXISTS document_status;
DROP TYPE IF EXISTS document_type;
DROP TYPE IF EXISTS winner_status;

-- ============================================================================
-- REMOVE AUCTION STATUS ENUM VALUES
-- ============================================================================

-- Note: PostgreSQL does not support removing enum values directly
-- If you need to remove the new auction statuses, you would need to:
-- 1. Create a new enum without the new values
-- 2. Alter the column to use the new enum
-- 3. Drop the old enum
-- This is complex and risky, so we leave the enum values in place

-- The following statuses were added and would remain:
-- 'awaiting_documents', 'awaiting_payment', 'deposit_forfeited', 
-- 'forfeiture_collected', 'failed_all_fallbacks', 'manual_resolution', 
-- 'paid', 'completed'

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify all tables are dropped
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name IN (
      'auction_winners', 'auction_documents', 'grace_extensions',
      'deposit_forfeitures', 'system_config', 'config_change_history',
      'deposit_events'
    )
  ) THEN
    RAISE EXCEPTION 'Rollback incomplete: Some tables still exist';
  END IF;
  
  RAISE NOTICE 'Rollback completed successfully';
END $$;
