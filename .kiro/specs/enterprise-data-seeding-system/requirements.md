# Requirements Document

## Introduction

This document specifies requirements for an enterprise-grade data seeding system for vehicle valuations and damage deductions in a production salvage management system. The system must maintain the existing user workflow (paste data → script created → run script) while making all operations idempotent, safe, and production-ready with automatic deployment seeding.

## Glossary

- **Seed_Script**: A TypeScript script that imports vehicle valuation or damage deduction data into the database
- **Idempotent_Operation**: An operation that produces the same result when executed multiple times
- **Vehicle_Valuation**: Market price data for a specific vehicle make, model, year, and condition category
- **Damage_Deduction**: Repair cost and valuation deduction data for specific vehicle components and damage levels
- **Fresh_Deployment**: A new environment (staging, production) with an empty or newly initialized database
- **System_User**: A special user account (ID: 00000000-0000-0000-0000-000000000001) used for automated operations
- **Seed_Registry**: A database table tracking which seed scripts have been executed
- **User_Workflow**: The existing process where users paste table data from Word documents, developer creates TypeScript import script, user runs script

## Requirements

### Requirement 1: Preserve User Workflow

**User Story:** As a developer, I want to maintain the exact same workflow for adding new vehicle data, so that the process remains familiar and efficient.

#### Acceptance Criteria

1. WHEN a user pastes vehicle data from a Word document, THE Developer SHALL create a TypeScript seed script following the standardized template
2. WHEN the seed script is created, THE User SHALL run it using the same command pattern (tsx scripts/seeds/...)
3. THE Seed_System SHALL NOT require users to manually convert data to JSON format
4. THE Seed_System SHALL accept data in the same raw TypeScript array format currently used
5. THE Seed_System SHALL provide the same console output format showing import progress and summary

### Requirement 2: Idempotent Seed Operations

**User Story:** As a system administrator, I want all seed scripts to be idempotent, so that running them multiple times never creates duplicate data.

#### Acceptance Criteria

1. WHEN a seed script is executed, THE Seed_Script SHALL check if each record already exists before inserting
2. WHEN a record already exists with matching unique constraints, THE Seed_Script SHALL update the existing record instead of creating a duplicate
3. WHEN a seed script is run multiple times, THE Database SHALL contain exactly the same data as running it once
4. THE Seed_Script SHALL use the unique constraint (make, model, year, conditionCategory) for vehicle valuations
5. THE Seed_Script SHALL use the unique constraint (make, component, damageLevel) for damage deductions
6. FOR ALL seed operations, running the script N times SHALL produce identical database state as running it once (idempotence property)

### Requirement 3: Safe Multi-Execution

**User Story:** As a developer, I want seed scripts to handle errors gracefully, so that partial failures don't corrupt the database.

#### Acceptance Criteria

1. WHEN a seed script encounters an error on one record, THE Seed_Script SHALL log the error and continue processing remaining records
2. WHEN a seed script completes, THE Seed_Script SHALL report counts of imported, updated, and skipped records
3. IF a database connection fails, THEN THE Seed_Script SHALL exit with a clear error message and non-zero exit code
4. THE Seed_Script SHALL wrap each record operation in a try-catch block
5. THE Seed_Script SHALL NOT use database transactions that would roll back all changes on single record failure

### Requirement 4: Organized Seed Structure

**User Story:** As a developer, I want all seed scripts organized in a dedicated folder, so that they are easy to find and manage.

#### Acceptance Criteria

1. THE Seed_System SHALL store all seed scripts in the scripts/seeds/ directory
2. THE Seed_System SHALL organize scripts by make: scripts/seeds/mercedes/, scripts/seeds/toyota/, etc.
3. THE Seed_System SHALL use naming convention: {make}-valuations.seed.ts and {make}-damage-deductions.seed.ts
4. THE Seed_System SHALL provide a master seed script at scripts/seeds/run-all-seeds.ts
5. THE Seed_System SHALL include a README.md in scripts/seeds/ documenting the structure and usage

### Requirement 5: Automatic Deployment Seeding

**User Story:** As a DevOps engineer, I want seed data to be automatically loaded on fresh deployments, so that new environments are immediately functional.

#### Acceptance Criteria

1. WHEN a fresh deployment is initialized, THE Seed_System SHALL automatically execute all seed scripts
2. THE Seed_System SHALL provide a seed registry table tracking which seeds have been executed
3. WHEN a seed script runs, THE Seed_System SHALL record its execution in the seed registry
4. WHEN a seed script has already been executed, THE Seed_System SHALL skip it on subsequent runs
5. THE Seed_System SHALL provide a migration or initialization hook that runs seeds after database schema is created
6. THE Seed_System SHALL support a --force flag to re-run seeds even if already executed

### Requirement 6: Convert Existing Scripts

**User Story:** As a developer, I want all existing import scripts converted to the new pattern, so that the entire codebase is consistent.

#### Acceptance Criteria

1. THE Seed_System SHALL convert all existing scripts/import-*-valuations.ts scripts to the new seed pattern
2. THE Seed_System SHALL convert all existing scripts/import-*-damage-deductions.ts scripts to the new seed pattern
3. THE Seed_System SHALL maintain all existing data and data sources in converted scripts
4. THE Seed_System SHALL move converted scripts to scripts/seeds/{make}/ directories
5. THE Seed_System SHALL delete or archive old import scripts after conversion
6. FOR ALL existing makes (Mercedes, Toyota, Nissan, Hyundai, Kia, Lexus, Audi), converted scripts SHALL import identical data as original scripts

### Requirement 7: Documentation for New Makes

**User Story:** As a developer, I want clear documentation for adding new vehicle makes, so that I can easily extend the system with BMW, Honda, etc.

#### Acceptance Criteria

1. THE Seed_System SHALL provide a template seed script at scripts/seeds/_template/make-valuations.seed.ts
2. THE Seed_System SHALL provide a template seed script at scripts/seeds/_template/make-damage-deductions.seed.ts
3. THE Seed_System SHALL include step-by-step instructions in scripts/seeds/README.md for adding new makes
4. THE Documentation SHALL explain the data format requirements for valuations and deductions
5. THE Documentation SHALL include examples of transforming raw data into database records
6. THE Documentation SHALL explain how to test new seed scripts before deployment

### Requirement 8: Support Both Data Types

**User Story:** As a system administrator, I want the seed system to handle both vehicle valuations and damage deductions, so that all pricing data is managed consistently.

#### Acceptance Criteria

1. THE Seed_System SHALL support seeding vehicle_valuations table with make, model, year, condition, and price data
2. THE Seed_System SHALL support seeding damage_deductions table with make, component, damage level, and cost data
3. THE Seed_System SHALL validate that all required fields are present before inserting records
4. THE Seed_System SHALL convert numeric values to appropriate decimal string format for database storage
5. THE Seed_System SHALL reference the System_User (00000000-0000-0000-0000-000000000001) as createdBy for all seed records

### Requirement 9: Prevent Data Loss

**User Story:** As a business owner, I want the seed system to prevent data loss, so that valuable pricing data is never accidentally deleted.

#### Acceptance Criteria

1. THE Seed_System SHALL create database backups before running destructive operations
2. WHEN updating existing records, THE Seed_System SHALL preserve the original createdAt timestamp
3. THE Seed_System SHALL log all data modifications to the valuation_audit_logs table
4. THE Seed_System SHALL provide a rollback mechanism to restore previous data versions
5. IF a seed script would delete more than 10% of existing records, THEN THE Seed_System SHALL require explicit confirmation

### Requirement 10: Seed Script Template

**User Story:** As a developer, I want a standardized seed script template, so that all seed scripts follow the same structure and patterns.

#### Acceptance Criteria

1. THE Seed_Template SHALL include proper TypeScript imports for database and schema
2. THE Seed_Template SHALL include a data transformation function converting raw data to database records
3. THE Seed_Template SHALL include idempotent upsert logic checking for existing records
4. THE Seed_Template SHALL include comprehensive error handling and logging
5. THE Seed_Template SHALL include a summary report showing imported, updated, and skipped counts
6. THE Seed_Template SHALL include proper process exit codes (0 for success, 1 for failure)

### Requirement 11: Seed Registry Tracking

**User Story:** As a system administrator, I want to track which seed scripts have been executed, so that I can audit the data loading history.

#### Acceptance Criteria

1. THE Seed_System SHALL create a seed_registry table with columns: id, script_name, executed_at, status, records_affected
2. WHEN a seed script starts, THE Seed_System SHALL create a registry entry with status 'running'
3. WHEN a seed script completes successfully, THE Seed_System SHALL update the registry entry with status 'completed' and record counts
4. IF a seed script fails, THEN THE Seed_System SHALL update the registry entry with status 'failed' and error message
5. THE Seed_System SHALL provide a query script to view seed execution history

### Requirement 12: Seed Script Validation

**User Story:** As a developer, I want seed scripts to validate data before insertion, so that invalid data never enters the database.

#### Acceptance Criteria

1. WHEN a seed script processes a record, THE Seed_Script SHALL validate that all required fields are present
2. WHEN a seed script processes a valuation record, THE Seed_Script SHALL validate that lowPrice <= averagePrice <= highPrice
3. WHEN a seed script processes a deduction record, THE Seed_Script SHALL validate that repairCostLow <= repairCostHigh
4. IF validation fails for a record, THEN THE Seed_Script SHALL log the validation error and skip that record
5. THE Seed_Script SHALL report validation failures in the summary output

### Requirement 13: Performance Optimization

**User Story:** As a system administrator, I want seed scripts to execute efficiently, so that large datasets can be imported quickly.

#### Acceptance Criteria

1. WHEN importing more than 100 records, THE Seed_Script SHALL use batch operations instead of individual inserts
2. THE Seed_Script SHALL process records in batches of 50 to balance memory usage and performance
3. THE Seed_Script SHALL provide progress indicators for long-running imports (e.g., "Processing 150/500...")
4. THE Seed_Script SHALL complete importing 1000 records in less than 60 seconds on standard hardware
5. THE Seed_Script SHALL use database connection pooling to avoid connection overhead

### Requirement 14: Seed Script Testing

**User Story:** As a developer, I want to test seed scripts before running them in production, so that I can catch errors early.

#### Acceptance Criteria

1. THE Seed_System SHALL provide a --dry-run flag that simulates execution without modifying the database
2. WHEN running in dry-run mode, THE Seed_Script SHALL validate all data and report what would be changed
3. THE Seed_System SHALL provide a test database configuration for safe testing
4. THE Seed_System SHALL include unit tests for data transformation functions
5. THE Seed_System SHALL include integration tests that verify seed scripts against a test database

### Requirement 15: Seed Script Documentation

**User Story:** As a new developer, I want comprehensive documentation for the seed system, so that I can understand and use it effectively.

#### Acceptance Criteria

1. THE Seed_System SHALL include a README.md in scripts/seeds/ explaining the overall architecture
2. THE Documentation SHALL include a quick start guide for running existing seeds
3. THE Documentation SHALL include a detailed guide for creating new seed scripts
4. THE Documentation SHALL include troubleshooting tips for common issues
5. THE Documentation SHALL include examples of both valuation and deduction seed scripts
6. THE Documentation SHALL explain the relationship between seeds and database migrations

