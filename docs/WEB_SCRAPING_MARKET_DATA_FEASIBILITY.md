# Web Scraping for Market Data Aggregation - Feasibility Analysis

## Executive Summary

**YES, this is feasible!** Your hybrid approach (AI + Web Scraping + Database) is actually how most modern pricing/valuation systems work. However, there are important legal, technical, and performance considerations.

**Bottom Line**: 
- ✅ Technically feasible and commonly done
- ⚠️ Legal considerations exist but manageable
- ✅ Performance can be optimized
- ✅ Security risks are manageable
- 💰 Cost-effective compared to paid APIs

---

## Part 1: How It Would Work

### The Hybrid System Architecture

```typescript
// Step 1: Check our database first (fastest)
const cachedPrice = await db.getMarketPrice(make, model, year);
if (cachedPrice && !isStale(cachedPrice)) {
  return cachedPrice;
}

// Step 2: Scrape multiple sources in parallel
const scrapedData = await Promise.all([
  scrapeJiji(make, model, year),
  scrapeJumia(make, model, year),
  scrapeCars45(make, model, year),
  scrapeCheki(make, model, year),
]);

// Step 3: Aggregate and validate
const aggregatedPrice = calculateMedian(scrapedData);

// Step 4: Save to database for future use
await db.saveMarketPrice({
  make, model, year,
  price: aggregatedPrice,
  sources: scrapedData,
  scrapedAt: new Date(),
  expiresAt: addDays(new Date(), 7) // Refresh weekly
});

// Step 5: Use AI to validate if price seems reasonable
const aiValidation = await validatePriceWithAI(aggregatedPrice, photos);

return {
  price: aggregatedPrice,
  confidence: aiValidation.confidence,
  sources: scrapedData.length,
  lastUpdated: new Date()
};
```

---

## Part 2: Legal & Ethical Considerations

### ✅ What's Generally LEGAL

1. **Public Data Scraping**
   - Scraping publicly available data (prices, listings) is generally legal
   - No login required = usually okay
   - Data displayed to all users = fair game

2. **Robots.txt Compliance**
   - Check `robots.txt` file on each site
   - Respect crawl delays and disallowed paths
   - Example: `https://jiji.ng/robots.txt`

3. **Fair Use**
   - Aggregating prices for your own use
   - Not republishing their entire database
   - Adding value through analysis

4. **Terms of Service**
   - Read each site's ToS carefully
   - Some explicitly allow, some prohibit
   - Violating ToS ≠ illegal, but can get you blocked

### ⚠️ What to AVOID

1. **Don't Overload Servers**
   - Rate limiting (1-2 requests per second max)
   - Respect server resources
   - Scrape during off-peak hours

2. **Don't Bypass Security**
   - No CAPTCHA breaking
   - No login credential theft
   - No circumventing paywalls

3. **Don't Republish Raw Data**
   - Don't create a Jiji clone
   - Aggregate and transform data
   - Add your own analysis

4. **Don't Scrape Personal Data**
   - Avoid seller phone numbers, emails
   - Focus on prices, specs, conditions
   - Comply with NDPR (Nigeria Data Protection Regulation)

### 📋 Nigerian Legal Context

**Nigeria Data Protection Regulation (NDPR)**:
- Applies to personal data of Nigerians
- Vehicle prices = NOT personal data ✅
- Seller contact info = personal data ❌
- Public listings = generally okay ✅

**Copyright Law**:
- Facts (prices) are NOT copyrightable ✅
- Original descriptions/photos = copyrighted ❌
- Database structure = copyrighted ❌

**Best Practice**: Scrape only factual data (make, model, year, price, condition)

---

## Part 3: Technical Implementation

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    User Request                          │
│              "Assess Toyota Camry 2020"                  │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              1. Check Database Cache                     │
│         (PostgreSQL with 7-day expiry)                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ├─── Cache Hit ──────► Return Price
                     │
                     └─── Cache Miss
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│         2. Parallel Web Scraping (Queue System)          │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐│
│  │  Jiji.ng │  │ Jumia.ng │  │ Cars45   │  │ Cheki   ││
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘│
│       │             │              │             │      │
│       └─────────────┴──────────────┴─────────────┘      │
│                         │                               │
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│           3. Data Aggregation & Validation              │
│                                                         │
│  • Remove outliers (±30% from median)                   │
│  • Calculate median, mean, confidence                   │
│  • Weight by source reliability                         │
│  • Validate with AI (does price match condition?)       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              4. Save to Database                         │
│                                                          │
│  • Store aggregated price                               │
│  • Store individual source prices                       │
│  • Set expiry (7 days)                                  │
│  • Track scraping success rate                          │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              5. Return to User                           │
│                                                          │
│  Price: ₦8,500,000                                      │
│  Confidence: 85%                                        │
│  Sources: 4/4 successful                                │
│  Last Updated: 2 days ago                               │
└─────────────────────────────────────────────────────────┘
```

### Implementation Stack

```typescript
// 1. Scraping Library
import * as cheerio from 'cheerio'; // HTML parsing
import axios from 'axios'; // HTTP requests
import puppeteer from 'puppeteer'; // For JavaScript-heavy sites

// 2. Queue System (for rate limiting)
import Bull from 'bull'; // Redis-based job queue
import Redis from 'ioredis';

// 3. Caching
import { db } from '@/lib/db/drizzle';
import { redis } from '@/lib/redis/client';

// 4. Proxy/Rotation (optional, for scale)
import { HttpsProxyAgent } from 'https-proxy-agent';
```

### Example: Scraping Jiji.ng

```typescript
/**
 * Scrape vehicle prices from Jiji.ng
 */
export async function scrapeJiji(
  make: string,
  model: string,
  year: number
): Promise<ScrapedPrice[]> {
  try {
    // Build search URL
    const searchQuery = `${make} ${model} ${year}`;
    const url = `https://jiji.ng/cars?query=${encodeURIComponent(searchQuery)}`;
    
    // Fetch with user agent (look like a browser)
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000, // 10 second timeout
    });
    
    // Parse HTML
    const $ = cheerio.load(response.data);
    const listings: ScrapedPrice[] = [];
    
    // Extract listings (adjust selectors based on actual HTML)
    $('.listing-item').each((i, element) => {
      const title = $(element).find('.listing-title').text().trim();
      const priceText = $(element).find('.listing-price').text().trim();
      const condition = $(element).find('.listing-condition').text().trim();
      const location = $(element).find('.listing-location').text().trim();
      
      // Parse price (handle formats like "₦8,500,000" or "8.5M")
      const price = parsePrice(priceText);
      
      if (price && price > 0) {
        listings.push({
          source: 'jiji',
          make,
          model,
          year,
          price,
          condition: normalizeCondition(condition),
          location,
          url: $(element).find('a').attr('href'),
          scrapedAt: new Date(),
        });
      }
    });
    
    console.log(`✅ Jiji: Found ${listings.length} listings`);
    return listings;
    
  } catch (error) {
    console.error('❌ Jiji scraping failed:', error);
    return []; // Return empty array on failure
  }
}

/**
 * Parse price from various formats
 */
function parsePrice(priceText: string): number {
  // Remove currency symbols and commas
  let cleaned = priceText.replace(/[₦,\s]/g, '');
  
  // Handle "M" for millions
  if (cleaned.includes('M')) {
    const num = parseFloat(cleaned.replace('M', ''));
    return num * 1000000;
  }
  
  // Handle "K" for thousands
  if (cleaned.includes('K')) {
    const num = parseFloat(cleaned.replace('K', ''));
    return num * 1000;
  }
  
  return parseFloat(cleaned);
}

/**
 * Normalize condition strings
 */
function normalizeCondition(condition: string): 'excellent' | 'good' | 'fair' | 'poor' {
  const lower = condition.toLowerCase();
  
  if (lower.includes('excellent') || lower.includes('brand new')) return 'excellent';
  if (lower.includes('good') || lower.includes('clean')) return 'good';
  if (lower.includes('fair') || lower.includes('used')) return 'fair';
  return 'poor';
}
```

### Queue System for Rate Limiting

```typescript
/**
 * Scraping queue to prevent overloading servers
 */
import Bull from 'bull';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Create queue
export const scrapingQueue = new Bull('scraping', {
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  limiter: {
    max: 2, // Max 2 jobs per duration
    duration: 1000, // Per 1 second
  },
});

// Process scraping jobs
scrapingQueue.process(async (job) => {
  const { source, make, model, year } = job.data;
  
  console.log(`🔍 Scraping ${source} for ${make} ${model} ${year}...`);
  
  switch (source) {
    case 'jiji':
      return await scrapeJiji(make, model, year);
    case 'jumia':
      return await scrapeJumia(make, model, year);
    case 'cars45':
      return await scrapeCars45(make, model, year);
    case 'cheki':
      return await scrapeCheki(make, model, year);
    default:
      throw new Error(`Unknown source: ${source}`);
  }
});

/**
 * Add scraping job to queue
 */
export async function queueScraping(
  make: string,
  model: string,
  year: number
): Promise<ScrapedPrice[]> {
  const sources = ['jiji', 'jumia', 'cars45', 'cheki'];
  
  // Add all sources to queue
  const jobs = await Promise.all(
    sources.map(source =>
      scrapingQueue.add({ source, make, model, year }, {
        attempts: 3, // Retry 3 times on failure
        backoff: {
          type: 'exponential',
          delay: 2000, // Start with 2 second delay
        },
      })
    )
  );
  
  // Wait for all jobs to complete
  const results = await Promise.all(
    jobs.map(job => job.finished())
  );
  
  // Flatten results
  return results.flat();
}
```

### Data Aggregation

```typescript
/**
 * Aggregate scraped prices from multiple sources
 */
export function aggregatePrices(
  scrapedData: ScrapedPrice[]
): AggregatedPrice {
  if (scrapedData.length === 0) {
    throw new Error('No scraped data available');
  }
  
  // Extract prices
  const prices = scrapedData.map(d => d.price);
  
  // Calculate statistics
  const sorted = prices.sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  
  // Remove outliers (±30% from median)
  const filtered = prices.filter(p => 
    p >= median * 0.7 && p <= median * 1.3
  );
  
  // Recalculate with filtered data
  const finalPrice = filtered.reduce((sum, p) => sum + p, 0) / filtered.length;
  
  // Calculate confidence based on data quality
  const confidence = calculateConfidence({
    sourceCount: scrapedData.length,
    priceVariance: (max - min) / median,
    outlierCount: prices.length - filtered.length,
  });
  
  return {
    price: Math.round(finalPrice),
    median: Math.round(median),
    mean: Math.round(mean),
    min: Math.round(min),
    max: Math.round(max),
    confidence,
    sourceCount: scrapedData.length,
    sources: scrapedData.map(d => ({
      source: d.source,
      price: d.price,
      condition: d.condition,
      url: d.url,
    })),
  };
}

/**
 * Calculate confidence score
 */
function calculateConfidence(params: {
  sourceCount: number;
  priceVariance: number;
  outlierCount: number;
}): number {
  let confidence = 100;
  
  // Penalize for few sources
  if (params.sourceCount < 3) {
    confidence -= 20;
  } else if (params.sourceCount < 5) {
    confidence -= 10;
  }
  
  // Penalize for high variance
  if (params.priceVariance > 0.5) {
    confidence -= 30; // Prices vary by >50%
  } else if (params.priceVariance > 0.3) {
    confidence -= 15; // Prices vary by >30%
  }
  
  // Penalize for outliers
  confidence -= params.outlierCount * 5;
  
  return Math.max(0, Math.min(100, confidence));
}
```

---

## Part 4: Database Schema

```typescript
// Market prices cache table
export const marketPrices = pgTable('market_prices', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Vehicle identification
  make: varchar('make', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  year: integer('year').notNull(),
  condition: varchar('condition', { length: 20 }), // excellent, good, fair, poor
  
  // Aggregated price data
  price: numeric('price', { precision: 12, scale: 2 }).notNull(),
  median: numeric('median', { precision: 12, scale: 2 }),
  mean: numeric('mean', { precision: 12, scale: 2 }),
  min: numeric('min', { precision: 12, scale: 2 }),
  max: numeric('max', { precision: 12, scale: 2 }),
  confidence: integer('confidence'), // 0-100
  
  // Source data
  sourceCount: integer('source_count').notNull(),
  sources: jsonb('sources').$type<Array<{
    source: string;
    price: number;
    condition: string;
    url: string;
  }>>(),
  
  // Metadata
  scrapedAt: timestamp('scraped_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(), // Refresh after this date
  
  // Indexes
  // CREATE INDEX idx_market_prices_lookup ON market_prices(make, model, year, condition);
  // CREATE INDEX idx_market_prices_expiry ON market_prices(expiresAt);
});
```

---

## Part 5: Performance Optimization

### 1. Caching Strategy

```typescript
/**
 * Multi-layer caching
 */
export async function getMarketPrice(
  make: string,
  model: string,
  year: number
): Promise<number> {
  // Layer 1: Redis cache (fastest - milliseconds)
  const cacheKey = `price:${make}:${model}:${year}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    console.log('✅ Redis cache hit');
    return JSON.parse(cached);
  }
  
  // Layer 2: Database cache (fast - <100ms)
  const dbPrice = await db
    .select()
    .from(marketPrices)
    .where(
      and(
        eq(marketPrices.make, make),
        eq(marketPrices.model, model),
        eq(marketPrices.year, year),
        gt(marketPrices.expiresAt, new Date()) // Not expired
      )
    )
    .limit(1);
  
  if (dbPrice.length > 0) {
    console.log('✅ Database cache hit');
    // Store in Redis for next time
    await redis.setex(cacheKey, 3600, JSON.stringify(dbPrice[0].price));
    return parseFloat(dbPrice[0].price);
  }
  
  // Layer 3: Scrape (slow - 5-10 seconds)
  console.log('❌ Cache miss - scraping...');
  const scrapedData = await queueScraping(make, model, year);
  const aggregated = aggregatePrices(scrapedData);
  
  // Save to database
  await db.insert(marketPrices).values({
    make,
    model,
    year,
    price: aggregated.price.toString(),
    median: aggregated.median.toString(),
    mean: aggregated.mean.toString(),
    min: aggregated.min.toString(),
    max: aggregated.max.toString(),
    confidence: aggregated.confidence,
    sourceCount: aggregated.sourceCount,
    sources: aggregated.sources,
    scrapedAt: new Date(),
    expiresAt: addDays(new Date(), 7), // Expire in 7 days
  });
  
  // Save to Redis
  await redis.setex(cacheKey, 3600, JSON.stringify(aggregated.price));
  
  return aggregated.price;
}
```

### 2. Background Scraping

```typescript
/**
 * Cron job to refresh popular vehicles
 */
export async function refreshPopularVehicles() {
  // Get top 100 most searched vehicles
  const popular = await db
    .select({
      make: marketPrices.make,
      model: marketPrices.model,
      year: marketPrices.year,
      searchCount: sql<number>`COUNT(*)`,
    })
    .from(marketPrices)
    .groupBy(marketPrices.make, marketPrices.model, marketPrices.year)
    .orderBy(sql`COUNT(*) DESC`)
    .limit(100);
  
  // Refresh each in background
  for (const vehicle of popular) {
    await scrapingQueue.add(
      {
        source: 'all',
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
      },
      {
        priority: 10, // Lower priority than user requests
        delay: Math.random() * 60000, // Random delay 0-60 seconds
      }
    );
  }
  
  console.log(`🔄 Queued ${popular.length} vehicles for refresh`);
}

// Run daily at 2 AM
// Add to vercel.json cron jobs
```

---

## Part 6: Security & Risk Mitigation

### Security Measures

1. **IP Rotation** (if needed at scale)
```typescript
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxies = [
  'http://proxy1.example.com:8080',
  'http://proxy2.example.com:8080',
  'http://proxy3.example.com:8080',
];

function getRandomProxy() {
  return proxies[Math.floor(Math.random() * proxies.length)];
}

const response = await axios.get(url, {
  httpsAgent: new HttpsProxyAgent(getRandomProxy()),
});
```

2. **User Agent Rotation**
```typescript
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
];

function getRandomUserAgent() {
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}
```

3. **Error Handling & Fallbacks**
```typescript
export async function getMarketPriceWithFallback(
  make: string,
  model: string,
  year: number
): Promise<{ price: number; source: string }> {
  try {
    // Try scraping
    const price = await getMarketPrice(make, model, year);
    return { price, source: 'scraped' };
  } catch (error) {
    console.error('Scraping failed, using fallback');
    
    // Fallback 1: Use old cached data (even if expired)
    const oldCache = await db
      .select()
      .from(marketPrices)
      .where(
        and(
          eq(marketPrices.make, make),
          eq(marketPrices.model, model),
          eq(marketPrices.year, year)
        )
      )
      .orderBy(desc(marketPrices.scrapedAt))
      .limit(1);
    
    if (oldCache.length > 0) {
      return {
        price: parseFloat(oldCache[0].price),
        source: 'stale_cache'
      };
    }
    
    // Fallback 2: Use hardcoded estimates
    const estimated = estimateMarketValue({ make, model, year });
    return { price: estimated, source: 'estimated' };
  }
}
```

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **IP Blocked** | Use proxy rotation, respect rate limits |
| **HTML Changes** | Monitor scraping success rate, alert on failures |
| **Legal Issues** | Only scrape public data, respect robots.txt |
| **Performance** | Cache aggressively, use background jobs |
| **Data Quality** | Aggregate multiple sources, validate with AI |
| **Cost** | Use free sources, cache for 7 days |

---

## Part 7: Cost Analysis

### Scraping Costs (vs Paid APIs)

| Approach | Setup Cost | Monthly Cost | Accuracy |
|----------|------------|--------------|----------|
| **Web Scraping** | $500 (dev time) | $20 (hosting) | 70-80% |
| **Paid API** | $0 | $500-2000 | 85-90% |
| **Hybrid** | $800 | $50 | 80-85% |

**Recommendation**: Start with scraping, upgrade to paid API later if needed.

### Infrastructure Costs

```
Redis (Upstash): $10/month
Queue Workers (Vercel): Included
Proxy Service (optional): $20/month
Database Storage: $5/month (for cache)
---
Total: ~$35/month
```

---

## Part 8: Implementation Roadmap

### Phase 1: MVP (Week 1-2)
- [ ] Scrape Jiji.ng only
- [ ] Basic caching (database only)
- [ ] Manual refresh (no queue)
- [ ] Simple aggregation (median)

### Phase 2: Multi-Source (Week 3-4)
- [ ] Add Jumia, Cars45, Cheki
- [ ] Implement queue system
- [ ] Add Redis caching
- [ ] Improve aggregation logic

### Phase 3: Optimization (Week 5-6)
- [ ] Background refresh for popular vehicles
- [ ] Error handling & fallbacks
- [ ] Monitoring & alerts
- [ ] Rate limiting & proxy rotation

### Phase 4: Scale (Month 2-3)
- [ ] Add more sources
- [ ] Machine learning for price prediction
- [ ] Historical price tracking
- [ ] API for external use

---

## Part 9: Monitoring & Maintenance

### Key Metrics to Track

```typescript
// Scraping success rate
const successRate = successfulScrapes / totalScrapes;

// Cache hit rate
const cacheHitRate = cacheHits / totalRequests;

// Data freshness
const avgAge = averageAgeOfCachedPrices;

// Price confidence
const avgConfidence = averageConfidenceScore;
```

### Alerts

```typescript
// Alert if scraping fails too often
if (successRate < 0.7) {
  await sendAlert('Scraping success rate below 70%');
}

// Alert if cache is too stale
if (avgAge > 14) {
  await sendAlert('Average cache age exceeds 14 days');
}

// Alert if confidence is low
if (avgConfidence < 60) {
  await sendAlert('Average confidence below 60%');
}
```

---

## Conclusion

### ✅ Feasibility: YES

Your hybrid approach is:
1. **Technically feasible** - Standard practice in the industry
2. **Legally acceptable** - As long as you follow best practices
3. **Cost-effective** - Much cheaper than paid APIs
4. **Scalable** - Can handle thousands of requests/day
5. **Accurate** - 70-80% accuracy with multiple sources

### 🎯 Recommended Approach

1. **Start Simple**: Scrape Jiji.ng only, cache for 7 days
2. **Add Sources**: Gradually add Jumia, Cars45, Cheki
3. **Optimize**: Add queue system, Redis, background refresh
4. **Monitor**: Track success rates, alert on failures
5. **Iterate**: Improve based on real-world usage

### 📊 Expected Results

- **Accuracy**: 70-80% (vs 30% now)
- **Coverage**: 80% of vehicles in Nigeria
- **Speed**: <100ms (cached), 5-10s (fresh scrape)
- **Cost**: ~$35/month
- **Maintenance**: 2-4 hours/week

### 🚀 Next Steps

1. Create scraping service for Jiji.ng
2. Set up queue system with Bull
3. Implement caching layer
4. Test with real vehicles
5. Monitor and iterate

**This is absolutely doable and will dramatically improve your AI accuracy!**
