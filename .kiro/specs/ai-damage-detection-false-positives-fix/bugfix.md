# Bugfix Requirements Document

## Introduction

The AI damage detection system is incorrectly identifying normal car parts (bumper, door, windshield, etc.) as damage indicators when analyzing photos of vehicles in excellent condition. This results in unrealistic damage severity assessments (MODERATE instead of NONE/MINOR) and significantly undervalued salvage prices (25% of market value instead of 90-95% for excellent condition).

The root cause is that Google Vision API returns object labels for all car parts regardless of damage state, and the `calculateDamageScore` function treats these normal part labels as damage indicators without checking for explicit damage keywords.

This bug affects vendor trust in the AI assessment system and can lead to incorrect pricing decisions that impact both vendors and the business.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a vehicle photo shows no visible damage (excellent/good condition) THEN the system incorrectly detects damage severity as MODERATE or SEVERE

1.2 WHEN Google Vision API returns normal car part labels (e.g., "Bumper", "Door", "Windshield", "Hood", "Fender") THEN the system treats these labels as damage indicators

1.3 WHEN a vehicle has no visible damage THEN the system calculates salvage value at 25% of market value instead of 90-95%

1.4 WHEN analyzing photos of excellent condition vehicles THEN the detected damage list contains only normal car part names without any damage keywords

1.5 WHEN damage score is calculated THEN all damage categories (structural, cosmetic, mechanical, interior) receive non-zero scores even for undamaged vehicles

### Expected Behavior (Correct)

2.1 WHEN a vehicle photo shows no visible damage (excellent/good condition) THEN the system SHALL return damage severity as MINOR or NONE

2.2 WHEN Google Vision API returns normal car part labels without damage keywords THEN the system SHALL NOT treat these labels as damage indicators

2.3 WHEN a vehicle has no visible damage THEN the system SHALL calculate salvage value at 90-95% of market value for excellent condition

2.4 WHEN analyzing photos of excellent condition vehicles THEN the detected damage list SHALL be empty or contain only explicit damage keywords (e.g., "damaged", "broken", "crack", "dent", "scratch", "rust", "collision", "wreck")

2.5 WHEN damage score is calculated for undamaged vehicles THEN all damage categories SHALL have scores less than 10

2.6 WHEN actual damage exists in photos THEN the system SHALL detect explicit damage keywords and set severity to match visual assessment

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a vehicle photo shows actual visible damage with damage keywords THEN the system SHALL CONTINUE TO detect damage severity as MODERATE or SEVERE appropriately

3.2 WHEN Google Vision API returns labels containing explicit damage keywords THEN the system SHALL CONTINUE TO treat these as damage indicators

3.3 WHEN damage score calculation uses database-first approach for market value THEN the system SHALL CONTINUE TO query the vehicle valuation database before falling back to market data scraping

3.4 WHEN condition adjustments are applied to market value THEN the system SHALL CONTINUE TO use the existing condition multipliers

3.5 WHEN salvage value is calculated for genuinely damaged vehicles THEN the system SHALL CONTINUE TO apply appropriate deductions based on damage severity

## Bug Condition and Property Specification

### Bug Condition Function

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type VehicleAssessment {
    photos: Array<Photo>,
    vehicleInfo: VehicleInfo,
    visionLabels: Array<String>,
    damageScore: DamageScore,
    damageSeverity: Severity,
    salvageValue: Number,
    marketValue: Number
  }
  OUTPUT: boolean
  
  // Returns true when the bug condition is met
  hasNoDamageKeywords ← NOT EXISTS label IN X.visionLabels WHERE 
    label CONTAINS_ANY ["damage", "damaged", "broken", "crack", "dent", 
                        "scratch", "rust", "collision", "wreck", "bent", 
                        "shattered", "crushed", "torn"]
  
  hasOnlyCarPartLabels ← ALL labels IN X.visionLabels ARE_IN 
    ["Car", "Bumper", "Door", "Windshield", "Hood", "Fender", "Wheel", 
     "Tire", "Mirror", "Headlight", "Sedan", "Vehicle"]
  
  incorrectSeverity ← X.damageSeverity IN [MODERATE, SEVERE]
  
  lowSalvageRatio ← (X.salvageValue / X.marketValue) < 0.80
  
  RETURN hasNoDamageKeywords AND hasOnlyCarPartLabels AND 
         incorrectSeverity AND lowSalvageRatio
END FUNCTION
```

### Property: Fix Checking

```pascal
// Property: Fix Checking - Correct Assessment for Undamaged Vehicles
FOR ALL X WHERE isBugCondition(X) DO
  result ← assessVehicle'(X)
  
  ASSERT result.damageSeverity IN [NONE, MINOR]
  ASSERT ALL category IN result.damageScore WHERE category.score < 10
  ASSERT (result.salvageValue / result.marketValue) >= 0.90
  ASSERT (result.detectedDamage IS_EMPTY) OR 
         (ALL damage IN result.detectedDamage WHERE 
          damage CONTAINS_ANY ["damage", "damaged", "broken", "crack", 
                               "dent", "scratch", "rust"])
END FOR
```

### Property: Preservation Checking

```pascal
// Property: Preservation Checking - Maintain Correct Damage Detection
FOR ALL X WHERE NOT isBugCondition(X) DO
  // For vehicles with actual damage keywords
  originalResult ← assessVehicle(X)
  fixedResult ← assessVehicle'(X)
  
  ASSERT fixedResult.damageSeverity = originalResult.damageSeverity
  ASSERT fixedResult.damageScore ≈ originalResult.damageScore (within 5%)
  ASSERT fixedResult.salvageValue ≈ originalResult.salvageValue (within 5%)
  ASSERT fixedResult.detectedDamage = originalResult.detectedDamage
END FOR
```

### Key Definitions

- **F (assessVehicle)**: The original AI assessment function that incorrectly treats normal car part labels as damage
- **F' (assessVehicle')**: The fixed AI assessment function that distinguishes between normal parts and actual damage
- **Counterexample**: A 2021 Toyota Camry in excellent condition with 6 photos showing no visible damage, incorrectly assessed as MODERATE damage with 25% salvage value

### Validation Strategy

1. **Fix Validation**: Test with vehicles in excellent condition (no visible damage) to ensure MINOR/NONE severity and 90-95% salvage ratio
2. **Regression Prevention**: Test with genuinely damaged vehicles to ensure damage detection still works correctly
3. **Edge Cases**: Test with borderline cases (minor scratches, light wear) to ensure appropriate severity levels
