# Implementation Plan

## Overview
This task list implements verification and testing for the AI damage detection false positives fix. The fixes have already been implemented in `calculateDamageScore` and `identifyDamagedComponents`, so the focus is on comprehensive testing to ensure the fixes work correctly and don't break existing damage detection.

---

## Tasks

- [x] 1. Write bug condition exploration test (BEFORE verifying fix)
  - **Property 1: Fault Condition** - Undamaged Vehicles Incorrectly Flagged as Damaged
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **NOTE**: Since fixes are already implemented, we'll verify the test would have failed before the fix
  - **GOAL**: Surface counterexamples that demonstrate the bug exists (or existed)
  - **Scoped PBT Approach**: Test with real vehicle photos showing no damage (pristine condition)
  - Test that vehicles with only normal car part labels (no damage keywords) are assessed as MINOR/NONE severity with 90-95% salvage value
  - Generate test cases with Vision API labels containing only: ["Car", "Bumper", "Door", "Windshield", "Hood", "Sedan", "Wheel", "Tire", "Mirror", "Headlight"]
  - Assert: damage severity is MINOR or NONE
  - Assert: all damage category scores < 10
  - Assert: salvage value >= 90% of market value
  - Assert: detected damage list is empty or minimal
  - Run test on CURRENT (fixed) code - expect PASS (confirms fix works)
  - Document that this test would have failed before the fix (based on bug reports)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Write preservation property tests (verify existing damage detection still works)
  - **Property 2: Preservation** - Damaged Vehicles Still Detected Correctly
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: Vehicles with damage keywords should still be detected as MODERATE/SEVERE
  - Write property-based test: for all vehicles with damage keywords in Vision labels, damage detection works correctly
  - Generate test cases with Vision API labels containing damage keywords: ["Damaged bumper", "Cracked windshield", "Dented door", "Broken headlight", "Scratched paint"]
  - Assert: damage severity is MODERATE or SEVERE (depending on extent)
  - Assert: damage category scores > 30 for affected categories
  - Assert: salvage value < 80% of market value
  - Assert: detected damage list contains appropriate components
  - Verify test passes on CURRENT (fixed) code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Verify and refine existing fixes

  - [x] 3.1 Verify calculateDamageScore implementation
    - Review damage keyword list for completeness
    - Test with edge cases: partial matches, case sensitivity, compound words
    - Verify early return when no damage keywords detected
    - Verify damage categorization logic (structural, mechanical, cosmetic, electrical, interior)
    - Add unit tests for various label combinations
    - _Bug_Condition: isBugCondition(input) where input.visionLabels contains only normal car parts_
    - _Expected_Behavior: Returns all zeros when no damage keywords detected_
    - _Preservation: Damage detection for genuinely damaged vehicles unchanged_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 3.2 Verify identifyDamagedComponents implementation
    - Test threshold of 30 with boundary cases (29, 30, 31)
    - Verify total score check prevents false positives
    - Test that empty array is returned when total < 30
    - Verify damage level mapping (minor/moderate/severe) is correct
    - Add unit tests for threshold edge cases
    - _Bug_Condition: isBugCondition(input) where damage scores are below threshold_
    - _Expected_Behavior: Returns empty array when total damage < 30_
    - _Preservation: Damage component identification for damaged vehicles unchanged_
    - _Requirements: 2.3, 2.4, 3.3, 3.4_

  - [x] 3.3 Verify market value calculations
    - Test database-first approach with excellent condition vehicles
    - Verify condition adjustments are applied correctly
    - Test mileage adjustments for various mileage ranges
    - Verify salvage value calculations use correct market values
    - Test that excellent condition vehicles get 90-95% salvage value
    - Add integration tests with real vehicle data
    - _Expected_Behavior: Excellent condition vehicles have 90-95% salvage value_
    - _Preservation: Market value calculations for damaged vehicles unchanged_
    - _Requirements: 2.5, 3.5_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Undamaged Vehicles Correctly Assessed
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Damaged Vehicles Still Detected Correctly
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after verification (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 4. Add comprehensive unit tests

  - [ ] 4.1 Unit tests for calculateDamageScore
    - Test with no damage keywords (expect all zeros)
    - Test with single damage keyword (expect appropriate category score)
    - Test with multiple damage keywords (expect multiple category scores)
    - Test with mixed normal and damage labels (expect only damage scored)
    - Test case sensitivity (lowercase, uppercase, mixed case)
    - Test partial matches (e.g., "damaged" matches "damage")
    - Test compound words (e.g., "fire damage", "water damage")
    - Test edge case: empty labels array
    - Test edge case: labels with very low confidence scores
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [ ] 4.2 Unit tests for identifyDamagedComponents
    - Test with total score < 30 (expect empty array)
    - Test with total score = 30 (boundary case)
    - Test with total score > 30 (expect damage components)
    - Test with single category > 30 (expect one component)
    - Test with multiple categories > 30 (expect multiple components)
    - Test damage level mapping: score 31-50 → minor, 51-70 → moderate, 71+ → severe
    - Test edge case: all categories exactly at threshold
    - Test edge case: one category very high, others zero
    - _Requirements: 2.3, 2.4, 3.3, 3.4_

  - [ ] 4.3 Unit tests for damage keyword detection
    - Test all keywords in damageKeywords array
    - Test that normal car part labels don't trigger damage detection
    - Test edge cases: "bumper" vs "damaged bumper"
    - Test edge cases: "door" vs "dented door"
    - Test edge cases: "windshield" vs "cracked windshield"
    - Test that keyword detection is case-insensitive
    - Test that partial matches work correctly
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [ ] 4.4 Unit tests for market value calculations
    - Test database-first approach with various conditions
    - Test condition adjustments: excellent (1.0), good (0.85), fair (0.70), poor (0.50)
    - Test mileage adjustments for low, average, and high mileage
    - Test salvage value calculation with various damage percentages
    - Test that excellent condition + no damage = 90-95% salvage value
    - Test edge case: user-provided market value
    - Test edge case: database query fails, falls back to scraping
    - Test edge case: scraping fails, falls back to estimation
    - _Requirements: 2.5, 3.5_

- [ ] 5. Add property-based tests

  - [ ] 5.1 Property test: Undamaged vehicles always assessed correctly
    - Generate random Vision API label sets with only normal car parts
    - For each generated input, verify:
      - All damage scores < 10
      - Severity is MINOR or NONE
      - Salvage value >= 90% of market value
      - Detected damage list is empty
    - Run 100+ test cases to ensure consistency
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 5.2 Property test: Damaged vehicles always detected
    - Generate random Vision API label sets with damage keywords
    - For each generated input, verify:
      - At least one damage score > 30
      - Severity is MODERATE or SEVERE (depending on extent)
      - Salvage value < 80% of market value
      - Detected damage list is not empty
    - Run 100+ test cases to ensure consistency
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 5.3 Property test: Threshold consistency
    - Generate random damage scores around threshold (25-35)
    - Verify that scores < 30 never trigger damage detection
    - Verify that scores > 30 always trigger damage detection
    - Verify that score = 30 is handled consistently
    - Test all damage categories (structural, mechanical, cosmetic, electrical, interior)
    - _Requirements: 2.3, 2.4, 3.3, 3.4_

  - [ ] 5.4 Property test: Salvage value calculations
    - Generate random vehicle conditions and damage percentages
    - Verify salvage value is always between 0% and 100% of market value
    - Verify excellent condition + no damage → 90-95% salvage value
    - Verify severe damage → 20-40% salvage value
    - Verify moderate damage → 50-70% salvage value
    - Verify calculations are monotonic (more damage = lower salvage value)
    - _Requirements: 2.5, 3.5_

- [ ] 6. Add integration tests with real vehicle photos

  - [ ] 6.1 Integration test: Excellent condition vehicle (2021 Toyota Camry)
    - Use existing test script: `scripts/test-2021-camry-excellent.ts`
    - Test with 6 photos of pristine vehicle
    - Verify Vision API returns only normal car part labels
    - Verify damage severity is MINOR or NONE
    - Verify salvage value is 90-95% of market value
    - Verify detected damage list is empty
    - Document results and compare to bug reports
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 6.2 Integration test: Good condition vehicle (2020 Honda Accord)
    - Create test with photos of well-maintained vehicle
    - Verify Vision API returns minimal or no damage keywords
    - Verify damage severity is MINOR
    - Verify salvage value is 85-90% of market value
    - Verify detected damage list is minimal
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 6.3 Integration test: Damaged vehicle (moderate damage)
    - Create test with photos of vehicle with visible dents/scratches
    - Verify Vision API returns damage keywords
    - Verify damage severity is MODERATE
    - Verify salvage value is 50-70% of market value
    - Verify detected damage list contains appropriate components
    - Confirm preservation of existing damage detection
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 6.4 Integration test: Severely damaged vehicle
    - Create test with photos of vehicle with structural damage
    - Verify Vision API returns severe damage keywords
    - Verify damage severity is SEVERE
    - Verify salvage value is 20-40% of market value
    - Verify detected damage list contains structural components
    - Confirm preservation of existing damage detection
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 6.5 Integration test: Edge case - light wear
    - Create test with photos of vehicle with minor wear but no explicit damage
    - Verify damage severity is MINOR
    - Verify salvage value is 80-85% of market value
    - Verify system doesn't over-penalize normal wear
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 7. Verify market value calculations are accurate

  - [ ] 7.1 Test database-first approach
    - Query valuation database for various makes/models/years
    - Verify correct condition category is used
    - Verify mileage adjustment is applied correctly
    - Verify condition adjustment is NOT applied (already in database price)
    - Test with vehicles in database vs not in database
    - _Requirements: 2.5, 3.5_

  - [ ] 7.2 Test scraping fallback
    - Test vehicles not in database
    - Verify scraping service is called correctly
    - Verify both mileage and condition adjustments are applied
    - Verify confidence scores are appropriate
    - Test error handling when scraping fails
    - _Requirements: 2.5, 3.5_

  - [ ] 7.3 Test estimation fallback
    - Test when both database and scraping fail
    - Verify estimation logic produces reasonable values
    - Verify confidence score is low (30%)
    - Test with various vehicle types and ages
    - _Requirements: 2.5, 3.5_

  - [ ] 7.4 Test salvage value calculations
    - Test with various damage percentages (0%, 10%, 30%, 50%, 70%, 90%)
    - Verify salvage value decreases as damage increases
    - Verify excellent condition + no damage = 90-95% salvage value
    - Verify severe damage = 20-40% salvage value
    - Verify calculations are consistent across different market values
    - _Requirements: 2.5, 3.5_

- [x] 8. Checkpoint - Ensure all tests pass
  - Run all unit tests and verify they pass
  - Run all property-based tests and verify they pass
  - Run all integration tests and verify they pass
  - Review test coverage and identify any gaps
  - Document any edge cases or issues discovered
  - Ensure no regressions in existing damage detection
  - Ask the user if questions arise

---

## Notes

- The fixes are already implemented in `calculateDamageScore` and `identifyDamagedComponents`
- Focus is on comprehensive testing to verify the fixes work correctly
- Property-based testing is used for stronger guarantees
- Integration tests use real vehicle photos to validate end-to-end behavior
- Preservation tests ensure existing damage detection is not broken
