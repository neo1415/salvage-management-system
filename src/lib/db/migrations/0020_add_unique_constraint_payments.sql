-- Migration: Add Unique Constraint to Payments Table
-- Purpose: Prevent duplicate payment records for the same auction
-- Date: 2024
-- 
-- Problem: User found duplicate payment records for auction GIA-8823 (8170710b):
-- - Record 1: ✅ Verified, ₦370,000, Released, Reference: PAY_8170710b_1774198978061
-- - Record 2: ⏳ Pending, ₦370,000, Frozen, Reference: PAY_8170710b_1774198978065
-- 
-- Solution: Add unique constraint on auction_id to ensure only ONE payment per auction
-- 
-- IMPORTANT: Run scripts/find-and-delete-duplicate-payments.ts --live BEFORE this migration
-- to clean up existing duplicates, otherwise this migration will fail.

-- Add unique constraint on auction_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_unique_auction 
ON payments(auction_id);

-- Add comment to document the constraint
COMMENT ON INDEX idx_payments_unique_auction IS 
'Ensures only one payment record exists per auction. Prevents duplicate payment creation.';
