-- Migration: Add Double-Entry Ledger System
-- Purpose: Provide true accounting integrity with double-entry bookkeeping
-- CRITICAL: This is ADDITIVE ONLY - does not modify existing tables

-- ============================================================================
-- LEDGER ACCOUNTS TABLE
-- ============================================================================
-- Represents all accounts in the system:
-- - vendor_wallet: Individual vendor escrow wallets
-- - nem_paystack: NEM's Paystack merchant account
-- - nem_bank: NEM's bank account (for settlements)

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('vendor_wallet', 'nem_paystack', 'nem_bank')),
  account_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Ensure unique account per type and ID
  UNIQUE(account_type, account_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS ledger_accounts_type_idx ON ledger_accounts(account_type);
CREATE INDEX IF NOT EXISTS ledger_accounts_account_id_idx ON ledger_accounts(account_id);

-- ============================================================================
-- LEDGER ENTRIES TABLE
-- ============================================================================
-- Every financial transaction creates TWO ledger entries:
-- 1. Debit entry (increases an account)
-- 2. Credit entry (decreases an account)
--
-- CRITICAL INVARIANT: SUM(debit) = SUM(credit) for each transaction_id

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
  debit NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (debit >= 0),
  credit NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (credit >= 0),
  description VARCHAR(500) NOT NULL,
  reference VARCHAR(255), -- Link to wallet_transactions.reference
  metadata TEXT, -- JSON string for additional context
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Ensure either debit OR credit is non-zero, not both
  CHECK (
    (debit > 0 AND credit = 0) OR 
    (credit > 0 AND debit = 0)
  )
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS ledger_entries_transaction_id_idx ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS ledger_entries_account_id_idx ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS ledger_entries_reference_idx ON ledger_entries(reference);
CREATE INDEX IF NOT EXISTS ledger_entries_created_at_idx ON ledger_entries(created_at);

-- ============================================================================
-- LEDGER TRANSACTION SUMMARY MATERIALIZED VIEW
-- ============================================================================
-- Provides quick validation of transaction balance
-- Shows total debits and credits for each transaction

CREATE MATERIALIZED VIEW IF NOT EXISTS ledger_transaction_summary AS
SELECT 
  transaction_id,
  SUM(debit) AS total_debit,
  SUM(credit) AS total_credit,
  CASE 
    WHEN ABS(SUM(debit) - SUM(credit)) < 0.01 THEN 'true'
    ELSE 'false'
  END AS is_balanced,
  ABS(SUM(debit) - SUM(credit)) AS discrepancy,
  COUNT(*) AS entry_count,
  MIN(created_at) AS created_at,
  NOW() AS updated_at
FROM ledger_entries
GROUP BY transaction_id;

-- Index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS ledger_transaction_summary_transaction_id_idx 
  ON ledger_transaction_summary(transaction_id);

-- ============================================================================
-- FUNCTION: Validate Ledger Transaction Balance
-- ============================================================================
-- Ensures that every transaction has balanced debits and credits
-- Called as a trigger after INSERT on ledger_entries

CREATE OR REPLACE FUNCTION validate_ledger_transaction_balance()
RETURNS TRIGGER AS $$
DECLARE
  total_debit NUMERIC(12, 2);
  total_credit NUMERIC(12, 2);
  discrepancy NUMERIC(12, 2);
BEGIN
  -- Calculate totals for this transaction
  SELECT 
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO total_debit, total_credit
  FROM ledger_entries
  WHERE transaction_id = NEW.transaction_id;
  
  -- Calculate discrepancy
  discrepancy := ABS(total_debit - total_credit);
  
  -- Allow small rounding errors (< 1 kobo)
  IF discrepancy >= 0.01 THEN
    RAISE EXCEPTION 'Ledger transaction % is unbalanced: debit=%, credit=%, discrepancy=%',
      NEW.transaction_id, total_debit, total_credit, discrepancy;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to validate balance after each entry
CREATE TRIGGER validate_ledger_balance_trigger
  AFTER INSERT ON ledger_entries
  FOR EACH ROW
  EXECUTE FUNCTION validate_ledger_transaction_balance();

-- ============================================================================
-- FUNCTION: Refresh Ledger Transaction Summary
-- ============================================================================
-- Refreshes the materialized view
-- Should be called periodically (e.g., every hour)

CREATE OR REPLACE FUNCTION refresh_ledger_transaction_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY ledger_transaction_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA: Create NEM System Accounts
-- ============================================================================
-- Create the main NEM accounts that will be used in all transactions

INSERT INTO ledger_accounts (account_type, account_id, name)
VALUES 
  ('nem_paystack', 'nem', 'NEM Paystack Merchant Account'),
  ('nem_bank', 'nem', 'NEM Bank Settlement Account')
ON CONFLICT (account_type, account_id) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE ledger_accounts IS 'Double-entry ledger accounts for all financial entities';
COMMENT ON TABLE ledger_entries IS 'Double-entry ledger entries - every transaction has balanced debits and credits';
COMMENT ON MATERIALIZED VIEW ledger_transaction_summary IS 'Summary of ledger transactions showing balance status';
COMMENT ON FUNCTION validate_ledger_transaction_balance() IS 'Validates that ledger transactions are balanced';
COMMENT ON FUNCTION refresh_ledger_transaction_summary() IS 'Refreshes the ledger transaction summary materialized view';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the migration succeeded:

-- 1. Check that NEM accounts were created
-- SELECT * FROM ledger_accounts WHERE account_id = 'nem';

-- 2. Check that the materialized view exists
-- SELECT * FROM ledger_transaction_summary LIMIT 1;

-- 3. Test the balance validation (should fail)
-- INSERT INTO ledger_entries (transaction_id, account_id, debit, credit, description)
-- VALUES (gen_random_uuid(), (SELECT id FROM ledger_accounts LIMIT 1), 100, 0, 'Test');
