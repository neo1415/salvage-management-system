# Requirements Document

## Introduction

This feature adds make-specific support to the damage deductions system in the vehicle valuation database. Currently, damage deductions are generic across all vehicle makes, but repair costs and valuation impacts vary significantly by manufacturer. For example, Audi parts are considerably more expensive than Toyota parts, requiring different deduction values. This enhancement enables the system to store and query damage deductions specific to each vehicle make while maintaining backward compatibility with existing generic deductions.

## Glossary

- **Damage_Deductions_Table**: The database table storing component damage repair costs and valuation deduction percentages
- **Make**: The vehicle manufacturer (e.g., Toyota, Audi, Honda)
- **Component**: A vehicle part that can be damaged (e.g., Front Bumper, Engine, Gearbox)
- **Damage_Level**: The severity of damage (minor, moderate, severe)
- **Repair_Cost_Range**: The estimated cost range to repair a damaged component (low and high values)
- **Valuation_Deduction_Range**: The amount to deduct from vehicle valuation (low and high values)
- **Generic_Deduction**: A damage deduction record without a make specified, applicable to all makes
- **Make_Specific_Deduction**: A damage deduction record tied to a specific vehicle make
- **Migration_Script**: A database schema change script that modifies table structure
- **Import_Script**: A script that loads damage deduction data into the database

## Requirements

### Requirement 1: Add Make Field to Damage Deductions Schema

**User Story:** As a system administrator, I want damage deductions to support make-specific values, so that I can accurately reflect the different repair costs across vehicle manufacturers.

#### Acceptance Criteria

1. THE Damage_Deductions_Table SHALL include a make field of type varchar(100)
2. THE make field SHALL be nullable to support both generic and make-specific deductions
3. THE Damage_Deductions_Table SHALL maintain all existing fields (component, damageLevel, repairCostEstimate, valuationDeductionPercent, description, createdBy, createdAt, updatedAt)
4. WHEN the schema is modified, THE Migration_Script SHALL preserve all existing Toyota deduction records

### Requirement 2: Support Range-Based Deduction Values

**User Story:** As a system administrator, I want to store repair cost and valuation deduction ranges, so that I can represent the variability in repair costs and market conditions.

#### Acceptance Criteria

1. THE Damage_Deductions_Table SHALL include repairCostLow field of type decimal(12, 2)
2. THE Damage_Deductions_Table SHALL include repairCostHigh field of type decimal(12, 2)
3. THE Damage_Deductions_Table SHALL include valuationDeductionLow field of type decimal(12, 2)
4. THE Damage_Deductions_Table SHALL include valuationDeductionHigh field of type decimal(12, 2)
5. THE Damage_Deductions_Table SHALL include notes field of type text for additional context
6. WHEN range fields are added, THE Migration_Script SHALL convert existing single-value fields to range fields by using the existing value for both low and high

### Requirement 3: Update Unique Constraint for Make-Specific Deductions

**User Story:** As a system administrator, I want the database to prevent duplicate deduction records for the same make, component, and damage level, so that data integrity is maintained.

#### Acceptance Criteria

1. THE Damage_Deductions_Table SHALL enforce a unique constraint on (make, component, damageLevel)
2. THE unique constraint SHALL allow multiple records with the same component and damageLevel when make values differ
3. THE unique constraint SHALL allow one record with NULL make for each (component, damageLevel) combination
4. WHEN the unique constraint is updated, THE Migration_Script SHALL verify no constraint violations exist in current data

### Requirement 4: Maintain Backward Compatibility with Existing Data

**User Story:** As a system administrator, I want existing Toyota deductions to remain functional after the schema change, so that the system continues to work without data loss.

#### Acceptance Criteria

1. WHEN the migration runs, THE Migration_Script SHALL preserve all 22 existing Toyota damage deduction records
2. THE Migration_Script SHALL set the make field to 'Toyota' for all existing records
3. THE Migration_Script SHALL convert repairCostEstimate to both repairCostLow and repairCostHigh
4. THE Migration_Script SHALL convert valuationDeductionPercent to calculated valuationDeductionLow and valuationDeductionHigh values
5. THE Migration_Script SHALL migrate description field content to the notes field

### Requirement 5: Enable Audi-Specific Deduction Import

**User Story:** As a system administrator, I want to import Audi-specific damage deductions, so that Audi vehicle valuations reflect accurate repair costs.

#### Acceptance Criteria

1. WHEN the Import_Script runs, THE System SHALL insert 35 Audi damage deduction records
2. THE Import_Script SHALL set make field to 'Audi' for all imported records
3. THE Import_Script SHALL use the range-based fields (repairCostLow, repairCostHigh, valuationDeductionLow, valuationDeductionHigh)
4. THE Import_Script SHALL populate the notes field with Audi-specific repair guidance
5. IF a deduction record already exists for the same (make, component, damageLevel), THEN THE Import_Script SHALL update the existing record rather than fail

### Requirement 6: Support Deduction Queries by Make

**User Story:** As a valuation service, I want to query damage deductions by vehicle make, so that I can apply the correct deductions during vehicle assessment.

#### Acceptance Criteria

1. WHEN querying for make-specific deductions, THE System SHALL return records matching the specified make
2. WHEN no make-specific deduction exists, THE System SHALL fall back to generic deductions (where make IS NULL)
3. THE System SHALL create an index on the make field for query performance
4. THE System SHALL maintain the existing componentIdx index for backward compatibility

### Requirement 7: Deprecate Single-Value Fields

**User Story:** As a developer, I want to remove deprecated single-value fields after migration, so that the schema remains clean and maintainable.

#### Acceptance Criteria

1. AFTER the migration completes, THE Damage_Deductions_Table SHALL NOT include the repairCostEstimate field
2. AFTER the migration completes, THE Damage_Deductions_Table SHALL NOT include the valuationDeductionPercent field
3. AFTER the migration completes, THE Damage_Deductions_Table SHALL NOT include the description field
4. THE Migration_Script SHALL drop these fields only after successfully copying data to new fields

### Requirement 8: Validate Migration Success

**User Story:** As a system administrator, I want to verify the migration completed successfully, so that I can confirm data integrity before proceeding.

#### Acceptance Criteria

1. THE Migration_Script SHALL output the count of records migrated
2. THE Migration_Script SHALL verify all existing records have non-null make values after migration
3. THE Migration_Script SHALL verify all range fields contain valid numeric values
4. IF any validation fails, THEN THE Migration_Script SHALL rollback all changes and report the error
