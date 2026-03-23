# Non-Standard Condition Categories Fix - Bugfix Design

## Overview

This bugfix addresses a critical UX and valuation accuracy issue where the UI shows inconsistent condition categories per vehicle make, creating confusion and preventing accurate valuations. The fix implements universal condition categories across ALL vehicles with intelligent fallback logic when specific conditions are unavailable, and leverages mileage data to determine quality (low/high) within each category.

The solution requires NO database schema changes or data migration - only query logic and UI modifications. The system will show 3 universal condition options to all users regardless of make, then intelligently map and fallback to available database conditions based on mileage and data availability.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when the selected condition category doesn't exist in the database and no fallback logic is applied, resulting in empty results
- **Property (P)**: The desired behavior - universal condition categories with intelligent fallback logic that always returns a valuation when data exists for that vehicle
- **Preservation**: Existing valuation data, damage deduction calculations, and AI assessment logic that must remain unchanged by the fix
- **Universal Condition Categories**: The 3 user-facing condition options shown in the UI: "Brand New", "Nigerian Used", "Foreign Used (Tokunbo)"
- **Database Condition Categories**: The actual condition values stored in the database: brand_new, excellent, good, fair, poor, tokunbo_low, tokunbo_high, nig_used_low, nig_used_high
- **Condition Mapping Service**: New service that maps universal UI conditions to database conditions with mileage-based quality determination
- **Fallback Chain**: The ordered sequence of database conditions to try when the primary condition is unavailable
- **Mileage Threshold**: 100,000 km - the boundary that determines whether a vehicle is "low" or "high" quality within a condition category
- **ValuationQueryService**: The service in `src/features/valuations/services/valuation-query.service.ts` that queries vehicle valuations from the database

## Bug Details

### Fault Condition

The bug manifests when a user selects a condition category that doesn't exist in the database for that specific make/model/year combination. The `ValuationQueryService.queryValuation` function queries for the exact condition without attempting fallback alternatives, resulting in empty results even when other condition categories have valuation data for that vehicle.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ValuationQueryParams
  OUTPUT: boolean
  
  available_conditions ← getAvailableConditions(input.make, input.model, input.year)
  requested_condition ← input.conditionCategory
  
  RETURN requested_condition NOT IN available_conditions
         AND no_fallback_attempted(input)
         AND valuation_data_exists_for_vehicle(input.make, input.model, input.year)
END FUNCTION
```

### Examples

- **Nissan Altima 2018 - Brand New**: User selects "Brand New" but database only has tokunbo_low and nig_used_low → System returns NO RESULTS instead of falling back to Foreign Used
- **Audi A4 2020 - Brand New**: User selects "Brand New" but database only has tokunbo_low and nig_used_low → System returns NO RESULTS instead of falling back to Foreign Used
- **Mercedes-Benz C-Class 2019 - Foreign Used**: User selects "Foreign Used" but database only has excellent, good, fair, poor → System returns NO RESULTS instead of falling back to excellent/good
- **Toyota Camry 2021 - Inconsistent UI**: User sees different condition options when switching from Toyota (mixed categories) to Nissan (only non-standard) → Confusing UX with no cross-make comparison possible

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All existing valuation records in the database must remain with their current condition values (no data migration)
- Damage deduction calculations must continue to work correctly with the new condition query logic
- AI assessment service must continue to function correctly when calculating valuations
- Fuzzy matching logic for make/model/year must remain unchanged
- All other valuation attributes (base_price, mileage_range, year, etc.) must continue to be returned unchanged

**Scope:**
All inputs that successfully find exact condition matches in the database should be completely unaffected by this fix. This includes:
- Queries where the requested condition exists in the database
- Damage deduction record queries
- Vehicle autocomplete functionality
- Make/model/year selection logic

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **No Universal UI Categories**: The UI currently shows make-specific condition options (excellent/good/fair/poor for Mercedes, tokunbo_low/nig_used_low for Nissan), creating inconsistent UX across different makes

2. **No Condition Mapping Layer**: The system directly passes user-selected conditions to the database query without any mapping or translation logic

3. **No Fallback Logic**: The `ValuationQueryService.queryValuation` function only attempts exact condition matches and doesn't try alternative conditions when the requested one is unavailable

4. **Mileage Data Ignored**: The system doesn't use mileage to determine whether a vehicle should be classified as "low" or "high" quality within a condition category

5. **No Intelligent Degradation**: When a specific condition doesn't exist, the system returns empty results instead of gracefully falling back to the next best available condition

## Correctness Properties

Property 1: Fault Condition - Universal Condition Categories with Fallback

_For any_ vehicle valuation query where the user selects a condition category that doesn't exist in the database, the fixed system SHALL attempt fallback to alternative conditions in priority order, returning a valuation when any condition data exists for that vehicle, and SHALL show the same 3 universal condition options in the UI regardless of vehicle make.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

Property 2: Preservation - Existing Valuation Data and Logic

_For any_ vehicle valuation query where the requested condition exists in the database, the fixed system SHALL produce exactly the same valuation results as the original system, preserving all existing valuation data, damage deduction calculations, and AI assessment logic without requiring any database schema changes or data migration.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/app/(dashboard)/adjuster/cases/new/page.tsx`

**Component**: Case Creation Form - Condition Selection UI

**Specific Changes**:
1. **Replace Condition Options**: Change the condition dropdown from make-specific options (excellent/good/fair/poor) to 3 universal options:
   - "Brand New"
   - "Nigerian Used"
   - "Foreign Used (Tokunbo)"

2. **Update Form Validation**: Change the Zod schema to accept the new universal condition values instead of the old excellent/good/fair/poor values

3. **Update TypeScript Types**: Update the vehicleCondition type from `'excellent' | 'good' | 'fair' | 'poor'` to `'brand_new' | 'nigerian_used' | 'foreign_used'`

4. **Update Help Text**: Update the UI help text to explain the 3 universal categories and how mileage affects quality determination

**File**: `src/features/valuations/services/condition-mapping.service.ts` (NEW)

**Service**: Condition Mapping Service with Fallback Logic

**Specific Changes**:
1. **Create Condition Mapping Service**: New service that maps universal UI conditions to database conditions with mileage-based quality determination

2. **Implement Mileage Threshold Logic**: Use 100,000 km as the threshold to determine low vs high quality within each condition category

3. **Define Fallback Chains**: Implement priority-ordered fallback chains for each universal condition:
   - Brand New → Foreign Used → Nigerian Used
   - Foreign Used → Nigerian Used → Brand New
   - Nigerian Used → Foreign Used → Brand New

4. **Implement Fallback Query Logic**: Method that tries primary conditions first, then fallback conditions in order, logging when fallback is used

5. **Add Logging for Fallback Usage**: Track and log when fallback logic is used for monitoring and analytics

**File**: `src/features/valuations/services/valuation-query.service.ts`

**Service**: Valuation Query Service

**Specific Changes**:
1. **Integrate Condition Mapping Service**: Import and use the new ConditionMappingService to map universal conditions to database conditions

2. **Replace Direct Condition Query**: Replace the direct `conditionCategory` query with the fallback chain logic from ConditionMappingService

3. **Pass Mileage to Mapping Service**: Ensure mileage is passed to the mapping service for quality determination

4. **Preserve Existing Fuzzy Matching**: Keep all existing fuzzy matching logic for make/model/year unchanged

5. **Add Fallback Logging**: Log when fallback conditions are used and which condition ultimately returned results

**File**: `src/app/(dashboard)/manager/approvals/page.tsx`

**Component**: Manager Approval Page - Condition Display

**Specific Changes**:
1. **Update Condition Display**: Update the condition display to show the universal condition names instead of database condition values

2. **Add Condition Mapping for Display**: Map database condition values back to universal condition names for display purposes

3. **Update TypeScript Types**: Update the vehicleCondition type to match the new universal condition values

**File**: `src/features/valuations/types/index.ts`

**Types**: Valuation Type Definitions

**Specific Changes**:
1. **Add Universal Condition Type**: Define a new type for universal condition categories: `'brand_new' | 'nigerian_used' | 'foreign_used'`

2. **Add Database Condition Type**: Define a type for database condition categories: `'brand_new' | 'excellent' | 'good' | 'fair' | 'poor' | 'tokunbo_low' | 'tokunbo_high' | 'nig_used_low' | 'nig_used_high'`

3. **Update ValuationQueryParams**: Update the interface to use the universal condition type

4. **Add Condition Mapping Types**: Define types for condition mapping configuration and fallback chains

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that query valuations with conditions that don't exist in the database for specific makes. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Nissan Brand New Test**: Query Nissan Altima 2018 with "Brand New" condition (will fail on unfixed code - no results returned)
2. **Audi Foreign Used Test**: Query Audi A4 2020 with "Foreign Used" condition (will fail on unfixed code - no results returned)
3. **Mercedes Nigerian Used Test**: Query Mercedes C-Class 2019 with "Nigerian Used" condition (will fail on unfixed code - no results returned)
4. **UI Consistency Test**: Check condition options shown for different makes (will fail on unfixed code - different options per make)

**Expected Counterexamples**:
- Queries return empty results even when valuation data exists for the vehicle in other condition categories
- Possible causes: no fallback logic, no condition mapping, make-specific UI options

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := queryValuationWithFallback_fixed(input)
  ASSERT result.found = true OR all_conditions_exhausted(input)
  ASSERT fallback_chain_attempted(input) = true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  result_original := queryValuation_original(input)
  result_fixed := queryValuation_fixed(input)
  
  ASSERT result_original.valuation = result_fixed.valuation
  ASSERT result_original.source = result_fixed.source
  ASSERT result_original.matchType = result_fixed.matchType
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for queries with exact condition matches, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Exact Match Preservation**: Observe that queries with exact condition matches work correctly on unfixed code, then write test to verify this continues after fix
2. **Fuzzy Matching Preservation**: Observe that fuzzy make/model/year matching works correctly on unfixed code, then write test to verify this continues after fix
3. **Damage Deduction Preservation**: Observe that damage deduction calculations work correctly on unfixed code, then write test to verify this continues after fix
4. **AI Assessment Preservation**: Observe that AI assessment calculations work correctly on unfixed code, then write test to verify this continues after fix

### Unit Tests

- Test condition mapping service maps universal conditions to correct database conditions
- Test mileage threshold logic (< 100,000 km → low, >= 100,000 km → high)
- Test fallback chain priority order for each universal condition
- Test that all 3 universal conditions are shown in UI regardless of make
- Test edge cases (no mileage provided, extreme mileage values, all conditions exhausted)

### Property-Based Tests

- Generate random vehicle queries and verify fallback logic attempts all conditions in priority order
- Generate random mileage values and verify correct low/high quality determination
- Test that all makes show same 3 universal condition options across many scenarios
- Verify preservation of exact match behavior across many vehicle combinations

### Integration Tests

- Test full case creation flow with new universal condition categories
- Test valuation queries with fallback logic across different makes
- Test that manager approval page displays conditions correctly
- Test that AI assessment continues to work with new condition mapping
- Test logging of fallback usage for monitoring and analytics
