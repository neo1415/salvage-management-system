# Requirements Document: AI Assessment Market Data Accuracy Fix

## Introduction

This document specifies requirements to fix critical accuracy issues in the AI assessment market data scraping system. The current system returns wildly inaccurate market values (e.g., ₦10,200,000 for a 2004 Honda Accord when actual market price is ₦2,000,000 - ₦4,500,000). Root cause analysis indicates the scraper is not properly filtering by vehicle year, not distinguishing between new and used vehicles, and not accounting for Nigerian vs foreign used (Tokunbo) pricing.

## Glossary

- **Scraper**: The component responsible for extracting pricing data from e-commerce websites
- **Query_Builder**: Component that constructs search queries with vehicle year and condition filters
- **Price_Validator**: Component that rejects unrealistic prices based on vehicle age and market norms
- **Confidence_Scorer**: Component that adjusts confidence based on year match quality and data relevance
- **Fallback_Estimator**: Component that applies depreciation when year-specific data is unavailable
- **Market_Price**: The aggregated median price from multiple e-commerce sources
- **Year_Match**: Listing that matches the exact vehicle year being assessed
- **Tokunbo**: Foreign used vehicles imported to Nigeria (typically priced higher than Nigerian used)
- **Nigerian_Used**: Locally used vehicles (typically priced lower than Tokunbo)
- **Brand_New_Price**: Price for new vehicles from dealerships (should be excluded for old vehicles)
- **Outlier**: Price that is more than 2x the expected range for a vehicle
- **Depreciation_Rate**: Annual percentage decrease in vehicle value (typically 15-20% per year)
- **Expected_Range**: Reasonable price range based on vehicle age and market research

## Requirements

### Requirement 1: Year-Specific Query Construction

**User Story:** As a Claims Adjuster, I want the scraper to search for the exact vehicle year, so that I get prices for comparable vehicles, not newer models.

#### Acceptance Criteria

1. WHEN constructing a search query for a vehicle, THE Query_Builder SHALL include the vehicle year as a required search parameter
2. WHEN a source supports year range filtering, THE Query_Builder SHALL set both year_from and year_to to the exact vehicle year
3. WHEN a source only supports keyword search, THE Query_Builder SHALL include the year in the search term
4. WHEN scraping results are returned, THE Scraper SHALL extract the year from each listing
5. WHEN a listing year does not match the requested year, THE Scraper SHALL mark it as a non-year-match
6. WHEN calculating median price, THE System SHALL prioritize year-matched listings over non-year-matched listings

### Requirement 2: New vs Used Vehicle Distinction

**User Story:** As a Claims Adjuster, I want the system to exclude brand new vehicle prices, so that salvage assessments reflect used vehicle market values.

#### Acceptance Criteria

1. WHEN scraping results are returned, THE Scraper SHALL analyze listing titles and descriptions for "new", "brand new", "0km", or "unused" keywords
2. WHEN a listing is identified as brand new, THE Scraper SHALL exclude it from price aggregation
3. WHEN a vehicle is older than 2 years, THE System SHALL reject any prices that match typical brand new pricing patterns
4. WHEN all scraped prices appear to be brand new prices, THE System SHALL log a warning and return an error indicating no used vehicle data found
5. THE Scraper SHALL prioritize listings with "used", "tokunbo", "foreign used", or "nigerian used" keywords

### Requirement 3: Price Validation and Outlier Detection

**User Story:** As a Claims Adjuster, I want the system to reject unrealistic prices, so that outliers don't skew the market valuation.

#### Acceptance Criteria

1. WHEN a vehicle is 20 years old, THE Price_Validator SHALL reject prices above ₦5,000,000 as unrealistic
2. WHEN a vehicle is 15-19 years old, THE Price_Validator SHALL reject prices above ₦8,000,000 as unrealistic
3. WHEN a vehicle is 10-14 years old, THE Price_Validator SHALL reject prices above ₦12,000,000 as unrealistic
4. WHEN a vehicle is 5-9 years old, THE Price_Validator SHALL reject prices above ₦20,000,000 as unrealistic
5. WHEN a vehicle is 0-4 years old, THE Price_Validator SHALL reject prices above ₦50,000,000 as unrealistic
6. WHEN a price is more than 3x the median of other prices, THE Price_Validator SHALL flag it as an outlier
7. WHEN a price is flagged as an outlier, THE System SHALL exclude it from median calculation but log it for debugging
8. WHEN all prices are rejected as outliers, THE System SHALL return an error indicating insufficient valid data

### Requirement 4: Enhanced Confidence Scoring

**User Story:** As a Claims Adjuster, I want to know how reliable each assessment is based on year match quality, so that I can make informed decisions about case valuations.

#### Acceptance Criteria

1. WHEN all scraped prices are from year-matched listings, THE Confidence_Scorer SHALL assign a confidence score of 90-100%
2. WHEN 50% or more scraped prices are from year-matched listings, THE Confidence_Scorer SHALL assign a confidence score of 70-89%
3. WHEN fewer than 50% scraped prices are from year-matched listings, THE Confidence_Scorer SHALL assign a confidence score of 50-69%
4. WHEN no year-matched listings are found, THE Confidence_Scorer SHALL assign a confidence score of 30-49%
5. WHEN prices are validated and no outliers are detected, THE Confidence_Scorer SHALL increase the confidence score by 10 percentage points
6. WHEN multiple outliers are detected and excluded, THE Confidence_Scorer SHALL decrease the confidence score by 10 percentage points
7. THE System SHALL include year match statistics in the assessment response (e.g., "3 of 5 prices matched exact year")

### Requirement 5: Depreciation-Based Fallback

**User Story:** As a Claims Adjuster, I want the system to estimate prices using depreciation when year-specific data is unavailable, so that I still get reasonable valuations.

#### Acceptance Criteria

1. WHEN no year-matched listings are found for the requested year, THE Fallback_Estimator SHALL search for listings from the nearest available year
2. WHEN listings from a newer year are found, THE Fallback_Estimator SHALL apply depreciation to estimate the requested year's value
3. THE Fallback_Estimator SHALL use a depreciation rate of 15% per year for the first 5 years
4. THE Fallback_Estimator SHALL use a depreciation rate of 10% per year for years 6-10
5. THE Fallback_Estimator SHALL use a depreciation rate of 5% per year for years 11+
6. WHEN applying depreciation, THE System SHALL log the source year, target year, and depreciation rate used
7. WHEN depreciation is applied, THE Confidence_Scorer SHALL reduce the confidence score by 20 percentage points

### Requirement 6: Comprehensive Debugging Logs

**User Story:** As a System Administrator, I want detailed logs of why prices are accepted or rejected, so that I can debug accuracy issues.

#### Acceptance Criteria

1. WHEN a price is scraped, THE System SHALL log the source, listing title, price, year extracted, and year match status
2. WHEN a price is rejected as brand new, THE System SHALL log the rejection reason and the keywords that triggered it
3. WHEN a price is rejected as an outlier, THE System SHALL log the price, the median of other prices, and the outlier ratio
4. WHEN a price is rejected by age-based validation, THE System SHALL log the vehicle age, price, and the threshold that was exceeded
5. WHEN depreciation is applied, THE System SHALL log the source year, target year, depreciation rate, original price, and adjusted price
6. WHEN no valid prices are found, THE System SHALL log a summary of all rejection reasons with counts
7. THE System SHALL use structured logging with consistent field names for easy querying

### Requirement 7: Tokunbo vs Nigerian Used Pricing

**User Story:** As a Claims Adjuster, I want the system to account for Tokunbo vs Nigerian used pricing differences, so that valuations reflect the actual vehicle origin.

#### Acceptance Criteria

1. WHEN scraping results are returned, THE Scraper SHALL analyze listing titles for "tokunbo", "foreign used", "imported", or "belgium" keywords
2. WHEN a listing is identified as Tokunbo, THE Scraper SHALL tag it with a "tokunbo" flag
3. WHEN a listing is identified as Nigerian used, THE Scraper SHALL tag it with a "nigerian_used" flag
4. WHEN calculating median price, THE System SHALL calculate separate medians for Tokunbo and Nigerian used vehicles
5. WHEN both Tokunbo and Nigerian used prices are available, THE System SHALL return both medians with appropriate labels
6. WHEN only one category is available, THE System SHALL return that median with a label indicating the category
7. THE System SHALL include the vehicle origin distribution in the assessment response (e.g., "2 Tokunbo, 3 Nigerian used")

### Requirement 8: Market Research Validation

**User Story:** As a Business Stakeholder, I want the system to validate against known market research, so that we can verify accuracy improvements.

#### Acceptance Criteria

1. WHEN assessing a 2004 Honda Accord, THE System SHALL return a market value between ₦2,000,000 and ₦4,500,000
2. WHEN the calculated median falls outside the expected range, THE System SHALL log a warning with the calculated value and expected range
3. THE System SHALL maintain a configuration file with expected price ranges for common vehicle models by year
4. WHEN a vehicle model and year match a configured expected range, THE Price_Validator SHALL use that range for validation
5. WHEN a calculated price is within 20% of the expected range, THE Confidence_Scorer SHALL increase confidence by 10 percentage points
6. WHEN a calculated price is outside the expected range by more than 50%, THE Confidence_Scorer SHALL decrease confidence by 20 percentage points

### Requirement 9: Query Refinement for Better Results

**User Story:** As a Claims Adjuster, I want the system to construct precise search queries, so that scraping returns relevant listings.

#### Acceptance Criteria

1. WHEN constructing a vehicle query, THE Query_Builder SHALL include make, model, year, and "used" keyword
2. WHEN a source supports advanced filters, THE Query_Builder SHALL use condition filters to exclude new vehicles
3. WHEN a source supports price range filters, THE Query_Builder SHALL set a maximum price based on vehicle age
4. WHEN initial scraping returns fewer than 3 results, THE Query_Builder SHALL retry with a broader query (e.g., without year filter)
5. WHEN a broader query is used, THE System SHALL apply stricter year matching and validation on results
6. THE Query_Builder SHALL avoid overly specific queries that return zero results

### Requirement 10: Real-Time Accuracy Metrics

**User Story:** As a System Administrator, I want to track accuracy metrics in real-time, so that I can monitor system performance.

#### Acceptance Criteria

1. WHEN an assessment is completed, THE System SHALL record the vehicle details, calculated price, confidence score, and year match rate
2. THE System SHALL maintain a rolling 30-day accuracy metric showing average confidence scores
3. THE System SHALL track the percentage of assessments with year-matched data
4. THE System SHALL track the percentage of prices rejected as outliers
5. THE System SHALL track the percentage of assessments using depreciation fallback
6. THE System SHALL expose these metrics via an admin API endpoint
7. WHEN accuracy metrics fall below target thresholds, THE System SHALL send alerts to administrators

