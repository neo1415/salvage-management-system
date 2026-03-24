-- Add 'machinery' to asset_type enum
-- This migration adds support for machinery/equipment as an asset type

-- Step 1: Add the new value to the enum
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'machinery';

-- Note: PostgreSQL doesn't allow removing enum values easily, so we only add
-- The enum now supports: 'vehicle', 'property', 'electronics', 'machinery'
