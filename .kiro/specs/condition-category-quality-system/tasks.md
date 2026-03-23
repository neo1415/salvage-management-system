# Implementation Plan: Condition Category Quality System

## Overview

This plan implements a 4-tier quality-based vehicle condition categorization system to replace the existing 3-category system. The implementation follows a bottom-up approach: core services first, then data migration, then UI updates, and finally integration testing.

## Tasks

- [ ] 1. Implement Condition Mapping Service
  - [x] 1.1 Create condition mapping service with type definitions
    - Define QualityTier and LegacyCondition types
    - Implement mapLegacyToQuality function
    - Implement formatConditionForDisplay function
    - Implement getQualityTiers function
    - Implement isValidQualityTier function
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 7.1, 7.2_
  
  - [ ]* 1.2 Write property test for condition display formatting
    - **Property 1: Condition Display Formatting**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6**
  
  - [ ]* 1.3 Write property test for legacy condition mapping
    - **Property 7: Legacy Condition Mapping**
    - **Validates: Requirements 5.3, 7.1, 7.2**
  
  - [ ]* 1.4 Write property test for semantic meaning preservation
    - **Property 8: Semantic Meaning Preservation**
    - **Validates: Requirements 7.4**
  
  - [ ]* 1.5 Write unit tests for condition mapping service
    - Test each legacy value maps correctly
    - Test invalid values trigger fallback
    - Test logging behavior
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 2. Create database migration script
  - [x] 2.1 Create migration SQL file
    - Write migration script to update salvage_cases.vehicle_condition
    - Write migration script to update vehicle_valuations.condition_category
    - Write migration script to update market_data_cache.condition
    - Add audit log entry for migration
    - Wrap in transaction for atomicity
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 2.2 Create migration runner script
    - Write TypeScript script to execute migration
    - Add verification logic to check migration success
    - Add rollback capability for emergency use
    - _Requirements: 2.6_
  
  - [ ]* 2.3 Write property test for migration idempotency
    - **Property 5: Migration Idempotency**
    - **Validates: Requirements 2.6**
  
  - [ ]* 2.4 Write property test for migration data preservation
    - **Property 6: Migration Data Preservation**
    - **Validates: Requirements 2.5**
  
  - [ ]* 2.5 Write unit tests for migration script
    - Test specific legacy values are migrated correctly
    - Test idempotency (run twice, same result)
    - Test data preservation (non-condition fields unchanged)
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 3. Checkpoint - Verify core services and migration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update AI Assessment Service
  - [x] 4.1 Add quality tier determination logic
    - Add qualityTier field to DamageAssessmentResult interface
    - Implement determineQualityTier function
    - Update assessDamage function to include quality tier
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [ ]* 4.2 Write property test for AI assessment output validation
    - **Property 9: AI Assessment Output Validation**
    - **Validates: Requirements 4.1**
  
  - [ ]* 4.3 Write property test for AI damage-to-quality mapping
    - **Property 10: AI Damage-to-Quality Mapping**
    - **Validates: Requirements 4.2**
  
  - [ ]* 4.4 Write unit tests for AI assessment service
    - Test specific damage scenarios map to correct quality tiers
    - Test boundary cases (10%, 30%, 60% damage)
    - Test error handling
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 5. Update Valuation Query Service
  - [x] 5.1 Update valuation query service for quality tiers
    - Update ValuationQueryParams interface to use QualityTier type
    - Update queryValuation function to use quality tier values
    - Remove old queryWithFallback method (no longer needed)
    - Add input validation for condition parameter
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ]* 5.2 Write property test for valuation query input validation
    - **Property 11: Valuation Query Input Validation**
    - **Validates: Requirements 5.1**
  
  - [ ]* 5.3 Write property test for valuation query exact matching
    - **Property 12: Valuation Query Exact Matching**
    - **Validates: Requirements 5.2**
  
  - [ ]* 5.4 Write unit tests for valuation query service
    - Test query with each quality tier
    - Test query rejects invalid condition values
    - Test exact matching behavior
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 6. Update Market Data Scraper Service
  - [x] 6.1 Add condition normalization logic
    - Implement normalizeCondition function
    - Update scraper to use quality tier values
    - Add logging for unknown condition terms
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 6.2 Write property test for market data scraper output validation
    - **Property 13: Market Data Scraper Output Validation**
    - **Validates: Requirements 6.1**
  
  - [ ]* 6.3 Write unit tests for market data scraper
    - Test normalization of common market terms
    - Test edge cases (unknown terms, empty strings)
    - Test logging of unknown terms
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 7. Checkpoint - Verify all service updates
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Update UI components
  - [x] 8.1 Update case creation form
    - Update condition dropdown to show 4 quality tiers
    - Use getQualityTiers() for dropdown options
    - Store selected value as quality tier
    - _Requirements: 3.1, 3.2, 3.4_
  
  - [x] 8.2 Update case approval interface
    - Display condition using formatConditionForDisplay
    - Update any condition filtering to use quality tiers
    - _Requirements: 3.1, 3.3, 3.5_
  
  - [x] 8.3 Update vehicle autocomplete component
    - Update condition options if component includes condition selection
    - Use quality tier values
    - _Requirements: 3.1, 3.6_
  
  - [x] 8.4 Update auction listing pages
    - Display vehicle condition using formatConditionForDisplay
    - Update any condition filtering to use quality tiers
    - _Requirements: 3.1, 3.3, 3.7_
  
  - [ ]* 8.5 Write property test for UI storage round-trip
    - **Property 3: UI Storage Round-Trip**
    - **Validates: Requirements 3.2, 3.3**
  
  - [ ]* 8.6 Write property test for UI component consistency
    - **Property 4: UI Component Consistency**
    - **Validates: Requirements 3.1, 3.4, 3.5, 3.6, 3.7**
  
  - [ ]* 8.7 Write unit tests for UI components
    - Test dropdown renders all four options
    - Test selecting an option stores correct value
    - Test displaying stored value shows correct label
    - Test error handling for invalid values
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 9. Run database migration
  - [x] 9.1 Execute migration script on development database
    - Run migration script using migration runner
    - Verify all condition values are updated
    - Check audit logs for migration record
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  
  - [x] 9.2 Verify migration results
    - Query database to confirm all values are valid quality tiers
    - Verify no data loss occurred
    - Test UI displays updated values correctly
    - _Requirements: 2.5, 7.4_

- [ ] 10. Integration testing
  - [ ]* 10.1 Write integration test for complete case creation flow
    - Create case with each quality tier
    - Verify condition is stored correctly
    - Verify condition displays correctly in approval interface
    - Verify condition appears correctly in auction listing
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7_
  
  - [ ]* 10.2 Write integration test for AI assessment integration
    - Upload vehicle photos
    - Verify AI assigns valid quality tier
    - Verify quality tier is stored with case
    - Verify quality tier affects valuation query
    - _Requirements: 4.1, 4.2, 5.1, 5.2_
  
  - [ ]* 10.3 Write integration test for migration integration
    - Seed test database with legacy condition values
    - Run migration script
    - Verify all values are updated
    - Verify UI displays updated values correctly
    - Verify valuation queries work with new values
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1, 5.2_
  
  - [ ]* 10.4 Write integration test for backward compatibility
    - Test Condition_Mapping_Service handles legacy values
    - Test system logs translations
    - Test no data loss occurs
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [ ]* 10.5 Write property test for round-trip condition mapping
    - **Property 15: Round-Trip Condition Mapping**
    - **Validates: Requirements 8.1**
  
  - [ ]* 10.6 Write property test for quality tier value validation
    - **Property 2: Quality Tier Value Validation**
    - **Validates: Requirements 1.1, 2.1**
  
  - [ ]* 10.7 Write property test for condition translation logging
    - **Property 14: Condition Translation Logging**
    - **Validates: Requirements 7.3**

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Migration should be tested thoroughly in development before production deployment
- All UI components must be updated consistently to avoid confusion
- The system maintains backward compatibility through the Condition_Mapping_Service
