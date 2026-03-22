# Design Document: Condition Category Quality System

## Overview

This design implements a 4-tier quality-based vehicle condition categorization system to replace the existing 3-category system (Brand New, Nigerian Used, Foreign Used). The new system uses universal quality descriptors (Excellent, Good, Fair, Poor) as primary labels with Nigerian market terms displayed in brackets for cultural context.

The system addresses user feedback that the current 3-category system "is not working" by providing:
- More granular condition assessment (4 tiers instead of 3)
- Quality-first labeling that aligns with international standards
- Market term clarifications in brackets for local context
- Consistent categorization across all vehicle makes and models

### Key Design Decisions

1. **Quality-First Approach**: Primary labels use universal quality descriptors (Excellent, Good, Fair, Poor) rather than market-specific terms, making the system more intuitive and internationally recognizable.

2. **Bracketed Market Terms**: Nigerian market terminology is preserved in brackets (e.g., "Excellent (Brand New)") to maintain cultural context without making it the primary classification.

3. **Database Value Normalization**: All condition values are stored in lowercase with underscores removed (e.g., "excellent", "good", "fair", "poor") for consistency and query performance.

4. **Backward Compatibility**: The system provides mapping functions to translate legacy condition values, ensuring no data loss during migration.

5. **AI Assessment Integration**: The AI damage assessment service will map its internal scoring to the new 4-tier system based on damage severity, vehicle age, and detected condition indicators.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface Layer                     │
├─────────────────────────────────────────────────────────────┤
│  • Case Creation Form                                        │
│  • Case Approval Interface                                   │
│  • Vehicle Autocomplete Component                            │
│  • Auction Listing Pages                                     │
│  • Condition Display Components                              │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer                              │
├─────────────────────────────────────────────────────────────┤
│  • Condition Mapping Service (NEW)                           │
│  • AI Assessment Service (UPDATED)                           │
│  • Valuation Query Service (UPDATED)                         │
│  • Market Data Scraper (UPDATED)                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer                                 │
├─────────────────────────────────────────────────────────────┤
│  • salvage_cases.vehicle_condition (UPDATED)                 │
│  • vehicle_valuations.condition_category (UPDATED)           │
│  • market_data_cache.condition (UPDATED)                     │
│  • Migration Script (NEW)                                    │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Input Flow**:
   - User selects condition from dropdown: "Excellent (Brand New)", "Good (Foreign Used)", "Fair (Nigerian Used)", or "Poor"
   - UI component extracts quality tier value: "excellent", "good", "fair", or "poor"
   - Value is stored in database in normalized format

2. **Display Flow**:
   - Database returns condition value: "excellent", "good", "fair", or "poor"
   - Condition Mapping Service formats for display: "Excellent (Brand New)", etc.
   - UI renders formatted label

3. **AI Assessment Flow**:
   - AI analyzes vehicle photos and context
   - Damage severity and condition indicators are evaluated
   - AI Assessment Service maps to quality tier: "excellent", "good", "fair", or "poor"
   - Condition value is stored with case record

4. **Valuation Query Flow**:
   - System receives condition parameter
   - Valuation Query Service looks up pricing for exact condition tier
   - If no exact match, Condition Mapping Service provides fallback logic
   - Pricing data is returned

## Components and Interfaces

### 1. Condition Mapping Service

**Purpose**: Centralized service for condition value translation and formatting.

**Location**: `src/features/valuations/services/condition-mapping.service.ts` (REPLACE EXISTING)

**Interface**:

```typescript
// New 4-tier quality system types
export type QualityTier = "excellent" | "good" | "fair" | "poor";

export type LegacyCondition = 
  | "brand_new" 
  | "foreign_used" 
  | "nigerian_used"
  | "tokunbo_low"
  | "tokunbo_high"
  | "nig_used_low"
  | "nig_used_high";

export interface ConditionDisplay {
  value: QualityTier;
  label: string; // e.g., "Excellent (Brand New)"
  marketTerm?: string; // e.g., "Brand New"
}

/**
 * Maps legacy condition values to new quality tiers
 */
export function mapLegacyToQuality(legacy: LegacyCondition): QualityTier;

/**
 * Formats quality tier for UI display with bracketed market term
 */
export function formatConditionForDisplay(quality: QualityTier): ConditionDisplay;

/**
 * Returns all quality tiers for dropdown/select components
 */
export function getQualityTiers(): ConditionDisplay[];

/**
 * Validates that a condition value is a valid quality tier
 */
export function isValidQualityTier(value: string): value is QualityTier;
```

**Mapping Logic**:

```typescript
Legacy → Quality Tier Mapping:
- "brand_new" → "excellent"
- "foreign_used" → "good"
- "tokunbo_low" → "good"
- "tokunbo_high" → "good"
- "nigerian_used" → "fair"
- "nig_used_low" → "fair"
- "nig_used_high" → "fair"

Quality Tier → Display Label Mapping:
- "excellent" → "Excellent (Brand New)"
- "good" → "Good (Foreign Used)"
- "fair" → "Fair (Nigerian Used)"
- "poor" → "Poor"
```

### 2. AI Assessment Service Updates

**Purpose**: Update AI damage assessment to output new quality tier values.

**Location**: `src/features/cases/services/ai-assessment.service.ts` (UPDATE)

**Changes**:

```typescript
// Add to DamageAssessmentResult interface
export interface DamageAssessmentResult extends AIAssessment {
  // ... existing fields ...
  
  // NEW: Quality tier assessment
  qualityTier: QualityTier;
}

// Update assessDamage function to include quality tier logic
export async function assessDamage(
  imageUrls: string[],
  marketValue: number,
  vehicleContext?: VehicleContext
): Promise<DamageAssessmentResult> {
  // ... existing assessment logic ...
  
  // NEW: Determine quality tier based on damage assessment
  const qualityTier = determineQualityTier(
    result.damageSeverity,
    result.damagePercentage,
    vehicleContext
  );
  
  return {
    ...result,
    qualityTier,
  };
}

/**
 * Determines quality tier based on damage assessment and vehicle context
 */
function determineQualityTier(
  damageSeverity: 'minor' | 'moderate' | 'severe',
  damagePercentage: number,
  vehicleContext?: VehicleContext
): QualityTier {
  // Logic:
  // - Excellent: minimal/no damage (<10%), recent vehicle (≤3 years old)
  // - Good: minor damage (10-30%), imported vehicle indicators
  // - Fair: moderate damage (30-60%), significant wear
  // - Poor: severe damage (>60%), major structural issues
}
```

**Quality Tier Determination Logic**:

| Damage Severity | Damage % | Vehicle Age | Quality Tier |
|----------------|----------|-------------|--------------|
| minor | <10% | ≤3 years | excellent |
| minor | <10% | >3 years | good |
| minor | 10-30% | any | good |
| moderate | 30-60% | any | fair |
| severe | >60% | any | poor |

### 3. Valuation Query Service Updates

**Purpose**: Update valuation queries to work with new quality tier values.

**Location**: `src/features/valuations/services/valuation-query.service.ts` (UPDATE)

**Changes**:

```typescript
export interface ValuationQueryParams {
  make: string;
  model: string;
  year: number;
  conditionCategory?: QualityTier; // UPDATED TYPE
}

// Update queryValuation to use QualityTier type
async queryValuation(params: ValuationQueryParams): Promise<ValuationResult> {
  const { make, model, year, conditionCategory } = params;
  
  // Query with new quality tier values
  const conditions = [
    eq(vehicleValuations.make, make),
    eq(vehicleValuations.model, model),
    eq(vehicleValuations.year, year),
  ];
  
  if (conditionCategory) {
    conditions.push(eq(vehicleValuations.conditionCategory, conditionCategory));
  }
  
  // ... rest of query logic ...
}

// Remove old queryWithFallback method (no longer needed with 4-tier system)
// The 4-tier system is simpler and doesn't require complex fallback logic
```

### 4. Market Data Scraper Updates

**Purpose**: Normalize scraped condition data to new quality tiers.

**Location**: `src/features/market-data/services/scraper.service.ts` (UPDATE)

**Changes**:

```typescript
/**
 * Normalizes scraped condition text to quality tier
 */
function normalizeCondition(rawCondition: string): QualityTier {
  const normalized = rawCondition.toLowerCase().trim();
  
  // Map common market terms to quality tiers
  if (normalized.includes('brand new') || normalized.includes('new')) {
    return 'excellent';
  }
  
  if (normalized.includes('tokunbo') || 
      normalized.includes('foreign used') || 
      normalized.includes('imported')) {
    return 'good';
  }
  
  if (normalized.includes('nigerian used') || 
      normalized.includes('locally used') ||
      normalized.includes('naija used')) {
    return 'fair';
  }
  
  if (normalized.includes('damaged') || 
      normalized.includes('accident') ||
      normalized.includes('salvage')) {
    return 'poor';
  }
  
  // Default to 'fair' for unknown conditions
  console.warn(`Unknown condition term: "${rawCondition}", defaulting to 'fair'`);
  return 'fair';
}
```

### 5. UI Component Updates

**Purpose**: Update all UI components to display and accept new quality tier values.

**Components to Update**:

1. **Case Creation Form** (`src/app/(dashboard)/adjuster/cases/new/page.tsx`)
   - Update condition dropdown to show 4 quality tiers
   - Store selected value as quality tier

2. **Case Approval Interface** (`src/app/(dashboard)/manager/approvals/page.tsx`)
   - Display condition using formatted label

3. **Vehicle Autocomplete** (`src/components/ui/vehicle-autocomplete.tsx`)
   - Update condition options if component includes condition selection

4. **Auction Listing Pages** (`src/app/(dashboard)/vendor/auctions/page.tsx`)
   - Display vehicle condition using formatted label

**Example UI Component Pattern**:

```typescript
import { getQualityTiers, formatConditionForDisplay } from '@/features/valuations/services/condition-mapping.service';

// In component
const conditionOptions = getQualityTiers();

// Render dropdown
<select name="condition">
  {conditionOptions.map(option => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ))}
</select>

// Display existing condition
const displayLabel = formatConditionForDisplay(vehicle.condition).label;
```

## Data Models

### Database Schema Changes

#### 1. salvage_cases Table

**Current Schema**:
```sql
vehicle_condition VARCHAR(20)
```

**Updated Schema** (no change to column definition, only values):
```sql
vehicle_condition VARCHAR(20)
-- Valid values: 'excellent', 'good', 'fair', 'poor'
```

**Migration Required**: Update existing records to use new values.

#### 2. vehicle_valuations Table

**Current Schema**:
```sql
condition_category VARCHAR(50) NOT NULL
```

**Updated Schema** (no change to column definition, only values):
```sql
condition_category VARCHAR(50) NOT NULL
-- Valid values: 'excellent', 'good', 'fair', 'poor'
```

**Migration Required**: Update existing records to use new values.

#### 3. market_data_cache Table

**Current Schema**:
```sql
condition VARCHAR(50)
```

**Updated Schema** (no change to column definition, only values):
```sql
condition VARCHAR(50)
-- Valid values: 'excellent', 'good', 'fair', 'poor'
```

**Migration Required**: Update existing records to use new values.

### Migration Script

**Location**: `src/lib/db/migrations/0008_condition_category_quality_system.sql`

**Migration Logic**:

```sql
-- Migration: Update condition categories to 4-tier quality system
-- Date: 2024
-- Description: Replaces 3-category system with 4-tier quality-based system

BEGIN;

-- 1. Update salvage_cases.vehicle_condition
UPDATE salvage_cases
SET vehicle_condition = CASE
  WHEN vehicle_condition = 'brand_new' THEN 'excellent'
  WHEN vehicle_condition = 'foreign_used' THEN 'good'
  WHEN vehicle_condition = 'nigerian_used' THEN 'fair'
  WHEN vehicle_condition IN ('excellent', 'good', 'fair', 'poor') THEN vehicle_condition
  ELSE 'fair' -- Default fallback
END
WHERE vehicle_condition IS NOT NULL;

-- 2. Update vehicle_valuations.condition_category
UPDATE vehicle_valuations
SET condition_category = CASE
  WHEN condition_category = 'brand_new' THEN 'excellent'
  WHEN condition_category = 'foreign_used' THEN 'good'
  WHEN condition_category = 'tokunbo_low' THEN 'good'
  WHEN condition_category = 'tokunbo_high' THEN 'good'
  WHEN condition_category = 'nigerian_used' THEN 'fair'
  WHEN condition_category = 'nig_used_low' THEN 'fair'
  WHEN condition_category = 'nig_used_high' THEN 'fair'
  WHEN condition_category IN ('excellent', 'good', 'fair', 'poor') THEN condition_category
  ELSE 'fair' -- Default fallback
END;

-- 3. Update market_data_cache.condition (if exists)
UPDATE market_data_cache
SET condition = CASE
  WHEN condition = 'brand_new' THEN 'excellent'
  WHEN condition = 'foreign_used' THEN 'good'
  WHEN condition = 'tokunbo_low' THEN 'good'
  WHEN condition = 'tokunbo_high' THEN 'good'
  WHEN condition = 'nigerian_used' THEN 'fair'
  WHEN condition = 'nig_used_low' THEN 'fair'
  WHEN condition = 'nig_used_high' THEN 'fair'
  WHEN condition IN ('excellent', 'good', 'fair', 'poor') THEN condition
  ELSE 'fair' -- Default fallback
END
WHERE condition IS NOT NULL;

-- 4. Log migration for audit trail
INSERT INTO valuation_audit_logs (
  action,
  entity_type,
  entity_id,
  changed_fields,
  user_id,
  created_at
)
SELECT
  'update',
  'migration',
  gen_random_uuid(),
  jsonb_build_object(
    'migration', jsonb_build_object(
      'old', 'legacy_condition_system',
      'new', '4_tier_quality_system'
    )
  ),
  (SELECT id FROM users WHERE role = 'super_admin' LIMIT 1),
  NOW();

COMMIT;
```

**Idempotency**: The migration uses CASE statements that check for both legacy and new values, making it safe to run multiple times.

**Rollback Script** (if needed):

```sql
-- Rollback: Revert to 3-category system (NOT RECOMMENDED)
-- This is provided for emergency use only

BEGIN;

-- Note: This rollback loses granularity (4 tiers → 3 categories)
UPDATE salvage_cases
SET vehicle_condition = CASE
  WHEN vehicle_condition = 'excellent' THEN 'brand_new'
  WHEN vehicle_condition = 'good' THEN 'foreign_used'
  WHEN vehicle_condition = 'fair' THEN 'nigerian_used'
  WHEN vehicle_condition = 'poor' THEN 'nigerian_used' -- Poor maps to nigerian_used
  ELSE vehicle_condition
END
WHERE vehicle_condition IS NOT NULL;

-- Similar updates for other tables...

COMMIT;
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies:

- **Criteria 1.2, 1.3, 1.4, 1.5**: These all test the same formatting function with different inputs. Combined into Property 1.
- **Criteria 2.2, 2.3, 2.4**: These are specific examples of the same migration mapping logic. Kept as examples, not properties.
- **Criteria 3.4, 3.5, 3.6, 3.7**: These are integration tests for specific UI components. Combined into Property 4.
- **Criteria 4.3, 4.4, 4.5, 4.6**: These are specific examples of AI mapping logic. Kept as examples, not properties.
- **Criteria 6.2, 6.3, 6.4, 6.5**: These are specific examples of scraper mapping logic. Kept as examples, not properties.
- **Criteria 8.3, 8.4, 8.5**: These are meta-requirements that duplicate other properties. Removed.

### Property 1: Condition Display Formatting

*For any* quality tier value ("excellent", "good", "fair", "poor"), when formatted for display, the output SHALL match the pattern "Quality_Tier (Market_Term)" for excellent/good/fair, and "Poor" (without brackets) for poor.

**Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6**

### Property 2: Quality Tier Value Validation

*For any* condition value stored in the database, the value SHALL be one of exactly four valid quality tiers: "excellent", "good", "fair", or "poor".

**Validates: Requirements 1.1, 2.1**

### Property 3: UI Storage Round-Trip

*For any* quality tier selected in a UI component, storing the value and then retrieving it SHALL produce the same quality tier value (round-trip property).

**Validates: Requirements 3.2, 3.3**

### Property 4: UI Component Consistency

*For all* UI components that display or accept condition categories, the components SHALL offer exactly four options with labels: "Excellent (Brand New)", "Good (Foreign Used)", "Fair (Nigerian Used)", and "Poor".

**Validates: Requirements 3.1, 3.4, 3.5, 3.6, 3.7**

### Property 5: Migration Idempotency

*For any* database state, running the migration script multiple times SHALL produce the same final state (idempotent property).

**Validates: Requirements 2.6**

### Property 6: Migration Data Preservation

*For any* vehicle record, after migration, all non-condition fields SHALL remain unchanged (preservation property).

**Validates: Requirements 2.5**

### Property 7: Legacy Condition Mapping

*For any* legacy condition value ("brand_new", "foreign_used", "nigerian_used", "tokunbo_low", "tokunbo_high", "nig_used_low", "nig_used_high"), the Condition_Mapping_Service SHALL map it to exactly one valid quality tier.

**Validates: Requirements 5.3, 7.1, 7.2**

### Property 8: Semantic Meaning Preservation

*For any* legacy condition value, the mapped quality tier SHALL preserve the semantic meaning (e.g., "brand_new" → "excellent" preserves "best condition" meaning, "nig_used_high" → "fair" preserves "moderate wear" meaning).

**Validates: Requirements 7.4**

### Property 9: AI Assessment Output Validation

*For any* AI damage assessment result, the output quality tier SHALL be one of: "excellent", "good", "fair", or "poor".

**Validates: Requirements 4.1**

### Property 10: AI Damage-to-Quality Mapping

*For any* damage assessment with damage percentage and severity, the AI_Assessment_Service SHALL consistently map the same damage characteristics to the same quality tier.

**Validates: Requirements 4.2**

### Property 11: Valuation Query Input Validation

*For any* valuation query, if a condition parameter is provided, it SHALL be one of: "excellent", "good", "fair", or "poor", otherwise the query SHALL reject the input.

**Validates: Requirements 5.1**

### Property 12: Valuation Query Exact Matching

*For any* valuation query with a condition parameter, the results SHALL include only records that exactly match the specified condition tier.

**Validates: Requirements 5.2**

### Property 13: Market Data Scraper Output Validation

*For any* scraped market data record, the normalized condition value SHALL be one of: "excellent", "good", "fair", or "poor".

**Validates: Requirements 6.1**

### Property 14: Condition Translation Logging

*For any* condition value translation performed by the Condition_Mapping_Service, the translation SHALL be logged with both the original and mapped values.

**Validates: Requirements 7.3**

### Property 15: Round-Trip Condition Mapping

*For any* quality tier value, the following round-trip SHALL preserve the value: store value → retrieve value → format for display → extract value from UI → store value produces the original value.

**Validates: Requirements 8.1**

## Error Handling

### Invalid Condition Values

**Scenario**: System encounters a condition value that is not a valid quality tier.

**Handling**:
1. Log a warning with the invalid value and context
2. Use fallback value: "fair" (middle tier, safest default)
3. Record the fallback in audit logs
4. Continue processing without throwing an error

**Example**:
```typescript
function validateQualityTier(value: string): QualityTier {
  if (isValidQualityTier(value)) {
    return value;
  }
  
  console.warn(
    `[ConditionMapping] Invalid quality tier: "${value}". ` +
    `Using fallback: "fair". Context: ${JSON.stringify(context)}`
  );
  
  auditLogger.log({
    action: 'condition_fallback',
    invalidValue: value,
    fallbackValue: 'fair',
    timestamp: new Date(),
  });
  
  return 'fair';
}
```

### Migration Failures

**Scenario**: Migration script encounters an error during execution.

**Handling**:
1. Wrap entire migration in a transaction (BEGIN...COMMIT)
2. If any error occurs, ROLLBACK the entire transaction
3. Log detailed error information
4. Prevent partial migrations (all-or-nothing)

**Example**:
```sql
BEGIN;

-- Migration statements...

-- If any error occurs, PostgreSQL automatically rolls back
-- No partial state is possible

COMMIT;
```

### AI Assessment Failures

**Scenario**: AI assessment cannot determine a quality tier.

**Handling**:
1. Log the failure with context (photos, vehicle details)
2. Return a neutral assessment with "fair" as default quality tier
3. Set confidence score to low (e.g., 30%)
4. Include warning in assessment result

**Example**:
```typescript
try {
  const qualityTier = determineQualityTier(damage, context);
  return { qualityTier, confidence: 85 };
} catch (error) {
  console.error('[AIAssessment] Failed to determine quality tier', error);
  
  return {
    qualityTier: 'fair',
    confidence: 30,
    warnings: ['Quality tier determination failed, using default'],
  };
}
```

### Valuation Query Failures

**Scenario**: No valuation data exists for the requested condition tier.

**Handling**:
1. Log the missing data scenario
2. Return null result (no fallback to different condition)
3. Let calling code decide how to handle (may try different condition or show "no data" message)

**Example**:
```typescript
const result = await queryValuation({
  make: 'Toyota',
  model: 'Camry',
  year: 2020,
  conditionCategory: 'excellent',
});

if (!result.found) {
  console.warn('[ValuationQuery] No data for excellent condition');
  // Calling code can try 'good' condition or show "no data" message
}
```

### UI Component Errors

**Scenario**: UI component receives invalid condition value to display.

**Handling**:
1. Log the invalid value
2. Display a fallback label: "Unknown Condition"
3. Highlight the issue in the UI (e.g., with a warning icon)
4. Allow user to correct the value

**Example**:
```typescript
function displayCondition(value: string): string {
  try {
    return formatConditionForDisplay(value as QualityTier).label;
  } catch (error) {
    console.error('[UI] Invalid condition value', { value, error });
    return 'Unknown Condition ⚠️';
  }
}
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Both testing approaches are complementary and necessary for complete validation.

### Property-Based Testing

**Library**: `fast-check` (JavaScript/TypeScript property-based testing library)

**Configuration**: Each property test will run a minimum of 100 iterations to ensure comprehensive input coverage.

**Test Tagging**: Each property test will include a comment tag referencing the design document property:

```typescript
/**
 * Feature: condition-category-quality-system
 * Property 1: Condition Display Formatting
 * 
 * For any quality tier value, when formatted for display,
 * the output SHALL match the expected pattern.
 */
test('Property 1: Condition Display Formatting', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('excellent', 'good', 'fair', 'poor'),
      (qualityTier) => {
        const display = formatConditionForDisplay(qualityTier);
        
        // Verify format
        if (qualityTier === 'excellent') {
          expect(display.label).toBe('Excellent (Brand New)');
          expect(display.marketTerm).toBe('Brand New');
        } else if (qualityTier === 'good') {
          expect(display.label).toBe('Good (Foreign Used)');
          expect(display.marketTerm).toBe('Foreign Used');
        } else if (qualityTier === 'fair') {
          expect(display.label).toBe('Fair (Nigerian Used)');
          expect(display.marketTerm).toBe('Nigerian Used');
        } else if (qualityTier === 'poor') {
          expect(display.label).toBe('Poor');
          expect(display.marketTerm).toBeUndefined();
        }
        
        expect(display.value).toBe(qualityTier);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing

**Focus Areas**:

1. **Condition Mapping Service**
   - Test each legacy value maps to correct quality tier
   - Test invalid values trigger fallback
   - Test logging behavior

2. **Migration Script**
   - Test specific legacy values are migrated correctly
   - Test idempotency (run twice, same result)
   - Test data preservation (non-condition fields unchanged)

3. **AI Assessment Service**
   - Test specific damage scenarios map to correct quality tiers
   - Test boundary cases (e.g., 10% damage, 30% damage, 60% damage)
   - Test error handling

4. **UI Components**
   - Test dropdown renders all four options
   - Test selecting an option stores correct value
   - Test displaying stored value shows correct label

5. **Valuation Query Service**
   - Test query with each quality tier
   - Test query rejects invalid condition values
   - Test exact matching behavior

6. **Market Data Scraper**
   - Test normalization of common market terms
   - Test edge cases (unknown terms, empty strings)
   - Test logging of unknown terms

### Integration Testing

**Test Scenarios**:

1. **Complete Case Creation Flow**
   - Create case with each quality tier
   - Verify condition is stored correctly
   - Verify condition displays correctly in approval interface
   - Verify condition appears correctly in auction listing

2. **AI Assessment Integration**
   - Upload vehicle photos
   - Verify AI assigns valid quality tier
   - Verify quality tier is stored with case
   - Verify quality tier affects valuation query

3. **Migration Integration**
   - Seed database with legacy condition values
   - Run migration script
   - Verify all values are updated
   - Verify UI displays updated values correctly
   - Verify valuation queries work with new values

4. **Backward Compatibility**
   - Test Condition_Mapping_Service handles legacy values
   - Test system logs translations
   - Test no data loss occurs

### Test Coverage Goals

- **Unit Test Coverage**: >90% for all modified services
- **Property Test Coverage**: All 15 correctness properties implemented
- **Integration Test Coverage**: All 4 integration scenarios passing
- **Edge Case Coverage**: All error handling paths tested

### Testing Tools

- **Unit Testing**: Jest
- **Property-Based Testing**: fast-check
- **Integration Testing**: Jest with test database
- **E2E Testing**: Playwright (for UI component verification)
- **Database Testing**: Drizzle ORM with test transactions

### Test Execution

```bash
# Run all tests
npm test

# Run only property-based tests
npm test -- --testNamePattern="Property"

# Run only migration tests
npm test -- --testPathPattern="migration"

# Run with coverage
npm test -- --coverage
```

### Continuous Integration

All tests must pass before merging:
- Unit tests: 100% passing
- Property tests: 100% passing (all 100 iterations)
- Integration tests: 100% passing
- No TypeScript errors
- No ESLint warnings

