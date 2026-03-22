# Universal AI Internet Search System - Design

## Architecture Overview

The Universal AI Internet Search System replaces the current market data scraping system with a Google search-based approach using Serper.dev API. The system maintains the existing database-first fallback strategy while extending support to universal item types beyond vehicles.

### High-Level Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Case Creation │───▶│  AI Assessment   │───▶│ Internet Search │
│      UI         │    │    Service       │    │    Service      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Gemini Damage    │    │   Serper.dev    │
                       │   Detection      │    │      API        │
                       └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Salvage Value    │    │ Market Price    │
                       │  Calculation     │    │   Extraction    │
                       └──────────────────┘    └─────────────────┘
                                │                        │
                                └────────┬───────────────┘
                                         ▼
                                ┌─────────────────┐
                                │ Database Cache  │
                                │   & Fallback    │
                                └─────────────────┘
```

## System Components

### 1. Internet Search Service

**Location**: `src/features/internet-search/services/internet-search.service.ts`

**Purpose**: Core service that orchestrates internet searches using Serper.dev API

**Key Functions**:
- `searchMarketPrice(item: ItemIdentifier): Promise<MarketPrice>`
- `searchPartPrice(part: PartIdentifier): Promise<PartPrice>`
- `constructSearchQuery(item: ItemIdentifier): string`
- `parseSearchResults(results: SerperResponse): PriceData[]`

**Integration Points**:
- Replaces `getMarketPrice()` in market-data.service.ts
- Used by AI assessment services for market valuation
- Used by Gemini damage detection for salvage calculations

### 2. Serper.dev API Client

**Location**: `src/lib/integrations/serper-api.ts`

**Purpose**: Low-level API client for Serper.dev Google Search API

**Key Functions**:
- `searchGoogle(query: string, options?: SearchOptions): Promise<SerperResponse>`
- `validateApiKey(): Promise<boolean>`
- `getRateLimitStatus(): RateLimitInfo`
- `handleApiError(error: any): SearchError`

**Features**:
- Rate limiting (2,500 requests/month free tier)
- Error handling and retry logic
- Request/response logging
- API key validation

### 3. Query Builder Service

**Location**: `src/features/internet-search/services/query-builder.service.ts`

**Purpose**: Intelligent query construction for different item types and search scenarios

**Key Functions**:
- `buildMarketQuery(item: ItemIdentifier): string`
- `buildPartQuery(part: PartIdentifier): string`
- `buildConditionQuery(condition: string): string`
- `localizeQuery(query: string, location: string): string`

**Query Templates**:
```typescript
// Vehicle market queries
"{make} {model} {year} {condition} price Nigeria"
"Toyota Camry 2021 Nigerian used price"

// Electronics queries  
"{brand} {model} {condition} price Nigeria"
"iPhone 13 UK used price Nigeria"

// Part queries
"{make} {year} {part} price Nigeria"
"Lexus 2021 bumper price Nigeria"

// Universal queries
"{brand} {model} {type} {condition} price Nigeria"
```

### 4. Price Extraction Service

**Location**: `src/features/internet-search/services/price-extraction.service.ts`

**Purpose**: Extract and validate price information from Google search results

**Key Functions**:
- `extractPrices(results: SearchResult[]): PriceData[]`
- `validatePrice(price: number, item: ItemIdentifier): boolean`
- `detectCurrency(text: string): Currency`
- `normalizePrice(price: string): number`

**Price Detection Patterns**:
```typescript
// Nigerian Naira patterns
/₦[\d,]+/g
/NGN\s*[\d,]+/g
/naira\s*[\d,]+/gi

// Million/thousand abbreviations
/₦\d+\.?\d*[mk]/gi  // ₦2.5m, ₦500k
/\d+\.?\d*\s*(million|thousand)\s*naira/gi
```

### 5. Cache Integration Service

**Location**: `src/features/internet-search/services/cache-integration.service.ts`

**Purpose**: Integrate with existing market data cache system

**Key Functions**:
- `getCachedSearchResult(query: string): Promise<CachedResult | null>`
- `setCachedSearchResult(query: string, result: SearchResult): Promise<void>`
- `isCacheValid(cachedAt: Date): boolean`
- `migrateCacheFormat(): Promise<void>`

**Cache Strategy**:
- 24-hour cache for identical queries
- Separate cache namespace for internet search results
- Maintain compatibility with existing cache service
- Background cache refresh for popular queries

## Data Models

### ItemIdentifier Interface

```typescript
interface ItemIdentifier {
  type: 'vehicle' | 'electronics' | 'appliance' | 'property';
  
  // Vehicle fields
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  condition?: UniversalCondition;
  
  // Electronics fields
  brand?: string;
  model?: string;
  storage?: string;
  condition?: UniversalCondition;
  
  // Universal fields
  category?: string;
  description?: string;
}
```

### PartIdentifier Interface

```typescript
interface PartIdentifier {
  vehicleMake: string;
  vehicleModel?: string;
  vehicleYear?: number;
  partName: string;
  partType: 'body' | 'mechanical' | 'electrical' | 'interior';
  damageLevel: 'minor' | 'moderate' | 'severe';
}
```

### SearchResult Interface

```typescript
interface SearchResult {
  query: string;
  prices: PriceData[];
  sources: SourceInfo[];
  confidence: number;
  searchedAt: Date;
  cacheExpiry: Date;
}

interface PriceData {
  price: number;
  currency: 'NGN';
  source: string;
  url: string;
  title: string;
  snippet: string;
  confidence: number;
}
```

### UniversalCondition Enum

```typescript
type UniversalCondition = 
  | 'Brand New'
  | 'Foreign Used (Tokunbo)'
  | 'Nigerian Used'
  | 'Heavily Used';

// Mapping to search terms
const CONDITION_SEARCH_TERMS = {
  'Brand New': 'brand new',
  'Foreign Used (Tokunbo)': 'tokunbo foreign used',
  'Nigerian Used': 'nigerian used locally used',
  'Heavily Used': 'fairly used old'
};
```

## Integration Strategy

### 1. AI Assessment Service Integration

**Current Flow**:
```typescript
// ai-assessment-enhanced.service.ts
const marketValueResult = await getMarketValueWithScraping(vehicleInfo);
```

**New Flow**:
```typescript
// ai-assessment-enhanced.service.ts
const marketValueResult = await getMarketValueWithInternetSearch(vehicleInfo);
```

**Implementation**:
- Replace `getMarketValueWithScraping()` function
- Maintain same return interface for backward compatibility
- Add new `dataSource: 'internet_search'` field
- Preserve database-first fallback strategy

### 2. Gemini Damage Detection Integration

**Current Flow**:
```typescript
// Gemini detects damage → Manual salvage calculation
const damages = identifyDamagedComponents(damageScore);
const salvageCalc = await damageCalculationService.calculateSalvageValue(marketValue, damages);
```

**New Flow**:
```typescript
// Gemini detects damage → Internet search for parts → Enhanced salvage calculation
const damages = identifyDamagedComponents(damageScore);
const partPrices = await searchPartPrices(damages, vehicleInfo);
const salvageCalc = await calculateSalvageValueWithPartPrices(marketValue, damages, partPrices);
```

### 3. Case Creation UI Integration

**Current Flow**:
```typescript
// User enters vehicle details → AI assessment → Market value from database/scraping
```

**New Flow**:
```typescript
// User enters item details → AI assessment → Market value from internet search
```

**Changes Required**:
- Update case creation form to support universal item types
- Add loading indicators for internet search
- Display search confidence and source information
- Handle search failures gracefully

## Fallback Strategy

### Database-First Approach (Preserved)

1. **Check Valuation Database** (vehicles only)
   - Query existing vehicle valuation database
   - Return database result if found (high confidence)
   - Skip internet search for database hits

2. **Check Cache**
   - Look for recent internet search results (< 24 hours)
   - Return cached result if found and fresh

3. **Internet Search**
   - Perform Serper.dev API search
   - Extract and validate prices
   - Cache results for future use

4. **Stale Cache Fallback**
   - Return stale cached results if internet search fails
   - Mark as low confidence

5. **Database Fallback**
   - Fall back to existing valuation database (vehicles)
   - Use generic estimates for other item types

6. **Error State**
   - Return error if all fallbacks fail
   - Allow manual price entry

### Error Handling Matrix

| Scenario | Action | Confidence | User Experience |
|----------|--------|------------|-----------------|
| Database hit | Return DB value | 95% | Instant result |
| Fresh cache hit | Return cached | 85% | Instant result |
| Successful search | Return search result | 70-90% | 2-3 second delay |
| API rate limit | Return stale cache | 60% | Show rate limit warning |
| API error | Return stale cache | 60% | Show temporary error |
| No cache + API error | Return DB fallback | 40% | Show degraded service warning |
| All systems fail | Allow manual entry | 0% | Show manual entry form |

## Performance Considerations

### Response Time Targets

- **Database lookup**: < 100ms
- **Cache lookup**: < 50ms  
- **Internet search**: < 3 seconds
- **Total user experience**: < 3.5 seconds

### Optimization Strategies

1. **Parallel Processing**
   ```typescript
   // Check cache and database simultaneously
   const [cachedResult, dbResult] = await Promise.allSettled([
     getCachedSearchResult(query),
     queryValuationDatabase(item)
   ]);
   ```

2. **Query Optimization**
   - Pre-built query templates
   - Intelligent query simplification
   - Location-specific query variants

3. **Caching Strategy**
   - 24-hour cache for exact matches
   - 7-day cache for similar items
   - Background refresh for popular queries
   - Preemptive caching for common items

4. **Rate Limit Management**
   - Client-side rate limiting
   - Request queuing during peak usage
   - Intelligent cache utilization
   - Usage monitoring and alerts

## Security Design

### API Key Management

```typescript
// Environment configuration
SERPER_API_KEY=your_serper_api_key_here
SERPER_RATE_LIMIT_PER_MONTH=2500
SERPER_RATE_LIMIT_PER_MINUTE=100
```

### Input Validation

```typescript
function validateSearchQuery(query: string): boolean {
  // Prevent injection attacks
  const dangerousPatterns = [
    /[<>\"']/g,           // HTML/JS injection
    /\b(script|eval|function)\b/gi,  // JS keywords
    /[;&|`$()]/g,         // Shell injection
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(query));
}
```

### Rate Limiting

```typescript
class SerperRateLimiter {
  private monthlyUsage = 0;
  private minuteUsage = 0;
  private lastReset = new Date();
  
  async checkQuota(): Promise<{ allowed: boolean; reason?: string }> {
    if (this.monthlyUsage >= 2500) {
      return { allowed: false, reason: 'Monthly quota exceeded' };
    }
    
    if (this.minuteUsage >= 100) {
      return { allowed: false, reason: 'Rate limit exceeded' };
    }
    
    return { allowed: true };
  }
}
```

## Monitoring and Analytics

### Usage Tracking

```typescript
interface SearchMetrics {
  query: string;
  itemType: string;
  resultCount: number;
  confidence: number;
  responseTime: number;
  dataSource: 'internet' | 'cache' | 'database';
  success: boolean;
  error?: string;
  timestamp: Date;
}
```

### Performance Monitoring

- API response times
- Cache hit rates
- Search success rates
- User satisfaction scores
- Cost tracking (API usage)

### Alerting Thresholds

- API error rate > 5%
- Average response time > 5 seconds
- Monthly quota usage > 80%
- Cache miss rate > 50%

## Migration Plan

### Phase 1: Core Implementation (Week 1-2)
- Implement Serper.dev API client
- Create internet search service
- Build query construction logic
- Add price extraction functionality

### Phase 2: Integration (Week 3)
- Replace market data service calls
- Update AI assessment service
- Integrate with existing cache system
- Add fallback mechanisms

### Phase 3: UI Updates (Week 4)
- Update case creation form for universal items
- Add search progress indicators
- Implement error handling UI
- Add confidence indicators

### Phase 4: Testing & Optimization (Week 5)
- Performance testing
- Load testing
- Error scenario testing
- Query optimization

### Phase 5: Deployment & Monitoring (Week 6)
- Production deployment
- Monitoring setup
- Usage analytics
- Performance tuning

## Risk Mitigation

### Technical Risks

1. **API Reliability**
   - **Risk**: Serper.dev downtime or service issues
   - **Mitigation**: Robust fallback chain, health checks, alternative API evaluation

2. **Search Quality**
   - **Risk**: Poor search results or price extraction accuracy
   - **Mitigation**: Result validation, confidence scoring, manual override options

3. **Performance Impact**
   - **Risk**: Slow internet searches affecting user experience
   - **Mitigation**: Aggressive caching, async processing, timeout handling

### Business Risks

1. **Cost Overrun**
   - **Risk**: Exceeding free tier limits
   - **Mitigation**: Usage monitoring, query optimization, rate limiting

2. **Data Quality**
   - **Risk**: Inaccurate pricing leading to poor valuations
   - **Mitigation**: Multiple source validation, confidence scoring, fallback to database

3. **User Adoption**
   - **Risk**: Users preferring manual entry over automated search
   - **Mitigation**: Clear confidence indicators, manual override options, gradual rollout

## Success Metrics

### Technical Metrics
- Search success rate: > 95%
- Average response time: < 3 seconds
- Cache hit rate: > 70%
- API error rate: < 2%

### Business Metrics
- User adoption rate: > 80%
- Valuation accuracy: ± 15% of market value
- Cost per search: < ₦50
- User satisfaction: > 4.0/5.0

### Quality Metrics
- Price extraction accuracy: > 90%
- Source reliability score: > 80%
- Confidence score accuracy: > 85%
- Fallback usage rate: < 10%