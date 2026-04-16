# AI Marketplace Intelligence - Quick Reference Guide

## Overview

This guide provides quick reference for using the AI Marketplace Intelligence features.

## Redis Cache

### Import
```typescript
import { getCached, setCached, deleteCached, CACHE_KEYS, CACHE_TTL } from '@/lib/cache/redis';
```

### Usage
```typescript
// Get cached prediction
const cached = await getCached<PredictionResult>(`${CACHE_KEYS.PREDICTION}:${auctionId}`);

// Set cached prediction
await setCached(`${CACHE_KEYS.PREDICTION}:${auctionId}`, prediction, CACHE_TTL.PREDICTION);

// Delete cached prediction
await deleteCached(`${CACHE_KEYS.PREDICTION}:${auctionId}`);
```

### Cache Keys
- `prediction:${auctionId}` - Prediction results (5-min TTL)
- `recommendations:${vendorId}` - Recommendation results (15-min TTL)
- `vendor_profile:${vendorId}` - Vendor profiles (30-min TTL)
- `market_conditions:${assetType}` - Market conditions (1-hour TTL)

## Prediction Service

### Import
```typescript
import { PredictionService } from '@/features/intelligence/services/prediction.service';
```

### Generate Prediction
```typescript
const service = new PredictionService();
const prediction = await service.generatePrediction(auctionId);

// Response structure
{
  auctionId: string;
  predictedPrice: number;
  lowerBound: number;
  upperBound: number;
  confidenceScore: number; // 0-1
  confidenceLevel: 'High' | 'Medium' | 'Low';
  method: 'historical' | 'salvage_value' | 'market_value_calc';
  sampleSize: number;
  metadata: {
    similarAuctions?: number;
    marketAdjustment?: number;
    competitionLevel?: string;
    seasonalFactor?: number;
    warnings?: string[];
    notes?: string[];
  };
  algorithmVersion: string;
  createdAt: Date;
}
```

### Analytics Integrations
The prediction service automatically integrates:
- **Asset Performance:** Demand-based price adjustments
- **Attribute Performance:** Color/trim premiums
- **Temporal Patterns:** Peak hour adjustments
- **Geographic Patterns:** Regional price variance
- **Enhanced Confidence:** Data quality factors

## Recommendation Service

### Import
```typescript
import { RecommendationService } from '@/features/intelligence/services/recommendation.service';
```

### Generate Recommendations
```typescript
const service = new RecommendationService();
const recommendations = await service.generateRecommendations(vendorId, limit);

// Response structure
[
  {
    auctionId: string;
    matchScore: number; // 0-100
    collaborativeScore: number;
    contentScore: number;
    popularityBoost: number;
    winRateBoost: number;
    reasonCodes: string[]; // e.g., ['Similar to your previous bids', 'Trending color']
    auctionDetails: {
      assetType: string;
      assetDetails: any;
      marketValue: number;
      reservePrice: number;
      currentBid: number | null;
      watchingCount: number;
      endTime: Date;
    };
  }
]
```

### Analytics Integrations
The recommendation service automatically integrates:
- **Vendor Segments:** Segment-specific strategies
- **Temporal Patterns:** Optimal timing boosts
- **Geographic Patterns:** Local prioritization
- **Attribute Performance:** Trending attributes
- **Conversion Funnel:** Optimization metrics

## API Endpoints

### Get Prediction
```typescript
GET /api/auctions/[id]/prediction

Response:
{
  success: true,
  data: PredictionResult
}
```

### Get Recommendations
```typescript
GET /api/vendors/[id]/recommendations?limit=20

Response:
{
  success: true,
  data: RecommendationResult[]
}
```

## Database Tables

### Core Intelligence Tables
- `predictions` - Stored predictions
- `recommendations` - Stored recommendations
- `interactions` - Vendor interaction events
- `fraud_alerts` - Fraud detection alerts
- `algorithm_config` - Algorithm configuration

### Analytics Tables
- `asset_performance_analytics` - Asset performance metrics
- `attribute_performance_analytics` - Attribute performance tracking
- `temporal_patterns_analytics` - Time-based patterns
- `geographic_patterns_analytics` - Regional patterns
- `vendor_segments` - Vendor segmentation
- `session_analytics` - Session tracking
- `conversion_funnel_analytics` - Conversion metrics

### ML Training Tables
- `prediction_logs` - Prediction performance logs
- `recommendation_logs` - Recommendation effectiveness logs
- `feature_vectors` - Feature engineering data
- `ml_training_datasets` - ML dataset metadata

## Testing

### Run Unit Tests
```bash
npm run test:unit
```

### Run Integration Tests
```bash
npm run test:integration
```

### Test Specific Service
```bash
npx vitest run src/features/intelligence/services/__tests__/prediction.service.test.ts
```

## Monitoring

### Check Redis Connection
```bash
npx tsx -e "import { redis } from '@/lib/cache/redis'; redis.ping().then(() => console.log('✅ Redis connected')).catch(e => console.error('❌', e.message))"
```

### Check Cache Statistics
```typescript
import { getCacheStats } from '@/lib/cache/redis';

const stats = await getCacheStats();
console.log('Cache stats:', stats);
// { predictions: 42, recommendations: 18, vendorProfiles: 5, marketConditions: 3 }
```

### Check Database Tables
```bash
npx tsx scripts/check-intelligence-tables.ts
```

## Common Patterns

### Invalidate Cache on Bid
```typescript
import { deleteCached, CACHE_KEYS } from '@/lib/cache/redis';

// When a significant bid is placed (>10% change)
if (bidChange > 0.10) {
  await deleteCached(`${CACHE_KEYS.PREDICTION}:${auctionId}`);
}
```

### Invalidate Cache on New Auction
```typescript
import { deleteCachedPattern, CACHE_KEYS } from '@/lib/cache/redis';

// When a new auction is created
await deleteCachedPattern(`${CACHE_KEYS.RECOMMENDATION}:*`);
```

### Track Recommendation Interaction
```typescript
import { db } from '@/lib/db';
import { recommendationLogs } from '@/lib/db/schema/ml-training';
import { eq } from 'drizzle-orm';

// When vendor clicks recommendation
await db
  .update(recommendationLogs)
  .set({ clicked: true, clickedAt: new Date() })
  .where(eq(recommendationLogs.recommendationId, recommendationId));

// When vendor places bid
await db
  .update(recommendationLogs)
  .set({ bidPlaced: true, bidPlacedAt: new Date() })
  .where(eq(recommendationLogs.recommendationId, recommendationId));
```

## Performance Tips

1. **Use Caching:** Always check cache before generating predictions/recommendations
2. **Batch Operations:** Use batch queries when possible for analytics
3. **Async Operations:** Use Promise.all() for parallel analytics queries
4. **Graceful Degradation:** Handle analytics failures gracefully (return defaults)
5. **Monitor TTLs:** Adjust cache TTLs based on data freshness requirements

## Troubleshooting

### Prediction Returns Low Confidence
- Check if sufficient historical data exists (need 5+ similar auctions)
- Verify asset details are complete (make, model, year, damage)
- Check if market conditions are volatile (high variance)

### Recommendations Not Personalized
- Verify vendor has bidding history (need 3+ bids for collaborative filtering)
- Check if vendor categories are set
- Ensure vendor_segments table is populated

### Cache Not Working
- Verify Redis connection: `redis.ping()`
- Check environment variables: `REDIS_URL`, `KV_REST_API_TOKEN`
- Verify cache keys are correctly formatted

### Analytics Not Applied
- Check if analytics tables are populated
- Verify analytics data is recent (check `updatedAt` timestamps)
- Ensure background jobs are running for analytics aggregation

## Environment Variables

```env
# Redis (Upstash)
REDIS_URL=rediss://default:...@rested-marmoset-5511.upstash.io:6379
KV_REST_API_TOKEN=...
KV_REST_API_URL=https://rested-marmoset-5511.upstash.io

# Database (Supabase)
DATABASE_URL=postgresql://...
```

## Support

For issues or questions:
1. Check this quick reference guide
2. Review the complete documentation: `docs/AI_MARKETPLACE_INTELLIGENCE_PHASE_2_3_COMPLETE.md`
3. Check the design document: `.kiro/specs/ai-marketplace-intelligence/design.md`
4. Review test files for usage examples
