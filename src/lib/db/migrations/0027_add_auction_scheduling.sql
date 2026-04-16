-- Migration: Add auction scheduling and timer management fields
-- Description: Adds scheduledStartTime and isScheduled fields to support future auction scheduling

-- Add new columns to auctions table
ALTER TABLE auctions 
ADD COLUMN scheduled_start_time TIMESTAMP,
ADD COLUMN is_scheduled BOOLEAN DEFAULT false;

-- Update existing auctions to set isScheduled = false (already default, but explicit for clarity)
UPDATE auctions 
SET is_scheduled = false 
WHERE is_scheduled IS NULL;

-- Add index for scheduled auctions to improve query performance
CREATE INDEX idx_auctions_scheduled ON auctions(is_scheduled, scheduled_start_time) 
WHERE is_scheduled = true;

-- Add comment for documentation
COMMENT ON COLUMN auctions.scheduled_start_time IS 'When the auction should start (nullable for immediate auctions)';
COMMENT ON COLUMN auctions.is_scheduled IS 'Whether auction is scheduled for future start';
