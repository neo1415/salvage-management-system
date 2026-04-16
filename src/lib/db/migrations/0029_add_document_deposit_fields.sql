-- Migration: Add deposit-specific fields to release_forms table
-- Date: 2025-01-XX
-- Purpose: Support document validity deadlines, payment deadlines, and extension tracking for deposit system

-- Add validity deadline tracking
ALTER TABLE release_forms ADD COLUMN validity_deadline TIMESTAMP;
ALTER TABLE release_forms ADD COLUMN extension_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE release_forms ADD COLUMN original_deadline TIMESTAMP;

-- Add payment deadline tracking
ALTER TABLE release_forms ADD COLUMN payment_deadline TIMESTAMP;

-- Add comments for documentation
COMMENT ON COLUMN release_forms.validity_deadline IS 'Deadline for signing documents (configurable, default 48 hours from generation)';
COMMENT ON COLUMN release_forms.extension_count IS 'Number of grace extensions granted (max configurable, default 2)';
COMMENT ON COLUMN release_forms.original_deadline IS 'Original validity deadline before any extensions';
COMMENT ON COLUMN release_forms.payment_deadline IS 'Deadline for payment after document signing (configurable, default 72 hours)';

-- Create index for deadline queries (used by cron jobs)
CREATE INDEX idx_release_forms_validity_deadline ON release_forms(validity_deadline) WHERE status = 'pending';
CREATE INDEX idx_release_forms_payment_deadline ON release_forms(payment_deadline) WHERE status = 'signed';

-- Backfill existing documents with NULL deadlines (legacy documents)
-- No action needed - NULL indicates legacy documents without deposit system
