-- Migration: Add pickup confirmation fields to auctions table
-- Description: Adds fields to track vendor and admin pickup confirmations for completed auctions
-- Date: 2024

-- Add pickup confirmation fields to auctions table
ALTER TABLE auctions 
ADD COLUMN pickup_confirmed_vendor BOOLEAN DEFAULT false,
ADD COLUMN pickup_confirmed_vendor_at TIMESTAMP,
ADD COLUMN pickup_confirmed_admin BOOLEAN DEFAULT false,
ADD COLUMN pickup_confirmed_admin_at TIMESTAMP,
ADD COLUMN pickup_confirmed_admin_by UUID REFERENCES users(id);

-- Create index for querying pending pickup confirmations
CREATE INDEX idx_auctions_pickup_confirmed_vendor ON auctions(pickup_confirmed_vendor) WHERE pickup_confirmed_vendor = false;
CREATE INDEX idx_auctions_pickup_confirmed_admin ON auctions(pickup_confirmed_admin) WHERE pickup_confirmed_admin = false;

-- Add comment for documentation
COMMENT ON COLUMN auctions.pickup_confirmed_vendor IS 'Indicates if vendor has confirmed item pickup';
COMMENT ON COLUMN auctions.pickup_confirmed_vendor_at IS 'Timestamp when vendor confirmed pickup';
COMMENT ON COLUMN auctions.pickup_confirmed_admin IS 'Indicates if admin/manager has confirmed item pickup';
COMMENT ON COLUMN auctions.pickup_confirmed_admin_at IS 'Timestamp when admin confirmed pickup';
COMMENT ON COLUMN auctions.pickup_confirmed_admin_by IS 'User ID of admin who confirmed pickup';
