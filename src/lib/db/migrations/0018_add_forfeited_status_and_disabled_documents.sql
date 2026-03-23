-- Migration: Add 'forfeited' status to auctions and 'disabled' field to release_forms
-- Date: 2024-01-XX
-- Purpose: Support 72-hour forfeiture logic and document disabling

-- Add 'forfeited' to auction_status enum
ALTER TYPE auction_status ADD VALUE IF NOT EXISTS 'forfeited';

-- Add 'disabled' column to release_forms table
ALTER TABLE release_forms 
ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;

-- Add 'forfeited' status to payments (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid  
    WHERE t.typname = 'payment_status' AND e.enumlabel = 'forfeited'
  ) THEN
    ALTER TYPE payment_status ADD VALUE 'forfeited';
  END IF;
END $$;

-- Create index on disabled column for faster queries
CREATE INDEX IF NOT EXISTS idx_release_forms_disabled 
ON release_forms(disabled) 
WHERE disabled = TRUE;

-- Add comment to explain the disabled field
COMMENT ON COLUMN release_forms.disabled IS 'Set to TRUE when auction is forfeited after 72 hours. Prevents document signing until grace period is granted.';

-- Add comment to explain forfeited status
COMMENT ON TYPE auction_status IS 'Auction status: scheduled, active, extended, closed, cancelled, forfeited (after 72 hours without payment)';
