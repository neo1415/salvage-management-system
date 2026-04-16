-- Rollback Migration: Revert deposit_events auction_id back to UUID
-- Description: Reverts auction_id from VARCHAR(255) back to UUID with foreign key constraint
-- WARNING: This will fail if there are any non-UUID values in auction_id column

-- Drop the index
DROP INDEX IF EXISTS idx_deposit_events_auction_id;

-- Change the column type back from VARCHAR(255) to UUID
-- This will fail if any non-UUID values exist
ALTER TABLE deposit_events 
ALTER COLUMN auction_id TYPE UUID USING auction_id::UUID;

-- Recreate the foreign key constraint (actual constraint name from database)
ALTER TABLE deposit_events 
ADD CONSTRAINT deposit_events_auction_id_fkey 
FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE;

-- Recreate the index
CREATE INDEX idx_deposit_events_auction_id ON deposit_events(auction_id);

-- Update comment
COMMENT ON COLUMN deposit_events.auction_id IS 'Auction identifier (UUID with foreign key to auctions table)';
