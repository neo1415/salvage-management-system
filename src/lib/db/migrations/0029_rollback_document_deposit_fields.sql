-- Rollback Migration: Remove deposit-specific fields from release_forms table
-- Date: 2025-01-XX
-- Purpose: Rollback document validity deadline and payment deadline tracking

-- Drop indexes
DROP INDEX IF EXISTS idx_release_forms_validity_deadline;
DROP INDEX IF EXISTS idx_release_forms_payment_deadline;

-- Remove columns
ALTER TABLE release_forms DROP COLUMN IF EXISTS validity_deadline;
ALTER TABLE release_forms DROP COLUMN IF EXISTS extension_count;
ALTER TABLE release_forms DROP COLUMN IF EXISTS original_deadline;
ALTER TABLE release_forms DROP COLUMN IF EXISTS payment_deadline;
