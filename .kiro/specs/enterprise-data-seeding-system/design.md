# Design Document: Enterprise-Grade Data Seeding System

## Overview

This design document specifies the technical architecture for an enterprise-grade data seeding system that manages vehicle valuation and damage deduction data in a production salvage management system. The system preserves the existing user workflow (paste data → create script → run script) while adding idempotent operations, seed registry tracking, and automatic deployment seeding capabilities.

### Goals

- Maintain the familiar user workflow for adding vehicle data
- Ensure all seed operations are idempotent (safe to run multiple times)
- Provide automatic seed execution on fresh deployments
- Organize seed scripts in a maintainable folder structure
- Support batch operations for performance optimization
- Enable comprehensive error handling and logging
- Facilitate easy addition of new vehicle makes

### Non-Goals

- Real-time data synchronization from external sources
- GUI-based data entry interface
- Automatic data validation against external APIs
- Multi-tenant seed isolation
- Seed versioning and rollback beyond basic audit logging

## Architecture

### System Components

```mermaid
graph TB
    A[User Pastes Data] --> B[Developer Creates Seed Script]
    B --> C[scripts/seeds/make/make-valuations.seed.ts]
    B --> D[scripts/seeds/make/make-damage-deductions.seed.ts]
    C --> E[Seed Runner]
    D --> E
    E --> F[Seed Registry Service]
    F --> G[Check if Already Executed]
    G -->|Not Executed| H[Execute Seed]
    G -->|Already Executed| I[Skip or Force Re-run]
    H --> J[Batch Processor]
    J --> K[Idempotent Upsert Logic]
    K --> L[Database]
    K --> M[Audit Logger]
    M --> N[valuation_audit_logs]
    F --> O[seed_registry Table]
    P[Deployment Hook] --> Q[Master Seed Runner]
    Q --> E
```

### Component Responsibilities

**Seed Script Template**
- Accepts raw TypeScript array data (current format)
- Transforms data into database-compatible records
- Implements idempotent upsert logic
- Provides progress indicators and summary reports
- Handles errors gracefully without stopping execution

**Seed Registry Service**
- Tracks which seed scripts have been executed
- Records execution status (running, completed, failed)
- Supports --force flag to re-run seeds
- Provides query interface for execution history

**Batch Processor**
- Groups records into batches of 50
- Executes batch operations for performance
- Maintains progress tracking across batches
- Handles partial batch failures

**Idempotent Upsert Logic**
- Checks for existing records using unique constraints
- Updates existing records instead of creating duplicates
- Preserves original createdAt timestamps
- Updates updatedAt timestamps on modifications

**Audit Logger**
- Records all data modifications to valuation_audit_logs
- Tracks create, update, and delete operations
- Stores before/after values for updates
- References System User for automated operations

**Master Seed Runner**
- Discovers all seed scripts in scripts/seeds/
- Executes seeds in deterministic order
- Integrates with deployment hooks
- Provides summary report of all executions

### Data Flow

1. **Manual Execution Flow**
   - User pastes vehicle data from Word document
   - Developer creates seed script using template
   - Developer runs: `tsx scripts/seeds/toyota/toyota-valuations.seed.ts`
   - Seed script checks registry for previous execution
   - If not executed or --force flag present, executes seed
   - Records are processed in batches of 50
   - Each record is upserted idempotently
   - Audit logs are created for all modifications
   - Registry is updated with execution status
   - Summary report is displayed

2. **Automatic Deployment Flow**
   - Fresh deployment initializes database schema
   - Deployment hook triggers master seed runner
   - Master seed runner discovers all seed scripts
   - Seeds are executed in alphabetical order by make
   - Registry tracks each seed execution
   - All vehicle data is loaded automatically
   - Deployment completes with seeded data

## Components and Interfaces

### Seed Registry Table Schema

```typescript
export const seedRegistry = pgTable('seed_registry', {
  id: uuid('id').primaryKey().defaultRandom(),
  scriptName: varchar('script_name', { length: 255 }).notNull().unique(),
  executedAt: timestamp('executed_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull(), // 'running', 'completed', 'failed'
  recordsAffected: integer('records_affected').default(0),
  recordsImported: integer('records_imported').default(0),
  recordsUpdated: integer('records_updated').default(0),
  recordsSkipped: integer('records_skipped').default(0),
  errorMessage: text('error_message'),
  executionTimeMs: integer('execution_time_ms'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  scriptNameIdx: index('idx_seed_registry_script_name').on(table.scriptName),
  statusIdx: index('idx_seed_registry_status').on(table.status),
  executedAtIdx: index('idx_seed_registry_executed_at').on(table.executedAt),
}));
```

### Seed Registry Service Interface

```typescript
interface SeedRegistryService {
  /**
   * Check if a seed script has been executed
   */
  hasBeenExecuted(scriptName: string): Promise<boolean>;
  
  /**
   * Record the start of a seed execution
   */
  recordStart(scriptName: string): Promise<string>; // Returns registry ID
  
  /**
   * Record successful completion of a seed
   */
  recordSuccess(
    registryId: string,
    stats: {
      recordsImported: number;
      recordsUpdated: number;
      recordsSkipped: number;
      executionTimeMs: number;
    }
  ): Promise<void>;
  
  /**
   * Record failure of a seed
   */
  recordFailure(
    registryId: string,
    error: Error,
    executionTimeMs: number
  ): Promise<void>;
  
  /**
   * Get execution history for a seed script
   */
  getHistory(scriptName: string): Promise<SeedExecution[]>;
  
  /**
   * Get all seed executions
   */
  getAllExecutions(): Promise<SeedExecution[]>;
}

interface SeedExecution {
  id: string;
  scriptName: string;
  executedAt: Date;
  status: 'running' | 'completed' | 'failed';
  recordsAffected: number;
  recordsImported: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errorMessage?: string;
  executionTimeMs: number;
}
```

### Batch Processor Interface

```typescript
interface BatchProcessor<T> {
  /**
   * Process records in batches
   */
  processBatch(
    records: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<BatchResult>
  ): Promise<ProcessingStats>;
}

interface BatchResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ record: any; error: Error }>;
}

interface ProcessingStats {
  totalRecords: number;
  totalImported: number;
  totalUpdated: number;
  totalSkipped: number;
  totalErrors: number;
  errors: Array<{ record: any; error: Error }>;
}
```

### Idempotent Upsert Interface

```typescript
interface IdempotentUpsert {
  /**
   * Upsert vehicle valuation record
   */
  upsertValuation(
    valuation: ValuationRecord
  ): Promise<UpsertResult>;
  
  /**
   * Upsert damage deduction record
   */
  upsertDeduction(
    deduction: DeductionRecord
  ): Promise<UpsertResult>;
}

interface UpsertResult {
  action: 'inserted' | 'updated' | 'skipped';
  recordId: string;
  error?: Error;
}

interface ValuationRecord {
  make: string;
  model: string;
  year: number;
  conditionCategory: string;
  lowPrice: number;
  highPrice: number;
  averagePrice: number;
  dataSource: string;
}

interface DeductionRecord {
  make: string;
  component: string;
  damageLevel: 'minor' | 'moderate' | 'severe';
  repairCostLow: number;
  repairCostHigh: number;
  valuationDeductionLow: number;
  valuationDeductionHigh: number;
  notes?: string;
}
```

### Seed Script Template Structure

```typescript
/**
 * Seed Script Template
 * 
 * Usage:
 * 1. Copy this template to scripts/seeds/{make}/{make}-valuations.seed.ts
 * 2. Replace {MAKE} with actual make name
 * 3. Paste raw data into rawData array
 * 4. Run: tsx scripts/seeds/{make}/{make}-valuations.seed.ts
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { seedRegistryService } from '@/features/seeds/services/seed-registry.service';
import { batchProcessor } from '@/features/seeds/services/batch-processor.service';
import { idempotentUpsert } from '@/features/seeds/services/idempotent-upsert.service';
import { eq, and } from 'drizzle-orm';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
const SCRIPT_NAME = '{make}-valuations';
const BATCH_SIZE = 50;

// Raw data pasted from Word document
const rawData = [
  // Paste data here
];

// Transform raw data to database records
function transformToDbRecords(rawData: any[]): ValuationRecord[] {
  const records: ValuationRecord[] = [];
  
  for (const item of rawData) {
    // Add transformation logic here
    // Example: handle multiple condition categories per row
  }
  
  return records;
}

// Main execution function
async function executeSeed() {
  const startTime = Date.now();
  const scriptName = SCRIPT_NAME;
  
  console.log(`🌱 Starting seed: ${scriptName}`);
  console.log(`📊 Total records to process: ${rawData.length}\n`);
  
  // Check if already executed (unless --force flag)
  const forceRun = process.argv.includes('--force');
  const dryRun = process.argv.includes('--dry-run');
  
  if (!forceRun && !dryRun) {
    const hasRun = await seedRegistryService.hasBeenExecuted(scriptName);
    if (hasRun) {
      console.log('⏭️  Seed already executed. Use --force to re-run.');
      process.exit(0);
    }
  }
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  // Record start in registry
  let registryId: string | null = null;
  if (!dryRun) {
    registryId = await seedRegistryService.recordStart(scriptName);
  }
  
  try {
    // Transform data
    const records = transformToDbRecords(rawData);
    console.log(`✅ Transformed ${records.length} records\n`);
    
    // Process in batches
    const stats = await batchProcessor.processBatch(
      records,
      BATCH_SIZE,
      async (batch) => {
        const result: BatchResult = {
          imported: 0,
          updated: 0,
          skipped: 0,
          errors: [],
        };
        
        for (const record of batch) {
          try {
            if (dryRun) {
              console.log(`[DRY RUN] Would upsert: ${record.year} ${record.make} ${record.model}`);
              result.imported++;
            } else {
              const upsertResult = await idempotentUpsert.upsertValuation(record);
              if (upsertResult.action === 'inserted') result.imported++;
              if (upsertResult.action === 'updated') result.updated++;
              if (upsertResult.action === 'skipped') result.skipped++;
            }
          } catch (error) {
            result.errors.push({ record, error: error as Error });
            result.skipped++;
          }
        }
        
        return result;
      }
    );
    
    const executionTime = Date.now() - startTime;
    
    // Record success
    if (!dryRun && registryId) {
      await seedRegistryService.recordSuccess(registryId, {
        recordsImported: stats.totalImported,
        recordsUpdated: stats.totalUpdated,
        recordsSkipped: stats.totalSkipped,
        executionTimeMs: executionTime,
      });
    }
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📈 SEED EXECUTION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Script: ${scriptName}`);
    console.log(`Total Records: ${stats.totalRecords}`);
    console.log(`✅ Imported: ${stats.totalImported}`);
    console.log(`🔄 Updated: ${stats.totalUpdated}`);
    console.log(`⏭️  Skipped: ${stats.totalSkipped}`);
    console.log(`❌ Errors: ${stats.totalErrors}`);
    console.log(`⏱️  Execution Time: ${(executionTime / 1000).toFixed(2)}s`);
    console.log('='.repeat(50) + '\n');
    
    if (stats.errors.length > 0) {
      console.log('❌ Errors encountered:');
      stats.errors.forEach(({ record, error }) => {
        console.log(`  - ${record.year} ${record.make} ${record.model}: ${error.message}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    if (!dryRun && registryId) {
      await seedRegistryService.recordFailure(
        registryId,
        error as Error,
        executionTime
      );
    }
    
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  }
}

// Execute seed
executeSeed();
```

### Master Seed Runner

```typescript
/**
 * Master Seed Runner
 * Executes all seed scripts in deterministic order
 * 
 * Usage:
 * tsx scripts/seeds/run-all-seeds.ts [--force] [--dry-run]
 */

import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

interface SeedScript {
  path: string;
  make: string;
  type: 'valuations' | 'damage-deductions';
}

async function discoverSeeds(): Promise<SeedScript[]> {
  const seedFiles = await glob('scripts/seeds/**/*.seed.ts', {
    ignore: ['scripts/seeds/_template/**'],
  });
  
  return seedFiles
    .map(filePath => {
      const parts = filePath.split('/');
      const make = parts[parts.length - 2];
      const fileName = parts[parts.length - 1];
      const type = fileName.includes('valuations') ? 'valuations' : 'damage-deductions';
      
      return { path: filePath, make, type };
    })
    .sort((a, b) => {
      // Sort by make, then valuations before deductions
      if (a.make !== b.make) return a.make.localeCompare(b.make);
      return a.type === 'valuations' ? -1 : 1;
    });
}

async function runSeed(seed: SeedScript, flags: string[]): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🌱 Running: ${seed.make} - ${seed.type}`);
  console.log(`${'='.repeat(60)}\n`);
  
  const command = `tsx ${seed.path} ${flags.join(' ')}`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    console.error(`❌ Failed to run ${seed.path}:`, error);
    throw error;
  }
}

async function runAllSeeds() {
  const startTime = Date.now();
  const flags = process.argv.slice(2);
  
  console.log('🚀 Master Seed Runner');
  console.log(`Flags: ${flags.join(' ') || 'none'}\n`);
  
  const seeds = await discoverSeeds();
  console.log(`📋 Discovered ${seeds.length} seed scripts\n`);
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const seed of seeds) {
    try {
      await runSeed(seed, flags);
      successCount++;
    } catch (error) {
      failureCount++;
      console.error(`❌ Seed failed: ${seed.path}`);
      
      // Continue with other seeds unless --fail-fast flag
      if (flags.includes('--fail-fast')) {
        throw error;
      }
    }
  }
  
  const executionTime = Date.now() - startTime;
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 MASTER SEED RUNNER SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Seeds: ${seeds.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`⏱️  Total Time: ${(executionTime / 1000).toFixed(2)}s`);
  console.log('='.repeat(60) + '\n');
  
  process.exit(failureCount > 0 ? 1 : 0);
}

runAllSeeds();
```

## Data Models

### Seed Registry Data Model

```typescript
type SeedStatus = 'running' | 'completed' | 'failed';

interface SeedRegistryRecord {
  id: string;
  scriptName: string;
  executedAt: Date;
  status: SeedStatus;
  recordsAffected: number;
  recordsImported: number;
  recordsUpdated: number;
  recordsSkipped: number;
  errorMessage?: string;
  executionTimeMs: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Valuation Seed Data Model

```typescript
interface RawValuationData {
  make: string;
  model: string;
  year: number;
  // Condition-specific pricing
  nigUsedLow?: number;
  nigUsedHigh?: number;
  avgUsed?: number;
  tokunboLow?: number;
  tokunboHigh?: number;
  avgTokunbo?: number;
  // Optional fields
  mileageLow?: number;
  mileageHigh?: number;
  marketNotes?: string;
}

interface TransformedValuationRecord {
  make: string;
  model: string;
  year: number;
  conditionCategory: string; // 'nig_used_low' | 'tokunbo_low' | etc.
  lowPrice: number;
  highPrice: number;
  averagePrice: number;
  dataSource: string;
  mileageLow?: number;
  mileageHigh?: number;
  marketNotes?: string;
}
```

### Deduction Seed Data Model

```typescript
interface RawDeductionData {
  make: string;
  component: string;
  damageLevel: 'minor' | 'moderate' | 'severe';
  repairCostLow: number;
  repairCostHigh: number;
  valuationDeductionLow: number;
  valuationDeductionHigh: number;
  notes?: string;
}

interface TransformedDeductionRecord {
  make: string;
  component: string;
  damageLevel: 'minor' | 'moderate' | 'severe';
  repairCostLow: number;
  repairCostHigh: number;
  valuationDeductionLow: number;
  valuationDeductionHigh: number;
  notes?: string;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies:
- Properties 2.1, 2.2, and 2.3 all relate to idempotence - combined into Property 1
- Properties 2.4 and 2.5 both test unique constraint enforcement - combined into Property 2
- Properties 8.3 and 12.1 both test required field validation - combined into Property 3
- Properties 12.2 and 12.3 both test range validation - combined into Property 4
- Properties 11.2, 11.3, and 11.4 all test registry tracking - combined into Property 6

### Property 1: Idempotent Seed Execution

*For any* seed script and any dataset, executing the seed N times (where N ≥ 1) SHALL produce the exact same database state as executing it once, with existing records being updated rather than duplicated.

**Validates: Requirements 2.1, 2.2, 2.3, 2.6**

### Property 2: Unique Constraint Enforcement

*For any* seed record, the system SHALL enforce unique constraints (make, model, year, conditionCategory) for valuations and (make, component, damageLevel) for deductions, preventing duplicate records with identical constraint values.

**Validates: Requirements 2.4, 2.5**

### Property 3: Required Field Validation

*For any* seed record (valuation or deduction), if any required field is missing or null, the system SHALL reject the record with a validation error and skip insertion.

**Validates: Requirements 8.3, 12.1**

### Property 4: Range Validation

*For any* valuation record, lowPrice ≤ averagePrice ≤ highPrice SHALL hold, and *for any* deduction record, repairCostLow ≤ repairCostHigh SHALL hold, otherwise the record SHALL be rejected with a validation error.

**Validates: Requirements 12.2, 12.3**

### Property 5: Error Isolation

*For any* seed execution with multiple records, if record N fails with an error, records N+1 through end SHALL still be processed, and the failure SHALL NOT cause a rollback of successfully processed records 1 through N-1.

**Validates: Requirements 3.1, 3.5**

### Property 6: Registry Tracking Completeness

*For any* seed script execution, the system SHALL create a registry entry with status 'running' at start, and SHALL update it to either 'completed' (with record counts) or 'failed' (with error message) at end, ensuring every execution is tracked.

**Validates: Requirements 5.3, 11.2, 11.3, 11.4**

### Property 7: Registry-Based Skip Logic

*For any* seed script that has a 'completed' status in the registry, subsequent executions SHALL skip the seed unless the --force flag is provided.

**Validates: Requirements 5.4**

### Property 8: CreatedAt Preservation

*For any* existing record being updated by a seed, the original createdAt timestamp SHALL be preserved unchanged, while updatedAt SHALL be set to the current timestamp.

**Validates: Requirements 9.2**

### Property 9: Audit Log Completeness

*For any* data modification (insert or update) performed by a seed, an entry SHALL be created in valuation_audit_logs with the action type, entity details, and System User reference.

**Validates: Requirements 9.3**

### Property 10: System User Attribution

*For any* record created by a seed script, the createdBy field SHALL reference the System User ID (00000000-0000-0000-0000-000000000001).

**Validates: Requirements 8.5**

### Property 11: Numeric to Decimal Conversion

*For any* numeric value (prices, costs, deductions) in seed data, the system SHALL convert it to a decimal string format with appropriate precision before database insertion.

**Validates: Requirements 8.4**

### Property 12: Validation Error Handling

*For any* record that fails validation, the system SHALL log the specific validation error, skip that record, and continue processing remaining records without throwing an exception.

**Validates: Requirements 12.4**

### Property 13: Dry-Run Non-Modification

*For any* seed execution with --dry-run flag, the system SHALL validate all records and report intended actions WITHOUT making any database modifications or registry updates.

**Validates: Requirements 14.2**

### Property 14: Data Equivalence After Migration

*For any* existing make (Mercedes, Toyota, Nissan, Hyundai, Kia, Lexus, Audi), the converted seed script SHALL produce database records that are equivalent in content to the original import script.

**Validates: Requirements 6.6**

## Error Handling

### Error Categories

**Validation Errors**
- Missing required fields
- Invalid data types
- Range constraint violations (lowPrice > highPrice)
- Invalid enum values (damageLevel not in ['minor', 'moderate', 'severe'])

**Database Errors**
- Connection failures
- Unique constraint violations (should not occur with proper upsert logic)
- Foreign key violations (System User not found)
- Transaction deadlocks

**System Errors**
- Out of memory (large datasets)
- File system errors (cannot read seed script)
- Network timeouts (database connection)

### Error Handling Strategies

**Record-Level Errors**
```typescript
try {
  await upsertRecord(record);
  successCount++;
} catch (error) {
  console.error(`Failed to process record:`, record, error);
  errorLog.push({ record, error });
  errorCount++;
  // Continue processing next record
}
```

**Batch-Level Errors**
```typescript
try {
  const batchResult = await processBatch(batch);
  aggregateResults(batchResult);
} catch (error) {
  console.error(`Batch processing failed:`, error);
  // Fall back to individual record processing
  for (const record of batch) {
    await processIndividualRecord(record);
  }
}
```

**Fatal Errors**
```typescript
try {
  await db.connect();
} catch (error) {
  console.error('❌ FATAL: Cannot connect to database');
  console.error(error);
  process.exit(1);
}
```

### Error Recovery

**Partial Failure Recovery**
- Seed scripts continue processing after individual record failures
- Summary report shows which records failed and why
- Failed records can be fixed and re-run with --force flag

**Registry Cleanup**
- If seed crashes mid-execution, registry entry remains in 'running' status
- Next execution detects stale 'running' entries (> 1 hour old) and marks them as 'failed'
- Provides --cleanup flag to reset stale registry entries

**Validation Error Reporting**
```typescript
interface ValidationError {
  record: any;
  field: string;
  constraint: string;
  message: string;
}

// Example validation errors
{
  record: { make: 'Toyota', model: 'Camry', year: 2020 },
  field: 'lowPrice',
  constraint: 'required',
  message: 'lowPrice is required but was undefined'
}

{
  record: { make: 'Toyota', model: 'Camry', lowPrice: 5000000, highPrice: 3000000 },
  field: 'lowPrice',
  constraint: 'range',
  message: 'lowPrice (5000000) must be <= highPrice (3000000)'
}
```

## Testing Strategy

### Dual Testing Approach

The seed system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of data transformation
- Edge cases (empty datasets, single record, malformed data)
- Error conditions (database connection failure, validation errors)
- Integration points (registry service, audit logger)

**Property-Based Tests** focus on:
- Universal properties that hold for all inputs
- Idempotence across random datasets
- Validation rules across generated data
- Registry tracking across multiple executions

Together, unit tests catch concrete bugs while property tests verify general correctness.

### Property-Based Testing Configuration

**Library Selection**: Use `fast-check` for TypeScript property-based testing

**Test Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: enterprise-data-seeding-system, Property {number}: {property_text}`
- Generators for random vehicle data, damage deductions, and seed execution scenarios

**Example Property Test**:
```typescript
import fc from 'fast-check';

/**
 * Feature: enterprise-data-seeding-system, Property 1: Idempotent Seed Execution
 * 
 * For any seed script and any dataset, executing the seed N times (where N ≥ 1)
 * SHALL produce the exact same database state as executing it once
 */
test('Property 1: Idempotent seed execution', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(valuationRecordGenerator(), { minLength: 1, maxLength: 100 }),
      fc.integer({ min: 2, max: 5 }),
      async (records, executionCount) => {
        // Setup: Clear test database
        await clearTestDatabase();
        
        // Execute seed once
        await executeSeed(records);
        const stateAfterOne = await getDatabaseState();
        
        // Execute seed N more times
        for (let i = 0; i < executionCount - 1; i++) {
          await executeSeed(records);
        }
        const stateAfterN = await getDatabaseState();
        
        // Assert: Database state is identical
        expect(stateAfterN).toEqual(stateAfterOne);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Test Examples

**Data Transformation Tests**
```typescript
describe('Data Transformation', () => {
  test('transforms raw valuation data to database records', () => {
    const rawData = [
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        nigUsedLow: 3000000,
        nigUsedHigh: 5000000,
        avgUsed: 4000000,
      },
    ];
    
    const transformed = transformToDbRecords(rawData);
    
    expect(transformed).toHaveLength(1);
    expect(transformed[0]).toMatchObject({
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      conditionCategory: 'nig_used_low',
      lowPrice: 3000000,
      highPrice: 5000000,
      averagePrice: 4000000,
    });
  });
  
  test('handles multiple condition categories per row', () => {
    const rawData = [
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        nigUsedLow: 3000000,
        nigUsedHigh: 5000000,
        avgUsed: 4000000,
        tokunboLow: 8000000,
        tokunboHigh: 12000000,
        avgTokunbo: 10000000,
      },
    ];
    
    const transformed = transformToDbRecords(rawData);
    
    expect(transformed).toHaveLength(2);
    expect(transformed[0].conditionCategory).toBe('nig_used_low');
    expect(transformed[1].conditionCategory).toBe('tokunbo_low');
  });
});
```

**Validation Tests**
```typescript
describe('Validation', () => {
  test('rejects valuation with missing required fields', async () => {
    const invalidRecord = {
      make: 'Toyota',
      model: 'Camry',
      // year is missing
      conditionCategory: 'nig_used_low',
      lowPrice: 3000000,
      highPrice: 5000000,
      averagePrice: 4000000,
    };
    
    const result = await validateValuationRecord(invalidRecord);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: 'year',
      constraint: 'required',
      message: expect.stringContaining('required'),
    });
  });
  
  test('rejects valuation with invalid price range', async () => {
    const invalidRecord = {
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      conditionCategory: 'nig_used_low',
      lowPrice: 5000000,
      highPrice: 3000000, // highPrice < lowPrice
      averagePrice: 4000000,
    };
    
    const result = await validateValuationRecord(invalidRecord);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      field: 'lowPrice',
      constraint: 'range',
      message: expect.stringContaining('lowPrice must be <= highPrice'),
    });
  });
});
```

**Registry Tests**
```typescript
describe('Seed Registry', () => {
  test('records seed execution start', async () => {
    const scriptName = 'toyota-valuations';
    
    const registryId = await seedRegistryService.recordStart(scriptName);
    
    const entry = await seedRegistryService.getById(registryId);
    expect(entry.scriptName).toBe(scriptName);
    expect(entry.status).toBe('running');
    expect(entry.executedAt).toBeInstanceOf(Date);
  });
  
  test('updates registry on successful completion', async () => {
    const scriptName = 'toyota-valuations';
    const registryId = await seedRegistryService.recordStart(scriptName);
    
    await seedRegistryService.recordSuccess(registryId, {
      recordsImported: 50,
      recordsUpdated: 25,
      recordsSkipped: 5,
      executionTimeMs: 1500,
    });
    
    const entry = await seedRegistryService.getById(registryId);
    expect(entry.status).toBe('completed');
    expect(entry.recordsImported).toBe(50);
    expect(entry.recordsUpdated).toBe(25);
    expect(entry.recordsSkipped).toBe(5);
  });
  
  test('skips seed if already executed', async () => {
    const scriptName = 'toyota-valuations';
    
    // First execution
    await executeSeed(scriptName, []);
    
    // Second execution should skip
    const hasRun = await seedRegistryService.hasBeenExecuted(scriptName);
    expect(hasRun).toBe(true);
  });
});
```

**Integration Tests**
```typescript
describe('Seed Execution Integration', () => {
  test('executes complete seed workflow', async () => {
    const seedData = [
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        nigUsedLow: 3000000,
        nigUsedHigh: 5000000,
        avgUsed: 4000000,
      },
    ];
    
    // Execute seed
    const result = await executeSeed('toyota-valuations', seedData);
    
    // Verify database state
    const records = await db.select().from(vehicleValuations);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      make: 'Toyota',
      model: 'Camry',
      year: 2020,
      conditionCategory: 'nig_used_low',
    });
    
    // Verify registry
    const registryEntry = await seedRegistryService.getHistory('toyota-valuations');
    expect(registryEntry[0].status).toBe('completed');
    expect(registryEntry[0].recordsImported).toBe(1);
    
    // Verify audit log
    const auditLogs = await db.select().from(valuationAuditLogs);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].action).toBe('create');
  });
  
  test('handles partial failures gracefully', async () => {
    const seedData = [
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        nigUsedLow: 3000000,
        nigUsedHigh: 5000000,
        avgUsed: 4000000,
      },
      {
        make: 'Toyota',
        model: 'Corolla',
        // year is missing - should fail validation
        nigUsedLow: 2000000,
        nigUsedHigh: 3500000,
        avgUsed: 2750000,
      },
      {
        make: 'Toyota',
        model: 'RAV4',
        year: 2021,
        nigUsedLow: 4000000,
        nigUsedHigh: 6000000,
        avgUsed: 5000000,
      },
    ];
    
    const result = await executeSeed('toyota-valuations', seedData);
    
    // Verify partial success
    expect(result.recordsImported).toBe(2);
    expect(result.recordsSkipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    
    // Verify database contains successful records
    const records = await db.select().from(vehicleValuations);
    expect(records).toHaveLength(2);
    expect(records.map(r => r.model)).toContain('Camry');
    expect(records.map(r => r.model)).toContain('RAV4');
    expect(records.map(r => r.model)).not.toContain('Corolla');
  });
});
```

### Test Database Setup

```typescript
// tests/setup/test-database.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

export async function setupTestDatabase() {
  const connectionString = process.env.TEST_DATABASE_URL!;
  const client = postgres(connectionString);
  const db = drizzle(client);
  
  // Run migrations
  await migrate(db, { migrationsFolder: './src/lib/db/migrations' });
  
  // Create System User
  await db.insert(users).values({
    id: '00000000-0000-0000-0000-000000000001',
    email: 'system@salvage.com',
    role: 'system',
  });
  
  return { db, client };
}

export async function clearTestDatabase(db: any) {
  await db.delete(vehicleValuations);
  await db.delete(damageDeductions);
  await db.delete(seedRegistry);
  await db.delete(valuationAuditLogs);
}
```

### Performance Testing

```typescript
describe('Performance', () => {
  test('processes 1000 records in under 60 seconds', async () => {
    const seedData = generateRandomValuations(1000);
    
    const startTime = Date.now();
    await executeSeed('performance-test', seedData);
    const executionTime = Date.now() - startTime;
    
    expect(executionTime).toBeLessThan(60000); // 60 seconds
  }, 70000); // Test timeout: 70 seconds
  
  test('uses batch operations for large datasets', async () => {
    const seedData = generateRandomValuations(150);
    
    const batchSpy = jest.spyOn(batchProcessor, 'processBatch');
    await executeSeed('batch-test', seedData);
    
    expect(batchSpy).toHaveBeenCalled();
    // Verify batches of 50
    expect(batchSpy.mock.calls[0][1]).toBe(50);
  });
});
```


## Folder Organization Structure

```
scripts/
└── seeds/
    ├── README.md                          # Comprehensive documentation
    ├── run-all-seeds.ts                   # Master seed runner
    ├── _template/                         # Seed script templates
    │   ├── make-valuations.seed.ts
    │   └── make-damage-deductions.seed.ts
    ├── audi/
    │   ├── audi-valuations.seed.ts
    │   └── audi-damage-deductions.seed.ts
    ├── hyundai/
    │   ├── hyundai-valuations.seed.ts
    │   └── hyundai-damage-deductions.seed.ts
    ├── kia/
    │   ├── kia-valuations.seed.ts
    │   └── kia-damage-deductions.seed.ts
    ├── lexus/
    │   ├── lexus-valuations.seed.ts
    │   └── lexus-damage-deductions.seed.ts
    ├── mercedes/
    │   ├── mercedes-valuations.seed.ts
    │   └── mercedes-damage-deductions.seed.ts
    ├── nissan/
    │   ├── nissan-valuations.seed.ts
    │   └── nissan-damage-deductions.seed.ts
    └── toyota/
        ├── toyota-valuations.seed.ts
        └── toyota-damage-deductions.seed.ts
```

### File Naming Conventions

- Seed scripts: `{make}-{type}.seed.ts`
  - Example: `toyota-valuations.seed.ts`
  - Example: `mercedes-damage-deductions.seed.ts`
- Make folders: lowercase, no spaces
  - Example: `toyota/`, `mercedes/`, `land-rover/`
- Template files: Same naming pattern in `_template/` folder

### README.md Structure

```markdown
# Vehicle Data Seeding System

## Overview
Enterprise-grade data seeding system for vehicle valuations and damage deductions.

## Quick Start

### Running Existing Seeds
```bash
# Run all seeds
tsx scripts/seeds/run-all-seeds.ts

# Run specific make
tsx scripts/seeds/toyota/toyota-valuations.seed.ts

# Force re-run
tsx scripts/seeds/toyota/toyota-valuations.seed.ts --force

# Dry run (no changes)
tsx scripts/seeds/toyota/toyota-valuations.seed.ts --dry-run
```

### Adding New Vehicle Make

1. Create make folder: `scripts/seeds/bmw/`
2. Copy templates from `_template/`
3. Rename files: `bmw-valuations.seed.ts`, `bmw-damage-deductions.seed.ts`
4. Paste raw data into `rawData` array
5. Update transformation logic if needed
6. Test with --dry-run flag
7. Run seed script

## Data Format

### Valuation Data Format
```typescript
{
  make: 'Toyota',
  model: 'Camry',
  year: 2020,
  nigUsedLow: 3000000,
  nigUsedHigh: 5000000,
  avgUsed: 4000000,
  tokunboLow: 8000000,
  tokunboHigh: 12000000,
  avgTokunbo: 10000000,
}
```

### Deduction Data Format
```typescript
{
  make: 'Toyota',
  component: 'Front Bumper',
  damageLevel: 'minor',
  repairCostLow: 50000,
  repairCostHigh: 100000,
  valuationDeductionLow: 75000,
  valuationDeductionHigh: 150000,
  notes: 'Paint and minor dent repair',
}
```

## Architecture

- **Idempotent**: Safe to run multiple times
- **Batch Processing**: 50 records per batch
- **Error Isolation**: One failure doesn't stop others
- **Registry Tracking**: Automatic skip of completed seeds
- **Audit Logging**: All changes tracked

## Troubleshooting

### Seed Already Executed
Use `--force` flag to re-run

### Validation Errors
Check console output for specific field errors

### Database Connection Failed
Verify DATABASE_URL in .env file

### Stale Registry Entries
Run with `--cleanup` flag to reset
```

## Deployment Integration

### Database Migration Hook

```typescript
// src/lib/db/migrations/run-seeds-after-migration.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Post-migration hook to run seeds on fresh deployments
 * Called automatically after database schema is created
 */
export async function runSeedsAfterMigration() {
  console.log('🌱 Running seed scripts after migration...');
  
  try {
    const { stdout, stderr } = await execAsync(
      'tsx scripts/seeds/run-all-seeds.ts'
    );
    
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    
    console.log('✅ Seeds completed successfully');
  } catch (error) {
    console.error('❌ Seed execution failed:', error);
    // Don't fail deployment if seeds fail
    // Seeds can be run manually later
  }
}
```

### Vercel Deployment Hook

```json
// vercel.json
{
  "buildCommand": "npm run build && npm run db:migrate && npm run db:seed",
  "scripts": {
    "db:migrate": "drizzle-kit push:pg",
    "db:seed": "tsx scripts/seeds/run-all-seeds.ts"
  }
}
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Run migrations and seeds on container start
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm start"]
```

### Environment Variables

```bash
# .env
DATABASE_URL=postgresql://user:password@host:5432/database
SYSTEM_USER_ID=00000000-0000-0000-0000-000000000001

# Optional: Skip seeds on deployment
SKIP_SEEDS=false

# Optional: Force re-run seeds
FORCE_SEEDS=false
```

## Service Implementation Details

### Seed Registry Service

```typescript
// src/features/seeds/services/seed-registry.service.ts
import { db } from '@/lib/db/drizzle';
import { seedRegistry } from '@/lib/db/schema/seed-registry';
import { eq, and, lt } from 'drizzle-orm';

export class SeedRegistryService {
  async hasBeenExecuted(scriptName: string): Promise<boolean> {
    const entries = await db
      .select()
      .from(seedRegistry)
      .where(
        and(
          eq(seedRegistry.scriptName, scriptName),
          eq(seedRegistry.status, 'completed')
        )
      )
      .limit(1);
    
    return entries.length > 0;
  }
  
  async recordStart(scriptName: string): Promise<string> {
    const [entry] = await db
      .insert(seedRegistry)
      .values({
        scriptName,
        status: 'running',
        executedAt: new Date(),
      })
      .returning();
    
    return entry.id;
  }
  
  async recordSuccess(
    registryId: string,
    stats: {
      recordsImported: number;
      recordsUpdated: number;
      recordsSkipped: number;
      executionTimeMs: number;
    }
  ): Promise<void> {
    await db
      .update(seedRegistry)
      .set({
        status: 'completed',
        recordsImported: stats.recordsImported,
        recordsUpdated: stats.recordsUpdated,
        recordsSkipped: stats.recordsSkipped,
        recordsAffected: stats.recordsImported + stats.recordsUpdated,
        executionTimeMs: stats.executionTimeMs,
        updatedAt: new Date(),
      })
      .where(eq(seedRegistry.id, registryId));
  }
  
  async recordFailure(
    registryId: string,
    error: Error,
    executionTimeMs: number
  ): Promise<void> {
    await db
      .update(seedRegistry)
      .set({
        status: 'failed',
        errorMessage: error.message,
        executionTimeMs,
        updatedAt: new Date(),
      })
      .where(eq(seedRegistry.id, registryId));
  }
  
  async getHistory(scriptName: string): Promise<SeedExecution[]> {
    return await db
      .select()
      .from(seedRegistry)
      .where(eq(seedRegistry.scriptName, scriptName))
      .orderBy(seedRegistry.executedAt);
  }
  
  async getAllExecutions(): Promise<SeedExecution[]> {
    return await db
      .select()
      .from(seedRegistry)
      .orderBy(seedRegistry.executedAt);
  }
  
  async cleanupStaleEntries(): Promise<number> {
    // Mark entries as failed if running for > 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const result = await db
      .update(seedRegistry)
      .set({
        status: 'failed',
        errorMessage: 'Execution timed out or crashed',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(seedRegistry.status, 'running'),
          lt(seedRegistry.executedAt, oneHourAgo)
        )
      );
    
    return result.rowCount || 0;
  }
}

export const seedRegistryService = new SeedRegistryService();
```

### Batch Processor Service

```typescript
// src/features/seeds/services/batch-processor.service.ts
export class BatchProcessor<T> {
  async processBatch(
    records: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<BatchResult>
  ): Promise<ProcessingStats> {
    const stats: ProcessingStats = {
      totalRecords: records.length,
      totalImported: 0,
      totalUpdated: 0,
      totalSkipped: 0,
      totalErrors: 0,
      errors: [],
    };
    
    // Process in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(records.length / batchSize);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
      
      try {
        const batchResult = await processor(batch);
        
        stats.totalImported += batchResult.imported;
        stats.totalUpdated += batchResult.updated;
        stats.totalSkipped += batchResult.skipped;
        stats.totalErrors += batchResult.errors.length;
        stats.errors.push(...batchResult.errors);
        
        console.log(`  ✅ Imported: ${batchResult.imported}, Updated: ${batchResult.updated}, Skipped: ${batchResult.skipped}`);
      } catch (error) {
        console.error(`  ❌ Batch ${batchNumber} failed:`, error);
        
        // Fall back to individual processing for this batch
        console.log(`  🔄 Retrying batch ${batchNumber} with individual record processing...`);
        
        for (const record of batch) {
          try {
            const individualResult = await processor([record]);
            stats.totalImported += individualResult.imported;
            stats.totalUpdated += individualResult.updated;
            stats.totalSkipped += individualResult.skipped;
          } catch (recordError) {
            stats.totalErrors++;
            stats.totalSkipped++;
            stats.errors.push({
              record,
              error: recordError as Error,
            });
          }
        }
      }
    }
    
    return stats;
  }
}

export const batchProcessor = new BatchProcessor();
```

### Idempotent Upsert Service

```typescript
// src/features/seeds/services/idempotent-upsert.service.ts
import { db } from '@/lib/db/drizzle';
import { vehicleValuations, damageDeductions, valuationAuditLogs } from '@/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

export class IdempotentUpsertService {
  async upsertValuation(valuation: ValuationRecord): Promise<UpsertResult> {
    try {
      // Check if record exists
      const existing = await db
        .select()
        .from(vehicleValuations)
        .where(
          and(
            eq(vehicleValuations.make, valuation.make),
            eq(vehicleValuations.model, valuation.model),
            eq(vehicleValuations.year, valuation.year),
            eq(vehicleValuations.conditionCategory, valuation.conditionCategory)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing record
        const [updated] = await db
          .update(vehicleValuations)
          .set({
            lowPrice: valuation.lowPrice.toString(),
            highPrice: valuation.highPrice.toString(),
            averagePrice: valuation.averagePrice.toString(),
            dataSource: valuation.dataSource,
            updatedAt: new Date(),
            // Preserve createdAt and createdBy
          })
          .where(eq(vehicleValuations.id, existing[0].id))
          .returning();
        
        // Log audit entry
        await this.logAudit('update', 'valuation', updated.id, {
          lowPrice: { old: existing[0].lowPrice, new: valuation.lowPrice.toString() },
          highPrice: { old: existing[0].highPrice, new: valuation.highPrice.toString() },
          averagePrice: { old: existing[0].averagePrice, new: valuation.averagePrice.toString() },
        });
        
        return { action: 'updated', recordId: updated.id };
      } else {
        // Insert new record
        const [inserted] = await db
          .insert(vehicleValuations)
          .values({
            make: valuation.make,
            model: valuation.model,
            year: valuation.year,
            conditionCategory: valuation.conditionCategory,
            lowPrice: valuation.lowPrice.toString(),
            highPrice: valuation.highPrice.toString(),
            averagePrice: valuation.averagePrice.toString(),
            dataSource: valuation.dataSource,
            createdBy: SYSTEM_USER_ID,
          })
          .returning();
        
        // Log audit entry
        await this.logAudit('create', 'valuation', inserted.id, {});
        
        return { action: 'inserted', recordId: inserted.id };
      }
    } catch (error) {
      return {
        action: 'skipped',
        recordId: '',
        error: error as Error,
      };
    }
  }
  
  async upsertDeduction(deduction: DeductionRecord): Promise<UpsertResult> {
    try {
      // Check if record exists
      const existing = await db
        .select()
        .from(damageDeductions)
        .where(
          and(
            eq(damageDeductions.make, deduction.make),
            eq(damageDeductions.component, deduction.component),
            eq(damageDeductions.damageLevel, deduction.damageLevel)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing record
        const [updated] = await db
          .update(damageDeductions)
          .set({
            repairCostLow: deduction.repairCostLow.toString(),
            repairCostHigh: deduction.repairCostHigh.toString(),
            valuationDeductionLow: deduction.valuationDeductionLow.toString(),
            valuationDeductionHigh: deduction.valuationDeductionHigh.toString(),
            notes: deduction.notes,
            updatedAt: new Date(),
            // Preserve createdAt and createdBy
          })
          .where(eq(damageDeductions.id, existing[0].id))
          .returning();
        
        // Log audit entry
        await this.logAudit('update', 'deduction', updated.id, {
          repairCostLow: { old: existing[0].repairCostLow, new: deduction.repairCostLow.toString() },
          repairCostHigh: { old: existing[0].repairCostHigh, new: deduction.repairCostHigh.toString() },
        });
        
        return { action: 'updated', recordId: updated.id };
      } else {
        // Insert new record
        const [inserted] = await db
          .insert(damageDeductions)
          .values({
            make: deduction.make,
            component: deduction.component,
            damageLevel: deduction.damageLevel,
            repairCostLow: deduction.repairCostLow.toString(),
            repairCostHigh: deduction.repairCostHigh.toString(),
            valuationDeductionLow: deduction.valuationDeductionLow.toString(),
            valuationDeductionHigh: deduction.valuationDeductionHigh.toString(),
            notes: deduction.notes,
            createdBy: SYSTEM_USER_ID,
          })
          .returning();
        
        // Log audit entry
        await this.logAudit('create', 'deduction', inserted.id, {});
        
        return { action: 'inserted', recordId: inserted.id };
      }
    } catch (error) {
      return {
        action: 'skipped',
        recordId: '',
        error: error as Error,
      };
    }
  }
  
  private async logAudit(
    action: 'create' | 'update' | 'delete',
    entityType: 'valuation' | 'deduction',
    entityId: string,
    changedFields: Record<string, { old: any; new: any }>
  ): Promise<void> {
    await db.insert(valuationAuditLogs).values({
      action,
      entityType,
      entityId,
      changedFields,
      userId: SYSTEM_USER_ID,
    });
  }
}

export const idempotentUpsert = new IdempotentUpsertService();
```

### Validation Service

```typescript
// src/features/seeds/services/validation.service.ts
export class ValidationService {
  validateValuation(record: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Required fields
    if (!record.make) errors.push(this.requiredError('make'));
    if (!record.model) errors.push(this.requiredError('model'));
    if (!record.year) errors.push(this.requiredError('year'));
    if (!record.conditionCategory) errors.push(this.requiredError('conditionCategory'));
    if (record.lowPrice === undefined) errors.push(this.requiredError('lowPrice'));
    if (record.highPrice === undefined) errors.push(this.requiredError('highPrice'));
    if (record.averagePrice === undefined) errors.push(this.requiredError('averagePrice'));
    if (!record.dataSource) errors.push(this.requiredError('dataSource'));
    
    // Range validation
    if (record.lowPrice > record.highPrice) {
      errors.push({
        field: 'lowPrice',
        constraint: 'range',
        message: `lowPrice (${record.lowPrice}) must be <= highPrice (${record.highPrice})`,
      });
    }
    
    if (record.averagePrice < record.lowPrice || record.averagePrice > record.highPrice) {
      errors.push({
        field: 'averagePrice',
        constraint: 'range',
        message: `averagePrice (${record.averagePrice}) must be between lowPrice (${record.lowPrice}) and highPrice (${record.highPrice})`,
      });
    }
    
    // Type validation
    if (typeof record.year !== 'number' || record.year < 1900 || record.year > 2100) {
      errors.push({
        field: 'year',
        constraint: 'type',
        message: `year must be a number between 1900 and 2100, got ${record.year}`,
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  validateDeduction(record: any): ValidationResult {
    const errors: ValidationError[] = [];
    
    // Required fields
    if (!record.make) errors.push(this.requiredError('make'));
    if (!record.component) errors.push(this.requiredError('component'));
    if (!record.damageLevel) errors.push(this.requiredError('damageLevel'));
    if (record.repairCostLow === undefined) errors.push(this.requiredError('repairCostLow'));
    if (record.repairCostHigh === undefined) errors.push(this.requiredError('repairCostHigh'));
    if (record.valuationDeductionLow === undefined) errors.push(this.requiredError('valuationDeductionLow'));
    if (record.valuationDeductionHigh === undefined) errors.push(this.requiredError('valuationDeductionHigh'));
    
    // Enum validation
    if (!['minor', 'moderate', 'severe'].includes(record.damageLevel)) {
      errors.push({
        field: 'damageLevel',
        constraint: 'enum',
        message: `damageLevel must be one of: minor, moderate, severe. Got: ${record.damageLevel}`,
      });
    }
    
    // Range validation
    if (record.repairCostLow > record.repairCostHigh) {
      errors.push({
        field: 'repairCostLow',
        constraint: 'range',
        message: `repairCostLow (${record.repairCostLow}) must be <= repairCostHigh (${record.repairCostHigh})`,
      });
    }
    
    if (record.valuationDeductionLow > record.valuationDeductionHigh) {
      errors.push({
        field: 'valuationDeductionLow',
        constraint: 'range',
        message: `valuationDeductionLow (${record.valuationDeductionLow}) must be <= valuationDeductionHigh (${record.valuationDeductionHigh})`,
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  private requiredError(field: string): ValidationError {
    return {
      field,
      constraint: 'required',
      message: `${field} is required but was undefined or null`,
    };
  }
}

export const validationService = new ValidationService();
```

## Migration Script

```sql
-- src/lib/db/migrations/0008_add_seed_registry.sql
CREATE TABLE IF NOT EXISTS "seed_registry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "script_name" varchar(255) NOT NULL UNIQUE,
  "executed_at" timestamp NOT NULL DEFAULT now(),
  "status" varchar(20) NOT NULL,
  "records_affected" integer DEFAULT 0,
  "records_imported" integer DEFAULT 0,
  "records_updated" integer DEFAULT 0,
  "records_skipped" integer DEFAULT 0,
  "error_message" text,
  "execution_time_ms" integer,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_seed_registry_script_name" ON "seed_registry" ("script_name");
CREATE INDEX IF NOT EXISTS "idx_seed_registry_status" ON "seed_registry" ("status");
CREATE INDEX IF NOT EXISTS "idx_seed_registry_executed_at" ON "seed_registry" ("executed_at");
```

## Summary

This design provides a comprehensive enterprise-grade data seeding system that:

1. **Preserves User Workflow**: Maintains the familiar paste → script → run pattern
2. **Ensures Idempotence**: Safe to run multiple times without creating duplicates
3. **Provides Automation**: Auto-runs on fresh deployments via seed registry
4. **Organizes Systematically**: Clear folder structure by vehicle make
5. **Handles Errors Gracefully**: Continues processing after individual failures
6. **Tracks Execution**: Complete audit trail via seed registry
7. **Optimizes Performance**: Batch operations for large datasets
8. **Supports Testing**: Dry-run mode and comprehensive test coverage
9. **Facilitates Extension**: Easy to add new vehicle makes with templates
10. **Integrates Seamlessly**: Works with existing deployment pipelines

The system is production-ready, maintainable, and scalable for future growth.
