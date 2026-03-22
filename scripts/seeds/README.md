# Vehicle Data Seeding System

## Overview

Enterprise-grade data seeding system for vehicle valuations and damage deductions in the salvage management system. This system provides idempotent, safe, and production-ready data imports with automatic deployment seeding capabilities.

### Key Features

- **Idempotent Operations**: Safe to run multiple times without creating duplicates
- **Registry Tracking**: Automatically skips already-executed seeds (use `--force` to re-run)
- **Batch Processing**: Processes records in batches of 50 for optimal performance
- **Error Isolation**: Individual record failures don't stop the entire import
- **Validation**: Comprehensive field and range validation before insertion
- **Audit Logging**: All changes tracked in `valuation_audit_logs` table
- **Dry-Run Mode**: Test seeds without making database changes

### Architecture

The seed system consists of:

1. **Seed Scripts**: Individual TypeScript files that import vehicle data
2. **Seed Registry**: Database table tracking execution history
3. **Batch Processor**: Handles large datasets efficiently
4. **Validation Service**: Ensures data integrity before insertion
5. **Idempotent Upsert**: Updates existing records instead of creating duplicates
6. **Master Seed Runner**: Executes all seeds in deterministic order

## Quick Start

### Running Existing Seeds

```bash
# Run all seeds (skips already-executed seeds)
tsx scripts/seeds/run-all-seeds.ts

# Run specific make
tsx scripts/seeds/toyota/toyota-valuations.seed.ts
tsx scripts/seeds/mercedes/mercedes-damage-deductions.seed.ts

# Force re-run (ignores registry)
tsx scripts/seeds/toyota/toyota-valuations.seed.ts --force

# Dry run (test without changes)
tsx scripts/seeds/toyota/toyota-valuations.seed.ts --dry-run

# Run all seeds with force flag
tsx scripts/seeds/run-all-seeds.ts --force

# Stop on first failure
tsx scripts/seeds/run-all-seeds.ts --fail-fast
```

### Common Commands

```bash
# Test a new seed before running
tsx scripts/seeds/bmw/bmw-valuations.seed.ts --dry-run

# Run seed and force update existing records
tsx scripts/seeds/bmw/bmw-valuations.seed.ts --force

# Run all seeds on fresh deployment
tsx scripts/seeds/run-all-seeds.ts
```

## Running Existing Seeds

### Available Makes

The system currently includes seed scripts for:

- **Audi**: Valuations and damage deductions
- **Hyundai**: Valuations and damage deductions
- **Kia**: Valuations and damage deductions
- **Lexus**: Valuations and damage deductions
- **Mercedes**: Valuations and damage deductions
- **Nissan**: Valuations and damage deductions
- **Toyota**: Valuations and damage deductions (Camry, Corolla, Highlander, RAV4, Sienna, Land Cruiser, Prado, Venza, Avalon)

### Execution Order

When running `run-all-seeds.ts`, seeds execute in this order:

1. Alphabetically by make (audi → hyundai → kia → lexus → mercedes → nissan → toyota)
2. Within each make: valuations first, then damage deductions

This ensures valuation data exists before damage deductions are imported.

### Registry Behavior

- **First Run**: Seed executes and records entry in `seed_registry` table
- **Subsequent Runs**: Seed skips execution (shows "already executed" message)
- **Force Flag**: Bypasses registry check and re-runs seed
- **Dry-Run Flag**: Skips registry recording (for testing only)

## Adding New Vehicle Make

Follow these steps to add a new vehicle make (e.g., BMW, Honda, Ford):

### Step 1: Create Make Folder

```bash
mkdir scripts/seeds/bmw
```

### Step 2: Copy Templates

```bash
cp scripts/seeds/_template/make-valuations.seed.ts scripts/seeds/bmw/bmw-valuations.seed.ts
cp scripts/seeds/_template/make-damage-deductions.seed.ts scripts/seeds/bmw/bmw-damage-deductions.seed.ts
```

### Step 3: Update Script Configuration

Open `bmw-valuations.seed.ts` and update:

```typescript
// Change this line:
const SCRIPT_NAME = '{make}-valuations';

// To:
const SCRIPT_NAME = 'bmw-valuations';
```

### Step 4: Paste Raw Data

Paste your vehicle data into the `rawData` array:

```typescript
const rawData = [
  {
    make: 'BMW',
    model: '3 Series',
    year: 2020,
    nigUsedLow: 15000000,
    nigUsedHigh: 25000000,
    avgUsed: 20000000,
    tokunboLow: 25000000,
    tokunboHigh: 40000000,
    avgTokunbo: 32500000,
    mileageLow: 20000,
    mileageHigh: 60000,
  },
  // Add more records...
];
```

### Step 5: Test with Dry-Run

```bash
tsx scripts/seeds/bmw/bmw-valuations.seed.ts --dry-run
```

Review the output to ensure:
- All records are transformed correctly
- No validation errors
- Expected number of records

### Step 6: Run the Seed

```bash
tsx scripts/seeds/bmw/bmw-valuations.seed.ts
```

### Step 7: Verify Import

Check the database to confirm records were imported:

```bash
# Using a database query script
tsx scripts/check-all-makes-data.ts
```

### Step 8: Repeat for Damage Deductions

Follow the same process for `bmw-damage-deductions.seed.ts`.

## Data Format

### Valuation Data Format

The seed system supports multiple condition categories per vehicle:

#### Nigerian Used (nig_used_low)

```typescript
{
  make: 'Toyota',
  model: 'Camry',
  year: 2020,
  nigUsedLow: 3000000,      // Minimum price for Nigerian used
  nigUsedHigh: 5000000,     // Maximum price for Nigerian used
  avgUsed: 4000000,         // Average price for Nigerian used
  mileageLow: 50000,        // Optional: Minimum mileage
  mileageHigh: 150000,      // Optional: Maximum mileage
  marketNotes: 'Popular sedan model', // Optional: Market notes
}
```

#### Foreign Used / Tokunbo (tokunbo_low)

```typescript
{
  make: 'Toyota',
  model: 'Camry',
  year: 2020,
  tokunboLow: 8000000,      // Minimum price for foreign used
  tokunboHigh: 12000000,    // Maximum price for foreign used
  avgTokunbo: 10000000,     // Average price for foreign used
  mileageLow: 30000,
  mileageHigh: 80000,
}
```

#### Condition-Based Categories

```typescript
{
  make: 'Toyota',
  model: 'Highlander',
  year: 2020,
  // Fair condition
  fair: 25000000,           // Single price or low price
  fairHigh: 38000000,       // High price
  avgFair: 31500000,        // Average price
  // Good condition
  good: 38000000,
  goodHigh: 52000000,
  avgGood: 45000000,
  // Excellent condition
  excellentLow: 52000000,
  excellentHigh: 68000000,
  avgExcellent: 60000000,
  mileageLow: 15000,
  mileageHigh: 40000,
}
```

#### Multiple Categories Per Row

A single raw data row can produce multiple database records:

```typescript
{
  make: 'Toyota',
  model: 'Camry',
  year: 2020,
  // Nigerian Used category
  nigUsedLow: 3000000,
  nigUsedHigh: 5000000,
  avgUsed: 4000000,
  // Tokunbo category
  tokunboLow: 8000000,
  tokunboHigh: 12000000,
  avgTokunbo: 10000000,
  // Shared fields
  mileageLow: 50000,
  mileageHigh: 150000,
}
// This creates 2 database records:
// 1. conditionCategory: 'nig_used_low'
// 2. conditionCategory: 'tokunbo_low'
```

### Deduction Data Format

Damage deductions specify repair costs and valuation impacts:

```typescript
{
  make: 'Toyota',
  component: 'Front Bumper',
  damageLevel: 'minor',              // 'minor' | 'moderate' | 'severe'
  repairCostLow: 50000,              // Minimum repair cost
  repairCostHigh: 100000,            // Maximum repair cost
  valuationDeductionLow: 75000,      // Minimum valuation deduction
  valuationDeductionHigh: 150000,    // Maximum valuation deduction
  notes: 'Paint and minor dent repair', // Optional: Repair notes
}
```

#### Damage Levels

- **minor**: Small dents, scratches, minor paint damage
- **moderate**: Significant dents, multiple panels, functional issues
- **severe**: Structural damage, major component replacement

#### Example Deduction Records

```typescript
const rawData = [
  // Minor damage
  {
    make: 'Mercedes',
    component: 'Front Bumper',
    damageLevel: 'minor',
    repairCostLow: 80000,
    repairCostHigh: 150000,
    valuationDeductionLow: 120000,
    valuationDeductionHigh: 225000,
    notes: 'Minor scratches and paint chips',
  },
  // Moderate damage
  {
    make: 'Mercedes',
    component: 'Front Bumper',
    damageLevel: 'moderate',
    repairCostLow: 200000,
    repairCostHigh: 400000,
    valuationDeductionLow: 300000,
    valuationDeductionHigh: 600000,
    notes: 'Significant dent requiring replacement',
  },
  // Severe damage
  {
    make: 'Mercedes',
    component: 'Engine',
    damageLevel: 'severe',
    repairCostLow: 2000000,
    repairCostHigh: 5000000,
    valuationDeductionLow: 3000000,
    valuationDeductionHigh: 7500000,
    notes: 'Major engine damage or replacement',
  },
];
```

### Field Descriptions

#### Valuation Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `make` | string | Yes | Vehicle manufacturer (e.g., 'Toyota', 'Mercedes') |
| `model` | string | Yes | Vehicle model (e.g., 'Camry', 'C-Class') |
| `year` | number | Yes | Model year (1900-2100) |
| `conditionCategory` | string | Yes | Auto-generated from data (nig_used_low, tokunbo_low, fair, good, excellent) |
| `lowPrice` | number | Yes | Minimum price in Naira |
| `highPrice` | number | Yes | Maximum price in Naira |
| `averagePrice` | number | Yes | Average price in Naira (must be between lowPrice and highPrice) |
| `dataSource` | string | Yes | Auto-set to 'manual_import' or specific guide name |
| `mileageLow` | number | No | Minimum expected mileage in kilometers |
| `mileageHigh` | number | No | Maximum expected mileage in kilometers |
| `marketNotes` | string | No | Additional market information or notes |

#### Deduction Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `make` | string | Yes | Vehicle manufacturer |
| `component` | string | Yes | Damaged component (e.g., 'Front Bumper', 'Engine', 'Transmission') |
| `damageLevel` | enum | Yes | 'minor', 'moderate', or 'severe' |
| `repairCostLow` | number | Yes | Minimum repair cost in Naira |
| `repairCostHigh` | number | Yes | Maximum repair cost in Naira |
| `valuationDeductionLow` | number | Yes | Minimum valuation deduction in Naira |
| `valuationDeductionHigh` | number | Yes | Maximum valuation deduction in Naira |
| `notes` | string | No | Repair notes or additional information |

### Validation Rules

The system validates all records before insertion:

**Valuation Validation**:
- `lowPrice` ≤ `averagePrice` ≤ `highPrice`
- `year` must be between 1900 and 2100
- All required fields must be present

**Deduction Validation**:
- `repairCostLow` ≤ `repairCostHigh`
- `valuationDeductionLow` ≤ `valuationDeductionHigh`
- `damageLevel` must be 'minor', 'moderate', or 'severe'
- All required fields must be present

## Architecture

### Idempotence

Every seed operation is idempotent, meaning running it multiple times produces the same result:

- **First Run**: Records are inserted into the database
- **Subsequent Runs**: Existing records are updated (not duplicated)
- **Unique Constraints**:
  - Valuations: `(make, model, year, conditionCategory)`
  - Deductions: `(make, component, damageLevel)`

**Example**:
```typescript
// First run: Inserts record
{ make: 'Toyota', model: 'Camry', year: 2020, conditionCategory: 'nig_used_low', lowPrice: 3000000 }

// Second run: Updates existing record (preserves createdAt, updates updatedAt)
{ make: 'Toyota', model: 'Camry', year: 2020, conditionCategory: 'nig_used_low', lowPrice: 3500000 }
```

### Batch Processing

Large datasets are processed in batches for optimal performance:

- **Batch Size**: 50 records per batch
- **Progress Indicators**: Shows "Processing batch 3/10..."
- **Error Handling**: Batch failure triggers individual record processing
- **Performance**: Processes 1000 records in ~30-45 seconds

### Registry Tracking

The `seed_registry` table tracks all seed executions:

```typescript
{
  id: 'uuid',
  scriptName: 'toyota-valuations',
  executedAt: '2026-03-15T10:30:00Z',
  status: 'completed', // 'running' | 'completed' | 'failed'
  recordsImported: 150,
  recordsUpdated: 25,
  recordsSkipped: 5,
  errorMessage: null,
  executionTimeMs: 12500,
}
```

**Registry Workflow**:
1. Seed starts → Creates entry with status 'running'
2. Seed completes → Updates entry with status 'completed' and statistics
3. Seed fails → Updates entry with status 'failed' and error message
4. Next run → Checks registry, skips if status is 'completed' (unless `--force`)

### Validation

All records are validated before insertion:

```typescript
// Validation checks
✓ Required fields present
✓ Price ranges valid (lowPrice ≤ averagePrice ≤ highPrice)
✓ Year within valid range (1900-2100)
✓ Damage level is valid enum value
✓ Repair cost ranges valid

// Validation failure example
❌ Validation failed for 2020 Toyota Camry:
   - lowPrice: lowPrice (5000000) must be <= highPrice (3000000)
   - averagePrice: averagePrice (4000000) must be between lowPrice and highPrice
```

### Error Handling

The system handles errors gracefully:

**Record-Level Errors**:
- Individual record failures don't stop the import
- Errors are logged and counted
- Summary report shows all errors at the end

**Batch-Level Errors**:
- Batch failure triggers fallback to individual processing
- Ensures maximum records are imported despite errors

**Fatal Errors**:
- Database connection failures stop execution immediately
- Registry is updated with failure status
- Exit code 1 indicates failure

**Example Error Output**:
```
❌ ERROR DETAILS:
------------------------------------------------------------
1. 2020 Toyota Camry
   Error: Validation failed: lowPrice must be <= highPrice
2. 2021 Mercedes C-Class
   Error: Database constraint violation: duplicate key
------------------------------------------------------------
```

## Troubleshooting

### Seed Already Executed

**Problem**: Seed shows "already executed" message

**Solution**:
```bash
# Use --force flag to re-run
tsx scripts/seeds/toyota/toyota-valuations.seed.ts --force
```

### Validation Errors

**Problem**: Records fail validation

**Solution**:
1. Check console output for specific field errors
2. Fix data in the seed script
3. Re-run with `--dry-run` to test
4. Run normally once validated

**Example**:
```
⚠️  Validation failed for 2020 Toyota Camry:
   - lowPrice: lowPrice (5000000) must be <= highPrice (3000000)
```

Fix: Swap lowPrice and highPrice values in rawData array.

### Database Connection Failed

**Problem**: "Cannot connect to database" error

**Solution**:
1. Verify `DATABASE_URL` in `.env` file
2. Check database is running
3. Verify network connectivity
4. Check database credentials

```bash
# Test database connection
tsx scripts/verify-google-apis.ts
```

### Stale Registry Entries

**Problem**: Registry shows "running" status for old executions

**Solution**:
```bash
# Clean up stale entries (> 1 hour old)
tsx scripts/seeds/cleanup-registry.ts

# Or force re-run the seed
tsx scripts/seeds/toyota/toyota-valuations.seed.ts --force
```

### Duplicate Records

**Problem**: Seeing duplicate records in database

**Solution**:
1. Check unique constraints are properly defined
2. Verify idempotent upsert logic is working
3. Review seed script for data transformation issues

```bash
# Check for duplicates
tsx scripts/check-all-makes-data.ts
```

### Slow Performance

**Problem**: Seed takes too long to execute

**Solution**:
1. Verify batch processing is enabled (BATCH_SIZE = 50)
2. Check database connection pool settings
3. Review database indexes on unique constraint fields
4. Consider splitting large datasets into multiple seed scripts

### Partial Import

**Problem**: Some records imported, others skipped

**Solution**:
1. Review error details in summary report
2. Fix validation errors in rawData
3. Re-run with `--force` to update existing records

**Example**:
```
📈 SEED EXECUTION SUMMARY
Total Records:    150
✅ Imported:      120
🔄 Updated:       20
⏭️  Skipped:       10
❌ Errors:        10
```

### System User Not Found

**Problem**: "System User ID not found" error

**Solution**:
```bash
# Create system user (run once)
tsx scripts/create-system-user.ts
```

The system user (ID: `00000000-0000-0000-0000-000000000001`) must exist before running seeds.

### Memory Issues

**Problem**: "Out of memory" error with large datasets

**Solution**:
1. Reduce BATCH_SIZE in seed script (e.g., from 50 to 25)
2. Split large datasets into multiple seed scripts
3. Increase Node.js memory limit:

```bash
NODE_OPTIONS="--max-old-space-size=4096" tsx scripts/seeds/toyota/toyota-valuations.seed.ts
```

### Dry-Run Shows Different Results

**Problem**: Dry-run succeeds but actual run fails

**Solution**:
1. Dry-run only validates, doesn't check database constraints
2. Run actual seed to see real errors
3. Fix errors and re-run with `--force`

## Advanced Usage

### Custom Transformation Logic

If your data format differs from the template, customize the `transformToDbRecords()` function:

```typescript
function transformToDbRecords(rawData: any[]): ValuationRecord[] {
  const records: ValuationRecord[] = [];
  
  for (const item of rawData) {
    // Custom transformation logic
    if (item.priceRange) {
      const [low, high] = item.priceRange.split('-').map(Number);
      records.push({
        make: item.manufacturer,
        model: item.vehicleModel,
        year: item.modelYear,
        conditionCategory: 'nig_used_low',
        lowPrice: low,
        highPrice: high,
        averagePrice: (low + high) / 2,
        dataSource: 'manual_import',
      });
    }
  }
  
  return records;
}
```

### Conditional Seeding

Skip certain records based on conditions:

```typescript
for (const item of rawData) {
  // Skip records older than 2000
  if (item.year < 2000) {
    console.log(`Skipping old vehicle: ${item.year} ${item.make} ${item.model}`);
    continue;
  }
  
  // Only import if price data is complete
  if (!item.nigUsedLow || !item.nigUsedHigh || !item.avgUsed) {
    console.warn(`Skipping incomplete data: ${item.year} ${item.make} ${item.model}`);
    continue;
  }
  
  // Add record
  records.push({...});
}
```

### Environment-Specific Seeding

Use environment variables to control seeding behavior:

```typescript
// Skip seeds in production
if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PRODUCTION_SEEDS) {
  console.log('⚠️  Skipping seed in production environment');
  process.exit(0);
}

// Use different data sources per environment
const dataSource = process.env.NODE_ENV === 'production'
  ? 'Official Price Guide 2026'
  : 'Test Data';
```

### Monitoring Seed Execution

Query the seed registry to monitor execution history:

```bash
# View all seed executions
tsx scripts/seeds/view-registry.ts

# View specific seed history
tsx scripts/seeds/view-registry.ts --script toyota-valuations

# View failed seeds only
tsx scripts/seeds/view-registry.ts --status failed

# View completed seeds from last 7 days
tsx scripts/seeds/view-registry.ts --status completed --days 7

# View all seeds for a specific make
tsx scripts/seeds/view-registry.ts --script toyota

# Combine filters
tsx scripts/seeds/view-registry.ts --status completed --days 30 --script mercedes
```

### Registry Cleanup

Clean up stale registry entries or reset the entire registry:

```bash
# Cleanup stale entries (running for > 1 hour)
tsx scripts/seeds/cleanup-registry.ts

# Reset entire registry (requires confirmation)
tsx scripts/seeds/cleanup-registry.ts --reset

# Reset without confirmation (use with caution!)
tsx scripts/seeds/cleanup-registry.ts --reset -y
```

**When to use cleanup**:
- After a deployment crash or server restart
- When seeds are stuck in 'running' status
- Regular maintenance to keep registry clean

**When to use reset**:
- Force re-execution of all seeds
- After major data changes or corrections
- Testing seed idempotence
- **CAUTION**: Use sparingly in production

## Best Practices

1. **Always Test with Dry-Run**: Test new seeds with `--dry-run` before actual execution
2. **Validate Data First**: Ensure data quality before creating seed scripts
3. **Use Descriptive Names**: Name seed scripts clearly (e.g., `toyota-valuations.seed.ts`)
4. **Document Data Sources**: Include source information in script comments
5. **Version Control**: Commit seed scripts to version control
6. **Backup Before Force**: Backup database before using `--force` flag
7. **Monitor Registry**: Regularly check seed registry for failed executions
8. **Handle Errors Gracefully**: Review error reports and fix data issues
9. **Keep Templates Updated**: Update templates when adding new features
10. **Test Idempotence**: Run seeds twice to verify idempotent behavior

## Related Documentation

- **Database Schema**: `src/lib/db/schema/vehicle-valuations.ts`
- **Seed Services**: `src/features/seeds/services/`
- **Migration Guide**: `src/lib/db/migrations/README.md`
- **API Documentation**: `src/app/api/admin/valuations/README.md`

## Support

For issues or questions:

1. Check this README for troubleshooting tips
2. Review seed script comments and templates
3. Check the seed registry for execution history
4. Review error logs in console output
5. Contact the development team for assistance

---

**Last Updated**: March 2026  
**Version**: 1.0.0  
**Maintainer**: Development Team
