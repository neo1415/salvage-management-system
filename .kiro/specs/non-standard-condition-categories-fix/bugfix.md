# Bugfix Requirements Document

## Introduction

This document addresses a critical UX and valuation bug where the UI shows inconsistent condition categories per vehicle make, creating confusion and preventing accurate valuations. The system needs universal condition categories across ALL vehicles with intelligent fallback logic when specific conditions are unavailable.

**Verified Database State (from diagnostic script):**
- **Mercedes-Benz**: fair (9), poor (7), excellent (6), good (11) - ONLY standard categories
- **Nissan**: tokunbo_low (98), nig_used_low (78) - ONLY non-standard, NO _high variants, NO brand_new
- **Audi**: tokunbo_low (18), nig_used_low (45) - ONLY non-standard, NO _high variants, NO brand_new
- **Toyota**: fair (54), excellent (16), tokunbo_low (24), nig_used_low (25), good (17) - MIXED
- **Hyundai**: tokunbo_low (60), nig_used_low (46) - ONLY non-standard, NO _high variants, NO brand_new
- **Lexus**: tokunbo_low (75), nig_used_low (56) - ONLY non-standard, NO _high variants, NO brand_new
- **Kia**: tokunbo_low (58), nig_used_low (46) - ONLY non-standard, NO _high variants, NO brand_new

**Key Insight:** Database has NO "brand_new" category and NO "_high" variants currently exist in production data (only in test files).

**The Real Bug:**
1. **Inconsistent UI per make** - Different condition options shown for different makes (stupid UX)
2. **No universal categories** - Users can't compare across makes because options differ
3. **No intelligent fallback** - System doesn't gracefully handle missing condition categories
4. **Mileage ignored** - System should use mileage to determine low/high quality, not separate UI options

**Impact:**
- Confusing UX where condition options change based on selected make
- Users cannot get valuations when their selected condition doesn't exist in database
- No graceful degradation when specific condition unavailable
- Mileage data not leveraged to determine vehicle quality within condition categories

**Root Cause:**
The system was designed with make-specific condition categories instead of universal categories with intelligent fallback logic. Mileage should determine quality (low/high) within each category, not be a separate UI selection.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user selects different vehicle makes THEN the UI shows different condition options per make, creating inconsistent UX

1.2 WHEN a user selects "Brand New" for Nissan THEN the system returns NO RESULTS because brand_new category doesn't exist in the database

1.3 WHEN a user selects "Foreign Used" for a make/model/year where only "Nigerian Used" exists THEN the system returns NO RESULTS instead of falling back to available conditions

1.4 WHEN the database has only tokunbo_low and nig_used_low (no _high variants) THEN the UI still shows separate low/high options that don't exist

1.5 WHEN a user enters mileage data THEN the system doesn't use it to determine quality (low/high) within the selected condition category

1.6 WHEN comparing vehicles across different makes THEN users see different condition options, making cross-make comparison impossible

### Expected Behavior (Correct)

2.1 WHEN a user creates a case for ANY vehicle make THEN the UI SHALL show 3 universal condition options: "Brand New", "Nigerian Used", "Foreign Used (Tokunbo)"

2.2 WHEN a user selects "Brand New" and it's not available for that make/model/year THEN the system SHALL fallback to "Foreign Used" → "Nigerian Used" in that order

2.3 WHEN a user selects "Foreign Used" and it's not available THEN the system SHALL fallback to "Nigerian Used" → "Brand New" in that order

2.4 WHEN a user selects "Nigerian Used" and it's not available THEN the system SHALL fallback to "Foreign Used" → "Brand New" in that order

2.5 WHEN a user enters mileage data THEN the system SHALL use it to determine if the vehicle is "low" or "high" quality within the selected condition category

2.6 WHEN querying the database with "Foreign Used" THEN the system SHALL first try tokunbo_low, then tokunbo_high based on mileage, then fallback to other conditions if neither exists

2.7 WHEN querying the database with "Nigerian Used" THEN the system SHALL first try nig_used_low, then nig_used_high based on mileage, then fallback to other conditions if neither exists

2.8 WHEN the fallback logic exhausts all condition categories THEN the system SHALL return an error message indicating no valuation data available for that vehicle

2.9 WHEN users compare vehicles across different makes THEN they SHALL see the same 3 condition options, enabling consistent cross-make comparison

### Unchanged Behavior (Regression Prevention)

3.1 WHEN querying valuations for any make/model/year THEN all other valuation attributes (base_price, mileage_range, year, etc.) SHALL CONTINUE TO be returned unchanged

3.2 WHEN damage deduction records are queried THEN they SHALL CONTINUE TO function correctly and remain unaffected by the condition category changes

3.3 WHEN existing valuation records are stored in the database THEN their condition values SHALL CONTINUE TO remain as-is (no data migration required)

3.4 WHEN the AI assessment service calculates damage deductions THEN it SHALL CONTINUE TO work correctly with the new condition query logic

3.5 WHEN users enter vehicle details (make, model, year, mileage) THEN those fields SHALL CONTINUE TO function exactly as before

## Bug Condition Specification

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ValuationQuery
  OUTPUT: boolean
  
  // Returns true when the selected condition doesn't exist in database
  // and no fallback logic is applied
  
  available_conditions ← getAvailableConditions(X.make, X.model, X.year)
  requested_condition ← mapUserSelectionToDbCondition(X.userCondition, X.mileage)
  
  // Bug exists when:
  // 1. Requested condition doesn't exist in database
  // 2. No fallback logic attempts alternative conditions
  // 3. System returns empty results instead of trying alternatives
  
  RETURN (requested_condition NOT IN available_conditions) AND 
         (no_fallback_attempted(X))
END FUNCTION
```

**Explanation:** The bug occurs when the system queries for a specific condition that doesn't exist in the database and fails to fallback to alternative conditions, resulting in empty results instead of graceful degradation.

### Property: Fix Checking - Universal UI

```pascal
// Property: All makes show same 3 universal condition options
FOR ALL make IN ["Mercedes-Benz", "Nissan", "Audi", "Toyota", "Hyundai", "Lexus", "Kia"] DO
  conditionOptions ← getConditionOptionsForMake'(make)
  
  // After fix, ALL makes show same 3 options
  ASSERT conditionOptions.length = 3
  ASSERT "Brand New" IN conditionOptions
  ASSERT "Nigerian Used" IN conditionOptions
  ASSERT "Foreign Used (Tokunbo)" IN conditionOptions
END FOR
```

### Property: Fix Checking - Intelligent Fallback

```pascal
// Property: Fallback logic when Brand New not available
FOR ALL vehicle WHERE "brand_new" NOT IN database DO
  result ← queryWithFallback'("Brand New", vehicle)
  
  // Should try: brand_new → tokunbo_low/high → nig_used_low/high
  ASSERT result IS NOT NULL OR all_conditions_exhausted
  ASSERT fallback_chain_attempted = ["brand_new", "tokunbo_low", "tokunbo_high", "nig_used_low", "nig_used_high"]
END FOR

// Property: Fallback logic when Foreign Used not available
FOR ALL vehicle WHERE "tokunbo_low" NOT IN database AND "tokunbo_high" NOT IN database DO
  result ← queryWithFallback'("Foreign Used", vehicle)
  
  // Should try: tokunbo_low/high → nig_used_low/high → brand_new
  ASSERT result IS NOT NULL OR all_conditions_exhausted
  ASSERT fallback_attempted_to_nig_used = TRUE
END FOR

// Property: Fallback logic when Nigerian Used not available
FOR ALL vehicle WHERE "nig_used_low" NOT IN database AND "nig_used_high" NOT IN database DO
  result ← queryWithFallback'("Nigerian Used", vehicle)
  
  // Should try: nig_used_low/high → tokunbo_low/high → brand_new
  ASSERT result IS NOT NULL OR all_conditions_exhausted
  ASSERT fallback_attempted_to_tokunbo = TRUE
END FOR
```

### Property: Fix Checking - Mileage-Based Quality

```pascal
// Property: Mileage determines low vs high quality within condition
FOR ALL condition IN ["Foreign Used", "Nigerian Used"] DO
  FOR ALL mileage IN [low_mileage, high_mileage] DO
    dbCondition ← mapConditionWithMileage'(condition, mileage)
    
    IF condition = "Foreign Used" AND mileage < threshold THEN
      ASSERT dbCondition = "tokunbo_low"
    ELSE IF condition = "Foreign Used" AND mileage >= threshold THEN
      ASSERT dbCondition = "tokunbo_high"
    ELSE IF condition = "Nigerian Used" AND mileage < threshold THEN
      ASSERT dbCondition = "nig_used_low"
    ELSE IF condition = "Nigerian Used" AND mileage >= threshold THEN
      ASSERT dbCondition = "nig_used_high"
    END IF
  END FOR
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Existing database records remain unchanged
FOR ALL valuation IN database DO
  condition_before ← valuation.condition
  // Apply fix (no data migration)
  condition_after ← valuation.condition
  
  ASSERT condition_before = condition_after
END FOR

// Property: Valuation queries return same data, just with fallback logic
FOR ALL vehicle IN test_vehicles DO
  // For conditions that exist in database
  IF condition_exists_in_db(vehicle.make, vehicle.model, vehicle.year, "tokunbo_low") THEN
    result_before ← queryValuation(vehicle, "tokunbo_low")
    result_after ← queryValuation'(vehicle, "Foreign Used")
    
    // Should return same valuation data
    ASSERT result_before.base_price = result_after.base_price
    ASSERT result_before.mileage_range = result_after.mileage_range
  END IF
END FOR

// Property: Damage deduction calculations remain unchanged
FOR ALL case IN existing_cases DO
  damage_before ← calculateDamageDeduction(case)
  // Apply fix
  damage_after ← calculateDamageDeduction'(case)
  
  ASSERT damage_before = damage_after
END FOR
```

### Fallback Logic Specification

**Universal Condition Categories (UI):**
1. Brand New
2. Nigerian Used
3. Foreign Used (Tokunbo)

**Database Condition Mapping with Fallback:**

```pascal
FUNCTION queryWithFallback(userCondition, vehicle, mileage)
  INPUT: userCondition (string), vehicle (make/model/year), mileage (number)
  OUTPUT: valuation record or null
  
  // Step 1: Map user selection to primary database conditions
  IF userCondition = "Brand New" THEN
    primary ← ["brand_new"]
    fallback ← ["tokunbo_low", "tokunbo_high", "nig_used_low", "nig_used_high"]
  
  ELSE IF userCondition = "Foreign Used" THEN
    // Use mileage to determine low vs high
    IF mileage < MILEAGE_THRESHOLD THEN
      primary ← ["tokunbo_low", "tokunbo_high"]
    ELSE
      primary ← ["tokunbo_high", "tokunbo_low"]
    END IF
    fallback ← ["nig_used_low", "nig_used_high", "brand_new"]
  
  ELSE IF userCondition = "Nigerian Used" THEN
    // Use mileage to determine low vs high
    IF mileage < MILEAGE_THRESHOLD THEN
      primary ← ["nig_used_low", "nig_used_high"]
    ELSE
      primary ← ["nig_used_high", "nig_used_low"]
    END IF
    fallback ← ["tokunbo_low", "tokunbo_high", "brand_new"]
  END IF
  
  // Step 2: Try primary conditions first
  FOR EACH condition IN primary DO
    result ← queryDatabase(vehicle, condition)
    IF result IS NOT NULL THEN
      RETURN result
    END IF
  END FOR
  
  // Step 3: Try fallback conditions
  FOR EACH condition IN fallback DO
    result ← queryDatabase(vehicle, condition)
    IF result IS NOT NULL THEN
      log_fallback_used(userCondition, condition, vehicle)
      RETURN result
    END IF
  END FOR
  
  // Step 4: All conditions exhausted
  RETURN null
END FUNCTION
```

**Mileage Threshold for Quality Determination:**
- Low mileage: < 100,000 km → try _low variant first
- High mileage: >= 100,000 km → try _high variant first

**Fallback Priority:**
1. **Brand New** → Foreign Used → Nigerian Used
2. **Foreign Used** → Nigerian Used → Brand New
3. **Nigerian Used** → Foreign Used → Brand New

**Semantic Justification:**
- **Universal categories** provide consistent UX across all makes
- **Intelligent fallback** ensures users always get a valuation when data exists
- **Mileage-based quality** leverages existing data to determine low/high condition
- **No data migration** required - only query logic changes
- **Graceful degradation** when specific condition unavailable
