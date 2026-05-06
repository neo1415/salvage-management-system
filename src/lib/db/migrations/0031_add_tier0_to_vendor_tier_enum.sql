-- Migration: Add tier0 to vendor_tier enum
-- This allows vendors without BVN verification to be tracked in the system

-- Step 1: Add the new enum value 'tier0' to the vendor_tier enum
ALTER TYPE vendor_tier ADD VALUE IF NOT EXISTS 'tier0';

-- Step 2: Update the default value for the tier column to tier0 (optional, based on business logic)
-- If you want new vendors to start at tier0 by default, uncomment the line below:
-- ALTER TABLE vendors ALTER COLUMN tier SET DEFAULT 'tier0';

-- Note: Existing vendors will remain at their current tier (tier1_bvn or tier2_full)
-- New vendors can now be created with tier0, tier1_bvn, or tier2_full
