# Implementation Plan: Make-Specific Damage Deductions

## Overview

This implementation adds make-specific support to the damage deductions system, enabling the storage and querying of manufacturer-specific repair costs and valuation impacts. The plan includes database schema migration, data migration for existing records, import capabilities for new make-specific data, and updated query logic with fallback mechanisms.

## Tasks

- [x] 1. Create database migration script for schema changes
  - Create migration file `0007_add_make_specific_deductions.sql`
  - Add new columns: make, repairCostLow, repairCostHigh, valuationDeductionLow, valuationDeductionHigh, notes
  - Wrap all operations in a transaction for rollback safety
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 2. Implement data migration logic
  - [x] 2.1 Migrate existing Toyota records to new schema
    - Set make field to 'Toyota' for all existing records
    - Copy repairCostEstimate to both repairCostLow and repairCostHigh
    - Calculate valuationDeductionLow as valuationDeductionPercent * 0.90
    - Calculate valuationDeductionHigh as valuationDeductionPercent * 1.10
    - Copy description field content to notes field
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 2.2 Write property test for repair cost range conversion
    - **Property 1: Repair Cost Range Conversion Preserves Original Values**
    - **Validates: Requirements 2.6, 4.3**

  - [x] 2.3 Write property test for valuation deduction range calculation
    - **Property 2: Valuation Deduction Range Calculated from Original Percentage**
    - **Validates: Requirements 4.4**

  - [x] 2.4 Write property test for description migration
    - **Property 3: Description Content Migrated to Notes**
    - **Validates: Requirements 4.5**

  - [x] 2.5 Write property test for make field assignment
    - **Property 4: All Migrated Records Have Toyota Make**
    - **Validates: Requirements 4.2**

- [ ] 3. Update database constraints and indexes
  - [x] 3.1 Drop old unique constraint on (component, damageLevel)
    - Remove existing constraint before adding new one
    - _Requirements: 3.1_

  - [x] 3.2 Add new unique constraint on (make, component, damageLevel)
    - Ensure constraint allows NULL make for generic deductions
    - Verify no constraint violations exist before applying
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.3 Create index on make field for query performance
    - Add index idx_deductions_make
    - _Requirements: 6.3_

  - [x] 3.4 Write property test for unique constraint behavior
    - **Property 5: Unique Constraint Prevents Duplicate Make-Component-Level Combinations**
    - **Property 6: Different Makes Allow Same Component-Level Combinations**
    - **Validates: Requirements 3.1, 3.2**

- [x] 4. Drop deprecated columns
  - Remove repairCostEstimate, valuationDeductionPercent, and description fields
  - Only drop after successful data migration to new fields
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 5. Add migration validation and rollback logic
  - [x] 5.1 Implement validation checks
    - Verify all records have non-null make values after migration
    - Verify all range fields contain valid numeric values
    - Verify low <= high for all range fields
    - Verify record count matches before and after migration
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 5.2 Implement rollback on validation failure
    - Rollback entire transaction if any validation fails
    - Output detailed error messages with failure details
    - _Requirements: 8.4_

  - [x] 5.3 Write property test for post-migration data validity
    - **Property 11: All Records Have Non-Null Make After Migration**
    - **Property 12: All Range Fields Valid After Migration**
    - **Validates: Requirements 8.2, 8.3**

- [x] 6. Create migration execution script
  - Create `scripts/run-migration-0007.ts` to execute the migration
  - Add database connection and transaction handling
  - Add logging for migration progress and results
  - Add verification queries to confirm success
  - _Requirements: 4.1, 8.1_

- [x] 7. Checkpoint - Test migration on development database
  - Run migration script on test database
  - Verify all 22 Toyota records are preserved
  - Verify schema changes are correct
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Create Audi damage deductions import script
  - [x] 8.1 Create import script structure
    - Create `scripts/import-audi-damage-deductions.ts`
    - Define DeductionImportRecord interface
    - Implement upsert logic (insert or update if exists)
    - _Requirements: 5.1, 5.5_

  - [x] 8.2 Add Audi-specific deduction data
    - Include all 35 Audi damage deduction records
    - Set make field to 'Audi' for all records
    - Use range-based fields for repair costs and valuation deductions
    - Populate notes field with Audi-specific repair guidance
    - _Requirements: 5.2, 5.3, 5.4_

  - [x] 8.3 Implement data validation
    - Validate all numeric fields are non-negative
    - Validate low values <= high values
    - Validate required fields are populated
    - Log validation errors with record details
    - _Requirements: 5.3_

  - [ ] 8.4 Write property test for imported record validity
    - **Property 7: Imported Records Have Valid Data**
    - **Validates: Requirements 5.2, 5.3, 5.4**

  - [ ] 8.5 Write property test for upsert behavior
    - **Property 8: Import Script Upserts Existing Records**
    - **Validates: Requirements 5.5**

- [ ] 9. Update damage calculation service
  - [x] 9.1 Update getDeduction method signature
    - Add optional make parameter to method
    - Maintain backward compatibility with existing calls
    - _Requirements: 6.1_

  - [x] 9.2 Implement make-specific query logic
    - Query for (make, component, damageLevel) when make provided
    - Fall back to (NULL make, component, damageLevel) if no result
    - Use default deduction percentages if still no result
    - Use midpoint of range values for calculations
    - _Requirements: 6.1, 6.2_

  - [ ] 9.3 Write property test for make-specific query
    - **Property 9: Make-Specific Query Returns Matching Records**
    - **Validates: Requirements 6.1**

  - [ ] 9.4 Write property test for query fallback logic
    - **Property 10: Query Falls Back to Generic Deductions**
    - **Validates: Requirements 6.2**

  - [ ] 9.5 Write unit tests for damage calculation service
    - Test make-specific query returns correct records
    - Test fallback to generic deductions
    - Test query with non-existent make
    - Test midpoint calculation for range values
    - _Requirements: 6.1, 6.2_

- [x] 10. Update database schema TypeScript definitions
  - Update `src/lib/db/schema/vehicle-valuations.ts` with new fields
  - Add make field as nullable varchar
  - Replace single-value fields with range fields
  - Update DamageDeduction interface
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4_

- [x] 11. Update AI assessment service integration
  - Update calls to damage calculation service to pass vehicle make
  - Ensure make is extracted from vehicle context
  - Test integration with make-specific deductions
  - _Requirements: 6.1_

- [x] 12. Create verification script
  - Create `scripts/verify-migration-0007.ts` to check migration results
  - Add queries to verify record counts
  - Add queries to verify data integrity
  - Add queries to verify constraint and index creation
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 13. Integration testing
  - [ ]* 13.1 Write integration test for migration script
    - Test migration runs successfully on test database
    - Verify Toyota records are preserved with correct values
    - Verify deprecated fields are removed
    - Verify indexes and constraints are created
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 7.3_

  - [ ]* 13.2 Write integration test for import script
    - Test Audi import creates exactly 35 records
    - Test upsert behavior with duplicate data
    - Test validation rejects invalid data
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 13.3 Write integration test for query service
    - Test make-specific query with real database
    - Test fallback to generic deductions
    - Test query performance with indexes
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Run all unit tests and property tests
  - Run integration tests against test database
  - Verify no regressions in existing damage calculation functionality
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Migration is wrapped in transaction for rollback safety
- Import script uses upsert to handle duplicate data gracefully
