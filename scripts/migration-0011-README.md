# Migration 0011: Update Cache Schema for Universal Types

## Overview

This migration updates the existing cache schema to support universal item types introduced by the Universal AI Internet Search System. It extends the `market_data_cache` table to handle appliances, property, jewelry, furniture, and machinery in addition to the existing vehicles, electronics, and buildings.

## Changes Made

### 1. Database Schema Updates

#### Property Type Support
- Extended `property_type` constraint to include new types:
  - `appliance` - Refrigerators, washing machines, air conditioners, etc.
  - `property` - Houses, apartments, land, commercial properties
  - `jewelry` - Rings, necklaces, watches, chains, etc.
  - `furniture` - Sofas, tables, beds, chairs, etc.
  - `machinery` - Generators, industrial equipment, tools, etc.

#### JSONB Structure Enhancement
The `property_details` JSONB field now supports these structures:

```typescript
// Appliance
{
  type: 'appliance',
  brand: string,
  model: string,
  applianceType: string,
  size?: string,
  condition?: string
}

// Property (Real Estate)
{
  type: 'property',
  propertyType: string,
  location: string,
  bedrooms?: number,
  condition?: string
}

// Jewelry
{
  type: 'jewelry',
  jewelryType: string,
  brand?: string,
  material?: string,
  weight?: string,
  condition?: string
}

// Furniture
{
  type: 'furniture',
  furnitureType: string,
  brand?: string,
  material?: string,
  size?: string,
  condition?: string
}

// Machinery
{
  type: 'machinery',
  brand: string,
  machineryType: string,
  model?: string,
  year?: number,
  condition?: string
}
```

### 2. Performance Indexes

#### New Specialized Indexes
- `idx_market_data_appliance_brand` - Appliance brand searches
- `idx_market_data_appliance_type` - Appliance type searches
- `idx_market_data_property_location` - Property location searches
- `idx_market_data_property_type_field` - Property type searches
- `idx_market_data_jewelry_type` - Jewelry type searches
- `idx_market_data_jewelry_material` - Jewelry material searches
- `idx_market_data_furniture_type` - Furniture type searches
- `idx_market_data_furniture_material` - Furniture material searches
- `idx_market_data_machinery_brand` - Machinery brand searches
- `idx_market_data_machinery_type` - Machinery type searches
- `idx_market_data_condition` - Universal condition searches

#### Improved Existing Indexes
- `idx_market_data_vehicle_make_model` - Combined vehicle make/model
- `idx_market_data_electronics_brand_model` - Combined electronics brand/model

### 3. Data Validation

#### Validation Functions
- `validate_appliance_details()` - Ensures required appliance fields
- `validate_property_details()` - Ensures required property fields
- `validate_jewelry_details()` - Ensures required jewelry fields
- `validate_furniture_details()` - Ensures required furniture fields
- `validate_machinery_details()` - Ensures required machinery fields

#### Check Constraints
- `chk_market_data_property_type` - Validates supported property types
- `chk_market_data_appliance_details` - Validates appliance data structure
- `chk_market_data_property_details` - Validates property data structure
- `chk_market_data_jewelry_details` - Validates jewelry data structure
- `chk_market_data_furniture_details` - Validates furniture data structure
- `chk_market_data_machinery_details` - Validates machinery data structure
- `chk_background_jobs_property_type` - Updates background jobs validation

### 4. Sample Data

The migration includes sample data for testing:
- Sample appliance: Samsung refrigerator
- Sample jewelry: Gold necklace
- Sample furniture: Leather sofa

## Integration Points

### TypeScript Schema Updates
- Updated `src/lib/db/schema/market-data.ts` JSONB type definitions
- Updated `src/features/market-data/types/index.ts` PropertyIdentifier interface
- Updated `src/features/market-data/services/cache.service.ts` hash generation
- Updated `src/features/internet-search/services/cache-integration.service.ts` normalization

### Cache Service Enhancements
- Hash generation now includes all new item type fields
- Normalization handles universal condition mapping
- Backward compatibility maintained for existing data

### Internet Search Integration
- Cache integration service supports all universal item types
- Query builder service can cache results for any item type
- Performance optimized for new search patterns

## Running the Migration

### Prerequisites
- Migration 0010 must be completed first
- Database user must have DDL privileges
- Sufficient disk space for new indexes

### Execution
```bash
# Run the migration
npm run tsx scripts/run-migration-0011.ts

# Verify the migration
npm run tsx scripts/verify-migration-0011.ts
```

### Rollback (if needed)
```sql
-- Drop new constraints
ALTER TABLE market_data_cache DROP CONSTRAINT IF EXISTS chk_market_data_appliance_details;
ALTER TABLE market_data_cache DROP CONSTRAINT IF EXISTS chk_market_data_property_details;
ALTER TABLE market_data_cache DROP CONSTRAINT IF EXISTS chk_market_data_jewelry_details;
ALTER TABLE market_data_cache DROP CONSTRAINT IF EXISTS chk_market_data_furniture_details;
ALTER TABLE market_data_cache DROP CONSTRAINT IF EXISTS chk_market_data_machinery_details;

-- Drop new indexes
DROP INDEX IF EXISTS idx_market_data_appliance_brand;
DROP INDEX IF EXISTS idx_market_data_appliance_type;
-- ... (continue for all new indexes)

-- Drop validation functions
DROP FUNCTION IF EXISTS validate_appliance_details(JSONB);
DROP FUNCTION IF EXISTS validate_property_details(JSONB);
-- ... (continue for all validation functions)

-- Revert property type constraint
ALTER TABLE market_data_cache DROP CONSTRAINT IF EXISTS chk_market_data_property_type;
ALTER TABLE market_data_cache ADD CONSTRAINT chk_market_data_property_type 
CHECK (property_type IN ('vehicle', 'electronics', 'building'));
```

## Performance Impact

### Positive Impacts
- Specialized indexes improve query performance for new item types
- Composite indexes reduce query execution time
- Partial indexes optimize condition-based searches

### Considerations
- Index maintenance overhead during writes
- Increased storage requirements for indexes
- Initial index creation time during migration

### Monitoring
- Monitor query performance for new item types
- Track index usage statistics
- Watch for constraint violation errors

## Testing

### Verification Tests
The verification script tests:
1. Property type constraints are properly updated
2. All validation functions are created and callable
3. All specialized indexes are created and active
4. Data insertion works for all new item types
5. Sample data is created successfully
6. Background jobs constraints are updated

### Manual Testing
```sql
-- Test appliance insertion
INSERT INTO market_data_cache (
  property_hash, property_type, property_details,
  median_price, min_price, max_price, source_count,
  scraped_at, stale_at
) VALUES (
  'test_appliance_001', 'appliance',
  '{"type": "appliance", "brand": "Samsung", "model": "RT38K5032S8", "applianceType": "refrigerator", "condition": "Brand New"}',
  350000, 320000, 380000, 2,
  NOW(), NOW() + INTERVAL '7 days'
);

-- Test jewelry insertion
INSERT INTO market_data_cache (
  property_hash, property_type, property_details,
  median_price, min_price, max_price, source_count,
  scraped_at, stale_at
) VALUES (
  'test_jewelry_001', 'jewelry',
  '{"type": "jewelry", "jewelryType": "ring", "material": "gold", "weight": "3 grams", "condition": "Brand New"}',
  45000, 40000, 50000, 3,
  NOW(), NOW() + INTERVAL '7 days'
);
```

## Troubleshooting

### Common Issues

#### Constraint Violations
```
ERROR: new row violates check constraint "chk_market_data_appliance_details"
```
**Solution**: Ensure required fields (brand, model, applianceType) are present in property_details

#### Index Creation Failures
```
ERROR: could not create index "idx_market_data_appliance_brand"
```
**Solution**: Check for existing conflicting indexes or insufficient disk space

#### Function Creation Errors
```
ERROR: function "validate_appliance_details" already exists
```
**Solution**: Use `CREATE OR REPLACE FUNCTION` or drop existing function first

### Performance Issues
- If queries are slow after migration, run `ANALYZE market_data_cache`
- Check index usage with `EXPLAIN ANALYZE` on slow queries
- Consider adjusting `work_mem` for index creation

### Data Integrity Issues
- Validate existing data before migration
- Check for NULL values in critical fields
- Ensure JSONB structure consistency

## Future Considerations

### Extensibility
- Schema designed to easily add more item types
- Validation functions can be extended for new requirements
- Index patterns established for consistent performance

### Maintenance
- Regular index maintenance and statistics updates
- Monitor constraint violation patterns
- Consider partitioning for very large datasets

### Integration
- Ready for internet search service integration
- Supports universal item type caching
- Maintains backward compatibility with existing systems

## Success Criteria

✅ All new item types supported in cache schema  
✅ Performance indexes created and optimized  
✅ Data validation ensures integrity  
✅ Backward compatibility maintained  
✅ Integration points updated  
✅ Sample data created for testing  
✅ Verification tests pass  
✅ Documentation complete  

## Related Files

- `src/lib/db/migrations/0011_update_cache_schema_universal_types.sql` - Migration SQL
- `scripts/run-migration-0011.ts` - Migration execution script
- `scripts/verify-migration-0011.ts` - Migration verification script
- `src/lib/db/schema/market-data.ts` - Updated schema definitions
- `src/features/market-data/types/index.ts` - Updated type definitions
- `src/features/market-data/services/cache.service.ts` - Updated cache service
- `src/features/internet-search/services/cache-integration.service.ts` - Updated integration service