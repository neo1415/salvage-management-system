-- Migration: Make auction_id nullable in payments table
-- This allows registration fee payments which are not associated with any auction

-- Drop the NOT NULL constraint on auction_id
ALTER TABLE payments 
ALTER COLUMN auction_id DROP NOT NULL;
