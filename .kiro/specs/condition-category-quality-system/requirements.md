# Requirements Document

## Introduction

This feature replaces the recently implemented 3-category vehicle condition system (Brand New, Nigerian Used, Foreign Used) with a 4-tier quality-based categorization system. The new system uses quality descriptors (Excellent, Good, Fair, Poor) as primary labels, with Nigerian market terms displayed in brackets as clarifications. This addresses user feedback that the current 3-category system "is not working" for their business needs.

## Glossary

- **Condition_Category_System**: The vehicle condition classification mechanism used throughout the salvage management platform
- **Quality_Tier**: One of four condition levels: Excellent, Good, Fair, or Poor
- **Market_Term**: Nigerian automotive market terminology shown in brackets (e.g., "Brand New", "Foreign Used", "Nigerian Used")
- **UI_Component**: Any user interface element that displays or accepts vehicle condition input
- **Database_Schema**: The data structure storing vehicle condition values
- **AI_Assessment_Service**: The automated vehicle valuation and condition detection system
- **Condition_Mapping_Service**: Service that translates between different condition category formats
- **Valuation_Query**: Database query that retrieves vehicle pricing based on condition

## Requirements

### Requirement 1: Four-Tier Quality System

**User Story:** As a business user, I want a 4-tier quality-based condition system, so that I can more accurately categorize vehicle conditions for my market.

#### Acceptance Criteria

1. THE Condition_Category_System SHALL support exactly four quality tiers: Excellent, Good, Fair, and Poor
2. THE Condition_Category_System SHALL display "Brand New" in brackets beside Excellent
3. THE Condition_Category_System SHALL display "Foreign Used" in brackets beside Good
4. THE Condition_Category_System SHALL display "Nigerian Used" in brackets beside Fair
5. THE Condition_Category_System SHALL display Poor without any bracketed clarification
6. FOR ALL UI_Components that display condition categories, the format SHALL be "Quality_Tier (Market_Term)" where applicable

### Requirement 2: Database Schema Migration

**User Story:** As a system administrator, I want the database schema updated to support the new condition categories, so that all vehicle records use the correct categorization.

#### Acceptance Criteria

1. THE Database_Schema SHALL store condition values as one of: "excellent", "good", "fair", or "poor"
2. WHEN existing records contain old condition values, THE migration script SHALL map "brand_new" to "excellent"
3. WHEN existing records contain old condition values, THE migration script SHALL map "foreign_used" to "good"
4. WHEN existing records contain old condition values, THE migration script SHALL map "nigerian_used" to "fair"
5. THE migration script SHALL preserve all other vehicle data during condition value updates
6. THE migration script SHALL be idempotent (running multiple times produces the same result)

### Requirement 3: UI Component Updates

**User Story:** As a user, I want all forms and displays to show the new condition categories, so that I can work with the updated system consistently.

#### Acceptance Criteria

1. THE UI_Component SHALL display condition options as: "Excellent (Brand New)", "Good (Foreign Used)", "Fair (Nigerian Used)", and "Poor"
2. WHEN a user selects a condition in any form, THE UI_Component SHALL store the quality tier value ("excellent", "good", "fair", "poor")
3. WHEN displaying existing vehicle conditions, THE UI_Component SHALL show the formatted label with bracketed clarification
4. THE case creation form SHALL use the new 4-tier condition selector
5. THE case approval interface SHALL display conditions using the new format
6. THE vehicle autocomplete component SHALL use the new condition categories
7. THE auction listing pages SHALL display conditions using the new format

### Requirement 4: AI Assessment Integration

**User Story:** As an adjuster, I want the AI assessment to output conditions in the new format, so that automated valuations align with the updated system.

#### Acceptance Criteria

1. WHEN the AI_Assessment_Service evaluates vehicle condition, THE service SHALL output one of: "excellent", "good", "fair", or "poor"
2. THE AI_Assessment_Service SHALL map its internal condition scores to the 4-tier quality system
3. WHEN AI assessment detects minimal damage on a recent vehicle, THE service SHALL assign "excellent" condition
4. WHEN AI assessment detects moderate wear on an imported vehicle, THE service SHALL assign "good" condition
5. WHEN AI assessment detects significant wear on a locally used vehicle, THE service SHALL assign "fair" condition
6. WHEN AI assessment detects severe damage or poor maintenance, THE service SHALL assign "poor" condition

### Requirement 5: Valuation Query Compatibility

**User Story:** As a system, I want valuation queries to work with the new condition categories, so that pricing remains accurate after the migration.

#### Acceptance Criteria

1. THE Valuation_Query SHALL accept condition parameters as: "excellent", "good", "fair", or "poor"
2. WHEN querying vehicle valuations, THE Valuation_Query SHALL match the provided condition tier exactly
3. THE Condition_Mapping_Service SHALL provide backward compatibility for any legacy condition references
4. WHEN the Valuation_Query encounters an unmapped condition value, THE service SHALL log a warning and use a default fallback
5. THE valuation database records SHALL be updated to use the new condition categories

### Requirement 6: Market Data Integration

**User Story:** As a system, I want market data scraping to align with the new condition categories, so that external pricing data integrates correctly.

#### Acceptance Criteria

1. WHEN the market data scraper extracts condition information, THE scraper SHALL normalize values to: "excellent", "good", "fair", or "poor"
2. THE scraper SHALL map "brand new" listings to "excellent" condition
3. THE scraper SHALL map "tokunbo" or "foreign used" listings to "good" condition
4. THE scraper SHALL map "nigerian used" or "locally used" listings to "fair" condition
5. THE scraper SHALL map listings with damage indicators to "poor" condition

### Requirement 7: Backward Compatibility and Data Integrity

**User Story:** As a developer, I want the system to handle legacy condition values gracefully, so that no data is lost during the transition.

#### Acceptance Criteria

1. THE Condition_Mapping_Service SHALL provide a mapping function from old to new condition values
2. WHEN the system encounters a legacy condition value, THE Condition_Mapping_Service SHALL translate it to the equivalent new value
3. THE system SHALL log all condition value translations for audit purposes
4. FOR ALL existing vehicle records, condition values SHALL be preserved through semantic mapping (not data loss)
5. THE system SHALL validate that all condition values in the database match the new 4-tier system after migration

### Requirement 8: Testing and Validation

**User Story:** As a quality assurance engineer, I want comprehensive tests for the condition category system, so that I can verify correct behavior across all components.

#### Acceptance Criteria

1. THE test suite SHALL include property-based tests for condition mapping (round-trip property: map old → new → display → store produces consistent results)
2. THE test suite SHALL verify UI components render all four condition options correctly
3. THE test suite SHALL verify AI assessment outputs valid condition values
4. THE test suite SHALL verify valuation queries work with all four condition tiers
5. THE test suite SHALL verify the migration script correctly transforms all legacy values
6. THE test suite SHALL include integration tests for the complete case creation flow with new conditions
