# Design Document: Vehicle Valuation Database System

## Overview

The Vehicle Valuation Database System provides a curated, structured database for vehicle pricing data in the Nigerian market. This system shifts the architecture from web-scraping-first to database-first, using scraped data only as a fallback mechanism. The system stores comprehensive vehicle valuation guides with year-by-year price ranges, mileage data, market intelligence, and damage deduction tables for accurate salvage pricing.

### Key Design Decisions

1. **Database-First Architecture**: Query the valuation database before attempting web scraping, reversing the current cache-first approach
2. **Hybrid Data Strategy**: Maintain both curated database and scraped cache, with clear precedence rules
3. **Structured Damage Deductions**: Replace heuristic-based damage calculations with data-driven deduction tables
4. **Bulk Import Support**: Enable efficient data population through CSV/JSON import rather than manual entry
5. **Backward Compatibility**: Maintain existing market data service interfaces while adding database layer

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Applications                      │
│  (AI Assessment Service, Market Data Service, Admin UI)     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Valuation Service Layer (New)                   │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ Valuation Query  │  │ Damage Calculation Service       │ │
│  │ Service          │  │                                  │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ Bulk Import      │  │ Admin Management Service         │ │
│  │ Service          │  │                                  │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Modified Market Data Service                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  1. Query Valuation DB → 2. Fallback to Scraping    │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ Valuation DB     │  │ Damage Deduction DB              │ │
│  │ (New)            │  │ (New)                            │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ Market Data      │  │ Audit Logs                       │ │
│  │ Cache (Existing) │  │ (Existing)                       │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Valuation Query Flow:**
```
1. Client requests vehicle price
2. Market Data Service queries Valuation DB
3. If found → Return database price (mark as "database" source)
4. If not found → Fallback to web scraping
5. If scraped → Cache in market_data_cache
6. Return result with source indicator
```

**Damage Calculation Flow:**
```
1. AI Assessment identifies damaged components
2. Damage Calculation Service queries base price from Valuation DB
3. For each damaged component:
   a. Query damage deduction table
   b. Apply deduction percentage
4. Calculate cumulative deductions (max 90%)
5. Return salvage value with breakdown
```

## Components and Interfaces

### 1. Database Schema

#### Vehicle Valuations Table

```typescript
export const vehicleValuations = pgTable('vehicle_valuations', {
  id: uuid('id').primaryKey().defaultRandom(),
  make: varchar('make', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  year: integer('year').notNull(),
  conditionCategory: varchar('condition_category', { length: 50 }).notNull(),
  
  // Price ranges in NGN
  lowPrice: decimal('low_price', { precision: 12, scale: 2 }).notNull(),
  highPrice: decimal('high_price', { precision: 12, scale: 2 }).notNull(),
  averagePrice: decimal('average_price', { precision: 12, scale: 2 }).notNull(),
  
  // Mileage ranges in kilometers
  mileageLow: integer('mileage_low'),
  mileageHigh: integer('mileage_high'),
  
  // Market intelligence
  marketNotes: text('market_notes'),
  dataSource: varchar('data_source', { length: 100 }).notNull(), // e.g., "Audi Guide 2024"
  
  // Metadata
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Composite unique constraint
  uniqueValuation: unique().on(table.make, table.model, table.year, table.conditionCategory),
  // Indexes for fast lookups
  makeModelIdx: index('idx_valuations_make_model').on(table.make, table.model),
  yearIdx: index('idx_valuations_year').on(table.year),
  makeModelYearIdx: index('idx_valuations_make_model_year').on(table.make, table.model, table.year),
}));
```

#### Damage Deductions Table

```typescript
export const damageDeductions = pgTable('damage_deductions', {
  id: uuid('id').primaryKey().defaultRandom(),
  component: varchar('component', { length: 100 }).notNull(),
  damageLevel: damageLevelEnum('damage_level').notNull(), // 'minor', 'moderate', 'severe'
  
  // Deduction data
  repairCostEstimate: decimal('repair_cost_estimate', { precision: 12, scale: 2 }).notNull(),
  valuationDeductionPercent: decimal('valuation_deduction_percent', { precision: 5, scale: 4 }).notNull(),
  
  // Metadata
  description: text('description'),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Composite unique constraint
  uniqueDeduction: unique().on(table.component, table.damageLevel),
  // Index for fast lookups
  componentIdx: index('idx_deductions_component').on(table.component),
}));

export const damageLevelEnum = pgEnum('damage_level', ['minor', 'moderate', 'severe']);
```

#### Valuation Audit Log Table

```typescript
export const valuationAuditLogs = pgTable('valuation_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: varchar('action', { length: 20 }).notNull(), // 'create', 'update', 'delete'
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'valuation', 'deduction'
  entityId: uuid('entity_id').notNull(),
  
  // Change tracking
  changedFields: jsonb('changed_fields').$type<Record<string, { old: any; new: any }>>(),
  
  // User tracking
  userId: uuid('user_id').notNull().references(() => users.id),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  entityIdx: index('idx_valuation_audit_entity').on(table.entityType, table.entityId),
  userIdx: index('idx_valuation_audit_user').on(table.userId),
  createdAtIdx: index('idx_valuation_audit_created').on(table.createdAt),
}));
```

### 2. Valuation Query Service

```typescript
interface ValuationQueryParams {
  make: string;
  model: string;
  year: number;
  conditionCategory?: string; // Optional filter
}

interface ValuationResult {
  found: boolean;
  valuation?: {
    lowPrice: number;
    highPrice: number;
    averagePrice: number;
    mileageLow?: number;
    mileageHigh?: number;
    marketNotes?: string;
    conditionCategory: string;
  };
  source: 'database' | 'not_found';
}

class ValuationQueryService {
  /**
   * Query vehicle valuation from database
   * Implements fuzzy year matching (±2 years) if exact match not found
   */
  async queryValuation(params: ValuationQueryParams): Promise<ValuationResult>;
  
  /**
   * Get all available years for a make/model
   */
  async getAvailableYears(make: string, model: string): Promise<number[]>;
  
  /**
   * Get all makes in database
   */
  async getAllMakes(): Promise<string[]>;
  
  /**
   * Get all models for a make
   */
  async getModelsForMake(make: string): Promise<string[]>;
}
```

### 3. Damage Calculation Service

```typescript
interface DamageInput {
  component: string;
  damageLevel: 'minor' | 'moderate' | 'severe';
}

interface DamageDeduction {
  component: string;
  damageLevel: string;
  repairCost: number;
  deductionPercent: number;
  deductionAmount: number;
}

interface SalvageCalculation {
  basePrice: number;
  totalDeductionPercent: number;
  totalDeductionAmount: number;
  salvageValue: number;
  deductions: DamageDeduction[];
  isTotalLoss: boolean;
  confidence: number;
}

class DamageCalculationService {
  /**
   * Calculate salvage value with damage deductions
   * Applies cumulative deductions up to 90% max
   */
  async calculateSalvageValue(
    basePrice: number,
    damages: DamageInput[]
  ): Promise<SalvageCalculation>;
  
  /**
   * Get damage deduction for a specific component and level
   * Returns default deduction if not found in database
   */
  async getDeduction(component: string, damageLevel: string): Promise<DamageDeduction>;
  
  /**
   * Apply salvage value guidelines (total loss rules, minimum values)
   */
  applySalvageGuidelines(
    basePrice: number,
    totalDeductionPercent: number,
    vehicleAge: number
  ): number;
}
```

### 4. Bulk Import Service

```typescript
interface ImportRecord {
  make: string;
  model: string;
  year: number;
  conditionCategory: string;
  lowPrice: number;
  highPrice: number;
  averagePrice: number;
  mileageLow?: number;
  mileageHigh?: number;
  marketNotes?: string;
}

interface ImportResult {
  totalRecords: number;
  successCount: number;
  updateCount: number;
  failureCount: number;
  errors: Array<{
    row: number;
    record: Partial<ImportRecord>;
    error: string;
  }>;
}

class BulkImportService {
  /**
   * Import vehicle valuations from CSV
   */
  async importFromCSV(
    fileContent: string,
    userId: string
  ): Promise<ImportResult>;
  
  /**
   * Import vehicle valuations from JSON
   */
  async importFromJSON(
    data: ImportRecord[],
    userId: string
  ): Promise<ImportResult>;
  
  /**
   * Validate import record
   */
  validateRecord(record: ImportRecord): { valid: boolean; errors: string[] };
  
  /**
   * Parse CSV content to records
   */
  parseCSV(content: string): ImportRecord[];
}
```

### 5. Modified Market Data Service

```typescript
// Modified getMarketPrice function
export async function getMarketPrice(
  property: PropertyIdentifier
): Promise<MarketPrice> {
  // NEW: Step 0 - Check valuation database first (for vehicles only)
  if (property.type === 'vehicle' && property.make && property.model && property.year) {
    const dbResult = await valuationQueryService.queryValuation({
      make: property.make,
      model: property.model,
      year: property.year,
    });
    
    if (dbResult.found && dbResult.valuation) {
      // Return database result without scraping
      await logDatabaseHit(property);
      
      return {
        median: dbResult.valuation.averagePrice,
        min: dbResult.valuation.lowPrice,
        max: dbResult.valuation.highPrice,
        count: 1,
        sources: [{
          source: 'valuation_database',
          price: dbResult.valuation.averagePrice,
          url: 'internal',
          title: `${property.make} ${property.model} ${property.year}`,
        }],
        confidence: 0.95, // High confidence for curated data
        isFresh: true,
        cacheAge: 0,
        dataSource: 'database', // NEW: Indicator for source
      };
    }
  }
  
  // Existing logic: Check cache, scrape, etc.
  // ... (rest of existing implementation)
}
```

### 6. Modified AI Assessment Service

```typescript
// Modified assessDamageEnhanced function
export async function assessDamageEnhanced(params: {
  photos: string[];
  vehicleInfo?: VehicleInfo;
  caseId?: string;
}): Promise<EnhancedDamageAssessment> {
  // ... existing damage detection logic ...
  
  // NEW: Get base price from valuation database
  let baseMarketValue = 0;
  let priceSource = 'estimated';
  
  if (params.vehicleInfo) {
    const dbResult = await valuationQueryService.queryValuation({
      make: params.vehicleInfo.make,
      model: params.vehicleInfo.model,
      year: params.vehicleInfo.year,
    });
    
    if (dbResult.found && dbResult.valuation) {
      baseMarketValue = dbResult.valuation.averagePrice;
      priceSource = 'database';
    } else {
      // Fallback to existing market data scraping
      const marketData = await getMarketValueWithScraping(params.vehicleInfo);
      baseMarketValue = marketData.value;
      priceSource = marketData.source;
    }
  }
  
  // NEW: Calculate damage-adjusted salvage value
  const damages: DamageInput[] = identifyDamagedComponents(damageScore);
  const salvageCalc = await damageCalculationService.calculateSalvageValue(
    baseMarketValue,
    damages
  );
  
  return {
    // ... existing fields ...
    marketValue: baseMarketValue,
    estimatedSalvageValue: salvageCalc.salvageValue,
    damageBreakdown: salvageCalc.deductions, // NEW: Detailed breakdown
    isTotalLoss: salvageCalc.isTotalLoss, // NEW: Total loss indicator
    priceSource, // NEW: Indicates if from database or scraping
  };
}
```

## Data Models

### TypeScript Interfaces

```typescript
// Valuation models
export interface VehicleValuation {
  id: string;
  make: string;
  model: string;
  year: number;
  conditionCategory: string;
  lowPrice: number;
  highPrice: number;
  averagePrice: number;
  mileageLow?: number;
  mileageHigh?: number;
  marketNotes?: string;
  dataSource: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DamageDeduction {
  id: string;
  component: string;
  damageLevel: 'minor' | 'moderate' | 'severe';
  repairCostEstimate: number;
  valuationDeductionPercent: number;
  description?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Calculation models
export interface SalvageCalculationResult {
  basePrice: number;
  deductions: Array<{
    component: string;
    damageLevel: string;
    repairCost: number;
    deductionPercent: number;
    deductionAmount: number;
  }>;
  totalDeductionPercent: number;
  totalDeductionAmount: number;
  salvageValue: number;
  isTotalLoss: boolean;
  confidence: number;
  appliedGuidelines: string[];
}

// Import models
export interface ValuationImportRecord {
  make: string;
  model: string;
  year: number;
  conditionCategory: string;
  lowPrice: number;
  highPrice: number;
  averagePrice: number;
  mileageLow?: number;
  mileageHigh?: number;
  marketNotes?: string;
}

export interface DamageDeductionImportRecord {
  component: string;
  damageLevel: 'minor' | 'moderate' | 'severe';
  repairCostEstimate: number;
  valuationDeductionPercent: number;
  description?: string;
}
```

### Validation Rules

```typescript
// Valuation validation
const valuationSchema = z.object({
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  conditionCategory: z.enum(['nig_used_low', 'nig_used_high', 'tokunbo_low', 'tokunbo_high', 'average']),
  lowPrice: z.number().positive(),
  highPrice: z.number().positive(),
  averagePrice: z.number().positive(),
  mileageLow: z.number().nonnegative().max(1000000).optional(),
  mileageHigh: z.number().nonnegative().max(1000000).optional(),
  marketNotes: z.string().max(5000).optional(),
}).refine(data => data.lowPrice <= data.highPrice, {
  message: "Low price must be less than or equal to high price",
}).refine(data => !data.mileageLow || !data.mileageHigh || data.mileageLow <= data.mileageHigh, {
  message: "Mileage low must be less than or equal to mileage high",
});

// Damage deduction validation
const deductionSchema = z.object({
  component: z.string().min(1).max(100),
  damageLevel: z.enum(['minor', 'moderate', 'severe']),
  repairCostEstimate: z.number().nonnegative(),
  valuationDeductionPercent: z.number().min(0).max(1),
  description: z.string().max(1000).optional(),
});
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Valuation Data Round-Trip Consistency

*For any* valid vehicle valuation record (with make, model, year, condition, prices, mileage, and notes), storing it in the database and then querying it back should return an equivalent record with all fields preserved.

**Validates: Requirements 1.1, 1.4, 1.5**

### Property 2: Damage Deduction Data Round-Trip Consistency

*For any* valid damage deduction record (with component, damage level, repair cost, and deduction percentage), storing it in the database and then querying it back should return an equivalent record with all fields preserved.

**Validates: Requirements 2.1**

### Property 3: Valuation Input Validation Correctness

*For any* valuation input, the validation should accept it if and only if: (1) low price ≤ high price, (2) year is between 1990 and current year + 1, (3) mileage values are non-negative and < 1,000,000, and (4) no duplicate exists for the same make/model/year/condition combination.

**Validates: Requirements 1.2, 9.1, 9.2, 9.3, 9.5, 9.6**

### Property 4: Damage Deduction Input Validation Correctness

*For any* damage deduction input, the validation should accept it if and only if: (1) damage level is one of 'minor', 'moderate', or 'severe', (2) deduction percentage is between 0 and 1, and (3) no duplicate exists for the same component/damage level combination.

**Validates: Requirements 2.2, 2.5, 9.4, 9.5, 9.6**

### Property 5: Query Filtering Completeness

*For any* set of stored valuations and any query parameters (make, model, year, condition), the query results should include all and only those valuations that match the specified parameters.

**Validates: Requirements 3.1, 3.2, 3.6**

### Property 6: Fuzzy Year Matching

*For any* make and model with stored valuations, when querying for a year that doesn't exist exactly, the system should return the valuation for the closest year within ±2 years, or null if no year is within that range.

**Validates: Requirements 3.3, 3.4**

### Property 7: Component Damage Deduction Organization

*For any* vehicle component with multiple damage deductions stored, querying for that component should return deductions ordered by damage level (minor < moderate < severe).

**Validates: Requirements 2.3, 2.6**

### Property 8: Cumulative Damage Deduction Calculation

*For any* base price and list of component damages, the total deduction should equal the sum of individual deductions, capped at 90% of the base price.

**Validates: Requirements 4.1, 4.2**

### Property 9: Highest Severity Deduplication

*For any* damage calculation where the same component appears multiple times with different damage levels, only the highest severity level should be used in the final calculation.

**Validates: Requirements 4.3**

### Property 10: Damage Calculation Completeness

*For any* damage calculation result, it should include both the adjusted salvage value and a detailed breakdown showing each component's deduction amount and percentage.

**Validates: Requirements 4.4, 6.3**

### Property 11: Default Deduction Fallback

*For any* component not found in the damage deduction table, the system should apply default deductions: 5% for minor, 15% for moderate, and 30% for severe damage.

**Validates: Requirements 4.5**

### Property 12: Non-Negative Salvage Value Invariant

*For any* base price and damage list, the calculated salvage value should always be greater than or equal to zero.

**Validates: Requirements 4.6**

### Property 13: Total Loss Classification

*For any* vehicle where total damage deductions exceed 70% of base value, the system should classify it as a total loss and cap the salvage value at 30% of base value.

**Validates: Requirements 10.1, 10.2**

### Property 14: Structural Damage Minimum Value

*For any* vehicle with structural damage, the salvage value should be at least 10% of the base value, regardless of other damage.

**Validates: Requirements 10.3**

### Property 15: Age-Based Depreciation

*For any* vehicle older than 10 years, the salvage calculation should apply additional depreciation beyond the standard damage deductions.

**Validates: Requirements 10.4**

### Property 16: Confidence Score Monotonicity

*For any* two salvage valuations, the one with more complete data (more fields populated, more recent data) should have a higher or equal confidence score.

**Validates: Requirements 10.5**

### Property 17: Bulk Import Upsert Behavior

*For any* import operation containing a record that matches an existing valuation (same make, model, year, condition), the existing record should be updated rather than creating a duplicate.

**Validates: Requirements 8.4**

### Property 18: Bulk Import Error Resilience

*For any* bulk import containing both valid and invalid records, the import should process all valid records successfully and report errors for invalid records without stopping the entire operation.

**Validates: Requirements 8.3, 8.5**

### Property 19: Bulk Import Format Support

*For any* valid valuation data, it should be importable in both CSV and JSON formats, producing equivalent results.

**Validates: Requirements 8.1, 8.2**

### Property 20: Data Update Immediate Visibility

*For any* valuation that is added or updated through the admin interface, querying for that valuation immediately afterward should return the updated data.

**Validates: Requirements 7.6**

### Property 21: Audit Log Completeness

*For any* create, update, or delete operation on valuation or deduction data, an audit log entry should be created containing the user ID, timestamp, action type, and changed fields.

**Validates: Requirements 12.1, 12.4**

### Property 22: Audit Log Chronological Ordering

*For any* set of audit log entries, querying them should return results in reverse chronological order (newest first).

**Validates: Requirements 12.2**

### Property 23: Audit Log Filtering Correctness

*For any* audit log query with filters (user, date range, action type), the results should include all and only those log entries matching the specified filters.

**Validates: Requirements 12.5**

## Error Handling

### Validation Errors

```typescript
class ValidationError extends Error {
  constructor(
    public field: string,
    public value: any,
    public constraint: string
  ) {
    super(`Validation failed for ${field}: ${constraint}`);
  }
}
```

**Error Scenarios:**
- Invalid price ranges (low > high)
- Out-of-range years
- Invalid mileage values
- Invalid damage levels
- Duplicate records
- Missing required fields

**Handling Strategy:**
- Return detailed error messages indicating which field failed and why
- For bulk imports, collect all validation errors and return them in the summary
- Log validation failures for monitoring
- Never partially save invalid data

### Database Errors

```typescript
class DatabaseError extends Error {
  constructor(
    public operation: string,
    public cause: Error
  ) {
    super(`Database operation failed: ${operation}`);
  }
}
```

**Error Scenarios:**
- Connection failures
- Query timeouts
- Constraint violations
- Transaction rollbacks

**Handling Strategy:**
- Retry transient errors (connection issues) up to 3 times
- Roll back transactions on any error
- Log all database errors with full context
- Return user-friendly error messages without exposing internal details

### Integration Errors

```typescript
class IntegrationError extends Error {
  constructor(
    public service: string,
    public operation: string,
    public cause?: Error
  ) {
    super(`Integration failed with ${service}: ${operation}`);
  }
}
```

**Error Scenarios:**
- Valuation database unavailable (fallback to scraping)
- Damage deduction table missing entries (use defaults)
- Audit logging failures (log but don't block operation)

**Handling Strategy:**
- Graceful degradation: use fallback mechanisms when database unavailable
- Never block critical operations due to audit logging failures
- Log all integration errors for monitoring
- Maintain backward compatibility with existing systems

### Import Errors

```typescript
interface ImportError {
  row: number;
  record: Partial<ImportRecord>;
  errors: string[];
}
```

**Error Scenarios:**
- Invalid file format
- Malformed CSV/JSON
- Validation failures in records
- Duplicate records within import file

**Handling Strategy:**
- Parse entire file before processing to catch format errors early
- Validate each record independently
- Continue processing valid records even when some fail
- Return comprehensive error report with row numbers and specific issues
- Provide import summary with counts of success/failure

## Testing Strategy

### Dual Testing Approach

The system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests:**
- Specific examples demonstrating correct behavior
- Edge cases (empty databases, boundary values, null handling)
- Error conditions (invalid inputs, database failures, constraint violations)
- Integration points between components
- Admin UI workflows

**Property-Based Tests:**
- Universal properties that hold for all inputs
- Comprehensive input coverage through randomization
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number

### Property-Based Testing Configuration

**Library Selection:**
- TypeScript/JavaScript: Use `fast-check` library
- Minimum 100 iterations per test (due to randomization)
- Each test must reference its design document property

**Tag Format:**
```typescript
// Feature: vehicle-valuation-database, Property 1: Valuation Data Round-Trip Consistency
test('valuation round-trip preserves all fields', async () => {
  await fc.assert(
    fc.asyncProperty(
      valuationArbitrary(),
      async (valuation) => {
        const stored = await valuationService.store(valuation);
        const retrieved = await valuationService.query({
          make: valuation.make,
          model: valuation.model,
          year: valuation.year,
          conditionCategory: valuation.conditionCategory,
        });
        expect(retrieved).toEqual(stored);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Test Coverage Requirements

**Unit Test Coverage:**
- Validation logic: Test all validation rules with valid and invalid inputs
- Query logic: Test exact matches, fuzzy matches, filtering, ordering
- Calculation logic: Test damage deductions, cumulative calculations, caps
- Import logic: Test CSV parsing, JSON parsing, upsert behavior, error handling
- Admin operations: Test CRUD operations, authorization, audit logging

**Property Test Coverage:**
- Data persistence: Round-trip properties for all data types
- Input validation: Validation correctness for all input types
- Query operations: Filtering, ordering, fuzzy matching
- Calculations: Damage deductions, salvage values, guidelines
- Bulk operations: Import behavior, error resilience
- Audit logging: Completeness, ordering, filtering

**Integration Test Coverage:**
- Market data service integration: Database-first query flow
- AI assessment service integration: Damage calculation with database data
- Admin interface: End-to-end workflows for data management
- Bulk import: End-to-end import workflows with real files

### Test Data Generation

**Generators for Property Tests:**

```typescript
// Valuation generator
const valuationArbitrary = () => fc.record({
  make: fc.stringOf(fc.char(), { minLength: 1, maxLength: 100 }),
  model: fc.stringOf(fc.char(), { minLength: 1, maxLength: 100 }),
  year: fc.integer({ min: 1990, max: new Date().getFullYear() + 1 }),
  conditionCategory: fc.constantFrom('nig_used_low', 'nig_used_high', 'tokunbo_low', 'tokunbo_high', 'average'),
  lowPrice: fc.float({ min: 100000, max: 50000000 }),
  highPrice: fc.float({ min: 100000, max: 50000000 }),
  averagePrice: fc.float({ min: 100000, max: 50000000 }),
  mileageLow: fc.option(fc.integer({ min: 0, max: 1000000 })),
  mileageHigh: fc.option(fc.integer({ min: 0, max: 1000000 })),
  marketNotes: fc.option(fc.string({ maxLength: 5000 })),
}).filter(v => v.lowPrice <= v.highPrice && v.lowPrice <= v.averagePrice && v.averagePrice <= v.highPrice);

// Damage deduction generator
const damageDeductionArbitrary = () => fc.record({
  component: fc.constantFrom('engine', 'transmission', 'body', 'interior', 'electrical', 'suspension'),
  damageLevel: fc.constantFrom('minor', 'moderate', 'severe'),
  repairCostEstimate: fc.float({ min: 0, max: 10000000 }),
  valuationDeductionPercent: fc.float({ min: 0, max: 1 }),
  description: fc.option(fc.string({ maxLength: 1000 })),
});

// Damage input generator
const damageInputArbitrary = () => fc.array(
  fc.record({
    component: fc.string({ minLength: 1, maxLength: 100 }),
    damageLevel: fc.constantFrom('minor', 'moderate', 'severe'),
  }),
  { minLength: 1, maxLength: 10 }
);
```

### Testing Workflow

1. **Development Phase:**
   - Write unit tests for specific examples and edge cases
   - Write property tests for universal properties
   - Run tests locally before committing

2. **CI/CD Pipeline:**
   - Run all unit tests (fast feedback)
   - Run all property tests with 100 iterations
   - Fail build if any test fails
   - Generate coverage reports

3. **Pre-Deployment:**
   - Run integration tests against staging database
   - Verify bulk import with sample data files
   - Test admin interface workflows
   - Verify market data service integration

4. **Post-Deployment:**
   - Monitor error rates and performance metrics
   - Review audit logs for data quality issues
   - Validate that database-first queries are working
   - Check fallback to scraping is functioning

### Performance Testing

While not part of correctness properties, performance should be validated:

**Load Testing:**
- Simulate 100 concurrent queries
- Verify response times stay under 200ms
- Test bulk import with 10,000+ records
- Verify database indexes are effective

**Stress Testing:**
- Test with database containing 20+ brands, 200+ models, 3000+ years
- Verify query performance doesn't degrade
- Test concurrent admin operations
- Verify audit log performance with large datasets
