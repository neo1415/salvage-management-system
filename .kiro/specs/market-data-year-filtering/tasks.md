# Implementation Plan: Market Data Year Filtering

## Overview

This implementation adds year-based filtering and validation to the existing market data scraping system. The work is organized into three main phases: (1) core year extraction and filtering services, (2) integration with existing scraper and aggregation, and (3) depreciation fallback and confidence scoring enhancements.

## Tasks

- [x] 1. Create year extraction service
  - Create `src/features/market-data/services/year-extraction.service.ts`
  - Implement `extractYear()` function with regex pattern `/\b(19[89]\d|20[0-9]\d)\b/`
  - Implement `isValidYear()` function with range validation (1980 to current year + 1)
  - Handle edge cases: multiple years (extract first), no year (return null), invalid range
  - _Requirements: 2.1, 2.5, 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 1.1 Write property test for year extraction robustness
  - **Property 2: Year Extraction Robustness**
  - **Validates: Requirements 2.1, 2.5, 7.1, 7.2, 7.3, 7.4**
  - Generate random listing titles with years in various positions and formats
  - Verify extraction succeeds for all valid years (1980-current+1)
  - Verify extraction returns null for invalid years or missing years

- [x] 1.2 Write unit tests for year extraction edge cases
  - Test multiple years in title (should extract first)
  - Test years at beginning, middle, end of title
  - Test various separators (spaces, dashes, slashes, none)
  - Test boundary years (1980, 1979, current year, current year + 2)
  - Test non-year 4-digit numbers (e.g., "2500cc engine")
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 2. Create year filter service
  - Create `src/features/market-data/services/year-filter.service.ts`
  - Define `YearFilterConfig`, `YearFilterResult` interfaces
  - Implement `filterByYear()` function with ±1 year tolerance
  - Calculate year match rate percentage
  - Track rejection reasons for debugging
  - _Requirements: 2.2, 2.3, 2.4, 4.1_

- [x] 2.1 Write property test for year tolerance validation
  - **Property 3: Year Tolerance Validation**
  - **Validates: Requirements 2.2, 2.3**
  - Generate random listings with various years
  - Verify listings within ±1 year are marked valid
  - Verify listings outside tolerance are rejected
  - Verify year match rate calculation is accurate

- [x] 2.2 Write unit tests for year filter edge cases
  - Test exact year match (should be valid)
  - Test ±1 year (should be valid)
  - Test ±2 years (should be rejected)
  - Test missing year in listing (should be rejected)
  - Test empty listing array
  - Test all listings rejected scenario
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 3. Enhance aggregation service with outlier detection
  - Modify `src/features/market-data/services/aggregation.service.ts`
  - Add `removeOutliers` option to `aggregatePrices()` function
  - Implement 2x median threshold for outlier detection
  - Calculate initial median, identify outliers, recalculate without outliers
  - Return outlier count in `AggregationResult`
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3.1 Write property test for outlier removal consistency
  - **Property 4: Outlier Removal Consistency**
  - **Validates: Requirements 3.1, 3.2**
  - Generate random price lists including extreme outliers
  - Verify final result contains no prices >2x final median
  - Verify outlier count is accurate

- [x] 3.2 Write unit tests for outlier detection edge cases
  - Test >50% outliers (should flag low confidence)
  - Test no outliers (should return original data)
  - Test all prices identical (no outliers)
  - Test single price (no outliers possible)
  - Test two prices (edge case for median calculation)
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure core filtering tests pass
  - Ensure all tests pass, ask the user if questions arise.



- [x] 5. Create depreciation service
  - Create `src/features/market-data/services/depreciation.service.ts`
  - Define `DepreciationConfig`, `DepreciationResult` interfaces
  - Implement `applyDepreciation()` function with tiered rates (15%, 10%, 5%)
  - Implement `getDepreciationRate()` helper function
  - Apply compound depreciation: `adjustedPrice = originalPrice * (1 - rate)^years`
  - Only adjust newer vehicles (year > targetYear)
  - Set minimum floor price of ₦100,000
  - Calculate confidence penalty (10 points per year, max 50)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 5.1 Write property test for depreciation calculation accuracy
  - **Property 5: Depreciation Calculation Accuracy**
  - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**
  - Generate random vehicle prices and year differences
  - Verify depreciation rates are correct for each age range (1-5, 6-10, 11+)
  - Verify compound depreciation formula is applied correctly
  - Verify only newer vehicles are adjusted

- [x] 5.2 Write unit tests for depreciation edge cases
  - Test vehicle older than target (should not adjust)
  - Test vehicle same year as target (should not adjust)
  - Test extreme depreciation resulting in <₦100k (should floor at ₦100k)
  - Test 1-year difference (15% rate)
  - Test 5-year difference (15% compounded 5 times)
  - Test 10-year difference (15% for 5 years, 10% for 5 years)
  - Test 15-year difference (all three rate tiers)
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 6. Integrate year filtering into scraper service
  - Modify `src/features/market-data/services/scraper.service.ts`
  - Import year extraction and year filter services
  - After parsing listings from HTML, extract year from each listing title
  - Store extracted year in `SourcePrice.extractedYear` field
  - Filter listings by year before returning `ScrapeResult`
  - Update `ScrapeResult` to include year filter metadata
  - Log rejection reasons and counts
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 8.3_

- [x] 6.1 Write integration test for scraper year filtering
  - Mock HTML responses with listings of various years
  - Verify only year-matched listings are returned
  - Verify extracted years are stored in results
  - Verify rejection metadata is included
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 7. Enhance market data service with year filtering orchestration
  - Modify `src/features/market-data/services/market-data.service.ts`
  - After collecting all source prices, calculate year match rate
  - If <3 year-matched listings, check if depreciation is applicable
  - If depreciation applicable, apply to newer listings
  - If <3 total listings after depreciation, throw error
  - Pass year match rate and depreciation flag to confidence calculation
  - Update `MarketPrice` response to include year match rate and depreciation flag
  - _Requirements: 4.1, 5.1, 6.1, 6.2, 6.3_

- [x] 7.1 Write integration test for market data year filtering flow
  - Test end-to-end: query → scrape → filter → aggregate
  - Test scenario: sufficient year-matched data (should not apply depreciation)
  - Test scenario: insufficient year-matched data (should apply depreciation)
  - Test scenario: insufficient total data (should throw error)
  - Verify confidence scores reflect year match quality
  - _Requirements: 4.1, 5.1, 6.1, 6.2, 6.3_

- [x] 8. Enhance confidence service with year match factors
  - Modify `src/features/market-data/services/confidence.service.ts`
  - Add `yearMatchRate`, `sampleSize`, `depreciationApplied` to `ConfidenceFactors`
  - Update confidence calculation to include year match rate deductions:
    - 70-100%: -0 points
    - 40-69%: -20 points
    - 0-39%: -40 points
  - Add sample size deductions:
    - <3 listings: -30 points
    - 3-5 listings: -15 points
    - 6+ listings: -0 points
  - Add depreciation penalty: -50 points if applied
  - Return warnings array for quality issues
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 5.6_

- [x] 8.1 Write property test for confidence score monotonicity
  - **Property 6: Confidence Score Monotonicity**
  - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
  - Generate pairs of results with same age/sample size but different year match rates
  - Verify higher year match rate always produces higher or equal confidence score
  - Verify confidence score ranges match requirements (90-100, 60-89, <60)

- [x] 8.2 Write unit tests for confidence calculation edge cases
  - Test all year match rate thresholds (70%, 40%, 39%)
  - Test all sample size thresholds (3, 5, 6)
  - Test depreciation penalty applied correctly
  - Test combined deductions don't go below 0
  - Test warnings are generated for quality issues
  - _Requirements: 4.2, 4.3, 4.4, 4.5, 5.6_

- [x] 9. Update TypeScript types for new fields
  - Modify `src/features/market-data/types/index.ts`
  - Add optional fields to `SourcePrice`: `extractedYear`, `yearMatched`, `depreciationApplied`, `originalPrice`, `depreciationRate`
  - Add fields to `MarketPrice`: `yearMatchRate`, `depreciationApplied`
  - Create `YearFilterMetadata` interface
  - Update `ConfidenceFactors` interface with new fields
  - _Requirements: All_

- [x] 9.1 Write property test for URL encoding safety
  - **Property 10: URL Encoding Safety**
  - **Validates: Requirements 1.4**
  - Generate random strings with special characters (spaces, &, ?, =, #, etc.)
  - Verify encoded URLs are valid according to RFC 3986
  - Verify special characters are properly escaped

- [x] 10. Add comprehensive logging for year filtering
  - Update `src/features/market-data/services/scraping-logger.service.ts`
  - Add log functions for year filtering stages
  - Log initial query string with year
  - Log listing counts at each filtering stage
  - Log outlier prices and removal reasons
  - Log depreciation calculations and adjustments
  - Log final confidence score and contributing factors
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 11. Checkpoint - Ensure all integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Update test script to validate year filtering
  - Modify `scripts/test-2004-honda-accord.ts` to show year filtering in action
  - Display year match rate in output
  - Display outliers removed count
  - Display depreciation applied flag
  - Display confidence score breakdown
  - Show before/after comparison of median prices
  - _Requirements: All_

- [x] 13. Create property test for minimum sample size enforcement
  - **Property 7: Minimum Sample Size Enforcement**
  - **Validates: Requirements 6.1**
  - Generate datasets with <3 valid listings
  - Verify error is thrown rather than returning estimate
  - Verify error message indicates insufficient data

- [x] 14. Create property test for year range boundary validation
  - **Property 8: Year Range Boundary Validation**
  - **Validates: Requirements 7.5**
  - Generate years outside valid range (< 1980, > current year + 1)
  - Verify these years are rejected as invalid
  - Verify boundary years (1980, current year + 1) are accepted

- [x] 15. Create property test for make/model pre-filtering
  - **Property 9: Make/Model Pre-filtering**
  - **Validates: Requirements 8.3**
  - Generate listings with mismatched makes/models
  - Verify these are rejected before year filtering
  - Verify year filtering is not attempted on rejected listings

- [x] 16. Final checkpoint - Run full test suite and validate with real data
  - Run all unit tests, property tests, and integration tests
  - Execute `scripts/test-2004-honda-accord.ts` and verify:
    - Year match rate is >70%
    - Median price is in expected range (₦2M-₦4.5M)
    - Outliers are removed (no ₦300M Lexus)
    - Confidence score is >80
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property/unit tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using `fast-check` library
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- The final checkpoint validates the fix with real-world data from the original bug report
