# AI-Powered Recommendation System

## Overview

The Recommendation System provides personalized auction recommendations to vendors using a hybrid approach combining collaborative filtering and content-based filtering. The system adapts to vendor behavior over time and handles cold-start scenarios for new vendors.

## Architecture

### Core Components

1. **RecommendationService** (`services/recommendation.service.ts`)
   - Main service class implementing recommendation algorithms
   - Handles vendor pattern extraction, scoring, and ranking
   - Manages cold-start strategies

2. **API Endpoint** (`/api/vendors/[id]/recommendations`)
   - RESTful endpoint for generating recommendations
   - Authentication and authorization
   - Audit logging and error handling

3. **Database Schema** (`schema/intelligence.ts`)
   - `recommendations` table: Stores generated recommendations
   - `interactions` table: Tracks vendor interactions
   - `algorithm_config` table: Configuration parameters

4. **Materialized Views** (`migrations/0025_add_intelligence_materialized_views.sql`)
   - `vendor_bidding_patterns_mv`: Vendor behavior analysis
   - `market_conditions_mv`: Market trend analysis

## Algorithm Details

### Collaborative Filtering (Item-Item Similarity)

Finds auctions similar to those the vendor previously bid on.

**Scoring Criteria:**
- Asset type match: 40 points
- Make/Model match: 30 points (Make only: 15)
- Damage severity match: 15 points (±1 level: 8)
- Price range match: 15 points (within 30%: 15, within 50%: 8)

**Time Decay:**
- Exponential decay over 6 months
- Recent bids weighted higher

**Minimum Threshold:** 30 points

### Content-Based Filtering

Matches auctions to vendor preferences and historical patterns.

**Scoring Criteria:**
- Category match (vendor.categories): 35 points
- Make preference (top makes): 25 points
- Price range fit (p25-p75): 25 points (extended range: 15)
- Damage level preference: 15 points
- High win rate category boost: +20 points

### Hybrid Scoring

Combines collaborative and content-based scores with dynamic weighting.

**Formula:**
```
match_score = (collaborative_score × w_collab) + (content_score × w_content) + 
              popularity_boost + win_rate_boost
```

**Dynamic Weights:**
- New vendors (< 3 bids): 20% collaborative, 80% content
- Warming up (3-9 bids): 40% collaborative, 60% content
- Established (10+ bids): 60% collaborative, 40% content

**Boosts:**
- Popularity boost: MIN(10, watching_count / 2)
- Win rate boost: category_win_rate × 15

### Cold-Start Strategy

Progressive transition as vendor data accumulates:

**Phase 1: New Vendor (0 bids)**
- Strategy: Popularity + Category Matching
- Weight: 100% popularity-based
- Reason: "Popular auction", "Matches your interests"

**Phase 2: Early Activity (1-2 bids)**
- Strategy: Content-Based with Popularity Fallback
- Weight: 70% content, 30% popularity
- Reason: "Similar to your recent bid", "Trending"

**Phase 3: Building History (3-9 bids)**
- Strategy: Hybrid with Content Emphasis
- Weight: 40% collaborative, 60% content
- Reason: "Matches your preferences", "Similar to past bids"

**Phase 4: Established Vendor (10+ bids)**
- Strategy: Full Hybrid Approach
- Weight: 60% collaborative, 40% content
- Reason: "Similar to your winning bids", "Based on your history"

## API Usage

### Generate Recommendations

```http
GET /api/vendors/{vendorId}/recommendations?limit=20
```

**Authentication:** Required (Bearer token)

**Authorization:** Vendors can only access their own recommendations

**Query Parameters:**
- `limit` (optional): Number of recommendations (1-50, default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "vendorId": "uuid",
    "recommendations": [
      {
        "auctionId": "uuid",
        "matchScore": 85.50,
        "collaborativeScore": 70.00,
        "contentScore": 65.00,
        "popularityBoost": 5.00,
        "winRateBoost": 10.50,
        "reasonCodes": [
          "Similar to your previous bids",
          "Matches your preferred categories",
          "High win rate in this category"
        ],
        "auctionDetails": {
          "assetType": "vehicle",
          "assetDetails": {
            "make": "Toyota",
            "model": "Camry",
            "year": "2020"
          },
          "marketValue": 500000,
          "reservePrice": 400000,
          "currentBid": null,
          "watchingCount": 12,
          "endTime": "2025-01-30T10:00:00Z"
        }
      }
    ],
    "count": 20,
    "generatedAt": "2025-01-23T14:30:00Z"
  },
  "meta": {
    "responseTimeMs": 145,
    "cached": false
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Attempting to access another vendor's recommendations
- `404 Not Found`: Vendor not found
- `500 Internal Server Error`: Server error

## Performance

### Targets
- Response time: <200ms for 95% of requests
- Recommendation quality: >15% bid conversion rate

### Optimization Strategies
1. **Redis Caching**: 15-minute TTL for recommendations
2. **Materialized Views**: Pre-computed vendor patterns
3. **Query Optimization**: Indexed lookups, limited result sets
4. **Batch Processing**: Background jobs for pattern updates

### Monitoring
- Response time tracking
- Recommendation click-through rate (CTR)
- Bid placement rate
- Algorithm accuracy metrics

## Security

### Authentication & Authorization
- NextAuth session validation
- Vendor-specific access control
- Admin/manager override capability

### Input Validation
- Zod schemas for query parameters
- UUID format validation
- Range checks on limit parameter

### SQL Injection Prevention
- Parameterized queries throughout
- Drizzle ORM type safety
- No dynamic SQL construction

### Audit Logging
- All API access logged
- User ID, IP address, device type tracked
- Error events logged for debugging

## Configuration

### Algorithm Parameters

Stored in `algorithm_config` table:

```typescript
{
  'recommendation.collab_weight': 0.60,
  'recommendation.content_weight': 0.40,
  'recommendation.min_match_score': 25,
  'recommendation.cold_start_bid_threshold': 3,
  'recommendation.similarity_threshold': 30
}
```

### Environment Variables

```env
INTELLIGENCE_ENABLED=true
INTELLIGENCE_ALGORITHM_VERSION=v1.0
REDIS_URL=redis://localhost:6379
```

## Testing

### Unit Tests
```bash
npm run test:unit -- src/features/intelligence/services/__tests__/recommendation.service.test.ts
```

### Integration Tests
```bash
npm run test:integration -- src/features/intelligence/services/__tests__/recommendation.integration.test.ts
```

### Test Coverage
- Collaborative filtering algorithm
- Content-based filtering algorithm
- Hybrid scoring
- Cold-start handling
- Diversity optimization
- Edge cases (no auctions, no history, etc.)

## Maintenance

### Materialized View Refresh

Vendor bidding patterns should be refreshed regularly:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY vendor_bidding_patterns_mv;
```

**Recommended Schedule:** Every 5 minutes (via cron job)

### Data Retention

- Recommendations: Keep for 30 days
- Interactions: Keep for 12 months, then archive
- Vendor patterns: Rolling 12-month window

### Performance Monitoring

Monitor these metrics:
- Average response time
- 95th percentile response time
- Recommendation CTR
- Bid placement rate
- Error rate

## Future Enhancements

1. **Session-Based Collaborative Filtering** (Task 3.2.2)
   - Track vendor sessions
   - Recommend based on current browsing behavior

2. **Temporal Patterns Integration** (Task 3.2.3)
   - Optimal timing for recommendations
   - Peak hour adjustments

3. **Geographic Patterns** (Task 3.2.4)
   - Local auction prioritization
   - Regional price variance

4. **Conversion Funnel Analytics** (Task 3.2.5)
   - Optimize for bid placement
   - A/B testing of algorithms

5. **Attribute Performance** (Task 3.2.6)
   - Trending colors, trims, features
   - Dynamic attribute scoring

## Troubleshooting

### Low Recommendation Quality

**Symptoms:** Low CTR, low bid placement rate

**Solutions:**
1. Check vendor bidding history (need 10+ bids for full collaborative)
2. Verify materialized views are up to date
3. Review algorithm weights in `algorithm_config`
4. Check for data quality issues (missing asset details)

### Slow Response Times

**Symptoms:** Response time >200ms

**Solutions:**
1. Check Redis cache hit rate
2. Verify database indexes are present
3. Review query execution plans
4. Consider reducing result set size

### No Recommendations Returned

**Symptoms:** Empty recommendation array

**Solutions:**
1. Verify active auctions exist
2. Check vendor hasn't bid on all auctions
3. Review minimum match score threshold
4. Check vendor categories match available auctions

## Support

For issues or questions:
- Check logs: `auditLogs` table with `actionType='intelligence_api_accessed'`
- Review error logs: `actionType='intelligence_fallback'`
- Contact: AI Intelligence Team
