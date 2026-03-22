# Implementation Plan: Market Data Scraping System

## Overview

This implementation plan breaks down the market data scraping system into discrete coding tasks. The system will integrate with the existing AI assessment service to provide real market prices from Nigerian e-commerce platforms, improving assessment accuracy from 30% to 70%+.

The implementation follows the existing codebase patterns:
- TypeScript with Next.js
- Service-based architecture in `src/features/`
- Drizzle ORM for database operations
- Vitest for unit tests, fast-check for property-based tests
- Existing audit logging infrastructure

## Tasks

- [x] 1. Set up database schema and migrations
  - Create Drizzle schema file at `src/lib/db/schema/market-data.ts`
  - Define tables: `market_data_cache`, `market_data_sources`, `scraping_logs`, `background_jobs`
  - Generate and run migration
  - _Requirements: 2.1, 2.2, 2.7, 5.1-5.5_

- [x] 2. Implement core data models and types
  - [x] 2.1 Create TypeScript interfaces for market data
    - Create `src/features/market-data/types/index.ts`
    - Define `PropertyIdentifier`, `MarketPrice`, `SourcePrice`, `ScrapeResult` interfaces
    - Export all types for use across services
    - _Requirements: 1.1-1.4, 2.7, 3.1-3.6_
  
  - [x] 2.2 Write property test for type validation
    - **Property 29: Property type support**
    - **Validates: Requirements 10.1, 10.2, 10.3**

- [-] 3. Implement cache service
  - [x] 3.1 Create cache service with PostgreSQL operations
    - Create `src/features/market-data/services/cache.service.ts`
    - Implement `getCachedPrice()`, `setCachedPrice()`, `markStale()`, `isStale()`
    - Use Drizzle ORM for database operations
    - Generate property hash using crypto (SHA-256 of normalized property details)
    - _Requirements: 2.1-2.7_
  
  - [-] 3.2 Write property tests for cache operations
    - **Property 7: Scraping persistence**
    - **Property 8: Fresh cache usage**
    - **Property 9: Stale data detection**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.7**
  
  - [x] 3.3 Write unit tests for cache edge cases
    - Test cache miss scenarios
    - Test concurrent cache updates
    - Test database connection failures
    - _Requirements: 2.1-2.7_

- [x] 4. Implement rate limiter service
  - [x] 4.1 Create rate limiter using Vercel KV
    - Create `src/features/market-data/services/rate-limiter.service.ts`
    - Implement sliding window rate limiting (2 requests/second per source)
    - Use Vercel KV for distributed state management
    - Implement `checkRateLimit()`, `recordRequest()`, `waitForRateLimit()`
    - _Requirements: 1.8, 7.5_
  
  - [x] 4.2 Write property test for rate limiting
    - **Property 6: Rate limiting enforcement**
    - **Property 24: Rate limit retry queueing**
    - **Validates: Requirements 1.8, 7.5**

- [x] 5. Implement query builder service
  - [x] 5.1 Create query builder for source-specific queries
    - Create `src/features/market-data/services/query-builder.service.ts`
    - Implement `buildSearchQuery()` with property type detection
    - Implement `buildVehicleQuery()`, `buildElectronicsQuery()`, `buildBuildingQuery()`
    - Create source-specific URL templates for Jiji, Jumia, Cars45, Cheki
    - _Requirements: 1.2-1.4, 10.5_
  
  - [x] 5.2 Write property test for query construction
    - **Property 2: Property-specific query construction**
    - **Validates: Requirements 1.2, 1.3, 1.4, 10.5**
  
  - [x] 5.3 Write unit tests for query builder
    - Test each source's query format
    - Test parameter encoding and sanitization
    - Test invalid property types
    - _Requirements: 1.2-1.4_

- [-] 6. Implement scraper service
  - [x] 6.1 Create base scraper with axios and cheerio
    - Create `src/features/market-data/services/scraper.service.ts`
    - Implement `scrapeSource()` with timeout handling (5 seconds)
    - Implement HTML parsing with cheerio
    - Implement robots.txt checking
    - Add error handling for HTTP errors and parsing failures
    - _Requirements: 1.1, 1.5-1.8, 6.4, 6.5, 7.1, 7.2, 9.1_
  
  - [x] 6.2 Implement source-specific scrapers
    - Create scraper configs for Jiji.ng, Jumia.ng, Cars45.ng, Cheki.ng
    - Define CSS selectors for price, title, and URL extraction
    - Implement price parsing and normalization (handle ₦, commas, etc.)
    - _Requirements: 1.1, 1.6_
  
  - [x] 6.3 Implement parallel scraping
    - Implement `scrapeAllSources()` using Promise.all()
    - Add rate limiting integration
    - Add timeout handling (10 seconds total)
    - _Requirements: 1.5, 6.2, 6.4, 6.5_
  
  - [x] 6.4 Write property tests for scraper
    - **Property 1: Multi-source scraping**
    - **Property 3: Parallel scraping performance**
    - **Property 4: Complete data extraction**
    - **Property 5: Robots.txt compliance**
    - **Property 22: Individual source timeout**
    - **Property 23: Partial failure resilience**
    - **Validates: Requirements 1.1, 1.5, 1.6, 1.7, 6.4, 6.5, 7.1, 7.2**
  
  - [x] 6.5 Write unit tests for scraper edge cases
    - Test malformed HTML handling
    - Test network errors
    - Test empty results
    - Test price parsing edge cases (missing currency, invalid format)
    - _Requirements: 1.6, 7.1, 7.2_

- [x] 7. Checkpoint - Ensure scraping tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement price aggregation service
  - [x] 8.1 Create aggregation service
    - Create `src/features/market-data/services/aggregation.service.ts`
    - Implement `calculateMedian()` with invalid price filtering
    - Implement `aggregatePrices()` to calculate min, max, median
    - Handle edge cases (0 prices, 1 price, 2 prices, 3+ prices)
    - _Requirements: 3.1-3.6_
  
  - [x] 8.2 Write property tests for aggregation
    - **Property 12: Median calculation correctness**
    - **Property 13: Invalid price filtering**
    - **Property 14: Empty price set error handling**
    - **Validates: Requirements 3.1, 3.2, 3.4, 3.5**
  
  - [x] 8.3 Write unit tests for aggregation edge cases
    - Test single price
    - Test two prices
    - Test all invalid prices
    - Test mixed valid and invalid prices
    - _Requirements: 3.1-3.5_

- [x] 9. Implement confidence scoring service
  - [x] 9.1 Create confidence scoring logic
    - Create `src/features/market-data/services/confidence.service.ts`
    - Implement `calculateConfidence()` based on source count and data freshness
    - Apply staleness penalties (20 points for 7-30 days, 40 points for 30+ days)
    - _Requirements: 7.6, 8.1-8.6_
  
  - [x] 9.2 Write property tests for confidence scoring
    - **Property 25: Source-count-based confidence scoring**
    - **Property 26: Staleness confidence penalty**
    - **Property 27: Confidence score presence**
    - **Validates: Requirements 7.6, 8.1-8.6**

- [x] 10. Implement audit logging integration
  - [x] 10.1 Add scraping logs to audit system
    - Extend existing audit logger at `src/lib/utils/audit-logger.ts`
    - Add scraping-specific log types
    - Implement logging for start, success, failure, cache hit, fallback events
    - Store logs in `scraping_logs` table
    - _Requirements: 5.1-5.5_
  
  - [x] 10.2 Write property test for logging
    - **Property 19: Comprehensive audit logging**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [ ] 11. Implement background job service
  - [x] 11.1 Create background job processor
    - Create `src/features/market-data/services/background-job.service.ts`
    - Implement `enqueueScrapingJob()`, `processScrapingJob()`, `getJobStatus()`
    - Store jobs in `background_jobs` table
    - Implement async job processing without blocking requests
    - _Requirements: 2.5, 6.2, 6.3, 9.5, 9.6_
  
  - [x] 11.2 Write property tests for background jobs
    - **Property 10: Background refresh for stale data**
    - **Property 21: Timeout-triggered background jobs**
    - **Property 28: Async background job execution**
    - **Validates: Requirements 2.5, 6.2, 6.3, 9.6**
  
  - [x] 11.3 Write unit tests for job processing
    - Test job creation
    - Test job status tracking
    - Test job failure handling
    - _Requirements: 2.5, 6.2, 6.3_

- [x] 12. Implement main market data service
  - [x] 12.1 Create orchestration service
    - Create `src/features/market-data/services/market-data.service.ts`
    - Implement `getMarketPrice()` with cache-first strategy
    - Implement fallback chain (fresh cache → scrape → stale cache → error)
    - Integrate all sub-services (cache, scraper, aggregation, confidence, logging)
    - _Requirements: 2.3-2.6, 7.3, 7.4, 11.4_
  
  - [x] 12.2 Implement `refreshMarketPrice()` for manual refresh
    - Force scraping regardless of cache state
    - Update cache with new results
    - _Requirements: 2.5_
  
  - [x] 12.3 Write property tests for market data service
    - **Property 11: Graceful degradation with stale data**
    - **Property 15: Aggregated and individual price storage**
    - **Property 20: Fresh cache performance**
    - **Property 30: Unsupported property type error**
    - **Property 31: Property type storage**
    - **Validates: Requirements 2.6, 3.6, 6.1, 7.3, 10.4, 10.6**
  
  - [ ] 12.4 Write integration tests for market data service
    - Test complete flow: cache miss → scrape → aggregate → store
    - Test cache hit flow
    - Test stale data fallback
    - Test all sources fail scenario
    - _Requirements: 2.3-2.6, 7.3, 7.4_

- [x] 13. Checkpoint - Ensure market data service tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Integrate with existing AI assessment service
  - [x] 14.1 Update enhanced AI assessment service
    - Modify `src/features/cases/services/ai-assessment-enhanced.service.ts`
    - Replace `estimateMarketValue()` calls with `getMarketPrice()` from market data service
    - Add market data confidence to overall confidence calculation
    - Preserve existing mileage and condition adjustments
    - _Requirements: 4.1-4.5_
  
  - [x] 14.2 Write property tests for AI integration
    - **Property 16: Damage calculation formula**
    - **Property 17: Damage severity bounds**
    - **Property 18: Complete assessment response**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**
  
  - [x] 14.3 Write integration tests for AI assessment with market data
    - Test assessment with fresh market data
    - Test assessment with stale market data
    - Test assessment with scraping failure (fallback to estimation)
    - Test assessment with no market data available
    - _Requirements: 4.1-4.5_

- [x] 15. Create API endpoint for background job processing
  - [x] 15.1 Create cron endpoint for job processing
    - Create `src/app/api/cron/process-scraping-jobs/route.ts`
    - Implement job queue processing
    - Add Vercel cron configuration
    - _Requirements: 2.5, 9.6_
  
  - [x] 15.2 Write integration tests for cron endpoint
    - Test job processing
    - Test concurrent job handling
    - Test job failure scenarios
    - _Requirements: 2.5, 9.6_

- [x] 16. Create API endpoint for manual market data refresh
  - [x] 16.1 Create admin endpoint for manual refresh
    - Create `src/app/api/admin/market-data/refresh/route.ts`
    - Implement authentication check (admin only)
    - Call `refreshMarketPrice()` service
    - Return refresh status
    - _Requirements: 2.5_
  
  - [x] 16.2 Write integration tests for refresh endpoint
    - Test successful refresh
    - Test authentication
    - Test invalid property parameters
    - _Requirements: 2.5_

- [x] 17. Add monitoring and metrics logging
  - [x] 17.1 Implement metrics collection
    - Create `src/features/market-data/services/metrics.service.ts`
    - Track scraping success rate, cache hit rate, response time
    - Log metrics to database for analysis
    - _Requirements: 11.5_
  
  - [x] 17.2 Write property test for metrics logging
    - **Property 32: Metrics logging for unmet targets**
    - **Validates: Requirements 11.5**

- [x] 18. Create README documentation
  - [x] 18.1 Document market data service
    - Create `src/features/market-data/README.md`
    - Document service architecture
    - Document API usage examples
    - Document configuration options
    - Document troubleshooting guide
    - _Requirements: All_

- [x] 19. Final checkpoint - Integration testing
  - [x] 19.1 Test complete case creation flow
    - Create test case with vehicle details
    - Verify market data is scraped and cached
    - Verify AI assessment uses market data
    - Verify confidence scores are calculated correctly
    - _Requirements: All_
  
  - [x] 19.2 Test performance requirements
    - Verify fresh cache responses < 2 seconds
    - Verify scraping timeout at 10 seconds
    - Verify individual source timeout at 5 seconds
    - _Requirements: 6.1, 6.2, 6.4_
  
  - [x] 19.3 Test error handling and fallbacks
    - Test all sources fail scenario
    - Test partial source failures
    - Test stale data fallback
    - Test rate limiting
    - _Requirements: 7.1-7.5_
  
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- ALL tests are REQUIRED - no optional tests for production-critical code
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- The implementation maintains consistency with existing codebase patterns:
  - Service-based architecture in `src/features/`
  - Drizzle ORM for database operations
  - Existing audit logging infrastructure
  - TypeScript with strict type checking
  - Vitest for unit tests, fast-check for property-based tests
