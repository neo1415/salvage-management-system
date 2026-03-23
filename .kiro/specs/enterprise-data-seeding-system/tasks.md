# Implementation Plan: Enterprise-Grade Data Seeding System

## Overview

This implementation plan converts the existing ad-hoc vehicle data import scripts into an enterprise-grade seeding system with idempotent operations, seed registry tracking, and automatic deployment integration. The system preserves the familiar user workflow (paste data → create script → run script) while adding production-ready features.

## Implementation Approach

- Phase 1: Core infrastructure (registry, services, templates)
- Phase 2: Convert existing 7 makes to new pattern
- Phase 3: Auto-deployment integration
- Phase 4: Testing and documentation

## Tasks

- [x] 1. Create database schema and migration for seed registry
  - Create migration file 0008_add_seed_registry.sql
  - Define seed_registry table with columns: id, script_name, executed_at, status, records_affected, records_imported, records_updated, records_skipped, error_message, execution_time_ms, created_at, updated_at
  - Add indexes on script_name, status, and executed_at
  - Create Drizzle schema definition in src/lib/db/schema/seed-registry.ts
  - _Requirements: 5.2, 11.1_

- [ ]* 1.1 Write property test for seed registry schema
  - **Property 6: Registry Tracking Completeness**
  - **Validates: Requirements 5.3, 11.2, 11.3, 11.4**

- [ ] 2. Implement Seed Registry Service
  - [x] 2.1 Create SeedRegistryService class in src/features/seeds/services/seed-registry.service.ts
    - Implement hasBeenExecuted(scriptName) method
    - Implement recordStart(scriptName) method returning registry ID
    - Implement recordSuccess(registryId, stats) method
    - Implement recordFailure(registryId, error, executionTimeMs) method
    - Implement getHistory(scriptName) method
    - Implement getAllExecutions() method
    - Implement cleanupStaleEntries() method for entries running > 1 hour
    - _Requirements: 5.2, 5.3, 5.4, 11.2, 11.3, 11.4_

  - [x] 2.2 Write unit tests for SeedRegistryService
    - Test recording seed execution start
    - Test updating registry on successful completion
    - Test updating registry on failure
    - Test hasBeenExecuted returns true for completed seeds
    - Test hasBeenExecuted returns false for non-existent seeds
    - Test cleanup of stale running entries
    - _Requirements: 11.2, 11.3, 11.4_

  - [ ]* 2.3 Write property test for registry-based skip logic
    - **Property 7: Registry-Based Skip Logic**
    - **Validates: Requirements 5.4**

- [ ] 3. Implement Batch Processor Service
  - [x] 3.1 Create BatchProcessor class in src/features/seeds/services/batch-processor.service.ts
    - Implement processBatch(records, batchSize, processor) method
    - Process records in batches of 50
    - Provide progress indicators (batch N/total)
    - Aggregate results across batches (imported, updated, skipped, errors)
    - Handle batch-level failures with fallback to individual processing
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ]* 3.2 Write unit tests for BatchProcessor
    - Test batch processing with 150 records creates 3 batches
    - Test progress indicators are displayed
    - Test batch failure falls back to individual processing
    - Test aggregation of results across batches
    - _Requirements: 13.1, 13.2, 13.3_

- [ ] 4. Implement Validation Service
  - [x] 4.1 Create ValidationService class in src/features/seeds/services/validation.service.ts
    - Implement validateValuation(record) method
    - Validate required fields: make, model, year, conditionCategory, lowPrice, highPrice, averagePrice, dataSource
    - Validate lowPrice <= averagePrice <= highPrice
    - Validate year is between 1900 and 2100
    - Implement validateDeduction(record) method
    - Validate required fields: make, component, damageLevel, repairCostLow, repairCostHigh, valuationDeductionLow, valuationDeductionHigh
    - Validate damageLevel is one of: minor, moderate, severe
    - Validate repairCostLow <= repairCostHigh
    - Validate valuationDeductionLow <= valuationDeductionHigh
    - Return ValidationResult with valid flag and errors array
    - _Requirements: 8.3, 12.1, 12.2, 12.3, 12.4_

  - [x] 4.2 Write unit tests for ValidationService
    - Test valuation with missing required fields
    - Test valuation with invalid price range (lowPrice > highPrice)
    - Test valuation with averagePrice outside range
    - Test valuation with invalid year
    - Test deduction with missing required fields
    - Test deduction with invalid damage level enum
    - Test deduction with invalid repair cost range
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 4.3 Write property test for required field validation
    - **Property 3: Required Field Validation**
    - **Validates: Requirements 8.3, 12.1**

  - [ ]* 4.4 Write property test for range validation
    - **Property 4: Range Validation**
    - **Validates: Requirements 12.2, 12.3**

  - [ ]* 4.5 Write property test for validation error handling
    - **Property 12: Validation Error Handling**
    - **Validates: Requirements 12.4**

- [ ] 5. Implement Idempotent Upsert Service
  - [x] 5.1 Create IdempotentUpsertService class in src/features/seeds/services/idempotent-upsert.service.ts
    - Implement upsertValuation(valuation) method
    - Check for existing record using unique constraint (make, model, year, conditionCategory)
    - If exists, update record preserving createdAt and createdBy
    - If not exists, insert new record with System User as createdBy
    - Convert numeric values to decimal string format
    - Log audit entry for all modifications
    - Return UpsertResult with action (inserted/updated/skipped) and recordId
    - Implement upsertDeduction(deduction) method
    - Check for existing record using unique constraint (make, component, damageLevel)
    - Follow same update/insert logic as valuations
    - Implement private logAudit() method for audit logging
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 8.4, 8.5, 9.2, 9.3_

  - [ ]* 5.2 Write unit tests for IdempotentUpsertService
    - Test inserting new valuation record
    - Test updating existing valuation record
    - Test preserving createdAt on update
    - Test System User attribution on insert
    - Test numeric to decimal conversion
    - Test audit log creation for inserts
    - Test audit log creation for updates
    - Test inserting new deduction record
    - Test updating existing deduction record
    - _Requirements: 2.1, 2.2, 8.4, 8.5, 9.2, 9.3_

  - [ ]* 5.3 Write property test for idempotent seed execution
    - **Property 1: Idempotent Seed Execution**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.6**

  - [ ]* 5.4 Write property test for unique constraint enforcement
    - **Property 2: Unique Constraint Enforcement**
    - **Validates: Requirements 2.4, 2.5**

  - [ ]* 5.5 Write property test for createdAt preservation
    - **Property 8: CreatedAt Preservation**
    - **Validates: Requirements 9.2**

  - [ ]* 5.6 Write property test for audit log completeness
    - **Property 9: Audit Log Completeness**
    - **Validates: Requirements 9.3**

  - [ ]* 5.7 Write property test for System User attribution
    - **Property 10: System User Attribution**
    - **Validates: Requirements 8.5**

  - [ ]* 5.8 Write property test for numeric to decimal conversion
    - **Property 11: Numeric to Decimal Conversion**
    - **Validates: Requirements 8.4**

- [ ] 6. Create seed script templates
  - [x] 6.1 Create template directory structure
    - Create scripts/seeds/_template/ directory
    - _Requirements: 7.1, 7.2_

  - [x] 6.2 Create valuation seed template at scripts/seeds/_template/make-valuations.seed.ts
    - Include imports for db, schema, services
    - Define SYSTEM_USER_ID, SCRIPT_NAME, BATCH_SIZE constants
    - Include rawData array placeholder with example data
    - Implement transformToDbRecords() function
    - Implement main executeSeed() function
    - Check registry for previous execution (skip unless --force)
    - Support --dry-run flag for validation without changes
    - Record start in registry
    - Transform data and process in batches
    - Handle errors gracefully with try-catch per record
    - Record success/failure in registry
    - Print comprehensive summary report
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 14.1, 14.2_

  - [x] 6.3 Create deduction seed template at scripts/seeds/_template/make-damage-deductions.seed.ts
    - Follow same structure as valuation template
    - Adapt transformToDbRecords() for deduction data format
    - Use deduction-specific validation
    - _Requirements: 7.2, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 6.4 Write property test for error isolation
    - **Property 5: Error Isolation**
    - **Validates: Requirements 3.1, 3.5**

  - [ ]* 6.5 Write property test for dry-run non-modification
    - **Property 13: Dry-Run Non-Modification**
    - **Validates: Requirements 14.2**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Convert Mercedes scripts to new pattern
  - [x] 8.1 Create scripts/seeds/mercedes/ directory
    - _Requirements: 4.2_

  - [x] 8.2 Convert scripts/import-mercedes-valuations.ts to scripts/seeds/mercedes/mercedes-valuations.seed.ts
    - Copy raw data from original script
    - Use valuation seed template structure
    - Implement transformation logic for Mercedes data format
    - Test with --dry-run flag
    - Verify data equivalence with original script
    - _Requirements: 6.1, 6.3, 6.6_

  - [x] 8.3 Convert scripts/import-mercedes-damage-deductions.ts to scripts/seeds/mercedes/mercedes-damage-deductions.seed.ts
    - Copy raw data from original script
    - Use deduction seed template structure
    - Implement transformation logic for Mercedes deduction format
    - Test with --dry-run flag
    - _Requirements: 6.2, 6.3, 6.6_

- [x] 9. Convert Toyota scripts to new pattern
  - [x] 9.1 Create scripts/seeds/toyota/ directory
    - _Requirements: 4.2_

  - [x] 9.2 Convert all Toyota valuation scripts to scripts/seeds/toyota/toyota-valuations.seed.ts
    - Consolidate data from scripts/import-toyota-*.ts files
    - Use valuation seed template structure
    - Handle multiple Toyota models (Camry, Corolla, RAV4, Prado, Venza, Avalon, Sienna)
    - Test with --dry-run flag
    - _Requirements: 6.1, 6.3, 6.6_

  - [x] 9.3 Convert Toyota damage deduction script to scripts/seeds/toyota/toyota-damage-deductions.seed.ts
    - Copy raw data from original script
    - Use deduction seed template structure
    - Test with --dry-run flag
    - _Requirements: 6.2, 6.3, 6.6_

- [x] 10. Convert Nissan scripts to new pattern
  - [x] 10.1 Create scripts/seeds/nissan/ directory
    - _Requirements: 4.2_

  - [x] 10.2 Convert scripts/import-nissan-valuations.ts to scripts/seeds/nissan/nissan-valuations.seed.ts
    - Copy raw data from original script
    - Use valuation seed template structure
    - Test with --dry-run flag
    - _Requirements: 6.1, 6.3, 6.6_

  - [x] 10.3 Convert scripts/import-nissan-damage-deductions.ts to scripts/seeds/nissan/nissan-damage-deductions.seed.ts
    - Copy raw data from original script
    - Use deduction seed template structure
    - Test with --dry-run flag
    - _Requirements: 6.2, 6.3, 6.6_

- [-] 11. Convert Hyundai scripts to new pattern
  - [x] 11.1 Create scripts/seeds/hyundai/ directory
    - _Requirements: 4.2_

  - [x] 11.2 Convert scripts/import-hyundai-kia-valuations.ts (Hyundai portion) to scripts/seeds/hyundai/hyundai-valuations.seed.ts
    - Extract Hyundai data from combined script
    - Use valuation seed template structure
    - Test with --dry-run flag
    - _Requirements: 6.1, 6.3, 6.6_

  - [x] 11.3 Convert scripts/import-hyundai-kia-damage-deductions.ts (Hyundai portion) to scripts/seeds/hyundai/hyundai-damage-deductions.seed.ts
    - Extract Hyundai data from combined script
    - Use deduction seed template structure
    - Test with --dry-run flag
    - _Requirements: 6.2, 6.3, 6.6_

- [x] 12. Convert Kia scripts to new pattern
  - [x] 12.1 Create scripts/seeds/kia/ directory
    - _Requirements: 4.2_

  - [x] 12.2 Convert scripts/import-hyundai-kia-valuations.ts (Kia portion) to scripts/seeds/kia/kia-valuations.seed.ts
    - Extract Kia data from combined script
    - Use valuation seed template structure
    - Test with --dry-run flag
    - _Requirements: 6.1, 6.3, 6.6_

  - [x] 12.3 Convert scripts/import-hyundai-kia-damage-deductions.ts (Kia portion) to scripts/seeds/kia/kia-damage-deductions.seed.ts
    - Extract Kia data from combined script
    - Use deduction seed template structure
    - Test with --dry-run flag
    - _Requirements: 6.2, 6.3, 6.6_

- [x] 13. Convert Lexus scripts to new pattern
  - [x] 13.1 Create scripts/seeds/lexus/ directory
    - _Requirements: 4.2_

  - [x] 13.2 Convert scripts/import-lexus-valuations.ts to scripts/seeds/lexus/lexus-valuations.seed.ts
    - Copy raw data from original script
    - Use valuation seed template structure
    - Test with --dry-run flag
    - _Requirements: 6.1, 6.3, 6.6_

  - [x] 13.3 Convert scripts/import-lexus-damage-deductions.ts to scripts/seeds/lexus/lexus-damage-deductions.seed.ts
    - Copy raw data from original script
    - Use deduction seed template structure
    - Test with --dry-run flag
    - _Requirements: 6.2, 6.3, 6.6_

- [x] 14. Convert Audi scripts to new pattern
  - [x] 14.1 Create scripts/seeds/audi/ directory
    - _Requirements: 4.2_

  - [x] 14.2 Convert scripts/import-audi-valuations-direct.ts to scripts/seeds/audi/audi-valuations.seed.ts
    - Copy raw data from original script
    - Use valuation seed template structure
    - Test with --dry-run flag
    - _Requirements: 6.1, 6.3, 6.6_

  - [x] 14.3 Convert scripts/import-audi-damage-deductions.ts to scripts/seeds/audi/audi-damage-deductions.seed.ts
    - Copy raw data from original script
    - Use deduction seed template structure
    - Test with --dry-run flag
    - _Requirements: 6.2, 6.3, 6.6_

- [ ]* 14.4 Write property test for data equivalence after migration
  - **Property 14: Data Equivalence After Migration**
  - **Validates: Requirements 6.6**

- [x] 15. Checkpoint - Verify all conversions complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Create Master Seed Runner
  - [x] 16.1 Create scripts/seeds/run-all-seeds.ts
    - Implement discoverSeeds() function using glob pattern
    - Sort seeds by make alphabetically, valuations before deductions
    - Implement runSeed(seed, flags) function using child_process.exec
    - Implement runAllSeeds() main function
    - Support --force, --dry-run, and --fail-fast flags
    - Provide comprehensive summary report
    - Exit with non-zero code if any seed fails
    - _Requirements: 4.4, 5.1_

  - [ ]* 16.2 Write integration test for master seed runner
    - Test discovery of all seed scripts
    - Test execution order (alphabetical by make, valuations first)
    - Test --force flag propagation
    - Test --dry-run flag propagation
    - Test --fail-fast behavior
    - Test summary report generation
    - _Requirements: 4.4, 5.1_

- [x] 17. Create comprehensive README documentation
  - [x] 17.1 Create scripts/seeds/README.md
    - Overview section explaining the seed system architecture
    - Quick Start section with common commands
    - Running Existing Seeds section
    - Adding New Vehicle Make section with step-by-step guide
    - Data Format section with examples for valuations and deductions
    - Architecture section explaining idempotence, batch processing, registry tracking
    - Troubleshooting section with common issues and solutions
    - _Requirements: 4.5, 7.3, 7.4, 7.5, 7.6, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [x] 18. Integrate with deployment pipeline
  - [x] 18.1 Add seed execution to database migration workflow
    - Create src/lib/db/migrations/run-seeds-after-migration.ts
    - Implement runSeedsAfterMigration() function
    - Call master seed runner after migrations complete
    - Handle seed failures gracefully (log but don't fail deployment)
    - _Requirements: 5.1, 5.5_

  - [x] 18.2 Update Vercel deployment configuration
    - Add db:seed script to package.json
    - Update vercel.json buildCommand to include seed execution
    - Add SKIP_SEEDS environment variable support
    - _Requirements: 5.1_

  - [x] 18.3 Update Docker deployment configuration
    - Update Dockerfile CMD to run migrations and seeds
    - Add environment variable support for SKIP_SEEDS and FORCE_SEEDS
    - _Requirements: 5.1_

- [x] 19. Create utility scripts
  - [x] 19.1 Create scripts/seeds/view-registry.ts
    - Query and display seed execution history
    - Show script name, status, execution time, record counts
    - Support filtering by status and date range
    - _Requirements: 11.5_

  - [x] 19.2 Create scripts/seeds/cleanup-registry.ts
    - Implement cleanup of stale 'running' entries
    - Support --reset flag to clear all registry entries
    - Require confirmation for destructive operations
    - _Requirements: 11.4_

- [ ]* 20. Write integration tests for complete seed workflow
  - Test complete seed execution from start to finish
  - Test registry tracking across multiple executions
  - Test idempotence by running seeds twice
  - Test error handling with invalid data
  - Test --force flag re-execution
  - Test --dry-run mode
  - Test batch processing with large datasets
  - _Requirements: 2.6, 3.1, 5.3, 5.4, 14.5_

- [ ]* 21. Write performance tests
  - Test importing 1000 records completes in < 60 seconds
  - Test batch operations are used for datasets > 100 records
  - Test memory usage remains stable during large imports
  - _Requirements: 13.1, 13.2, 13.4_

- [x] 22. Archive old import scripts
  - [x] 22.1 Create scripts/archive/ directory
    - _Requirements: 6.5_

  - [x] 22.2 Move old import scripts to archive
    - Move scripts/import-mercedes-*.ts
    - Move scripts/import-toyota-*.ts
    - Move scripts/import-nissan-*.ts
    - Move scripts/import-hyundai-kia-*.ts
    - Move scripts/import-lexus-*.ts
    - Move scripts/import-audi-*.ts
    - Add README.md in archive explaining these are superseded
    - _Requirements: 6.5_

- [ ] 23. Final checkpoint - Complete system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Phase 1 (tasks 1-7) establishes core infrastructure
- Phase 2 (tasks 8-15) converts all existing makes
- Phase 3 (tasks 16-19) adds automation and deployment integration
- Phase 4 (tasks 20-23) completes testing and cleanup
- System User ID (00000000-0000-0000-0000-000000000001) must exist before running seeds
- All seed operations are idempotent and safe to run multiple times
- Batch size of 50 records balances performance and memory usage
- Registry tracking prevents duplicate executions on fresh deployments
