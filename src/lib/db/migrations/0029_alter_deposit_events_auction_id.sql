-- Migration: Alter deposit_events auction_id to VARCHAR for flexibility
-- Description: Changes auction_id from UUID with foreign key to VARCHAR(255) for testing flexibility
-- This allows deposit events to reference auction IDs that may not exist in the auctions table

-- Drop the foreign key constraint (actual constraint name from database)
ALTER TABLE deposit_events 
DROP CONSTRAINT IF EXISTS deposit_events_auction_id_fkey;

-- Drop the index on auction_id (will recreate after type change)
DROP INDEX IF EXISTS idx_deposit_events_auction_id;

-- Change the column type from UUID to VARCHAR(255)
ALTER TABLE deposit_events 
ALTER COLUMN auction_id TYPE VARCHAR(255);

-- Recreate the index
CREATE INDEX idx_deposit_events_auction_id ON deposit_events(auction_id);

-- Add comment explaining the change
COMMENT ON COLUMN deposit_events.auction_id IS 'Auction identifier (VARCHAR for flexibility, no foreign key constraint)';
