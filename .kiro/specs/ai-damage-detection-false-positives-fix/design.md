# AI Damage Detection False Positives Fix - Bugfix Design

## Overview

The AI damage detection system incorrectly identifies normal car parts (bumper, door, windshield, etc.) as damage indicators when analyzing photos of vehicles in excellent condition. This occurs because Google Vision API returns object labels for all visible car parts regardless of damage state, and the current implementation treats these normal part labels as damage indicators without checking for explicit damage keywords.

The fix involves three key changes:
1. Update `calculateDamageScore` to only detect actual damage keywords (already partially implemented)
2. Raise the damage threshold from 0 to 30 in `identifyDamagedComponents` to require significant damage before flagging (already implemented)
3. Ensure the threshold is consistently applied and market value calculations remain accurate

This is a targeted fix that works within Google Vision's limitations while we plan to migrate to a better computer vision solution later.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when Google Vision returns only normal car part labels without damage keywords, but the system still reports MODERATE/SEVERE damage
- **Property (P)**: The desired behavior - vehicles with no damage keywords should be assessed as MINOR/NONE severity with 90-95% salvage value
- **Preservation**: Existing damage detection for genuinely damaged vehicles must remain unchanged
- **calculateDamageScore**: The function in `ai-assessment-enhanced.service.ts` that analyzes Vision API labels and returns damage scores by category
- **identifyDamagedComponents**: The function that converts damage scores into component-level damage inputs for deduction calculations
- **DAMAGE_THRESHOLD**: The minimum score (30) required to consider a category as having significant damage
- **damageKeywords**: The explicit list of damage-related terms that indicate actual damage (e.g., "damaged", "broken", "crack", "dent")

## Bug Details

### Fault Condition

The bug manifests when Google Vision API returns only normal car part labels (e.g., "Bumper", "Door", "Windshield", "Hood") without any damage-specific keywords, but the system still calculates non-zero damage scores and reports MODERATE or SEVERE damage severity.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type VehicleAssessment {
    visionLabels: Array<{description: string, score: number}>,
    damageScore: DamageScore,
    damageSeverity: 'none' | 'minor' | 'moderate' | 'severe',
    salvageValue: number,
    marketValue: number
  }
  OUTPUT: boolean
  
  // Check if labels contain NO damage keywords
  damageKeywords := ['damage', 'damaged', 'broken', 'crack', 'cracked', 
                     'dent', 'dented', 'scratch', 'scratched', 'rust', 
                     'rusted', 'collision', 'bent', 'crushed', 'shattered', 
                     'torn', 'missing', 'detached', 'smashed', 'destroyed', 
                     'wrecked', 'wreck', 'junk', 'salvage', 'totaled']
  
  hasNoDamageKeywords := NOT EXISTS label IN input.visionLabels WHERE
    label.description.toLowerCase() CONTAINS_ANY damageKeywords
  
  // Check if labels are only normal car parts
  normalCarParts := ['car', 'bumper', 'door', 'windshield', 'hood', 
                     'fender', 'wheel', 'tire', 'mirror', 'headlight', 
                     'taillight', 'sedan', 'vehicle', 'trunk', 'roof']
  
  hasOnlyCarPartLabels := ALL labels IN input.visionLabels 
    WHERE label.description.toLowerCase() IN normalCarParts
  
  // Check if system incorrectly reports damage
  incorrectSeverity := input.damageSeverity IN ['moderate', 'severe']
  
  lowSalvageRatio := (input.salvageValue / input.marketValue) < 0.80
  
  RETURN hasNoDamageKeywords AND hasOnlyCarPartLabels AND 
         (incorrectSeverity OR lowSalvageRatio)
END FUNCTION
```

### Examples

- **Example 1**: 2021 Toyota Camry in excellent condition with 6 photos showing pristine exterior
  - Vision labels: ["Car", "Bumper", "Door", "Windshield", "Hood", "Sedan"]
  - Expected: MINOR/NONE severity, 90-95% salvage value
  - Actual (before fix): MODERATE severity, 25% salvage value

- **Example 2**: 2020 Honda Accord with no visible damage, well-maintained
  - Vision labels: ["Vehicle", "Wheel", "Tire", "Mirror", "Headlight"]
  - Expected: MINOR/NONE severity, 90-95% salvage value
  - Actual (before fix): MODERATE severity, 30% salvage value

- **Example 3**: 2019 Toyota Corolla with minor scratches (actual damage)
  - Vision labels: ["Car", "Bumper", "Scratched", "Door", "Minor damage"]
  - Expected: MINOR severity, 75-85% salvage value
  - Actual: MINOR severity, 75-85% salvage value (correct behavior)

- **Edge Case**: Vehicle with very light wear but no explicit damage keywords
  - Vision labels: ["Car", "Bumper", "Door", "Faded paint"]
  - Expected: MINOR severity, 85-90% salvage value (slight reduction for wear)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Vehicles with actual damage keywords must continue to be detected as MODERATE or SEVERE appropriately
- Damage score calculation for genuinely damaged vehicles must remain unchanged
- Market value calculation using database-first approach must remain unchanged
- Condition adjustments and mileage adjustments must continue to work as before
- Salvage value calculations for damaged vehicles must continue to apply appropriate deductions

**Scope:**
All inputs that do NOT involve undamaged vehicles (i.e., vehicles with actual damage keywords in Vision API labels) should be completely unaffected by this fix. This includes:
- Vehicles with explicit damage keywords in Vision labels
- Vehicles with structural, mechanical, or cosmetic damage
- Vehicles with collision or accident damage
- All existing damage severity calculations for genuinely damaged vehicles

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes have been identified:

1. **Incorrect Damage Keyword Detection (PARTIALLY FIXED)**: The `calculateDamageScore` function has been updated to check for explicit damage keywords, but we need to verify it's working correctly
   - The function now returns all zeros when no damage keywords are detected
   - The damageKeywords array includes comprehensive damage-related terms

2. **Low Damage Threshold (FIXED)**: The `identifyDamagedComponents` function has been updated to use a threshold of 30 instead of 0
   - Old behavior: Any score > 0 triggered damage component identification
   - New behavior: Only scores > 30 are considered significant damage
   - This prevents false positives from low-confidence detections

3. **Potential Edge Cases**: There may be edge cases where the fixes don't fully address the issue
   - Vision API might return ambiguous labels that aren't clearly damage or normal parts
   - The threshold of 30 might need fine-tuning based on real-world testing
   - Market value calculations might need adjustment for excellent condition vehicles

4. **Testing Gap**: The fixes have been implemented but may not have been thoroughly tested with real-world data
   - Need to verify with actual photos of undamaged vehicles
   - Need to ensure preservation of damage detection for genuinely damaged vehicles

## Correctness Properties

Property 1: Fault Condition - Correct Assessment for Undamaged Vehicles

_For any_ vehicle assessment where Google Vision API returns only normal car part labels without damage keywords (isBugCondition returns true), the fixed AI assessment function SHALL return damage severity as MINOR or NONE, all damage category scores below 10, salvage value at 90-95% of market value, and an empty or minimal detected damage list.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Accurate Damage Detection for Damaged Vehicles

_For any_ vehicle assessment where Google Vision API returns labels containing explicit damage keywords (isBugCondition returns false), the fixed AI assessment function SHALL produce the same damage severity, damage scores (within 5%), salvage value (within 5%), and detected damage list as the original function, preserving accurate damage detection for genuinely damaged vehicles.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

The fixes have already been implemented in the codebase, but we need to verify and potentially refine them:

**File**: `src/features/cases/services/ai-assessment-enhanced.service.ts`

**Function**: `calculateDamageScore`

**Specific Changes**:
1. **Damage Keyword Detection (IMPLEMENTED)**: The function now checks for explicit damage keywords before scoring
   - Returns all zeros when no damage keywords are detected
   - Only processes labels that contain damage-related terms
   - Logs detection results for debugging

2. **Verification Needed**: Ensure the damageKeywords array is comprehensive
   - Current keywords: 'damage', 'damaged', 'broken', 'crack', 'cracked', 'dent', 'dented', 'scratch', 'scratched', 'rust', 'rusted', 'collision', 'bent', 'crushed', 'shattered', 'torn', 'missing', 'detached', 'smashed', 'destroyed', 'wrecked', 'wreck', 'junk', 'salvage', 'totaled', 'debris', 'rubble', 'scrap', 'mangled', 'twisted', 'burned', 'fire damage', 'water damage', 'flood', 'corroded', 'corrosion'
   - May need to add more keywords based on real-world testing

**Function**: `identifyDamagedComponents`

**Specific Changes**:
1. **Raised Damage Threshold (IMPLEMENTED)**: Changed from 0 to 30
   - Old: `if (damageScore.structural > 0)`
   - New: `if (damageScore.structural > 30)`
   - Applied to all damage categories: structural, mechanical, cosmetic, electrical, interior

2. **Total Score Check (IMPLEMENTED)**: Added early return if total damage is below threshold
   - Calculates total damage score across all categories
   - Returns empty array if total < 30
   - Prevents false positives from low-confidence detections

3. **Logging (IMPLEMENTED)**: Added console logs for debugging
   - Logs when damage is below threshold
   - Logs when damage is detected with scores
   - Helps verify the fix is working correctly

**Function**: `getMarketValueWithScraping`

**Verification Needed**:
1. **Database-First Approach**: Ensure it correctly queries the valuation database
   - Should use user-provided condition category
   - Should apply mileage adjustment only (condition already in database price)
   - Should fall back to scraping if database doesn't have data

2. **Condition Adjustments**: Verify excellent condition vehicles get 90-95% of market value
   - Database prices should already reflect condition
   - Scraping fallback should apply condition adjustment correctly

**Function**: `determineSeverity`

**Verification Needed**:
1. **Severity Thresholds**: Ensure damage percentage thresholds are appropriate
   - Current: minor < 20%, moderate 20-50%, severe > 50%
   - With new threshold of 30, most undamaged vehicles should have 0% damage
   - Should result in MINOR or NONE severity for undamaged vehicles

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (if available), then verify the fix works correctly and preserves existing behavior.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Since the fix is already implemented, we'll verify it works correctly with real-world data.

**Test Plan**: Test with actual photos of vehicles in excellent condition (no visible damage) to verify the system correctly identifies them as MINOR/NONE severity with high salvage value. Use the existing test scripts to validate behavior.

**Test Cases**:
1. **Excellent Condition Vehicle Test**: Test 2021 Toyota Camry with 6 photos showing no visible damage
   - Expected: MINOR/NONE severity, 90-95% salvage value, empty damage list
   - Script: `scripts/test-2021-camry-excellent.ts`

2. **Good Condition Vehicle Test**: Test 2020 Honda Accord with well-maintained exterior
   - Expected: MINOR severity, 85-90% salvage value, minimal damage list
   - Create new test script if needed

3. **Multiple Undamaged Vehicles Test**: Test various makes/models in excellent condition
   - Expected: Consistent MINOR/NONE severity across all tests
   - Verify threshold of 30 is appropriate

4. **Edge Case - Light Wear Test**: Test vehicle with minor wear but no explicit damage
   - Expected: MINOR severity, 80-85% salvage value
   - Verify system doesn't over-penalize normal wear

**Expected Results**:
- All undamaged vehicles should have damage scores below 10 in all categories
- Salvage values should be 90-95% of market value for excellent condition
- Damage severity should be MINOR or NONE
- Detected damage list should be empty or contain only explicit damage keywords

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (undamaged vehicles), the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := assessDamageEnhanced_fixed(input)
  
  // Verify damage scores are minimal
  ASSERT result.damageScore.structural < 10
  ASSERT result.damageScore.mechanical < 10
  ASSERT result.damageScore.cosmetic < 10
  ASSERT result.damageScore.electrical < 10
  ASSERT result.damageScore.interior < 10
  
  // Verify severity is appropriate
  ASSERT result.severity IN ['none', 'minor']
  
  // Verify salvage value is high
  salvageRatio := result.salvageValue / result.marketValue
  ASSERT salvageRatio >= 0.90
  
  // Verify detected damage is minimal
  ASSERT (result.detectedDamage.length = 0) OR
         (ALL damage IN result.detectedDamage WHERE
          damage.component NOT IN ['structure', 'engine', 'body'])
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (vehicles with actual damage), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  // For vehicles with actual damage keywords
  result_fixed := assessDamageEnhanced_fixed(input)
  
  // Verify damage detection still works
  ASSERT result_fixed.severity IN ['moderate', 'severe'] 
    IF input.visionLabels CONTAINS damage_keywords
  
  // Verify damage scores are calculated correctly
  totalDamageScore := result_fixed.damageScore.structural +
                      result_fixed.damageScore.mechanical +
                      result_fixed.damageScore.cosmetic +
                      result_fixed.damageScore.electrical +
                      result_fixed.damageScore.interior
  
  ASSERT totalDamageScore > 30 IF actual damage exists
  
  // Verify salvage value reflects damage
  salvageRatio := result_fixed.salvageValue / result_fixed.marketValue
  ASSERT salvageRatio < 0.80 IF severe damage
  ASSERT salvageRatio BETWEEN 0.50 AND 0.80 IF moderate damage
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all damaged vehicles

**Test Plan**: Test with actual photos of damaged vehicles to verify damage detection still works correctly. Use existing test data or create new test cases with explicit damage.

**Test Cases**:
1. **Moderate Damage Preservation**: Test vehicle with visible dents and scratches
   - Expected: MODERATE severity, 50-70% salvage value
   - Verify damage detection works as before

2. **Severe Damage Preservation**: Test vehicle with structural damage or collision
   - Expected: SEVERE severity, 20-40% salvage value
   - Verify severe damage is still detected correctly

3. **Mixed Damage Preservation**: Test vehicle with multiple damage types
   - Expected: Appropriate severity based on damage extent
   - Verify all damage categories are scored correctly

4. **Edge Case - Borderline Damage**: Test vehicle with damage score around 30
   - Expected: Consistent behavior at threshold boundary
   - Verify threshold doesn't cause unexpected behavior

### Unit Tests

- Test `calculateDamageScore` with various label combinations (no damage, minor damage, severe damage)
- Test `identifyDamagedComponents` with scores at threshold boundaries (29, 30, 31)
- Test damage keyword detection with edge cases (partial matches, case sensitivity)
- Test market value calculations for excellent condition vehicles
- Test severity determination with various damage percentages

### Property-Based Tests

- Generate random Vision API label sets and verify damage detection is consistent
- Generate random vehicle conditions and verify salvage value calculations are appropriate
- Test that all undamaged vehicles (no damage keywords) result in MINOR/NONE severity
- Test that all damaged vehicles (with damage keywords) result in appropriate severity
- Verify threshold of 30 is consistently applied across all damage categories

### Integration Tests

- Test full AI assessment flow with real photos of undamaged vehicles
- Test full AI assessment flow with real photos of damaged vehicles
- Test database-first market value approach with various vehicle conditions
- Test that salvage value calculations use correct market values
- Test that condition adjustments are applied correctly for excellent condition vehicles
