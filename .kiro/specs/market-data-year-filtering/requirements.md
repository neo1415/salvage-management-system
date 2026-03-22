# Requirements Document: Market Data Year Filtering

## Introduction

The AI assessment system currently fetches market data without proper year filtering, resulting in highly inaccurate valuations. Test evidence shows that when searching for a 2004 Honda Accord (expected value ₦2M-₦4.5M), the system returns a median of ₦10.2M (2.3x too high) because only 2 out of 20 listings match the target year. The system includes vehicles from 2023 (₦300M Lexus) and other years that drastically skew the valuation.

This feature will implement robust year-based filtering, validation, and fallback mechanisms to ensure market data accurately reflects the age and depreciation of salvage vehicles.

## Glossary

- **Market_Data_Service**: The service responsible for fetching and aggregating vehicle pricing data from external sources
- **Query_Builder**: Component that constructs search queries for external marketplaces
- **Year_Filter**: Component that validates and filters listings based on vehicle year
- **Outlier_Detector**: Component that identifies and removes price outliers from aggregation
- **Depreciation_Calculator**: Component that adjusts prices based on vehicle age when insufficient year-matched data exists
- **Listing**: A single vehicle advertisement from an external marketplace containing price, year, make, and model
- **Target_Year**: The manufacturing year of the salvage vehicle being assessed
- **Year_Tolerance**: The acceptable range of years (±N years) for matching listings
- **Confidence_Score**: A metric (0-100) indicating the reliability of the market data based on sample size and year matching

## Requirements

### Requirement 1: Year-Inclusive Query Construction

**User Story:** As a Claims Adjuster, I need the system to search for vehicles matching the specific year, so that initial results are relevant to the salvage vehicle's age.

#### Acceptance Criteria

1. WHEN constructing a search query for market data, THE Query_Builder SHALL include the target year in the search string
2. WHEN the target year is provided, THE Query_Builder SHALL format the query as "{year} {make} {model}" (e.g., "2004 Honda Accord")
3. WHEN the target year is missing or invalid, THE Query_Builder SHALL log a warning and proceed with make/model only
4. THE Query_Builder SHALL encode special characters in the query string for URL safety

### Requirement 2: Year-Based Listing Validation

**User Story:** As a Claims Adjuster, I need the system to validate that fetched listings match the target year, so that only age-appropriate vehicles are included in valuation.

#### Acceptance Criteria

1. WHEN a listing is fetched, THE Year_Filter SHALL extract the year from the listing title or metadata
2. WHEN the extracted year is within ±1 year of the target year, THE Year_Filter SHALL mark the listing as valid
3. WHEN the extracted year differs by more than 1 year from the target year, THE Year_Filter SHALL reject the listing
4. WHEN the year cannot be extracted from a listing, THE Year_Filter SHALL reject the listing
5. THE Year_Filter SHALL use regex pattern matching to extract 4-digit years from listing titles


### Requirement 3: Outlier Detection and Removal

**User Story:** As a Claims Adjuster, I need the system to remove price outliers, so that extreme values don't skew the median valuation.

#### Acceptance Criteria

1. WHEN calculating the median price, THE Outlier_Detector SHALL identify prices greater than 2x the initial median
2. WHEN outliers are detected, THE Outlier_Detector SHALL exclude them from the final aggregation
3. WHEN more than 50% of listings are outliers, THE Outlier_Detector SHALL flag the data as low confidence
4. THE Outlier_Detector SHALL log the number of outliers removed for audit purposes

### Requirement 4: Year Match Quality Metrics

**User Story:** As a Claims Adjuster, I need to know how many listings matched the target year, so that I can assess the reliability of the valuation.

#### Acceptance Criteria

1. WHEN aggregating market data, THE Market_Data_Service SHALL calculate the percentage of year-matched listings
2. WHEN at least 70% of listings match the target year (±1), THE Market_Data_Service SHALL assign a confidence score of 90-100
3. WHEN 40-69% of listings match the target year, THE Market_Data_Service SHALL assign a confidence score of 60-89
4. WHEN fewer than 40% of listings match the target year, THE Market_Data_Service SHALL assign a confidence score below 60
5. THE Market_Data_Service SHALL include the confidence score in the response metadata

### Requirement 5: Depreciation-Based Fallback

**User Story:** As a Claims Adjuster, I need the system to apply depreciation adjustments when insufficient year-matched data exists, so that valuations remain reasonable even with limited data.

#### Acceptance Criteria

1. WHEN fewer than 3 year-matched listings are found, THE Depreciation_Calculator SHALL apply a depreciation formula to available data
2. WHEN applying depreciation, THE Depreciation_Calculator SHALL use a rate of 15% per year for the first 5 years
3. WHEN applying depreciation, THE Depreciation_Calculator SHALL use a rate of 10% per year for years 6-10
4. WHEN applying depreciation, THE Depreciation_Calculator SHALL use a rate of 5% per year for years beyond 10
5. THE Depreciation_Calculator SHALL adjust prices from newer vehicles downward to match the target year
6. THE Depreciation_Calculator SHALL flag depreciation-adjusted results with a confidence score below 50

### Requirement 6: Minimum Sample Size Enforcement

**User Story:** As a Claims Adjuster, I need the system to require a minimum number of valid listings, so that valuations are based on sufficient market data.

#### Acceptance Criteria

1. WHEN fewer than 3 valid listings remain after filtering, THE Market_Data_Service SHALL return an error indicating insufficient data
2. WHEN between 3-5 valid listings exist, THE Market_Data_Service SHALL proceed but flag the result as low confidence
3. WHEN 6 or more valid listings exist, THE Market_Data_Service SHALL proceed with normal confidence scoring
4. THE Market_Data_Service SHALL log the final sample size for audit purposes

### Requirement 7: Year Extraction Robustness

**User Story:** As a Developer, I need the year extraction to handle various listing title formats, so that the system works across different marketplace conventions.

#### Acceptance Criteria

1. WHEN a listing title contains a 4-digit year (2000-2099), THE Year_Filter SHALL extract it
2. WHEN a listing title contains multiple years, THE Year_Filter SHALL extract the first occurrence
3. WHEN a listing title contains the year at the beginning, middle, or end, THE Year_Filter SHALL successfully extract it
4. THE Year_Filter SHALL handle titles with or without separators (spaces, dashes, slashes)
5. THE Year_Filter SHALL reject years outside the valid range (1980-current year + 1)

### Requirement 8: Query Result Validation

**User Story:** As a Developer, I need the system to validate that search results are relevant to the query, so that unrelated listings are excluded early.

#### Acceptance Criteria

1. WHEN a listing is fetched, THE Market_Data_Service SHALL verify the make matches the target make (case-insensitive)
2. WHEN a listing is fetched, THE Market_Data_Service SHALL verify the model matches the target model (fuzzy match with 80% similarity)
3. WHEN a listing fails make/model validation, THE Market_Data_Service SHALL reject it before year filtering
4. THE Market_Data_Service SHALL log rejected listings with reasons for debugging

### Requirement 9: Logging and Observability

**User Story:** As a Developer, I need comprehensive logging of the filtering process, so that I can debug issues and monitor data quality.

#### Acceptance Criteria

1. WHEN fetching market data, THE Market_Data_Service SHALL log the initial query string
2. WHEN filtering listings, THE Market_Data_Service SHALL log the count of listings at each filtering stage
3. WHEN outliers are removed, THE Market_Data_Service SHALL log the outlier prices and reasons
4. WHEN depreciation is applied, THE Market_Data_Service SHALL log the adjustment calculations
5. THE Market_Data_Service SHALL log the final confidence score and contributing factors
