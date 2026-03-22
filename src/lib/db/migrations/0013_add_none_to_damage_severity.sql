-- Migration: Add 'none' to damage_severity enum
-- Purpose: Support pristine items with no damage in AI assessment
-- Issue: AI assessment returns 'none' for pristine items, but database enum only accepts ['minor', 'moderate', 'severe']
-- Fix: Add 'none' as a valid enum value

-- Add 'none' to the damage_severity enum
ALTER TYPE damage_severity ADD VALUE IF NOT EXISTS 'none';

-- Note: PostgreSQL doesn't allow removing enum values or reordering them
-- The new value 'none' will be added at the end of the enum
-- This is safe and backward compatible
