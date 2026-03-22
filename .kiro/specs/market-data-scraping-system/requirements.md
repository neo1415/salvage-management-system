# Requirements Document: Market Data Scraping System

## Introduction

This document specifies requirements for a web scraping system that aggregates market prices from multiple Nigerian e-commerce platforms to improve AI-based property assessment accuracy. The system will scrape, cache, and aggregate pricing data for vehicles, electronics, and buildings from at least three sources, using this data alongside AI photo analysis to calculate accurate damage-based value assessments.

## Glossary

- **Scraper**: The component responsible for extracting pricing data from e-commerce websites
- **Cache**: The PostgreSQL database storage that persists scraped market data
- **Property**: Any assessable item including vehicles, electronics, or buildings
- **Market_Price**: The aggregated median price from multiple e-commerce sources
- **Damage_Assessment**: AI-calculated percentage decrease in property value based on photo analysis
- **Stale_Data**: Cached market prices older than 7 days
- **Source**: An e-commerce website providing market pricing data (Jiji.ng, Jumia.ng, Cars45.ng, Cheki.ng)
- **Rate_Limiter**: Component enforcing maximum 2 requests per second per source
- **Background_Job**: Asynchronous scraping task that runs independently of user requests
- **Confidence_Score**: Numerical indicator of assessment accuracy based on data quality and recency

## Requirements

### Requirement 1: Multi-Source Price Scraping

**User Story:** As an adjuster, I want the system to gather prices from multiple Nigerian e-commerce sites, so that I can get accurate market valuations for damaged property.

#### Acceptance Criteria

1. THE Scraper SHALL extract pricing data from at least three sources: Jiji.ng, Jumia.ng, and Cars45.ng
2. WHEN scraping vehicles, THE Scraper SHALL search using make, model, and year parameters
3. WHEN scraping electronics, THE Scraper SHALL search using brand, model, and product type parameters
4. WHEN scraping buildings, THE Scraper SHALL search using location, property type, and size parameters
5. THE Scraper SHALL execute requests to all sources in parallel to minimize total scraping time
6. WHEN a source returns pricing data, THE Scraper SHALL extract price, listing title, and listing URL
7. THE Scraper SHALL respect robots.txt directives for each source
8. THE Rate_Limiter SHALL enforce a maximum of 2 requests per second per source

### Requirement 2: Permanent Caching with Refresh Strategy

**User Story:** As a system administrator, I want scraped data cached permanently with periodic refresh, so that we minimize scraping overhead while maintaining data freshness.

#### Acceptance Criteria

1. WHEN the Scraper successfully retrieves pricing data, THE Cache SHALL store the data permanently in PostgreSQL
2. THE Cache SHALL record the timestamp of each scraping operation
3. WHEN cached data exists and is less than 7 days old, THE System SHALL use cached data without re-scraping
4. WHEN cached data is older than 7 days, THE System SHALL mark it as Stale_Data
5. WHEN Stale_Data is requested, THE System SHALL initiate a background scraping job to refresh the data
6. WHEN a background scraping job fails, THE System SHALL return Stale_Data rather than failing the assessment
7. THE Cache SHALL store property identifier, source name, price, currency, listing URL, and scrape timestamp for each record

### Requirement 3: Price Aggregation and Median Calculation

**User Story:** As an adjuster, I want the system to calculate a reliable median price from multiple sources, so that outliers don't skew the market valuation.

#### Acceptance Criteria

1. WHEN multiple prices are retrieved for the same property, THE System SHALL calculate the median price across all sources
2. WHEN fewer than 3 prices are available, THE System SHALL calculate the median from available prices
3. WHEN only 1 price is available, THE System SHALL use that single price as the Market_Price
4. WHEN no prices are available, THE System SHALL return an error indicating insufficient market data
5. THE System SHALL exclude prices that are zero or negative from median calculation
6. THE System SHALL store the calculated Market_Price alongside individual source prices in the Cache

### Requirement 4: AI Photo Analysis Integration

**User Story:** As an adjuster, I want AI to analyze damage photos and calculate value decrease, so that assessments account for actual property condition.

#### Acceptance Criteria

1. WHEN property photos are provided, THE AI_Assessment_Service SHALL analyze images to determine damage severity
2. THE AI_Assessment_Service SHALL return a damage severity percentage between 0% and 100%
3. WHEN damage severity is calculated, THE System SHALL apply the percentage decrease to the Market_Price
4. THE System SHALL calculate final assessed value as: Market_Price × (1 - damage_severity_percentage)
5. THE System SHALL include both Market_Price and damage-adjusted value in the assessment response

### Requirement 5: Comprehensive Audit Logging

**User Story:** As a system administrator, I want all scraping activity logged, so that I can monitor system health and debug issues.

#### Acceptance Criteria

1. WHEN a scraping operation starts, THE System SHALL log the property identifier, sources targeted, and timestamp
2. WHEN a scraping operation completes successfully, THE System SHALL log the number of prices found per source
3. WHEN a scraping operation fails, THE System SHALL log the error message, source name, and failure reason
4. WHEN cached data is used, THE System SHALL log the cache hit with data age
5. WHEN Stale_Data is returned due to scraping failure, THE System SHALL log the fallback event
6. THE System SHALL use the existing audit logging infrastructure for all scraping logs

### Requirement 6: Performance and Timeout Constraints

**User Story:** As an adjuster, I want assessments to complete quickly, so that I can process cases efficiently.

#### Acceptance Criteria

1. WHEN cached data is available and fresh, THE System SHALL return assessment results within 2 seconds
2. WHEN scraping is required, THE System SHALL initiate a Background_Job if total scraping time exceeds 10 seconds
3. WHEN a Background_Job is initiated, THE System SHALL immediately return cached data (even if stale) with a flag indicating refresh in progress
4. THE Scraper SHALL timeout individual source requests after 5 seconds
5. WHEN a source times out, THE Scraper SHALL continue with remaining sources rather than failing the entire operation

### Requirement 7: Error Handling and Graceful Degradation

**User Story:** As an adjuster, I want the system to handle scraping failures gracefully, so that I can still get assessments even when some sources are unavailable.

#### Acceptance Criteria

1. WHEN a source returns an HTTP error, THE Scraper SHALL log the error and continue with remaining sources
2. WHEN a source returns malformed HTML, THE Scraper SHALL log a parsing error and continue with remaining sources
3. WHEN all sources fail, THE System SHALL return Stale_Data if available
4. WHEN all sources fail and no cached data exists, THE System SHALL return an error with a descriptive message
5. WHEN rate limiting is triggered, THE Scraper SHALL queue the request for retry after the rate limit window expires
6. THE System SHALL include a Confidence_Score in assessment responses based on data freshness and source count

### Requirement 8: Confidence Score Calculation

**User Story:** As an adjuster, I want to know how reliable each assessment is, so that I can make informed decisions about case valuations.

#### Acceptance Criteria

1. WHEN Market_Price is calculated from 3 or more sources with fresh data (less than 7 days old), THE System SHALL assign a Confidence_Score of 90-100%
2. WHEN Market_Price is calculated from 2 sources with fresh data, THE System SHALL assign a Confidence_Score of 70-89%
3. WHEN Market_Price is calculated from 1 source with fresh data, THE System SHALL assign a Confidence_Score of 50-69%
4. WHEN Market_Price uses Stale_Data (7-30 days old), THE System SHALL reduce the Confidence_Score by 20 percentage points
5. WHEN Market_Price uses very stale data (more than 30 days old), THE System SHALL reduce the Confidence_Score by 40 percentage points
6. THE System SHALL include the Confidence_Score in all assessment responses

### Requirement 9: Serverless Infrastructure Compatibility

**User Story:** As a system administrator, I want the scraping system to work on Vercel's serverless platform, so that we can use free infrastructure.

#### Acceptance Criteria

1. THE Scraper SHALL use axios and cheerio libraries for HTTP requests and HTML parsing
2. THE System SHALL NOT use Puppeteer or other headless browser solutions
3. THE System SHALL store all persistent data in the existing PostgreSQL database
4. THE System SHALL use Vercel KV for rate limiting state management
5. WHEN a scraping operation exceeds Vercel's 10-second function timeout, THE System SHALL delegate to a Background_Job
6. THE Background_Job SHALL update the Cache asynchronously without blocking the user request

### Requirement 10: Property Type Support

**User Story:** As an adjuster, I want to assess all property types using the same system, so that I have a consistent workflow regardless of case type.

#### Acceptance Criteria

1. THE System SHALL support vehicle assessments with make, model, year, and mileage parameters
2. THE System SHALL support electronics assessments with brand, model, and condition parameters
3. THE System SHALL support building assessments with location, property type, size, and age parameters
4. WHEN a property type is not recognized, THE System SHALL return an error indicating unsupported property type
5. THE Scraper SHALL adapt search queries based on property type to match source-specific search formats
6. THE Cache SHALL store property type alongside pricing data for proper retrieval

### Requirement 11: Accuracy Improvement Target

**User Story:** As a business stakeholder, I want assessment accuracy to improve significantly, so that we can provide better service to clients.

#### Acceptance Criteria

1. WHEN the system is fully operational, assessment accuracy SHALL improve from the baseline 30% to at least 70%
2. THE System SHALL achieve 80% or higher cache hit rate for vehicle assessments within 30 days of deployment
3. THE Scraper SHALL achieve 70% or higher success rate across all scraping operations
4. THE System SHALL provide Market_Price data for at least 70% of assessment requests
5. WHEN accuracy targets are not met, THE System SHALL log detailed metrics for analysis and improvement
