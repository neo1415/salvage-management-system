# Market Data Scraping System

## Overview

The Market Data Scraping System provides real-time market price data from Nigerian e-commerce platforms to improve AI assessment accuracy. It integrates with the existing AI assessment service to replace estimated market values with actual scraped prices, improving accuracy from 30% to 70%+.

## Architecture

### Service-Based Design

The system follows a modular service-based architecture with clear separation of concerns:

```
src/features/market-data/
├── services/
│   ├── cache.service.ts           # PostgreSQL-based caching
│   ├── rate-limiter.service.ts    # Vercel KV rate limiting
│   ├── query-builder.service.ts   # Source-specific query generation
│   ├── scraper.service.ts         # Multi-source web scraping
│   ├── aggregation.service.ts     # Price aggregation and statistics
│   ├── confidence.service.ts      # Confidence score calculation
│   ├── scraping-logger.service.ts # Audit logging
│   ├── background-job.service.ts  # Async job processing
│   ├── market-data.service.ts     # Main orchestration service
│   └── metrics.service.ts         # Performance monitoring
├── types/
│   └── index.ts                   # TypeScript interfaces
└── README.md                      # This file
```

### Data Flow

```
1. Request → Market Data Service
2. Check Cache (PostgreSQL)
   ├─ Fresh? → Return cached data
   └─ Stale/Miss? → Continue
3. Scrape Sources (Parallel)
   ├─ Jiji.ng
   ├─ Jumia.ng
   ├─ Cars45.ng
   └─ Cheki.ng
4. Aggregate Prices (Median, Min, Max)
5. Calculate Confidence Score
6. Store in Cache
7. Return Result
```

### Fallback Strategy

The system implements a robust fallback chain:

1. **Fresh Cache** (< 7 days) - Instant response
2. **Scrape Sources** - Real-time data (10s timeout)
3. **Stale Cache** (7-30 days) - Degraded but usable
4. **Error** - Only if all sources fail and no cache

## Supported Property Types

### Vehicles
```typescript
{
  type: 'vehicle',
  make: 'Toyota',
  model: 'Camry',
  year: 2020,
  mileage?: 50000,
  condition?: 'good'
}
```

### Electronics
```typescript
{
  type: 'electronics',
  brand: 'Samsung',
  productModel: 'Galaxy S21',
  productType: 'smartphone',
  condition?: 'excellent'
}
```

### Buildings
```typescript
{
  type: 'building',
  location: 'Lagos, Lekki',
  propertyType: 'apartment',
  size: 120,
  bedrooms?: 3,
  bathrooms?: 2
}
```

## API Usage

### Get Market Price

```typescript
import { getMarketPrice } from '@/features/market-data/services/market-data.service';

const property = {
  type: 'vehicle',
  make: 'Toyota',
  model: 'Camry',
  year: 2020
};

const result = await getMarketPrice(property);

console.log(result);
// {
//   median: 8500000,
//   min: 7800000,
//   max: 9200000,
//   sources: [
//     { source: 'jiji', price: 8500000, url: '...', title: '...' },
//     { source: 'jumia', price: 8300000, url: '...', title: '...' }
//   ],
//   confidence: 85,
//   isCached: false,
//   cacheAge: 0
// }
```

### Refresh Market Price (Admin Only)

```typescript
import { refreshMarketPrice } from '@/features/market-data/services/market-data.service';

// Force re-scraping regardless of cache state
const result = await refreshMarketPrice(property);
```

### Check Cache Status

```typescript
import { getCachedPrice } from '@/features/market-data/services/cache.service';

const cached = await getCachedPrice(property);

if (cached && !cached.isStale) {
  console.log('Fresh cache available');
} else if (cached && cached.isStale) {
  console.log('Stale cache available');
} else {
  console.log('No cache available');
}
```

## Configuration

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...
KV_URL=redis://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...

# Optional
CRON_SECRET=your-secret-for-cron-endpoints
```

### Rate Limiting

Default: 2 requests per second per source

```typescript
// Configured in rate-limiter.service.ts
const RATE_LIMIT = {
  maxRequests: 2,
  windowMs: 1000
};
```

### Cache TTL

- Fresh: 0-7 days (no penalty)
- Stale: 7-30 days (20-40 point confidence penalty)
- Expired: 30+ days (deleted on next access)

### Timeouts

- Individual source: 5 seconds
- Total scraping: 10 seconds
- Background job: 60 seconds

## API Endpoints

### POST /api/admin/market-data/refresh

Manually trigger market data refresh (admin only).

**Request:**
```json
{
  "property": {
    "type": "vehicle",
    "make": "Toyota",
    "model": "Camry",
    "year": 2020
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Market data refresh initiated successfully",
  "property": { ... },
  "timestamp": "2024-02-23T10:30:00.000Z"
}
```

### GET /api/cron/process-scraping-jobs

Process pending background scraping jobs (called by Vercel Cron).

**Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "success": true,
  "processed": 5,
  "succeeded": 4,
  "failed": 1,
  "errors": ["Job abc123: Timeout"],
  "timestamp": "2024-02-23T10:30:00.000Z"
}
```

## Background Jobs

The system uses background jobs for async scraping to avoid blocking requests.

### When Jobs Are Created

1. Cache miss with timeout during scraping
2. Stale cache detected (7+ days old)
3. Manual refresh requested

### Job Processing

Jobs are processed by the cron endpoint every 5 minutes:

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/process-scraping-jobs",
    "schedule": "*/5 * * * *"
  }]
}
```

### Job Status Tracking

```typescript
import { getJobStatus } from '@/features/market-data/services/background-job.service';

const status = await getJobStatus('job-id');
// 'pending' | 'processing' | 'completed' | 'failed'
```

## Performance Metrics

The system tracks key performance indicators:

### Target Metrics

- **Scraping Success Rate**: ≥70%
- **Cache Hit Rate**: ≥80%
- **Market Price Availability**: ≥70%

### Monitoring

Metrics are logged when targets are not met:

```typescript
import { logMetrics } from '@/features/market-data/services/metrics.service';

await logMetrics({
  scrapingSuccessRate: 0.65,  // Below 70% target
  cacheHitRate: 0.85,          // Above 80% target
  marketPriceAvailability: 0.68 // Below 70% target
});
```

## Error Handling

### Common Errors

#### 1. All Sources Failed

```typescript
{
  error: 'All sources failed to return prices',
  details: {
    jiji: 'Timeout',
    jumia: 'Network error',
    cars45: 'Parsing error',
    cheki: 'Rate limited'
  }
}
```

**Solution**: System automatically falls back to stale cache if available.

#### 2. Unsupported Property Type

```typescript
{
  error: 'Unsupported property type: furniture'
}
```

**Solution**: Only use supported types (vehicle, electronics, building).

#### 3. Rate Limit Exceeded

```typescript
{
  error: 'Rate limit exceeded for source: jiji'
}
```

**Solution**: System automatically queues request for retry.

#### 4. Cache Connection Error

```typescript
{
  error: 'Failed to connect to cache database'
}
```

**Solution**: System proceeds with scraping, logs error for monitoring.

## Troubleshooting

### Issue: Low Scraping Success Rate

**Symptoms**: Success rate < 70%

**Possible Causes**:
1. Source website structure changed
2. Network connectivity issues
3. Rate limiting too aggressive
4. Robots.txt blocking

**Solutions**:
1. Update CSS selectors in `scraper.service.ts`
2. Check network connectivity and DNS resolution
3. Adjust rate limits in `rate-limiter.service.ts`
4. Review robots.txt compliance

### Issue: Slow Response Times

**Symptoms**: Responses > 2 seconds with fresh cache

**Possible Causes**:
1. Database connection pool exhausted
2. Cache queries not optimized
3. Network latency to database

**Solutions**:
1. Increase database connection pool size
2. Add database indexes on `property_hash` column
3. Use connection pooling (PgBouncer)

### Issue: Stale Data Being Returned

**Symptoms**: Cache age > 7 days

**Possible Causes**:
1. Background jobs not running
2. Cron endpoint not configured
3. Job processing failures

**Solutions**:
1. Verify Vercel Cron configuration in `vercel.json`
2. Check cron endpoint logs for errors
3. Manually trigger refresh via admin endpoint

### Issue: Confidence Scores Too Low

**Symptoms**: Confidence < 50%

**Possible Causes**:
1. Only 1-2 sources returning data
2. Data is stale (7+ days)
3. Sources returning inconsistent prices

**Solutions**:
1. Add more data sources
2. Trigger manual refresh
3. Review price aggregation logic

## Testing

### Unit Tests

```bash
npm run test:unit -- tests/unit/market-data
```

### Integration Tests

```bash
npm run test:integration -- tests/integration/market-data
```

### Property-Based Tests

All services have property-based tests using fast-check:

```typescript
// Example: Cache operations
fc.assert(
  fc.property(
    fc.record({
      type: fc.constantFrom('vehicle', 'electronics', 'building'),
      // ... property generators
    }),
    async (property) => {
      const result = await getMarketPrice(property);
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    }
  ),
  { numRuns: 100 }
);
```

## Integration with AI Assessment

The market data service integrates seamlessly with the AI assessment service:

```typescript
// In ai-assessment-enhanced.service.ts
import { getMarketPrice } from '@/features/market-data/services/market-data.service';

async function assessVehicle(property: VehicleProperty) {
  // Get real market data
  const marketData = await getMarketPrice(property);
  
  // Use median price as base value
  const baseValue = marketData.median;
  
  // Apply damage adjustments
  const adjustedValue = baseValue * (1 - damagePercentage);
  
  // Combine confidence scores
  const overallConfidence = (
    marketData.confidence * 0.6 +  // Market data weight
    damageConfidence * 0.4          // Damage assessment weight
  );
  
  return {
    estimatedValue: adjustedValue,
    confidence: overallConfidence,
    marketData
  };
}
```

## Database Schema

### market_data_cache

Stores scraped market prices with TTL.

```sql
CREATE TABLE market_data_cache (
  id UUID PRIMARY KEY,
  property_hash VARCHAR(64) UNIQUE NOT NULL,
  property_type VARCHAR(50) NOT NULL,
  property_details JSONB NOT NULL,
  median_price INTEGER NOT NULL,
  min_price INTEGER NOT NULL,
  max_price INTEGER NOT NULL,
  source_prices JSONB NOT NULL,
  confidence_score INTEGER NOT NULL,
  scraped_at TIMESTAMP NOT NULL,
  is_stale BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_property_hash ON market_data_cache(property_hash);
CREATE INDEX idx_scraped_at ON market_data_cache(scraped_at);
```

### scraping_logs

Audit trail for all scraping operations.

```sql
CREATE TABLE scraping_logs (
  id UUID PRIMARY KEY,
  property_hash VARCHAR(64) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  source VARCHAR(50),
  success BOOLEAN NOT NULL,
  error_message TEXT,
  response_time INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_property_hash_logs ON scraping_logs(property_hash);
CREATE INDEX idx_event_type ON scraping_logs(event_type);
```

### background_jobs

Async job queue for scraping operations.

```sql
CREATE TABLE background_jobs (
  id UUID PRIMARY KEY,
  property_hash VARCHAR(64) NOT NULL,
  property_details JSONB NOT NULL,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_status ON background_jobs(status);
CREATE INDEX idx_created_at_jobs ON background_jobs(created_at);
```

## Best Practices

### 1. Always Use Cache-First Strategy

```typescript
// Good
const result = await getMarketPrice(property);

// Bad - bypasses cache
const result = await refreshMarketPrice(property);
```

### 2. Handle Errors Gracefully

```typescript
try {
  const result = await getMarketPrice(property);
  // Use result
} catch (error) {
  // Fall back to estimation
  const estimated = estimateMarketValue(property);
}
```

### 3. Monitor Performance Metrics

```typescript
// Log metrics regularly
await logMetrics({
  scrapingSuccessRate,
  cacheHitRate,
  marketPriceAvailability
});
```

### 4. Use Background Jobs for Non-Critical Updates

```typescript
// Don't block user requests
if (isCacheStale) {
  await enqueueScrapingJob(property);
  // Return stale data immediately
  return cachedData;
}
```

### 5. Respect Rate Limits

```typescript
// System handles this automatically
// Don't bypass rate limiter
await checkRateLimit(source);
await scrapeSource(source, query);
```

## Security Considerations

### 1. Admin Endpoint Protection

The manual refresh endpoint requires admin authentication:

```typescript
// Automatic in route handler
const session = await auth();
if (session.user.role !== 'system_admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### 2. Cron Endpoint Protection

The job processing endpoint requires a secret token:

```typescript
const authHeader = request.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### 3. Input Validation

All property inputs are validated:

```typescript
if (!['vehicle', 'electronics', 'building'].includes(property.type)) {
  throw new Error('Unsupported property type');
}
```

### 4. Robots.txt Compliance

The scraper respects robots.txt:

```typescript
const robotsAllowed = await checkRobotsTxt(source, url);
if (!robotsAllowed) {
  throw new Error('Blocked by robots.txt');
}
```

## Future Enhancements

### Planned Features

1. **Additional Data Sources**
   - OLX Nigeria
   - Konga
   - Property Pro (for buildings)

2. **Machine Learning Integration**
   - Price prediction models
   - Anomaly detection
   - Trend analysis

3. **Real-Time Updates**
   - WebSocket notifications
   - Live price tracking
   - Price alerts

4. **Advanced Caching**
   - Redis for hot data
   - CDN integration
   - Predictive pre-caching

5. **Enhanced Monitoring**
   - Grafana dashboards
   - Alerting system
   - Performance analytics

## Support

For issues or questions:

1. Check this README
2. Review test files for usage examples
3. Check audit logs in database
4. Contact the development team

## License

Internal use only - NEM Insurance Salvage Management System
