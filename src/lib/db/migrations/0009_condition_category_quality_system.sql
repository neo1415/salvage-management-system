-- Migration: Update condition categories to 4-tier quality system
-- Date: 2024
-- Description: Replaces 3-category system (Brand New, Nigerian Used, Foreign Used) 
--              with 4-tier quality-based system (Excellent, Good, Fair, Poor)
-- 
-- Mapping:
--   "Brand New" → "Excellent"
--   "Foreign Used" → "Good"  
--   "Nigerian Used" → "Fair"
--   Any other values → "Fair" (safe fallback)
--
-- Tables Updated:
--   1. salvage_cases.vehicle_condition
--   2. vehicle_valuations.condition_category
--   3. market_data_cache (via property_details JSONB)
--
-- This migration is idempotent and can be run multiple times safely.

BEGIN;

-- ============================================================================
-- 1. Update salvage_cases.vehicle_condition
-- ============================================================================
UPDATE salvage_cases
SET vehicle_condition = CASE
  -- Map legacy 3-category system
  WHEN vehicle_condition = 'brand_new' THEN 'excellent'
  WHEN vehicle_condition = 'foreign_used' THEN 'good'
  WHEN vehicle_condition = 'nigerian_used' THEN 'fair'
  
  -- Preserve already-migrated values
  WHEN vehicle_condition IN ('excellent', 'good', 'fair', 'poor') THEN vehicle_condition
  
  -- Safe fallback for any unexpected values
  ELSE 'fair'
END
WHERE vehicle_condition IS NOT NULL;

-- ============================================================================
-- 2. Update vehicle_valuations.condition_category
-- ============================================================================
UPDATE vehicle_valuations
SET condition_category = CASE
  -- Map legacy 3-category system
  WHEN condition_category = 'brand_new' THEN 'excellent'
  WHEN condition_category = 'foreign_used' THEN 'good'
  WHEN condition_category = 'nigerian_used' THEN 'fair'
  
  -- Map legacy sub-categories (from previous system iterations)
  WHEN condition_category = 'tokunbo_low' THEN 'good'
  WHEN condition_category = 'tokunbo_high' THEN 'good'
  WHEN condition_category = 'nig_used_low' THEN 'fair'
  WHEN condition_category = 'nig_used_high' THEN 'fair'
  
  -- Preserve already-migrated values
  WHEN condition_category IN ('excellent', 'good', 'fair', 'poor') THEN condition_category
  
  -- Safe fallback for any unexpected values
  ELSE 'fair'
END;

-- ============================================================================
-- 3. Update market_data_cache condition values in property_details JSONB
-- ============================================================================
-- Note: market_data_cache stores condition in the property_details JSONB field
-- We need to update the 'condition' key within that JSONB object

UPDATE market_data_cache
SET property_details = jsonb_set(
  property_details,
  '{condition}',
  to_jsonb(
    CASE
      -- Map legacy 3-category system
      WHEN property_details->>'condition' = 'brand_new' THEN 'excellent'
      WHEN property_details->>'condition' = 'foreign_used' THEN 'good'
      WHEN property_details->>'condition' = 'nigerian_used' THEN 'fair'
      
      -- Map legacy sub-categories
      WHEN property_details->>'condition' = 'tokunbo_low' THEN 'good'
      WHEN property_details->>'condition' = 'tokunbo_high' THEN 'good'
      WHEN property_details->>'condition' = 'nig_used_low' THEN 'fair'
      WHEN property_details->>'condition' = 'nig_used_high' THEN 'fair'
      
      -- Preserve already-migrated values
      WHEN property_details->>'condition' IN ('excellent', 'good', 'fair', 'poor') 
        THEN property_details->>'condition'
      
      -- Safe fallback for any unexpected values
      ELSE 'fair'
    END
  )
)
WHERE property_details ? 'condition'
  AND property_details->>'condition' IS NOT NULL;

-- ============================================================================
-- 4. Add audit log entry for migration
-- ============================================================================
INSERT INTO valuation_audit_logs (
  id,
  action,
  entity_type,
  entity_id,
  changed_fields,
  user_id,
  created_at
)
SELECT
  gen_random_uuid(),
  'update',
  'migration',
  gen_random_uuid(),
  jsonb_build_object(
    'migration', jsonb_build_object(
      'name', '0009_condition_category_quality_system',
      'description', 'Migrated from 3-category system to 4-tier quality system',
      'old_system', jsonb_build_array('brand_new', 'foreign_used', 'nigerian_used'),
      'new_system', jsonb_build_array('excellent', 'good', 'fair', 'poor'),
      'mapping', jsonb_build_object(
        'brand_new', 'excellent',
        'foreign_used', 'good',
        'nigerian_used', 'fair',
        'tokunbo_low', 'good',
        'tokunbo_high', 'good',
        'nig_used_low', 'fair',
        'nig_used_high', 'fair'
      ),
      'tables_updated', jsonb_build_array(
        'salvage_cases.vehicle_condition',
        'vehicle_valuations.condition_category',
        'market_data_cache.property_details.condition'
      )
    )
  ),
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1),
  NOW()
WHERE EXISTS (SELECT 1 FROM users WHERE role = 'super_admin');

-- ============================================================================
-- 5. Verification queries (commented out - for manual verification)
-- ============================================================================

-- Verify salvage_cases.vehicle_condition values
-- SELECT DISTINCT vehicle_condition, COUNT(*) 
-- FROM salvage_cases 
-- WHERE vehicle_condition IS NOT NULL
-- GROUP BY vehicle_condition
-- ORDER BY vehicle_condition;

-- Verify vehicle_valuations.condition_category values
-- SELECT DISTINCT condition_category, COUNT(*) 
-- FROM vehicle_valuations 
-- GROUP BY condition_category
-- ORDER BY condition_category;

-- Verify market_data_cache condition values
-- SELECT DISTINCT property_details->>'condition' as condition, COUNT(*) 
-- FROM market_data_cache 
-- WHERE property_details ? 'condition'
-- GROUP BY property_details->>'condition'
-- ORDER BY condition;

-- Check audit log entry
-- SELECT * FROM valuation_audit_logs 
-- WHERE entity_type = 'migration' 
-- AND changed_fields->'migration'->>'name' = '0009_condition_category_quality_system'
-- ORDER BY created_at DESC 
-- LIMIT 1;

COMMIT;
