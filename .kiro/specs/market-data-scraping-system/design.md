# Design Document: Market Data Scraping System

## Overview

The Market Data Scraping System enhances the existing AI assessment service by integrating real-time market price data from Nigerian e-commerce platforms. This system will scrape, cache, and aggregate pricing data to provide accurate market valuations that, combined with AI photo analysis, produce reliable damage-based assessments.

The system integrates seamlessly with the existing `ai-assessment-enhanced.service.ts` by replacing the `estimateMarketValue()` function with real scraped data, while maintaining all existing interfaces and workflows.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Case Creation Flow                       │
│  (src/app/api/cases/route.ts)                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│          Enhanced AI Assessment Service                      │
│  (src/features/cases/services/ai-assessment-enhanced.ts)    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ├──────────────┬──────────────┐
                     ▼              ▼              ▼
            ┌────────────┐  ┌────────────┐  ┌────────────┐
            │   Google   │  │   Market   │  │  Damage    │
            │   Vision   │  │   Data     │  │  Analysis  │
            │    API     │  │  Service   │  │            │
            └────────────┘  └──────┬─────┘  └────────────┘
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
            ┌────────────────┐         ┌────────────────┐
            │  Scraper       │         │  Cache         │
            │  Service       │         │  (PostgreSQL)  │
            └────┬───────────┘         └────────────────┘
                 │
     ┌───────────┼───────────┬───────────┐
     ▼           ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Jiji.ng │ │Jumia.ng │ │Cars45.ng│ │Cheki.ng │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
```

### Component Interaction Flow

1. **Case Creation** → Adjuster creates case with property details and photos
2. **AI Assessment** → Enhanced service requests market data
3. **Market Data Service** → Checks cache, initiates scraping if needed
4. **Scraper Service** → Scrapes sources in parallel, respects rate limits
5. **Cache** → Stores results permanently, marks stale data
6. **Aggregation** → Calculates median price from multiple sources
7. **Damage Calculation** → Applies AI damage percentage to market price
8. **Response** → Returns assessment with confidence score

## Components and Interfaces

### 1. Market Data Service

**Location**: `src/features/market-data/services/market-data.service.ts`

**Purpose**: Orchestrates market price retrieval, caching, and aggregation

```typescript
export interface PropertyIdentifier {
  type: 'vehicle' | 'electronics' | 'building';
  
  // Vehicle fields
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  
  // Electronics fields
  brand?: string;
  productModel?: string;
  productType?: string;
  
  // Building fields
  location?: string;
  propertyType?: string;
  size?: number;
  bedrooms?: number;
}

export interface MarketPrice {
  median: number;
  min: number;
  max: number;
  count: number;
  sources: SourcePrice[];
  confidence: number;
  isFresh: boolean;
  cacheAge: number; // days
}

export interface SourcePrice {
  source: string;
  price: number;
  currency: string;
  listingUrl: string;
  listingTitle: string;
  scrapedAt: Date;
}

export async function getMarketPrice(
  property: PropertyIdentifier
): Promise<MarketPrice>

export async function refreshMarketPrice(
  property: PropertyIdentifier
): Promise<void>
```

### 2. Scraper Service

**Location**: `src/features/market-data/services/scraper.service.ts`

**Purpose**: Executes web scraping operations across multiple sources

```typescript
export interface ScraperConfig {
  source: string;
  baseUrl: string;
  selectors: {
    priceSelector: string;
    titleSelector: string;
    linkSelector: string;
    containerSelector: string;
  };
  rateLimit: {
    requestsPerSecond: number;
    burstSize: number;
  };
}

export interface ScrapeResult {
  success: boolean;
  source: string;
  prices: SourcePrice[];
  error?: string;
  duration: number;
}

export async function scrapeSource(
  source: string,
  searchQuery: string,
  config: ScraperConfig
): Promise<ScrapeResult>

export async function scrapeAllSources(
  property: PropertyIdentifier
): Promise<ScrapeResult[]>
```

### 3. Cache Service

**Location**: `src/features/market-data/services/cache.service.ts`

**Purpose**: Manages persistent storage and retrieval of market data

```typescript
export interface CachedMarketData {
  id: string;
  propertyHash: string;
  propertyType: string;
  propertyDetails: PropertyIdentifier;
  prices: SourcePrice[];
  medianPrice: number;
  scrapedAt: Date;
  isStale: boolean;
  staleAt: Date;
}

export async function getCachedPrice(
  property: PropertyIdentifier
): Promise<CachedMarketData | null>

export async function setCachedPrice(
  property: PropertyIdentifier,
  prices: SourcePrice[]
): Promise<void>

export async function markStale(
  propertyHash: string
): Promise<void>

export function isStale(scrapedAt: Date): boolean
```

### 4. Rate Limiter

**Location**: `src/features/market-data/services/rate-limiter.service.ts`

**Purpose**: Enforces rate limiting using Vercel KV

```typescript
export interface RateLimitConfig {
  source: string;
  requestsPerSecond: number;
  burstSize: number;
}

export async function checkRateLimit(
  source: string
): Promise<{ allowed: boolean; retryAfter?: number }>

export async function recordRequest(
  source: string
): Promise<void>

export async function waitForRateLimit(
  source: string
): Promise<void>
```

### 5. Query Builder

**Location**: `src/features/market-data/services/query-builder.service.ts`

**Purpose**: Constructs source-specific search queries

```typescript
export interface SearchQuery {
  source: string;
  url: string;
  params: Record<string, string>;
}

export function buildSearchQuery(
  property: PropertyIdentifier,
  source: string
): SearchQuery

export function buildVehicleQuery(
  make: string,
  model: string,
  year: number,
  source: string
): SearchQuery

export function buildElectronicsQuery(
  brand: string,
  model: string,
  type: string,
  source: string
): SearchQuery

export function buildBuildingQuery(
  location: string,
  type: string,
  size: number,
  source: string
): SearchQuery
```

### 6. Background Job Service

**Location**: `src/features/market-data/services/background-job.service.ts`

**Purpose**: Handles async scraping operations that exceed timeout limits

```typescript
export interface BackgroundJob {
  id: string;
  type: 'scrape_market_data';
  propertyHash: string;
  property: PropertyIdentifier;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export async function enqueueScrapingJob(
  property: PropertyIdentifier
): Promise<string>

export async function processScrapingJob(
  jobId: string
): Promise<void>

export async function getJobStatus(
  jobId: string
): Promise<BackgroundJob>
```

## Data Models

### Database Schema

**Table**: `market_data_cache`

```sql
CREATE TABLE market_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_hash VARCHAR(64) NOT NULL UNIQUE,
  property_type VARCHAR(20) NOT NULL,
  property_details JSONB NOT NULL,
  median_price DECIMAL(12, 2) NOT NULL,
  min_price DECIMAL(12, 2) NOT NULL,
  max_price DECIMAL(12, 2) NOT NULL,
  source_count INTEGER NOT NULL,
  scraped_at TIMESTAMP NOT NULL DEFAULT NOW(),
  stale_at TIMESTAMP NOT NULL,
  is_stale BOOLEAN GENERATED ALWAYS AS (NOW() > stale_at) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_data_property_hash ON market_data_cache(property_hash);
CREATE INDEX idx_market_data_stale ON market_data_cache(is_stale, scraped_at);
CREATE INDEX idx_market_data_type ON market_data_cache(property_type);
```

**Table**: `market_data_sources`

```sql
CREATE TABLE market_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_id UUID NOT NULL REFERENCES market_data_cache(id) ON DELETE CASCADE,
  source_name VARCHAR(50) NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
  listing_url TEXT NOT NULL,
  listing_title TEXT NOT NULL,
  scraped_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_sources_cache ON market_data_sources(cache_id);
CREATE INDEX idx_market_sources_name ON market_data_sources(source_name);
```

**Table**: `scraping_logs`

```sql
CREATE TABLE scraping_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_hash VARCHAR(64) NOT NULL,
  source_name VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  prices_found INTEGER DEFAULT 0,
  duration_ms INTEGER NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scraping_logs_property ON scraping_logs(property_hash);
CREATE INDEX idx_scraping_logs_source ON scraping_logs(source_name, created_at);
CREATE INDEX idx_scraping_logs_status ON scraping_logs(status);
```

**Table**: `background_jobs`

```sql
CREATE TABLE background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL,
  property_hash VARCHAR(64) NOT NULL,
  property_details JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_background_jobs_status ON background_jobs(status, created_at);
CREATE INDEX idx_background_jobs_property ON background_jobs(property_hash);
```

### Drizzle Schema

**Location**: `src/lib/db/schema/market-data.ts`

```typescript
import { pgTable, uuid, varchar, decimal, integer, timestamp, jsonb, text, boolean, index } from 'drizzle-orm/pg-core';

export const marketDataCache = pgTable('market_data_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyHash: varchar('property_hash', { length: 64 }).notNull().unique(),
  propertyType: varchar('property_type', { length: 20 }).notNull(),
  propertyDetails: jsonb('property_details').notNull(),
  medianPrice: decimal('median_price', { precision: 12, scale: 2 }).notNull(),
  minPrice: decimal('min_price', { precision: 12, scale: 2 }).notNull(),
  maxPrice: decimal('max_price', { precision: 12, scale: 2 }).notNull(),
  sourceCount: integer('source_count').notNull(),
  scrapedAt: timestamp('scraped_at').notNull().defaultNow(),
  staleAt: timestamp('stale_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  propertyHashIdx: index('idx_market_data_property_hash').on(table.propertyHash),
  staleIdx: index('idx_market_data_stale').on(table.scrapedAt),
  typeIdx: index('idx_market_data_type').on(table.propertyType),
}));

export const marketDataSources = pgTable('market_data_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  cacheId: uuid('cache_id').notNull().references(() => marketDataCache.id, { onDelete: 'cascade' }),
  sourceName: varchar('source_name', { length: 50 }).notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('NGN'),
  listingUrl: text('listing_url').notNull(),
  listingTitle: text('listing_title').notNull(),
  scrapedAt: timestamp('scraped_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  cacheIdx: index('idx_market_sources_cache').on(table.cacheId),
  nameIdx: index('idx_market_sources_name').on(table.sourceName),
}));

export const scrapingLogs = pgTable('scraping_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyHash: varchar('property_hash', { length: 64 }).notNull(),
  sourceName: varchar('source_name', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  pricesFound: integer('prices_found').default(0),
  durationMs: integer('duration_ms').notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  propertyIdx: index('idx_scraping_logs_property').on(table.propertyHash),
  sourceIdx: index('idx_scraping_logs_source').on(table.sourceName, table.createdAt),
  statusIdx: index('idx_scraping_logs_status').on(table.status),
}));

export const backgroundJobs = pgTable('background_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobType: varchar('job_type', { length: 50 }).notNull(),
  propertyHash: varchar('property_hash', { length: 64 }).notNull(),
  propertyDetails: jsonb('property_details').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  statusIdx: index('idx_background_jobs_status').on(table.status, table.createdAt),
  propertyIdx: index('idx_background_jobs_property').on(table.propertyHash),
}));
```

## Integration with Existing AI Assessment

### Modified Enhanced AI Assessment Service

The existing `assessDamageEnhanced()` function will be updated to use the market data service:

```typescript
// BEFORE (current implementation)
const marketValue = vehicleInfo?.marketValue || estimateMarketValue(vehicleInfo, photos.length);

// AFTER (with market data integration)
const marketValue = await getMarketValueWithScraping(vehicleInfo);

async function getMarketValueWithScraping(vehicleInfo?: VehicleInfo): Promise<number> {
  // If user provided market value, use it
  if (vehicleInfo?.marketValue && vehicleInfo.marketValue > 0) {
    return vehicleInfo.marketValue;
  }
  
  // If we have vehicle info, try to get scraped market data
  if (vehicleInfo?.make && vehicleInfo?.model && vehicleInfo?.year) {
    try {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: vehicleInfo.make,
        model: vehicleInfo.model,
        year: vehicleInfo.year,
        mileage: vehicleInfo.mileage
      };
      
      const marketPrice = await getMarketPrice(property);
      
      // Apply mileage and condition adjustments
      let adjustedPrice = marketPrice.median;
      
      if (vehicleInfo.mileage) {
        const age = new Date().getFullYear() - vehicleInfo.year;
        adjustedPrice *= getMileageAdjustment(vehicleInfo.mileage, age);
      }
      
      if (vehicleInfo.condition) {
        adjustedPrice *= getConditionAdjustment(vehicleInfo.condition);
      }
      
      return Math.round(adjustedPrice);
    } catch (error) {
      console.error('Failed to get market price, falling back to estimation:', error);
      // Fall back to existing estimation logic
      return estimateMarketValue(vehicleInfo, 5);
    }
  }
  
  // Fall back to existing estimation logic
  return estimateMarketValue(vehicleInfo, 5);
}
```

### Updated Confidence Calculation

The confidence calculation will be enhanced to account for market data quality:

```typescript
// Add market data confidence to existing confidence calculation
if (marketPrice && marketPrice.isFresh && marketPrice.count >= 3) {
  confidence.valuationAccuracy = 90;
  confidence.reasons.push(`Market value from ${marketPrice.count} sources (${marketPrice.cacheAge} days old)`);
} else if (marketPrice && marketPrice.count >= 2) {
  confidence.valuationAccuracy = 75;
  confidence.reasons.push(`Market value from ${marketPrice.count} sources (${marketPrice.cacheAge} days old)`);
} else if (marketPrice && marketPrice.count === 1) {
  confidence.valuationAccuracy = 60;
  confidence.reasons.push('Market value from single source - limited data');
} else if (vehicleInfo?.marketValue) {
  confidence.valuationAccuracy = 90;
} else {
  confidence.valuationAccuracy = 30;
  confidence.reasons.push('Market value estimated without real data');
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I've identified the following redundancies:

- **4.3 and 4.4** are identical - both test the damage calculation formula. Will combine into single property.
- **6.2 and 9.5** are duplicates - both test timeout handling for background jobs. Will use 6.2.
- **1.2, 1.3, 1.4** all test query construction for different property types. Will combine into single comprehensive property.
- **8.1, 8.2, 8.3** all test confidence scoring with different source counts. Will combine into single property with ranges.
- **5.1, 5.2, 5.3, 5.4, 5.5** all test logging behavior. Will combine into comprehensive logging property.

### Correctness Properties

Property 1: Multi-source scraping
*For any* property identifier, when scraping is initiated, the system should attempt to scrape at least 3 sources (Jiji.ng, Jumia.ng, Cars45.ng) and return results from all successful sources
**Validates: Requirements 1.1**

Property 2: Property-specific query construction
*For any* property type (vehicle, electronics, building), the query builder should construct search queries containing all required parameters for that property type
**Validates: Requirements 1.2, 1.3, 1.4, 10.5**

Property 3: Parallel scraping performance
*For any* set of sources, when scraping multiple sources, the total execution time should be less than the sum of individual scraping times (indicating parallel execution)
**Validates: Requirements 1.5**

Property 4: Complete data extraction
*For any* successful scrape result, the extracted data should contain price, listing title, and listing URL fields
**Validates: Requirements 1.6, 2.7**

Property 5: Robots.txt compliance
*For any* source, before scraping, the system should check robots.txt and skip any disallowed paths
**Validates: Requirements 1.7**

Property 6: Rate limiting enforcement
*For any* source, when making multiple requests, the time between consecutive requests should be at least 500ms (2 requests per second maximum)
**Validates: Requirements 1.8**

Property 7: Scraping persistence
*For any* successful scrape operation, the pricing data should be stored in the PostgreSQL database with a valid timestamp
**Validates: Requirements 2.1, 2.2**

Property 8: Fresh cache usage
*For any* cached data less than 7 days old, requesting market price should return cached data without initiating new scraping
**Validates: Requirements 2.3**

Property 9: Stale data detection
*For any* cached data older than 7 days, the system should mark it as stale
**Validates: Requirements 2.4**

Property 10: Background refresh for stale data
*For any* stale cached data, when requested, the system should initiate a background job to refresh the data
**Validates: Requirements 2.5**

Property 11: Graceful degradation with stale data
*For any* scraping operation that fails, if stale cached data exists, the system should return the stale data rather than an error
**Validates: Requirements 2.6, 7.3**

Property 12: Median calculation correctness
*For any* set of valid prices (positive numbers), the calculated median should equal the mathematical median of those prices
**Validates: Requirements 3.1, 3.2**

Property 13: Invalid price filtering
*For any* set of prices containing zero or negative values, the median calculation should exclude those invalid prices
**Validates: Requirements 3.5**

Property 14: Empty price set error handling
*For any* property with no available prices, the system should return an error indicating insufficient market data
**Validates: Requirements 3.4, 7.4**

Property 15: Aggregated and individual price storage
*For any* cached market data, both the calculated median price and individual source prices should be stored
**Validates: Requirements 3.6**

Property 16: Damage calculation formula
*For any* market price and damage severity percentage, the final assessed value should equal market_price × (1 - damage_percentage / 100)
**Validates: Requirements 4.3, 4.4**

Property 17: Damage severity bounds
*For any* AI assessment, the damage severity percentage should be between 0 and 100 (inclusive)
**Validates: Requirements 4.2**

Property 18: Complete assessment response
*For any* assessment response, it should contain both the market price and the damage-adjusted value
**Validates: Requirements 4.5**

Property 19: Comprehensive audit logging
*For any* scraping operation (start, success, failure, cache hit, fallback), the system should create a log entry with appropriate details (property identifier, sources, timestamps, prices found, errors)
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

Property 20: Fresh cache performance
*For any* request with fresh cached data available, the response time should be under 2 seconds
**Validates: Requirements 6.1**

Property 21: Timeout-triggered background jobs
*For any* scraping operation that would exceed 10 seconds, the system should initiate a background job and return immediately with cached data (if available) and a refresh-in-progress flag
**Validates: Requirements 6.2, 6.3, 9.5**

Property 22: Individual source timeout
*For any* source request, if the source doesn't respond within 5 seconds, the request should timeout and the scraper should continue with remaining sources
**Validates: Requirements 6.4, 6.5**

Property 23: Partial failure resilience
*For any* scraping operation where some sources fail (HTTP errors, parsing errors, timeouts), the system should continue scraping remaining sources and return results from successful sources
**Validates: Requirements 7.1, 7.2, 6.5**

Property 24: Rate limit retry queueing
*For any* request that triggers rate limiting, the system should queue the request for retry after the rate limit window expires
**Validates: Requirements 7.5**

Property 25: Source-count-based confidence scoring
*For any* market price calculation, the confidence score should be in the range 90-100% for 3+ sources, 70-89% for 2 sources, and 50-69% for 1 source (with fresh data)
**Validates: Requirements 8.1, 8.2, 8.3**

Property 26: Staleness confidence penalty
*For any* market price using stale data (7-30 days old), the confidence score should be reduced by 20 percentage points; for very stale data (30+ days old), reduced by 40 percentage points
**Validates: Requirements 8.4, 8.5**

Property 27: Confidence score presence
*For any* assessment response, it should include a confidence score
**Validates: Requirements 8.6, 7.6**

Property 28: Async background job execution
*For any* background job, it should update the cache without blocking the original user request
**Validates: Requirements 9.6**

Property 29: Property type support
*For any* supported property type (vehicle, electronics, building), the system should successfully process assessments with the appropriate parameters
**Validates: Requirements 10.1, 10.2, 10.3**

Property 30: Unsupported property type error
*For any* unsupported property type, the system should return an error indicating the property type is not supported
**Validates: Requirements 10.4**

Property 31: Property type storage
*For any* cached market data, the property type should be stored alongside the pricing data
**Validates: Requirements 10.6**

Property 32: Metrics logging for unmet targets
*For any* operation where accuracy targets are not met, the system should log detailed metrics for analysis
**Validates: Requirements 11.5**

## Error Handling

### Error Categories

1. **Scraping Errors**
   - HTTP errors (4xx, 5xx)
   - Network timeouts
   - DNS resolution failures
   - SSL/TLS errors

2. **Parsing Errors**
   - Malformed HTML
   - Missing selectors
   - Unexpected page structure
   - Invalid price formats

3. **Rate Limiting Errors**
   - Rate limit exceeded
   - IP blocked
   - CAPTCHA challenges

4. **Data Validation Errors**
   - Invalid property parameters
   - Missing required fields
   - Out-of-range values

5. **Cache Errors**
   - Database connection failures
   - Query timeouts
   - Data corruption

### Error Handling Strategy

**Scraping Errors**: Log error, continue with remaining sources, use cached data if available

**Parsing Errors**: Log error with HTML snippet, continue with remaining sources

**Rate Limiting**: Queue request for retry, use cached data immediately

**Validation Errors**: Return 400 error to client with detailed validation messages

**Cache Errors**: Attempt scraping without cache, log critical error for monitoring

### Fallback Chain

```
1. Try fresh cache (< 7 days)
   ↓ (cache miss or stale)
2. Try scraping all sources
   ↓ (scraping fails)
3. Try stale cache (7-30 days)
   ↓ (no stale cache)
4. Try very stale cache (30+ days)
   ↓ (no cache at all)
5. Return error with descriptive message
```

## Testing Strategy

### Dual Testing Approach

The system will use both unit tests and property-based tests for comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of query construction
- Edge cases (empty results, single source, all sources fail)
- Integration points (database, external APIs)
- Error conditions (network failures, parsing errors)

**Property-Based Tests** focus on:
- Universal properties across all inputs (median calculation, confidence scoring)
- Comprehensive input coverage through randomization
- Invariants (rate limiting, timeout enforcement)
- Round-trip properties (cache storage and retrieval)

### Property-Based Testing Configuration

**Library**: Use `fast-check` for TypeScript property-based testing

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: market-data-scraping-system, Property {number}: {property_text}`
- Seed-based reproducibility for failed tests

**Example Property Test**:

```typescript
import fc from 'fast-check';

// Feature: market-data-scraping-system, Property 12: Median calculation correctness
test('median calculation is mathematically correct', () => {
  fc.assert(
    fc.property(
      fc.array(fc.float({ min: 1, max: 100000000 }), { minLength: 1, maxLength: 20 }),
      (prices) => {
        const result = calculateMedian(prices);
        const sorted = [...prices].sort((a, b) => a - b);
        const expectedMedian = sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
        
        expect(result).toBeCloseTo(expectedMedian, 2);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Test Coverage Goals

- Unit test coverage: 80%+ for all service files
- Property test coverage: All 32 correctness properties implemented
- Integration test coverage: All API endpoints and database operations
- E2E test coverage: Complete case creation flow with market data

### Testing Environments

**Development**: Mock scraping responses, use test database

**Staging**: Real scraping with test sources, production-like database

**Production**: Real scraping, comprehensive monitoring and alerting

## Performance Considerations

### Caching Strategy

- **Cache Hit Rate Target**: 80%+ for vehicles within 30 days
- **Cache Invalidation**: 7-day TTL with background refresh
- **Cache Warming**: Pre-populate cache for common vehicles

### Scraping Performance

- **Parallel Execution**: Scrape all sources simultaneously
- **Timeout Configuration**: 5 seconds per source, 10 seconds total
- **Connection Pooling**: Reuse HTTP connections for multiple requests

### Database Optimization

- **Indexes**: Property hash, scrape timestamp, source name
- **Partitioning**: Consider partitioning by property type for large datasets
- **Archival**: Archive scraping logs older than 90 days

### Rate Limiting

- **Vercel KV**: Use for distributed rate limiting state
- **Sliding Window**: Implement sliding window algorithm for smooth rate limiting
- **Burst Handling**: Allow burst of 5 requests, then enforce 2/second

## Security Considerations

### Scraping Ethics

- Respect robots.txt directives
- Implement rate limiting to avoid overwhelming sources
- Use appropriate User-Agent headers
- Cache aggressively to minimize requests

### Data Privacy

- Do not store personally identifiable information from listings
- Anonymize listing URLs in logs
- Encrypt sensitive property details in cache

### Input Validation

- Sanitize all property parameters before query construction
- Validate price ranges (reject negative or unrealistic values)
- Limit query string length to prevent injection attacks

### Error Information Disclosure

- Do not expose internal error details to clients
- Log detailed errors internally for debugging
- Return generic error messages to API consumers

## Monitoring and Observability

### Key Metrics

1. **Scraping Success Rate**: Percentage of successful scrapes per source
2. **Cache Hit Rate**: Percentage of requests served from cache
3. **Average Response Time**: Time to return market price
4. **Confidence Score Distribution**: Distribution of confidence scores
5. **Background Job Queue Length**: Number of pending background jobs

### Alerts

- Scraping success rate drops below 70%
- Cache hit rate drops below 60%
- Average response time exceeds 3 seconds
- Background job queue exceeds 100 pending jobs
- Any source consistently fails for 1 hour

### Logging

- All scraping operations logged to `scraping_logs` table
- Audit logs for all market data requests
- Performance metrics logged to monitoring service
- Error logs with stack traces for debugging

## Deployment Strategy

### Phase 1: Development (Week 1-2)

- Implement core scraping service
- Implement caching layer
- Write unit and property tests
- Test with mock data

### Phase 2: Staging (Week 3)

- Deploy to staging environment
- Test with real sources (limited traffic)
- Monitor performance and error rates
- Tune rate limiting and timeouts

### Phase 3: Production Rollout (Week 4)

- Deploy to production with feature flag
- Enable for 10% of traffic
- Monitor accuracy improvement
- Gradually increase to 100%

### Phase 4: Optimization (Week 5+)

- Analyze cache hit rates
- Optimize query construction
- Add more sources if needed
- Implement cache warming

## Future Enhancements

### Additional Sources

- Add Konga.ng for electronics
- Add PropertyPro.ng for buildings
- Add Autochek.ng for vehicles

### Machine Learning

- Train ML model to predict market prices
- Use ML to validate scraped prices (outlier detection)
- Predict optimal cache refresh intervals

### Advanced Features

- Historical price tracking
- Price trend analysis
- Market volatility indicators
- Automated price alerts

### API Improvements

- GraphQL API for flexible queries
- Webhook notifications for price updates
- Bulk assessment API for multiple properties
