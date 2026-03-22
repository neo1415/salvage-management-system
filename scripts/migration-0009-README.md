# Migration 0009: Condition Category Quality System

## Overview

This migration replaces the 3-category vehicle condition system with a 4-tier quality-based system:

**Old System (3 categories):**
- Brand New
- Foreign Used
- Nigerian Used

**New System (4 quality tiers):**
- Excellent (Brand New)
- Good (Foreign Used)
- Fair (Nigerian Used)
- Poor

## What This Migration Does

1. **Updates salvage_cases.vehicle_condition**
   - Maps legacy values to new quality tiers
   - Preserves already-migrated values

2. **Updates vehicle_valuations.condition_category**
   - Maps legacy values to new quality tiers
   - Handles sub-categories (tokunbo_low/high, nig_used_low/high)
   - Preserves already-migrated values

3. **Updates market_data_cache.property_details.condition**
   - Updates condition values in JSONB field
   - Maps legacy values to new quality tiers
   - Preserves already-migrated values

4. **Creates audit log entry**
   - Records migration execution for tracking
   - Includes mapping details and tables updated

5. **Verifies migration success**
   - Checks all condition values are valid quality tiers
   - Reports any invalid values found

## Mapping Logic

```
Legacy Value       → New Quality Tier
─────────────────────────────────────
brand_new          → excellent
foreign_used       → good
nigerian_used      → fair
tokunbo_low        → good
tokunbo_high       → good
nig_used_low       → fair
nig_used_high      → fair
Other values       → fair (safe fallback)
```

## Usage

### 1. Verify Migration Readiness

Before running the migration, check the current state:

```bash
npx tsx scripts/verify-migration-0009.ts
```

This will show:
- Current condition values in all tables
- Number of records with legacy values
- Whether migration has already been run
- Database connection status

### 2. Run Migration

Execute the migration:

```bash
npx tsx scripts/run-migration-0009.ts
```

The script will:
- Read the migration SQL file
- Execute the migration (wrapped in transaction)
- Verify all condition values are updated
- Display detailed results and statistics

### 3. Rollback (Emergency Only)

⚠️ **WARNING: Rollback causes data loss!**

The "poor" quality tier will be mapped to "nigerian_used", losing granularity.

```bash
npx tsx scripts/run-migration-0009.ts --rollback
```

Only use rollback if absolutely necessary.

## Safety Features

### Idempotency

The migration is **idempotent** - it can be run multiple times safely:
- Already-migrated values are preserved
- Only legacy values are updated
- No data duplication occurs

### Transaction Wrapping

The entire migration is wrapped in a transaction:
- If any error occurs, all changes are rolled back
- No partial state is possible
- Database integrity is maintained

### Verification

After migration, the script verifies:
- All condition values are valid quality tiers
- No invalid values exist
- Audit log entry was created
- Expected number of records were updated

## Expected Results

Based on current database state (as of verification):

- **vehicle_valuations**: 629 records will be updated
  - 333 records: tokunbo_low → good
  - 296 records: nig_used_low → fair
  - Already migrated: 120 records (excellent, good, fair, poor)

- **salvage_cases**: No records to update (no legacy values)

- **market_data_cache**: No records to update (no condition values set)

## Troubleshooting

### Migration Fails

If the migration fails:
1. Check the error message in the output
2. Verify database connection is working
3. Check database permissions (need UPDATE, INSERT)
4. All changes are automatically rolled back

### Invalid Values After Migration

If verification finds invalid values:
1. Check the migration SQL file for errors
2. Review the mapping logic
3. Run verification script to see which values are invalid
4. Contact development team for assistance

### Rollback Needed

If you need to rollback:
1. Understand that "poor" → "nigerian_used" loses data
2. Run: `npx tsx scripts/run-migration-0009.ts --rollback`
3. Verify rollback with verification script
4. Document why rollback was needed

## Next Steps After Migration

1. **Update UI Components**
   - Update condition dropdowns to show new labels
   - Update condition displays to use new format

2. **Update AI Assessment Service**
   - Ensure AI outputs quality tier values
   - Update condition determination logic

3. **Update Valuation Query Service**
   - Use quality tier values in queries
   - Remove old fallback logic

4. **Test Case Creation Flow**
   - Create test cases with each quality tier
   - Verify conditions display correctly
   - Verify valuations work correctly

## Files

- **Migration SQL**: `src/lib/db/migrations/0009_condition_category_quality_system.sql`
- **Runner Script**: `scripts/run-migration-0009.ts`
- **Verification Script**: `scripts/verify-migration-0009.ts`
- **This README**: `scripts/migration-0009-README.md`

## Support

For questions or issues:
1. Review this README
2. Run verification script to check current state
3. Check migration SQL file for details
4. Contact development team if needed

## References

- **Spec**: `.kiro/specs/condition-category-quality-system/`
- **Requirements**: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
- **Design**: See design.md for full system architecture
- **Tasks**: Task 2.2 - Create migration runner script
