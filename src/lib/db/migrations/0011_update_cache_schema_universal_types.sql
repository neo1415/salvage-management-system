-- Migration: Update Cache Schema for Universal Item Types
-- Date: 2024
-- Description: Updates existing cache schema to support universal item types
--              introduced by the Universal AI Internet Search System.
--              Extends market_data_cache to handle jewelry, furniture, machinery,
--              appliances, and property types with proper field mappings.
--
-- Changes:
--   1. Update market_data_cache.property_details JSONB to support new item types
--   2. Add new item type constraints and validation
--   3. Update indexes for better performance with new types
--   4. Maintain backward compatibility with existing data
--
-- Integration: Works with existing market data cache and new internet search system
-- Purpose: Enable universal item type caching across all search methods

-- ============================================================================
-- 1. Add new item types to property_type enum (if using enum)
-- ============================================================================
-- Note: Since we're using varchar, we'll add validation via check constraints

-- Add check constraint for supported property types
ALTER TABLE "market_data_cache" 
DROP CONSTRAINT IF EXISTS "chk_market_data_property_type";

ALTER TABLE "market_data_cache" 
ADD CONSTRAINT "chk_market_data_property_type" 
CHECK (property_type IN (
  'vehicle', 
  'electronics', 
  'building', 
  'appliance', 
  'property', 
  'jewelry', 
  'furniture', 
  'machinery'
));

-- ============================================================================
-- 2. Update property_details JSONB structure documentation
-- ============================================================================
-- The property_details JSONB field now supports these structures:
--
-- Vehicle: { type: 'vehicle', make: string, model: string, year?: number, mileage?: number, condition?: string }
-- Electronics: { type: 'electronics', brand: string, productModel: string, productType?: string, storage?: string, color?: string, condition?: string }
-- Building: { type: 'building', location: string, propertyType: string, size?: number, bedrooms?: number, condition?: string }
-- Appliance: { type: 'appliance', brand: string, model: string, applianceType: string, size?: string, condition?: string }
-- Property: { type: 'property', propertyType: string, location: string, bedrooms?: number, condition?: string }
-- Jewelry: { type: 'jewelry', jewelryType: string, brand?: string, material?: string, weight?: string, condition?: string }
-- Furniture: { type: 'furniture', furnitureType: string, brand?: string, material?: string, size?: string, condition?: string }
-- Machinery: { type: 'machinery', brand: string, machineryType: string, model?: string, year?: number, condition?: string }

-- ============================================================================
-- 3. Add indexes for new item types
-- ============================================================================

-- Index for appliance searches
CREATE INDEX IF NOT EXISTS "idx_market_data_appliance_brand" 
ON "market_data_cache" USING GIN ((property_details->'brand')) 
WHERE property_type = 'appliance';

CREATE INDEX IF NOT EXISTS "idx_market_data_appliance_type" 
ON "market_data_cache" USING GIN ((property_details->'applianceType')) 
WHERE property_type = 'appliance';

-- Index for property searches
CREATE INDEX IF NOT EXISTS "idx_market_data_property_location" 
ON "market_data_cache" USING GIN ((property_details->'location')) 
WHERE property_type = 'property';

CREATE INDEX IF NOT EXISTS "idx_market_data_property_type_field" 
ON "market_data_cache" USING GIN ((property_details->'propertyType')) 
WHERE property_type = 'property';

-- Index for jewelry searches
CREATE INDEX IF NOT EXISTS "idx_market_data_jewelry_type" 
ON "market_data_cache" USING GIN ((property_details->'jewelryType')) 
WHERE property_type = 'jewelry';

CREATE INDEX IF NOT EXISTS "idx_market_data_jewelry_material" 
ON "market_data_cache" USING GIN ((property_details->'material')) 
WHERE property_type = 'jewelry';

-- Index for furniture searches
CREATE INDEX IF NOT EXISTS "idx_market_data_furniture_type" 
ON "market_data_cache" USING GIN ((property_details->'furnitureType')) 
WHERE property_type = 'furniture';

CREATE INDEX IF NOT EXISTS "idx_market_data_furniture_material" 
ON "market_data_cache" USING GIN ((property_details->'material')) 
WHERE property_type = 'furniture';

-- Index for machinery searches
CREATE INDEX IF NOT EXISTS "idx_market_data_machinery_brand" 
ON "market_data_cache" USING GIN ((property_details->'brand')) 
WHERE property_type = 'machinery';

CREATE INDEX IF NOT EXISTS "idx_market_data_machinery_type" 
ON "market_data_cache" USING GIN ((property_details->'machineryType')) 
WHERE property_type = 'machinery';

-- Universal condition index for all item types
CREATE INDEX IF NOT EXISTS "idx_market_data_condition" 
ON "market_data_cache" USING GIN ((property_details->'condition'));

-- ============================================================================
-- 4. Update existing indexes for better performance
-- ============================================================================

-- Improve existing vehicle indexes
DROP INDEX IF EXISTS "idx_market_data_vehicle_make";
CREATE INDEX IF NOT EXISTS "idx_market_data_vehicle_make_model" 
ON "market_data_cache" USING GIN ((property_details->'make'), (property_details->'model')) 
WHERE property_type = 'vehicle';

-- Improve existing electronics indexes
DROP INDEX IF EXISTS "idx_market_data_electronics_brand";
CREATE INDEX IF NOT EXISTS "idx_market_data_electronics_brand_model" 
ON "market_data_cache" USING GIN ((property_details->'brand'), (property_details->'productModel')) 
WHERE property_type = 'electronics';

-- ============================================================================
-- 5. Add validation functions for new item types
-- ============================================================================

-- Function to validate appliance property details
CREATE OR REPLACE FUNCTION validate_appliance_details(details JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    details ? 'brand' AND 
    details ? 'model' AND
    details ? 'applianceType' AND
    details->>'brand' IS NOT NULL AND
    details->>'model' IS NOT NULL AND
    details->>'applianceType' IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate property details
CREATE OR REPLACE FUNCTION validate_property_details(details JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    details ? 'propertyType' AND 
    details ? 'location' AND
    details->>'propertyType' IS NOT NULL AND
    details->>'location' IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate jewelry details
CREATE OR REPLACE FUNCTION validate_jewelry_details(details JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    details ? 'jewelryType' AND
    details->>'jewelryType' IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate furniture details
CREATE OR REPLACE FUNCTION validate_furniture_details(details JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    details ? 'furnitureType' AND
    details->>'furnitureType' IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to validate machinery details
CREATE OR REPLACE FUNCTION validate_machinery_details(details JSONB)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    details ? 'brand' AND 
    details ? 'machineryType' AND
    details->>'brand' IS NOT NULL AND
    details->>'machineryType' IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 6. Add check constraints for data validation
-- ============================================================================

-- Add validation constraints for new item types
ALTER TABLE "market_data_cache" 
DROP CONSTRAINT IF EXISTS "chk_market_data_appliance_details";

ALTER TABLE "market_data_cache" 
ADD CONSTRAINT "chk_market_data_appliance_details" 
CHECK (
  property_type != 'appliance' OR 
  validate_appliance_details(property_details)
);

ALTER TABLE "market_data_cache" 
DROP CONSTRAINT IF EXISTS "chk_market_data_property_details";

ALTER TABLE "market_data_cache" 
ADD CONSTRAINT "chk_market_data_property_details" 
CHECK (
  property_type != 'property' OR 
  validate_property_details(property_details)
);

ALTER TABLE "market_data_cache" 
DROP CONSTRAINT IF EXISTS "chk_market_data_jewelry_details";

ALTER TABLE "market_data_cache" 
ADD CONSTRAINT "chk_market_data_jewelry_details" 
CHECK (
  property_type != 'jewelry' OR 
  validate_jewelry_details(property_details)
);

ALTER TABLE "market_data_cache" 
DROP CONSTRAINT IF EXISTS "chk_market_data_furniture_details";

ALTER TABLE "market_data_cache" 
ADD CONSTRAINT "chk_market_data_furniture_details" 
CHECK (
  property_type != 'furniture' OR 
  validate_furniture_details(property_details)
);

ALTER TABLE "market_data_cache" 
DROP CONSTRAINT IF EXISTS "chk_market_data_machinery_details";

ALTER TABLE "market_data_cache" 
ADD CONSTRAINT "chk_market_data_machinery_details" 
CHECK (
  property_type != 'machinery' OR 
  validate_machinery_details(property_details)
);

-- ============================================================================
-- 7. Update background_jobs table for new item types
-- ============================================================================

-- Add check constraint for background jobs property types
ALTER TABLE "background_jobs" 
DROP CONSTRAINT IF EXISTS "chk_background_jobs_property_type";

ALTER TABLE "background_jobs" 
ADD CONSTRAINT "chk_background_jobs_property_type" 
CHECK (property_details->>'type' IN (
  'vehicle', 
  'electronics', 
  'building', 
  'appliance', 
  'property', 
  'jewelry', 
  'furniture', 
  'machinery'
));

-- ============================================================================
-- 8. Add audit log entry for migration
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
      'name', '0011_update_cache_schema_universal_types',
      'description', 'Updated existing cache schema to support universal item types',
      'changes', jsonb_build_object(
        'property_types_added', jsonb_build_array(
          'appliance',
          'property', 
          'jewelry',
          'furniture',
          'machinery'
        ),
        'indexes_added', jsonb_build_array(
          'idx_market_data_appliance_brand',
          'idx_market_data_appliance_type',
          'idx_market_data_property_location',
          'idx_market_data_property_type_field',
          'idx_market_data_jewelry_type',
          'idx_market_data_jewelry_material',
          'idx_market_data_furniture_type',
          'idx_market_data_furniture_material',
          'idx_market_data_machinery_brand',
          'idx_market_data_machinery_type',
          'idx_market_data_condition'
        ),
        'validation_functions_added', jsonb_build_array(
          'validate_appliance_details',
          'validate_property_details',
          'validate_jewelry_details',
          'validate_furniture_details',
          'validate_machinery_details'
        ),
        'constraints_added', jsonb_build_array(
          'chk_market_data_property_type',
          'chk_market_data_appliance_details',
          'chk_market_data_property_details',
          'chk_market_data_jewelry_details',
          'chk_market_data_furniture_details',
          'chk_market_data_machinery_details',
          'chk_background_jobs_property_type'
        )
      ),
      'purpose', jsonb_build_object(
        'universal_support', 'Enable caching for all item types supported by internet search',
        'performance', 'Add specialized indexes for efficient querying of new item types',
        'data_integrity', 'Ensure proper validation of item-specific fields',
        'backward_compatibility', 'Maintain compatibility with existing vehicle, electronics, and building data'
      ),
      'integration', jsonb_build_object(
        'internet_search', 'Supports new universal item types from query builder service',
        'existing_cache', 'Extends existing market_data_cache table structure',
        'validation', 'Adds type-specific validation for data integrity'
      )
    )
  ),
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1),
  NOW()
WHERE EXISTS (SELECT 1 FROM users WHERE role = 'super_admin');

-- ============================================================================
-- 9. Create sample data for testing new item types
-- ============================================================================

-- Sample appliance cache entry
INSERT INTO market_data_cache (
  property_hash,
  property_type,
  property_details,
  median_price,
  min_price,
  max_price,
  source_count,
  scraped_at,
  stale_at
) VALUES (
  'sample_appliance_hash_001',
  'appliance',
  jsonb_build_object(
    'type', 'appliance',
    'brand', 'Samsung',
    'model', 'RF23R62E3SR',
    'applianceType', 'refrigerator',
    'size', '23 cubic feet',
    'condition', 'Brand New'
  ),
  450000.00,
  420000.00,
  480000.00,
  3,
  NOW(),
  NOW() + INTERVAL '7 days'
) ON CONFLICT (property_hash) DO NOTHING;

-- Sample jewelry cache entry
INSERT INTO market_data_cache (
  property_hash,
  property_type,
  property_details,
  median_price,
  min_price,
  max_price,
  source_count,
  scraped_at,
  stale_at
) VALUES (
  'sample_jewelry_hash_001',
  'jewelry',
  jsonb_build_object(
    'type', 'jewelry',
    'jewelryType', 'necklace',
    'material', 'gold',
    'weight', '10 grams',
    'condition', 'Brand New'
  ),
  85000.00,
  75000.00,
  95000.00,
  2,
  NOW(),
  NOW() + INTERVAL '7 days'
) ON CONFLICT (property_hash) DO NOTHING;

-- Sample furniture cache entry
INSERT INTO market_data_cache (
  property_hash,
  property_type,
  property_details,
  median_price,
  min_price,
  max_price,
  source_count,
  scraped_at,
  stale_at
) VALUES (
  'sample_furniture_hash_001',
  'furniture',
  jsonb_build_object(
    'type', 'furniture',
    'furnitureType', 'sofa',
    'material', 'leather',
    'size', '3-seater',
    'condition', 'Foreign Used (Tokunbo)'
  ),
  125000.00,
  100000.00,
  150000.00,
  4,
  NOW(),
  NOW() + INTERVAL '7 days'
) ON CONFLICT (property_hash) DO NOTHING;

-- ============================================================================
-- 10. Performance optimization
-- ============================================================================

-- Analyze tables to update statistics for query planner
ANALYZE market_data_cache;
ANALYZE background_jobs;

-- Create partial indexes for frequently queried conditions
CREATE INDEX IF NOT EXISTS "idx_market_data_brand_new" 
ON "market_data_cache" (property_type, created_at) 
WHERE property_details->>'condition' = 'Brand New';

CREATE INDEX IF NOT EXISTS "idx_market_data_foreign_used" 
ON "market_data_cache" (property_type, created_at) 
WHERE property_details->>'condition' = 'Foreign Used (Tokunbo)';

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS "idx_market_data_type_condition_created" 
ON "market_data_cache" (property_type, (property_details->>'condition'), created_at);