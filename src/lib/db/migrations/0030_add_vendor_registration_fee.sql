-- Migration: Add Vendor Registration Fee System
-- Description: Adds registration fee tracking to vendors table and makes auctionId nullable in payments table
-- Date: 2025-01-21
-- Author: AI Assistant

-- ============================================================================
-- 1. Add registration fee columns to vendors table
-- ============================================================================

ALTER TABLE vendors
ADD COLUMN registration_fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN registration_fee_amount NUMERIC(12, 2),
ADD COLUMN registration_fee_paid_at TIMESTAMP,
ADD COLUMN registration_fee_reference VARCHAR(255);

-- ============================================================================
-- 2. Make auctionId nullable in payments table (for registration fees)
-- ============================================================================

-- Registration fee payments will have auctionId = NULL
-- This allows us to reuse the payments table for both auction and registration payments
ALTER TABLE payments
ALTER COLUMN auction_id DROP NOT NULL;

-- ============================================================================
-- 3. Add indexes for performance
-- ============================================================================

-- Index for checking if vendor has paid registration fee
CREATE INDEX idx_vendors_registration_fee_paid ON vendors(registration_fee_paid);

-- Index for looking up payments by registration fee reference
CREATE INDEX idx_vendors_registration_fee_reference ON vendors(registration_fee_reference);

-- Index for finding registration fee payments (where auctionId is NULL)
CREATE INDEX idx_payments_registration_fee ON payments(vendor_id, payment_reference) WHERE auction_id IS NULL;

-- ============================================================================
-- 4. Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN vendors.registration_fee_paid IS 'Whether vendor has paid the one-time registration fee (₦10,000-15,000)';
COMMENT ON COLUMN vendors.registration_fee_amount IS 'Amount paid for registration fee in Naira';
COMMENT ON COLUMN vendors.registration_fee_paid_at IS 'Timestamp when registration fee was paid';
COMMENT ON COLUMN vendors.registration_fee_reference IS 'Paystack payment reference for registration fee (format: REG-{uuid})';

-- ============================================================================
-- 5. Backfill existing vendors (mark as paid to avoid disruption)
-- ============================================================================

-- All existing vendors are grandfathered in - they don't need to pay
-- Only new vendors (created after this migration) will need to pay
UPDATE vendors
SET 
  registration_fee_paid = TRUE,
  registration_fee_amount = 0.00,
  registration_fee_paid_at = created_at,
  registration_fee_reference = 'GRANDFATHERED'
WHERE registration_fee_paid = FALSE;

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================

-- To rollback this migration, run:
-- ALTER TABLE vendors DROP COLUMN registration_fee_paid;
-- ALTER TABLE vendors DROP COLUMN registration_fee_amount;
-- ALTER TABLE vendors DROP COLUMN registration_fee_paid_at;
-- ALTER TABLE vendors DROP COLUMN registration_fee_reference;
-- ALTER TABLE payments ALTER COLUMN auction_id SET NOT NULL;
-- DROP INDEX IF EXISTS idx_vendors_registration_fee_paid;
-- DROP INDEX IF EXISTS idx_vendors_registration_fee_reference;
-- DROP INDEX IF EXISTS idx_payments_registration_fee;
