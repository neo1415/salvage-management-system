# Requirements Document

## Introduction

The Vehicle Valuation Database System provides a curated, structured database for vehicle pricing data in the Nigerian market. This system replaces unreliable web scraping as the primary data source while maintaining scraping as a secondary validation mechanism. The system stores comprehensive vehicle valuation guides with year-by-year price ranges, mileage data, market intelligence, and damage deduction tables for accurate salvage pricing.

## Glossary

- **System**: The Vehicle Valuation Database System
- **Valuation_Database**: The primary curated database containing structured vehicle pricing data
- **Damage_Deduction_Table**: A structured table mapping vehicle components and damage levels to repair costs and valuation deductions
- **Market_Data_Service**: The existing service that currently uses web scraping for market data
- **AI_Assessment_Service**: The existing service that analyzes vehicle damage and estimates salvage value
- **Base_Price**: The market value of a vehicle in good condition before damage adjustments
- **Salvage_Value**: The estimated value of a damaged vehicle after applying damage deductions
- **Condition_Category**: Classification of vehicle condition (Nig-Used, Tokunbo, etc.)
- **Damage_Level**: Classification of damage severity (Minor, Moderate, Severe)
- **Vehicle_Component**: A specific part of a vehicle that can be damaged (e.g., engine, transmission, body)
- **Admin_Interface**: The user interface for authorized users to manage valuation data
- **Hybrid_Approach**: Using the database as primary source with web scraping as fallback/validation

## Requirements

### Requirement 1: Vehicle Valuation Data Storage

**User Story:** As a system administrator, I want to store comprehensive vehicle valuation data by make, model, year, and condition, so that the system can provide accurate pricing without relying on web scraping.

#### Acceptance Criteria

1. THE System SHALL store vehicle valuations with make, model, year, condition category, price ranges, mileage ranges, and market notes
2. WHEN a vehicle valuation is stored, THE System SHALL validate that all required fields are present and within acceptable ranges
3. THE System SHALL support multiple condition categories per vehicle (Nig-Used Low, Nig-Used High, Tokunbo Low, Tokunbo High, Average)
4. THE System SHALL store mileage ranges associated with each vehicle year
5. THE System SHALL store market intelligence notes specific to the Nigerian market for each vehicle entry
6. THE System SHALL maintain a minimum of 20 vehicle brands with 5-10 models each
7. THE System SHALL maintain a minimum of 15 years of historical data per model

### Requirement 2: Damage Deduction Data Storage

**User Story:** As a system administrator, I want to store damage deduction tables for vehicle components, so that the system can accurately calculate salvage values based on specific damage.

#### Acceptance Criteria

1. THE System SHALL store damage deductions with component name, damage level, repair cost estimate, and valuation deduction percentage
2. WHEN a damage deduction is stored, THE System SHALL validate that damage levels are one of Minor, Moderate, or Severe
3. THE System SHALL support damage deductions for all major vehicle components (engine, transmission, body, interior, electrical, suspension)
4. THE System SHALL store repair cost estimates in Nigerian Naira
5. THE System SHALL store valuation deduction percentages as decimal values between 0 and 1
6. WHEN multiple damage deductions exist for the same component, THE System SHALL organize them by damage level

### Requirement 3: Vehicle Valuation Query API

**User Story:** As a developer, I want to query vehicle valuations by make, model, year, and condition, so that I can retrieve accurate pricing data for the AI assessment system.

#### Acceptance Criteria

1. WHEN a query includes make, model, and year, THE System SHALL return all matching valuation records
2. WHEN a query includes a condition category, THE System SHALL return only valuations matching that condition
3. WHEN no exact match exists for a year, THE System SHALL return the closest available year within a 2-year range
4. WHEN no valuation exists in the database, THE System SHALL return a null result to trigger fallback to web scraping
5. THE System SHALL return query results within 200 milliseconds for 95% of requests
6. WHEN a valuation is returned, THE System SHALL include all price ranges, mileage data, and market notes

### Requirement 4: Damage-Adjusted Price Calculation

**User Story:** As a developer, I want to calculate damage-adjusted vehicle prices, so that the AI assessment can provide accurate salvage valuations.

#### Acceptance Criteria

1. WHEN provided with a base price and a list of component damages, THE System SHALL calculate the total valuation deduction
2. WHEN multiple components are damaged, THE System SHALL apply deductions cumulatively up to a maximum of 90% total deduction
3. WHEN a component has multiple damage levels, THE System SHALL use the highest severity level for that component
4. THE System SHALL return both the adjusted price and a breakdown of deductions by component
5. WHEN a component is not found in the damage deduction table, THE System SHALL apply a default deduction based on damage level (Minor: 5%, Moderate: 15%, Severe: 30%)
6. THE System SHALL calculate salvage values that are never negative

### Requirement 5: Market Data Service Integration

**User Story:** As a developer, I want the market data service to check the valuation database first before web scraping, so that the system uses curated data as the primary source.

#### Acceptance Criteria

1. WHEN the Market_Data_Service receives a pricing request, THE System SHALL query the Valuation_Database first
2. WHEN the Valuation_Database returns a result, THE System SHALL use that data without triggering web scraping
3. WHEN the Valuation_Database returns no result, THE System SHALL fall back to web scraping
4. WHEN web scraping returns data, THE System SHALL cache it in the existing market_data_cache table
5. THE System SHALL log whether pricing data came from the database or web scraping for analytics
6. WHEN both database and scraped data exist, THE System SHALL prioritize database data

### Requirement 6: AI Assessment Service Integration

**User Story:** As a developer, I want the AI assessment service to use damage deduction tables, so that salvage value estimates are based on structured data rather than heuristics.

#### Acceptance Criteria

1. WHEN the AI_Assessment_Service identifies vehicle damage, THE System SHALL query the damage deduction table for each damaged component
2. WHEN the AI_Assessment_Service calculates salvage value, THE System SHALL apply damage deductions to the base price from the Valuation_Database
3. THE System SHALL provide a detailed breakdown showing base price, each damage deduction, and final salvage value
4. WHEN the Valuation_Database has no base price, THE System SHALL use the existing market value estimation logic
5. THE System SHALL maintain backward compatibility with existing assessment logic when database data is unavailable

### Requirement 7: Administrative Data Management

**User Story:** As a system administrator, I want an interface to add, update, and delete vehicle valuation data, so that I can maintain accurate pricing information.

#### Acceptance Criteria

1. WHEN an administrator accesses the Admin_Interface, THE System SHALL display a list of all vehicle makes and models in the database
2. WHEN an administrator selects a vehicle, THE System SHALL display all years and condition categories with their pricing data
3. WHEN an administrator adds or updates a valuation, THE System SHALL validate all fields before saving
4. WHEN an administrator deletes a valuation, THE System SHALL require confirmation and log the deletion in audit logs
5. THE System SHALL restrict access to the Admin_Interface to users with admin or manager roles
6. WHEN an administrator saves changes, THE System SHALL immediately make the updated data available to the query API

### Requirement 8: Bulk Data Import

**User Story:** As a system administrator, I want to import vehicle valuation data from structured guides, so that I can quickly populate the database with comprehensive data.

#### Acceptance Criteria

1. WHEN an administrator uploads a structured data file, THE System SHALL parse and validate the format
2. THE System SHALL support CSV and JSON formats for bulk import
3. WHEN importing data, THE System SHALL validate each record and report any validation errors without stopping the import
4. WHEN a record already exists for the same make, model, year, and condition, THE System SHALL update the existing record
5. WHEN the import completes, THE System SHALL provide a summary showing records added, updated, and failed
6. THE System SHALL support importing both valuation data and damage deduction data in separate operations

### Requirement 9: Data Quality and Validation

**User Story:** As a system administrator, I want the system to enforce data quality rules, so that the valuation database maintains accuracy and consistency.

#### Acceptance Criteria

1. WHEN a price range is entered, THE System SHALL validate that the low price is less than the high price
2. WHEN a year is entered, THE System SHALL validate that it is between 1990 and the current year plus 1
3. WHEN a mileage range is entered, THE System SHALL validate that values are non-negative and reasonable (less than 1,000,000 km)
4. WHEN a damage deduction percentage is entered, THE System SHALL validate that it is between 0 and 1
5. THE System SHALL prevent duplicate entries for the same make, model, year, and condition combination
6. WHEN validation fails, THE System SHALL provide clear error messages indicating which fields are invalid and why

### Requirement 10: Salvage Value Guidelines

**User Story:** As a developer, I want the system to apply salvage value guidelines, so that calculated values align with Nigerian market practices.

#### Acceptance Criteria

1. WHEN total damage exceeds 70% of base value, THE System SHALL classify the vehicle as a total loss
2. WHEN a vehicle is classified as a total loss, THE System SHALL cap the salvage value at 30% of base value
3. THE System SHALL apply a minimum salvage value of 10% of base value for any vehicle with structural damage
4. WHEN calculating salvage value, THE System SHALL consider vehicle age and apply additional depreciation for vehicles older than 10 years
5. THE System SHALL provide a confidence score for salvage valuations based on data completeness and recency

### Requirement 11: Performance and Scalability

**User Story:** As a system architect, I want the database to perform efficiently at scale, so that the system can handle high query volumes without degradation.

#### Acceptance Criteria

1. THE System SHALL support concurrent queries from multiple users without performance degradation
2. THE System SHALL index vehicle make, model, and year fields for fast lookups
3. THE System SHALL cache frequently accessed valuation data in memory for sub-50ms response times
4. WHEN the database contains 20+ brands with 10 models each and 15 years per model, THE System SHALL maintain query response times under 200ms
5. THE System SHALL support at least 100 concurrent API requests without errors

### Requirement 12: Audit and Traceability

**User Story:** As a system administrator, I want all data changes to be logged, so that I can track who modified valuation data and when.

#### Acceptance Criteria

1. WHEN an administrator adds, updates, or deletes valuation data, THE System SHALL log the action with user ID, timestamp, and changed fields
2. WHEN an administrator views audit logs, THE System SHALL display all changes in reverse chronological order
3. THE System SHALL retain audit logs for a minimum of 2 years
4. WHEN a valuation is used in a salvage calculation, THE System SHALL log which version of the data was used
5. THE System SHALL allow filtering audit logs by user, date range, and action type
