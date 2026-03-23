# Design Document: Market Data Year Filtering

## Overview

This design enhances the existing market data scraping system to implement robust year-based filtering and validation. The current implementation includes the year in search queries but doesn't validate that returned listings match the target year, leading to inaccurate valuations (e.g., 2004 Honda Accord returning ₦10.2M instead of ₦2M-₦4.5M).

The solution adds three new components:
1. **Year Extraction Service**: Extracts years from listing titles using regex patterns
2. **Year Filter Service**: Validates listings against target year with ±1 year tolerance
3. **Depreciation Service**: Applies age-based adjustments when insufficient year-matched data exists

These components integrate into the existing scraper pipeline between data collection and aggregation.

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────┐
│                    Market Data Service                       │
│  (Existing - orchestrates cache, scraping, aggregation)     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├──> Cache Service (existing)
                 │
                 ├──> Scraper Service (existing)
                 │         │
                 │         └──> Query Builder (existing)
                 │
                 ├──> [NEW] Year Filter Service
                 │         │
                 │         ├──> Year Extraction Service
                 │         └──> Depreciation Service
                 │
                 └──> Aggregation Service (modified)
                           │
                           └──> Outlier Detection (enhanced)
```

### Integration Points

The year filtering logic integrates at two points:

1. **Post-Scraping Validation** (in `scraper.service.ts`):
   - After parsing listings from HTML
   - Before returning `ScrapeResult`
   - Filters out year-mismatched listings

2. **Pre-Aggregation Enhancement** (in `market-data.service.ts`):
   - After collecting all source prices
   - Before calling `aggregatePrices()`
   - Applies depreciation if needed
   - Calculates year-match quality metrics



## Components and Interfaces

### 1. Year Extraction Service

**Purpose**: Extract 4-digit years from listing titles using regex patterns.

**Interface**:
```typescript
/**
 * Extract year from listing title
 * Returns null if no valid year found
 */
function extractYear(title: string): number | null;

/**
 * Validate year is within acceptable range
 * Range: 1980 to (current year + 1)
 */
function isValidYear(year: number): boolean;
```

**Implementation Details**:
- Regex pattern: `/\b(19[89]\d|20[0-9]\d)\b/` (matches 1980-2099)
- Extracts first occurrence if multiple years present
- Validates extracted year is within 1980 to (current year + 1)
- Returns `null` for invalid or missing years

**Example**:
```typescript
extractYear("Toyota Camry 2004 - Clean") // => 2004
extractYear("2015 Honda Accord EX-L") // => 2015
extractYear("Mercedes Benz GLE 2020/2021") // => 2020 (first occurrence)
extractYear("Toyota Corolla - Good condition") // => null
extractYear("Honda 1975 Classic") // => null (too old)
```

### 2. Year Filter Service

**Purpose**: Validate listings against target year with configurable tolerance.

**Interface**:
```typescript
interface YearFilterConfig {
  targetYear: number;
  tolerance: number; // ±N years
}

interface YearFilterResult {
  valid: SourcePrice[];
  rejected: Array<{
    listing: SourcePrice;
    reason: string;
    extractedYear: number | null;
  }>;
  yearMatchRate: number; // 0-100 percentage
}

/**
 * Filter listings by year
 * Returns valid listings and rejection details
 */
function filterByYear(
  listings: SourcePrice[],
  config: YearFilterConfig
): YearFilterResult;
```

**Implementation Details**:
- Default tolerance: ±1 year
- Extracts year from each listing title
- Rejects listings where:
  - Year cannot be extracted
  - Year differs by more than tolerance
- Calculates year match rate: `(valid count / total count) * 100`
- Logs rejection reasons for debugging

**Example**:
```typescript
const listings = [
  { title: "Honda Accord 2004", price: 2500000, ... },
  { title: "Honda Accord 2013", price: 5350000, ... },
  { title: "Honda Accord 2005", price: 2800000, ... },
];

filterByYear(listings, { targetYear: 2004, tolerance: 1 });
// Returns:
// {
//   valid: [listing1, listing3], // 2004 and 2005
//   rejected: [{ listing: listing2, reason: "Year 2013 outside tolerance", extractedYear: 2013 }],
//   yearMatchRate: 66.67
// }
```

### 3. Depreciation Service

**Purpose**: Apply age-based price adjustments when insufficient year-matched data exists.

**Interface**:
```typescript
interface DepreciationConfig {
  targetYear: number;
  currentYear: number;
}

interface DepreciationResult {
  adjustedPrices: SourcePrice[];
  appliedRate: number; // percentage
  confidencePenalty: number; // 0-50 points
}

/**
 * Apply depreciation to newer vehicles
 * Adjusts prices downward to match target year
 */
function applyDepreciation(
  listings: SourcePrice[],
  config: DepreciationConfig
): DepreciationResult;

/**
 * Calculate depreciation rate based on vehicle age
 */
function getDepreciationRate(yearsDifference: number): number;
```

**Depreciation Rates**:
- Years 1-5: 15% per year
- Years 6-10: 10% per year
- Years 11+: 5% per year

**Implementation Details**:
- Only adjusts prices from newer vehicles (year > targetYear)
- Compounds depreciation: `adjustedPrice = originalPrice * (1 - rate)^years`
- Applies confidence penalty: 10 points per year difference (max 50)
- Preserves original listing data in metadata

**Example**:
```typescript
const listings = [
  { title: "Honda Accord 2010", price: 6000000, ... },
];

applyDepreciation(listings, { targetYear: 2004, currentYear: 2025 });
// 2010 -> 2004 = 6 years difference
// Years 1-5: 15% per year = 0.85^5 = 0.4437
// Year 6: 10% = 0.4437 * 0.90 = 0.3993
// Adjusted: 6,000,000 * 0.3993 = ₦2,395,800
// Confidence penalty: 50 points (capped at 6+ years)
```

### 4. Enhanced Aggregation Service

**Purpose**: Integrate year filtering and calculate quality metrics.

**Modified Interface**:
```typescript
interface AggregationResult {
  median: number;
  min: number;
  max: number;
  count: number;
  yearMatchRate: number; // NEW
  outliersRemoved: number; // NEW
  depreciationApplied: boolean; // NEW
}

/**
 * Aggregate prices with enhanced outlier detection
 * Now removes prices >2x median
 */
function aggregatePrices(
  prices: SourcePrice[],
  options?: {
    removeOutliers?: boolean;
    outlierThreshold?: number; // default: 2.0 (2x median)
  }
): AggregationResult;
```

**Enhanced Outlier Detection**:
- Calculate initial median
- Identify outliers: `price > median * threshold`
- Remove outliers and recalculate
- Log outlier count and values



## Data Models

### Extended SourcePrice Type

```typescript
interface SourcePrice {
  source: string;
  price: number;
  currency: string;
  listingUrl: string;
  listingTitle: string;
  scrapedAt: Date;
  
  // NEW FIELDS
  extractedYear?: number | null; // Year extracted from title
  yearMatched?: boolean; // Whether year matches target
  depreciationApplied?: boolean; // Whether price was adjusted
  originalPrice?: number; // Original price before depreciation
  depreciationRate?: number; // Rate applied (if any)
}
```

### Year Filter Metadata

```typescript
interface YearFilterMetadata {
  targetYear: number;
  tolerance: number;
  totalListings: number;
  validListings: number;
  rejectedListings: number;
  yearMatchRate: number;
  rejectionReasons: Record<string, number>; // reason -> count
}
```

### Confidence Score Factors

```typescript
interface ConfidenceFactors {
  sourceCount: number; // Number of sources with data
  dataAgeDays: number; // Age of cached data
  yearMatchRate: number; // NEW: % of year-matched listings
  sampleSize: number; // NEW: Total valid listings
  depreciationApplied: boolean; // NEW: Whether fallback was used
}

interface ConfidenceResult {
  score: number; // 0-100
  factors: ConfidenceFactors;
  warnings: string[]; // Quality warnings
}
```

**Confidence Calculation**:
```
Base Score = 100

Deductions:
- Data age: -5 points per day (max -30)
- Low source count: -20 points if < 2 sources
- Low year match rate:
  - 70-100%: -0 points
  - 40-69%: -20 points
  - 0-39%: -40 points
- Small sample size:
  - < 3 listings: -30 points
  - 3-5 listings: -15 points
  - 6+ listings: -0 points
- Depreciation applied: -50 points

Final Score = max(0, Base Score - Total Deductions)
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Before writing the correctness properties, let me analyze the acceptance criteria for testability:



### Property 1: Query Year Inclusion

*For any* vehicle with a valid year, make, and model, the constructed search query string SHALL contain the year value.

**Validates: Requirements 1.1, 1.2**

### Property 2: Year Extraction Robustness

*For any* listing title containing a 4-digit year between 1980 and (current year + 1), the year extraction function SHALL successfully extract that year regardless of position (beginning, middle, end) or surrounding separators (spaces, dashes, slashes, none).

**Validates: Requirements 2.1, 2.5, 7.1, 7.2, 7.3, 7.4**

### Property 3: Year Tolerance Validation

*For any* listing with an extractable year and any target year, the year filter SHALL mark the listing as valid if and only if the absolute difference between extracted year and target year is ≤ 1.

**Validates: Requirements 2.2, 2.3**

### Property 4: Outlier Removal Consistency

*For any* set of prices, after outlier detection and removal, the final aggregated result SHALL NOT contain any price greater than 2x the final median.

**Validates: Requirements 3.1, 3.2**

### Property 5: Depreciation Calculation Accuracy

*For any* vehicle price from a newer year, when depreciation is applied to adjust to a target year, the depreciation rate SHALL be 15% per year for years 1-5, 10% per year for years 6-10, and 5% per year beyond 10 years, compounded correctly.

**Validates: Requirements 5.2, 5.3, 5.4, 5.5**

### Property 6: Confidence Score Monotonicity

*For any* two market data results with the same data age and sample size, the result with a higher year match rate SHALL have a confidence score greater than or equal to the result with a lower year match rate.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 7: Minimum Sample Size Enforcement

*For any* market data request, if fewer than 3 valid listings remain after all filtering, the service SHALL return an error rather than a price estimate.

**Validates: Requirements 6.1**

### Property 8: Year Range Boundary Validation

*For any* extracted year value, if the year is less than 1980 or greater than (current year + 1), the year filter SHALL reject it as invalid.

**Validates: Requirements 7.5**

### Property 9: Make/Model Pre-filtering

*For any* listing that fails make or model validation, the listing SHALL be rejected before year filtering is attempted.

**Validates: Requirements 8.3**

### Property 10: URL Encoding Safety

*For any* query string containing special characters (spaces, ampersands, quotes, etc.), the encoded URL SHALL be valid and properly escape all special characters according to RFC 3986.

**Validates: Requirements 1.4**



## Error Handling

### Year Extraction Failures

**Scenario**: Listing title contains no recognizable year

**Handling**:
- Log warning with listing title
- Mark listing as rejected with reason "No year found"
- Continue processing other listings
- Do not throw error (partial failure is acceptable)

**Example**:
```typescript
// Input: "Honda Accord - Excellent condition"
// Output: { extractedYear: null, rejected: true, reason: "No year found" }
```

### Insufficient Data After Filtering

**Scenario**: Fewer than 3 listings remain after year filtering

**Handling**:
- Check if depreciation fallback is applicable (listings from newer years exist)
- If yes: Apply depreciation and proceed with low confidence
- If no: Throw error "Insufficient year-matched data available"
- Log the filtering funnel (initial count → after year filter → final count)

**Example**:
```typescript
// Initial: 20 listings
// After year filter: 2 listings (both match target year)
// Result: Error thrown (insufficient data)

// Initial: 20 listings  
// After year filter: 2 listings (target year), 10 listings (newer years)
// Result: Apply depreciation to 10 newer listings, proceed with 12 total
```

### All Sources Fail

**Scenario**: Scraping fails for all sources and no cache exists

**Handling**:
- Existing behavior (throw error)
- No changes needed for year filtering feature

### Invalid Year in Query

**Scenario**: Target year is null, undefined, or outside valid range

**Handling**:
- Log warning "Invalid target year: {value}"
- Proceed with make/model-only query
- Apply year filtering in post-processing if possible
- Flag result with low confidence

### Depreciation Edge Cases

**Scenario**: Listing year is older than target year

**Handling**:
- Do not apply depreciation (only adjust newer vehicles downward)
- Include in aggregation as-is
- This is expected behavior (older vehicles may be priced lower)

**Scenario**: Depreciation would result in negative or zero price

**Handling**:
- Set minimum adjusted price to ₦100,000 (floor value)
- Log warning "Depreciation floor applied"
- Flag with very low confidence (<20)

## Testing Strategy

This feature will use a dual testing approach combining unit tests for specific logic and property-based tests for universal correctness.

### Unit Testing Focus

Unit tests will cover:
- Specific regex patterns for year extraction
- Edge cases in depreciation calculation (boundary years, extreme age differences)
- Error handling paths (no year found, insufficient data)
- Integration points with existing services
- Logging output verification

### Property-Based Testing Focus

Property tests will verify universal properties across randomized inputs:
- Year extraction works for all valid year formats (Property 2)
- Year tolerance validation is consistent (Property 3)
- Outlier removal produces clean results (Property 4)
- Depreciation calculations are mathematically correct (Property 5)
- Confidence scoring is monotonic (Property 6)
- URL encoding handles all special characters (Property 10)

### Property Test Configuration

- Library: `fast-check` (TypeScript property-based testing)
- Minimum iterations: 100 per property test
- Each test tagged with: `Feature: market-data-year-filtering, Property {N}: {description}`
- Generators for: years (1980-2025), prices (₦100k-₦100M), listing titles, vehicle data

### Test Data Generators

```typescript
// Generate random vehicle years
const yearGen = fc.integer({ min: 1980, max: new Date().getFullYear() + 1 });

// Generate random listing titles with years
const listingTitleGen = fc.tuple(yearGen, fc.string(), fc.string())
  .map(([year, make, model]) => `${make} ${model} ${year}`);

// Generate random price lists
const priceListGen = fc.array(
  fc.integer({ min: 100000, max: 100000000 }),
  { minLength: 1, maxLength: 50 }
);

// Generate random vehicle data
const vehicleGen = fc.record({
  make: fc.constantFrom('Toyota', 'Honda', 'Mercedes', 'BMW', 'Lexus'),
  model: fc.string({ minLength: 3, maxLength: 20 }),
  year: yearGen,
});
```

### Integration Testing

Integration tests will verify:
- End-to-end flow: query → scrape → filter → aggregate
- Year filtering integrates correctly with existing cache service
- Confidence scores reflect year match quality
- Depreciation fallback triggers correctly
- Logging captures all filtering stages

### Test Coverage Goals

- Unit test coverage: >90% for new services
- Property test coverage: All 10 correctness properties
- Integration test coverage: All major user flows
- Edge case coverage: All error handling paths

