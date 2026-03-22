# Implementation Plan: Vehicle Valuation Database System

## Overview

This implementation plan converts the vehicle valuation database design into actionable coding tasks. The approach follows a layered architecture: database schema first, then core services, then integration with existing systems, and finally the admin interface. Each task builds incrementally to ensure the system remains functional throughout development.

## Tasks

- [x] 1. Set up database schema and migrations
  - Create vehicle_valuations table with all fields and indexes
  - Create damage_deductions table with all fields and indexes
  - Create valuation_audit_logs table with all fields and indexes
  - Add damage_level enum type
  - Create migration file (0005_add_vehicle_valuation_tables.sql)
  - Run migration script
  - _Requirements: 1.1, 2.1, 12.1_

- [x] 2. Implement valuation query service
  - [x] 2.1 Create valuation query service with core interfaces
    - Define TypeScript interfaces for ValuationQueryParams and ValuationResult
    - Implement queryValuation method with exact match logic
    - Implement database query with Drizzle ORM
    - _Requirements: 3.1, 3.2, 3.6_
  
  - [x] 2.2 Write property test for valuation query
    - **Property 5: Query Filtering Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.6**
  
  - [x] 2.3 Implement fuzzy year matching
    - Add logic to find closest year within ±2 years
    - Return null if no match within range
    - _Requirements: 3.3, 3.4_
  
  - [x] 2.4 Write property test for fuzzy year matching
    - **Property 6: Fuzzy Year Matching**
    - **Validates: Requirements 3.3, 3.4**
  
  - [x] 2.5 Implement helper methods
    - Implement getAvailableYears method
    - Implement getAllMakes method
    - Implement getModelsForMake method
    - _Requirements: 7.1, 7.2_
  
  - [x] 2.6 Write unit tests for helper methods
    - Test getAvailableYears with various datasets
    - Test getAllMakes with empty and populated database
    - Test getModelsForMake with various makes
    - _Requirements: 7.1, 7.2_

- [x] 3. Implement damage calculation service
  - [x] 3.1 Create damage calculation service with core interfaces
    - Define TypeScript interfaces for DamageInput, DamageDeduction, SalvageCalculation
    - Implement getDeduction method to query damage deduction table
    - Implement default deduction fallback logic
    - _Requirements: 4.5, 6.1_
  
  - [x] 3.2 Write property test for default deduction fallback
    - **Property 11: Default Deduction Fallback**
    - **Validates: Requirements 4.5**
  
  - [x] 3.3 Implement calculateSalvageValue method
    - Deduplicate damages by component (keep highest severity)
    - Calculate cumulative deductions
    - Apply 90% cap on total deductions
    - Calculate final salvage value
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 3.4 Write property test for cumulative damage calculation
    - **Property 8: Cumulative Damage Deduction Calculation**
    - **Validates: Requirements 4.1, 4.2**
  
  - [x] 3.5 Write property test for highest severity deduplication
    - **Property 9: Highest Severity Deduplication**
    - **Validates: Requirements 4.3**
  
  - [x] 3.6 Write property test for non-negative salvage value
    - **Property 12: Non-Negative Salvage Value Invariant**
    - **Validates: Requirements 4.6**
  
  - [x] 3.7 Implement applySalvageGuidelines method
    - Implement total loss classification (>70% damage)
    - Apply 30% cap for total loss vehicles
    - Apply 10% minimum for structural damage
    - Apply age-based depreciation for vehicles >10 years
    - Calculate confidence score
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [x] 3.8 Write property test for total loss classification
    - **Property 13: Total Loss Classification**
    - **Validates: Requirements 10.1, 10.2**
  
  - [x] 3.9 Write property test for structural damage minimum
    - **Property 14: Structural Damage Minimum Value**
    - **Validates: Requirements 10.3**
  
  - [x] 3.10 Write property test for age-based depreciation
    - **Property 15: Age-Based Depreciation**
    - **Validates: Requirements 10.4**

- [x] 4. Checkpoint - Ensure core services work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement validation logic
  - [x] 5.1 Create validation schemas with Zod
    - Define valuationSchema with all validation rules
    - Define deductionSchema with all validation rules
    - Implement custom refinements for price ranges and mileage ranges
    - _Requirements: 1.2, 2.2, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [x] 5.2 Write property test for valuation input validation
    - **Property 3: Valuation Input Validation Correctness**
    - **Validates: Requirements 1.2, 9.1, 9.2, 9.3, 9.5, 9.6**
  
  - [x] 5.3 Write property test for damage deduction input validation
    - **Property 4: Damage Deduction Input Validation Correctness**
    - **Validates: Requirements 2.2, 2.5, 9.4, 9.5, 9.6**

- [x] 6. Implement bulk import service
  - [x] 6.1 Create bulk import service with CSV and JSON parsing
    - Implement parseCSV method using csv-parse library
    - Implement importFromJSON method
    - Implement validateRecord method using Zod schemas
    - _Requirements: 8.1, 8.2_
  
  - [x] 6.2 Write property test for bulk import format support
    - **Property 19: Bulk Import Format Support**
    - **Validates: Requirements 8.1, 8.2**
  
  - [x] 6.3 Implement import processing logic
    - Implement upsert logic (update if exists, insert if new)
    - Implement error collection without stopping import
    - Generate import summary with counts
    - _Requirements: 8.3, 8.4, 8.5_
  
  - [x] 6.4 Write property test for upsert behavior
    - **Property 17: Bulk Import Upsert Behavior**
    - **Validates: Requirements 8.4**
  
  - [x] 6.5 Write property test for error resilience
    - **Property 18: Bulk Import Error Resilience**
    - **Validates: Requirements 8.3, 8.5**
  
  - [x] 6.6 Create separate import methods for valuations and deductions
    - Implement importValuations method
    - Implement importDeductions method
    - _Requirements: 8.6_

- [x] 7. Implement audit logging
  - [x] 7.1 Create audit logging service
    - Implement logCreate method
    - Implement logUpdate method with field change tracking
    - Implement logDelete method
    - Store user ID, timestamp, action, entity type, entity ID, changed fields
    - _Requirements: 12.1, 12.4_
  
  - [x] 7.2 Write property test for audit log completeness
    - **Property 21: Audit Log Completeness**
    - **Validates: Requirements 12.1, 12.4**
  
  - [x] 7.3 Implement audit log query methods
    - Implement queryAuditLogs with reverse chronological ordering
    - Implement filtering by user, date range, action type
    - _Requirements: 12.2, 12.5_
  
  - [x] 7.4 Write property test for audit log ordering
    - **Property 22: Audit Log Chronological Ordering**
    - **Validates: Requirements 12.2**
  
  - [x] 7.5 Write property test for audit log filtering
    - **Property 23: Audit Log Filtering Correctness**
    - **Validates: Requirements 12.5**

- [x] 8. Checkpoint - Ensure all core services work together
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Integrate with market data service
  - [x] 9.1 Modify getMarketPrice function in market-data.service.ts
    - Add database query as Step 0 (before cache check)
    - Check if property type is 'vehicle' and has make/model/year
    - Query valuation database using ValuationQueryService
    - Return database result if found (skip scraping)
    - Add 'dataSource' field to MarketPrice interface
    - Log database hits for analytics
    - _Requirements: 5.1, 5.2, 5.5, 5.6_
  
  - [x] 9.2 Write integration test for database-first query flow
    - Test that database is queried before scraping
    - Test that scraping is skipped when database has data
    - Test that scraping is used when database has no data
    - Test that database data is prioritized over cached scraped data
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

- [x] 10. Integrate with AI assessment service
  - [x] 10.1 Modify assessDamageEnhanced function in ai-assessment-enhanced.service.ts
    - Query valuation database for base price before scraping
    - Use database price if found, otherwise fallback to existing logic
    - Identify damaged components from damage score
    - Call DamageCalculationService to calculate salvage value
    - Add damage breakdown to assessment result
    - Add isTotalLoss flag to assessment result
    - Add priceSource indicator to assessment result
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 10.2 Write integration test for AI assessment with database
    - Test that database is queried for base price
    - Test that damage deductions are applied correctly
    - Test that breakdown is included in result
    - Test fallback to existing logic when database unavailable
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 11. Checkpoint - Ensure integrations work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Create admin API endpoints
  - [x] 12.1 Create GET /api/admin/valuations endpoint
    - Implement query with optional filters (make, model, year, condition)
    - Return paginated results
    - Restrict access to admin and manager roles
    - _Requirements: 7.1, 7.2, 7.5_
  
  - [x] 12.2 Create POST /api/admin/valuations endpoint
    - Validate input using Zod schema
    - Store valuation in database
    - Log creation in audit logs
    - Return created valuation
    - _Requirements: 7.3, 7.6, 12.1_
  
  - [x] 12.3 Write property test for data update immediate visibility
    - **Property 20: Data Update Immediate Visibility**
    - **Validates: Requirements 7.6**
  
  - [x] 12.4 Create PUT /api/admin/valuations/[id] endpoint
    - Validate input using Zod schema
    - Update valuation in database
    - Log update with changed fields in audit logs
    - Return updated valuation
    - _Requirements: 7.3, 7.6, 12.1_
  
  - [x] 12.5 Create DELETE /api/admin/valuations/[id] endpoint
    - Require confirmation (check request body for confirmation flag)
    - Delete valuation from database
    - Log deletion in audit logs
    - Return success response
    - _Requirements: 7.4, 12.1_
  
  - [x] 12.6 Create similar endpoints for damage deductions
    - GET /api/admin/deductions
    - POST /api/admin/deductions
    - PUT /api/admin/deductions/[id]
    - DELETE /api/admin/deductions/[id]
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 12.1_

- [x] 13. Create bulk import API endpoints
  - [x] 13.1 Create POST /api/admin/valuations/import endpoint
    - Accept CSV or JSON file upload
    - Parse file using BulkImportService
    - Validate and import records
    - Return import summary with success/failure counts
    - Restrict access to admin and manager roles
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  
  - [x] 13.2 Create POST /api/admin/deductions/import endpoint
    - Accept CSV or JSON file upload
    - Parse file using BulkImportService
    - Validate and import records
    - Return import summary with success/failure counts
    - _Requirements: 8.6_
  
  - [x] 13.3 Write integration test for bulk import endpoints
    - Test CSV import with valid data
    - Test JSON import with valid data
    - Test import with mixed valid/invalid data
    - Test upsert behavior
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 14. Create audit log API endpoints
  - [x] 14.1 Create GET /api/admin/audit-logs endpoint
    - Implement query with filters (user, date range, action type, entity type)
    - Return results in reverse chronological order
    - Implement pagination
    - Restrict access to admin role only
    - _Requirements: 12.2, 12.5_
  
  - [x] 14.2 Write integration test for audit log endpoints
    - Test querying with various filters
    - Test chronological ordering
    - Test pagination
    - _Requirements: 12.2, 12.5_

- [x] 15. Checkpoint - Ensure all API endpoints work
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Create admin UI for valuation management
  - [ ] 16.1 Create valuation list page
    - Display table of all valuations with filters
    - Implement search by make, model, year
    - Implement pagination
    - Add "Add New" button
    - Add edit and delete actions for each row
    - _Requirements: 7.1, 7.2_
  
  - [ ] 16.2 Create valuation form component
    - Create form with all valuation fields
    - Implement client-side validation
    - Handle create and update modes
    - Show validation errors
    - _Requirements: 7.3, 9.6_
  
  - [ ] 16.3 Create delete confirmation modal
    - Show confirmation dialog before deletion
    - Display valuation details in modal
    - Implement delete action
    - _Requirements: 7.4_
  
  - [ ] 16.4 Write unit tests for valuation UI components
    - Test form validation
    - Test create/update flows
    - Test delete confirmation
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 17. Create admin UI for damage deduction management
  - [ ] 17.1 Create damage deduction list page
    - Display table of all deductions grouped by component
    - Implement search by component
    - Add "Add New" button
    - Add edit and delete actions for each row
    - _Requirements: 7.1, 7.2_
  
  - [ ] 17.2 Create damage deduction form component
    - Create form with all deduction fields
    - Implement client-side validation
    - Handle create and update modes
    - Show validation errors
    - _Requirements: 7.3, 9.6_
  
  - [ ] 17.3 Write unit tests for deduction UI components
    - Test form validation
    - Test create/update flows
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 18. Create admin UI for bulk import
  - [ ] 18.1 Create import page with file upload
    - Add file upload component for CSV/JSON
    - Show file format instructions
    - Display import progress
    - Show import summary after completion
    - Display errors for failed records
    - _Requirements: 8.1, 8.2, 8.3, 8.5_
  
  - [ ] 18.2 Create sample CSV/JSON templates
    - Create downloadable sample valuation CSV
    - Create downloadable sample valuation JSON
    - Create downloadable sample deduction CSV
    - Create downloadable sample deduction JSON
    - _Requirements: 8.1, 8.2_
  
  - [ ] 18.3 Write integration test for import UI
    - Test file upload flow
    - Test error display
    - Test summary display
    - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [ ] 19. Create admin UI for audit logs
  - [ ] 19.1 Create audit log viewer page
    - Display table of audit logs in reverse chronological order
    - Implement filters (user, date range, action type)
    - Implement pagination
    - Show changed fields for update actions
    - _Requirements: 12.2, 12.5_
  
  - [ ] 19.2 Write unit tests for audit log viewer
    - Test filtering
    - Test pagination
    - Test display of changed fields
    - _Requirements: 12.2, 12.5_

- [ ] 20. Final checkpoint - End-to-end testing
  - Test complete workflow: import data → query via API → use in AI assessment
  - Test admin UI workflows: create, update, delete valuations and deductions
  - Test bulk import with real data files
  - Test market data service integration with database-first approach
  - Test AI assessment service integration with damage deductions
  - Verify audit logs are created for all operations
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout development
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- The implementation follows a bottom-up approach: database → services → APIs → UI
- All admin operations require proper role-based authorization
- Audit logging is integrated throughout for compliance and debugging
