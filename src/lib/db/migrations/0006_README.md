# Migration 0006: Add Mileage, Condition, and Price Override Fields

**Feature**: case-creation-and-approval-enhancements  
**Requirements**: 1.1, 2.1, 6.4, 7.1  
**Date**: 2026-02-27

## Overview

This migration adds support for enhanced case creation and manager approval workflows by adding four new optional fields to the `salvage_cases` table:

1. **vehicle_mileage** - Odometer reading for more accurate AI valuations
2. **vehicle_condition** - Pre-accident condition assessment
3. **ai_estimates** - Original AI price estimates (before manager overrides)
4. **manager_overrides** - Manager's price adjustments with audit trail

## Schema Changes

### New Columns

```sql
ALTER TABLE salvage_cases
ADD COLUMN vehicle_mileage INTEGER,
ADD COLUMN vehicle_condition VARCHAR(20) CHECK (vehicle_condition IN ('excellent', 'good', 'fair', 'poor')),
ADD COLUMN ai_estimates JSONB,
ADD COLUMN manager_overrides JSONB;
```

### Column Details

#### vehicle_mileage
- **Type**: INTEGER
- **Nullable**: YES
- **Purpose**: Store vehicle odometer reading in kilometers
- **Usage**: Passed to AI service for more accurate market value estimation
- **Example**: 75000 (75,000 km)

#### vehicle_condition
- **Type**: VARCHAR(20)
- **Nullable**: YES
- **Constraint**: CHECK (vehicle_condition IN ('excellent', 'good', 'fair', 'poor'))
- **Purpose**: Store pre-accident vehicle condition
- **Usage**: Passed to AI service for condition-based valuation adjustments
- **Valid Values**:
  - `excellent` - Well-maintained, minimal wear
  - `good` - Normal wear, good maintenance
  - `fair` - Some wear, average maintenance
  - `poor` - Significant wear, poor maintenance

#### ai_estimates
- **Type**: JSONB
- **Nullable**: YES
- **Purpose**: Store original AI price estimates before any manager overrides
- **Structure**:
```json
{
  "marketValue": 8500000,
  "repairCost": 3200000,
  "salvageValue": 5300000,
  "reservePrice": 3710000,
  "confidence": 85
}
```

#### manager_overrides
- **Type**: JSONB
- **Nullable**: YES
- **Purpose**: Store manager's price adjustments with audit information
- **Structure**:
```json
{
  "marketValue": 9000000,
  "repairCost": 3200000,
  "salvageValue": 5500000,
  "reservePrice": 3850000,
  "reason": "Market research shows higher value for this model in Lagos",
  "overriddenBy": "user-uuid",
  "overriddenAt": "2026-02-27T10:30:00Z"
}
```

### New Indexes

```sql
CREATE INDEX idx_salvage_cases_mileage ON salvage_cases(vehicle_mileage);
CREATE INDEX idx_salvage_cases_condition ON salvage_cases(vehicle_condition);
```

**Purpose**: Improve query performance when filtering or analyzing cases by mileage or condition.

## Backward Compatibility

✅ **Fully backward compatible**

- All new columns are nullable
- Existing cases will have NULL values for new fields
- Existing queries and code continue to work without modification
- AI service handles missing mileage/condition by using defaults

## Running the Migration

### Development Environment

```bash
# Run the migration
npx tsx scripts/run-migration-0006.ts

# Verify the migration
npx tsx scripts/verify-migration-0006.ts

# Test with sample data
npx tsx scripts/test-migration-0006-data.ts
```

### Production Environment

```bash
# 1. Backup the database
pg_dump salvage_db > backup_before_0006.sql

# 2. Run the migration
psql salvage_db < src/lib/db/migrations/0006_add_mileage_condition_overrides.sql

# 3. Verify the changes
psql salvage_db -c "\d salvage_cases"
```

## Rollback Plan

If needed, the migration can be rolled back:

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_salvage_cases_mileage;
DROP INDEX IF EXISTS idx_salvage_cases_condition;

-- Remove columns
ALTER TABLE salvage_cases
DROP COLUMN IF EXISTS vehicle_mileage,
DROP COLUMN IF EXISTS vehicle_condition,
DROP COLUMN IF EXISTS ai_estimates,
DROP COLUMN IF EXISTS manager_overrides;
```

**Note**: Rollback will result in data loss for any cases that have these fields populated.

## Usage Examples

### Creating a Case with Mileage and Condition

```typescript
import { db } from '@/lib/db';
import { salvageCases } from '@/lib/db/schema/cases';

await db.insert(salvageCases).values({
  // ... existing fields ...
  vehicleMileage: 75000,
  vehicleCondition: 'good',
  aiEstimates: {
    marketValue: 8500000,
    repairCost: 3200000,
    salvageValue: 5300000,
    reservePrice: 3710000,
    confidence: 85
  }
});
```

### Approving with Price Overrides

```typescript
import { db } from '@/lib/db';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq } from 'drizzle-orm';

await db.update(salvageCases)
  .set({
    status: 'approved',
    approvedBy: managerId,
    approvedAt: new Date(),
    managerOverrides: {
      marketValue: 9000000,
      salvageValue: 5500000,
      reservePrice: 3850000,
      reason: 'Market research shows higher value',
      overriddenBy: managerId,
      overriddenAt: new Date().toISOString()
    }
  })
  .where(eq(salvageCases.id, caseId));
```

### Querying Cases by Condition

```typescript
import { db } from '@/lib/db';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq } from 'drizzle-orm';

// Find all cases with excellent condition
const excellentCases = await db
  .select()
  .from(salvageCases)
  .where(eq(salvageCases.vehicleCondition, 'excellent'));

// Find cases with high mileage
const highMileageCases = await db
  .select()
  .from(salvageCases)
  .where(sql`vehicle_mileage > 150000`);
```

## Testing

### Verification Checklist

- [x] All 4 columns created successfully
- [x] CHECK constraint on vehicle_condition enforced
- [x] Both indexes created
- [x] Column comments added
- [x] Backward compatible with existing cases
- [x] JSONB fields support complex data structures
- [x] Indexes are usable for queries

### Test Results

All tests passed successfully:
- ✅ Backward compatibility verified
- ✅ Valid condition values accepted
- ✅ Invalid condition values rejected
- ✅ JSONB fields work correctly
- ✅ Indexes improve query performance

## Related Files

- **Migration SQL**: `src/lib/db/migrations/0006_add_mileage_condition_overrides.sql`
- **Schema Definition**: `src/lib/db/schema/cases.ts`
- **Run Script**: `scripts/run-migration-0006.ts`
- **Verification Script**: `scripts/verify-migration-0006.ts`
- **Test Script**: `scripts/test-migration-0006-data.ts`

## Next Steps

After this migration is deployed:

1. Update case creation form to collect mileage and condition
2. Update AI assessment service to use mileage and condition
3. Update manager approval page to support price editing
4. Update approval API to handle price overrides
5. Add audit logging for price changes

## Support

For questions or issues with this migration, refer to:
- Spec: `.kiro/specs/case-creation-and-approval-enhancements/`
- Requirements: `.kiro/specs/case-creation-and-approval-enhancements/requirements.md`
- Design: `.kiro/specs/case-creation-and-approval-enhancements/design.md`
