# AI Marketplace Intelligence - Phase 9 & 10 Quick Reference

**Quick access guide for Phase 9 (Background Jobs) and Phase 10 (Vendor UI Components)**

---

## Background Jobs Quick Start

### Start All Jobs
```typescript
import { startAllIntelligenceJobs } from '@/features/intelligence/jobs';

startAllIntelligenceJobs();
```

### Stop All Jobs
```typescript
import { stopAllIntelligenceJobs } from '@/features/intelligence/jobs';

stopAllIntelligenceJobs();
```

### Manual Job Execution (Testing)
```typescript
import {
  refreshMaterializedViewsNow,
  runAnalyticsAggregationNow,
  runAccuracyTrackingNow,
  runDataMaintenanceNow,
  runSchemaEvolutionNow,
} from '@/features/intelligence/jobs';

// Refresh materialized views
await refreshMaterializedViewsNow();

// Run analytics aggregation
await runAnalyticsAggregationNow('hourly');
await runAnalyticsAggregationNow('daily');

// Run accuracy tracking
await runAccuracyTrackingNow('prediction');
await runAccuracyTrackingNow('recommendation');
await runAccuracyTrackingNow('tuning');

// Run data maintenance
await runDataMaintenanceNow('interactions');
await runDataMaintenanceNow('logs');
await runDataMaintenanceNow('segments');

// Run schema evolution
await runSchemaEvolutionNow('asset-types');
await runSchemaEvolutionNow('attributes');
```

---

## Job Schedules

| Job | Schedule | Cron Expression |
|-----|----------|-----------------|
| **Materialized Views** |
| Vendor Bidding Patterns | Every 5 minutes | `*/5 * * * *` |
| Market Conditions | Every 5 minutes | `*/5 * * * *` |
| **Analytics Aggregation** |
| Hourly Rollup | Every hour at :00 | `0 * * * *` |
| Daily Rollup | Daily at 1:00 AM | `0 1 * * *` |
| Weekly Rollup | Mondays at 2:00 AM | `0 2 * * 1` |
| Monthly Rollup | 1st of month at 3:00 AM | `0 3 1 * *` |
| **Accuracy Tracking** |
| Prediction Accuracy | Hourly at :15 | `15 * * * *` |
| Recommendation Effectiveness | Hourly at :30 | `30 * * * *` |
| Algorithm Tuning | Daily at 4:00 AM | `0 4 * * *` |
| **Data Maintenance** |
| Interactions Cleanup | Sundays at 5:00 AM | `0 5 * * 0` |
| Log Rotation | Sundays at 6:00 AM | `0 6 * * 0` |
| Vendor Segment Update | Mondays at 3:00 AM | `0 3 * * 1` |
| Asset Performance Update | Daily at 2:00 AM | `0 2 * * *` |
| Feature Vector Update | Mondays at 4:00 AM | `0 4 * * 1` |
| **Schema Evolution** |
| Asset Type Detection | Daily at 5:00 AM | `0 5 * * *` |
| Attribute Detection | Daily at 5:30 AM | `30 5 * * *` |

---

## UI Components Quick Start

### PredictionCard
```typescript
import { PredictionCard } from '@/components/intelligence';

<PredictionCard
  auctionId="auction-123"
  predictedPrice={4500000}
  lowerBound={4200000}
  upperBound={4800000}
  confidenceScore={0.85}
  confidenceLevel="High"
  method="historical"
  sampleSize={15}
  metadata={{
    similarAuctions: 15,
    marketAdjustment: 1.05,
    competitionLevel: 'moderate_high',
    seasonalFactor: 1.02,
  }}
/>
```

### PredictionExplanationModal
```typescript
import { PredictionExplanationModal } from '@/components/intelligence';

const [isOpen, setIsOpen] = useState(false);

<PredictionExplanationModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  prediction={predictionData}
/>
```

### RecommendationCard
```typescript
import { RecommendationCard } from '@/components/intelligence';

<RecommendationCard
  auctionId="auction-456"
  matchScore={85.5}
  reasonCodes={[
    'Similar to your previous bids',
    'High win rate in this category',
    'Trending auction'
  ]}
  auctionDetails={{
    assetType: 'vehicle',
    assetDetails: {
      make: 'Toyota',
      model: 'Camry',
      year: '2018'
    },
    marketValue: 5000000,
    reservePrice: 3500000,
    currentBid: 4000000,
    watchingCount: 12,
    endTime: new Date('2025-02-01T18:00:00Z')
  }}
  onNotInterested={(auctionId) => console.log('Dismissed:', auctionId)}
/>
```

### RecommendationsFeed
```typescript
import { RecommendationsFeed } from '@/components/intelligence';

<RecommendationsFeed vendorId="vendor-789" />
```

### Market Insights Page
```
URL: /vendor/market-insights
File: src/app/(dashboard)/vendor/market-insights/page.tsx
```

---

## API Endpoints

### Get Recommendations
```
GET /api/vendors/{vendorId}/recommendations?page=1&limit=10
```

### Track Interaction
```
POST /api/intelligence/interactions
Body: {
  eventType: 'recommendation_dismissed',
  auctionId: string,
  metadata: { matchScore, reasonCodes }
}
```

### Get Market Insights
```
GET /api/intelligence/market-insights?assetType=vehicle&dateRange=30d&region=lagos
```

### Download Market Report
```
GET /api/intelligence/market-insights/download?assetType=vehicle&dateRange=30d&region=lagos
```

---

## Confidence Level Colors

| Level | Score Range | Color | CSS Class |
|-------|-------------|-------|-----------|
| High | ≥75% | Green | `bg-green-100 text-green-800` |
| Medium | 50-74% | Yellow | `bg-yellow-100 text-yellow-800` |
| Low | <50% | Orange | `bg-orange-100 text-orange-800` |

---

## Reason Code Colors

| Reason Type | Color | CSS Class |
|-------------|-------|-----------|
| Win rate / High win | Green | `bg-green-100 text-green-800` |
| Similar / Previous | Blue | `bg-blue-100 text-blue-800` |
| Trending / Popular | Purple | `bg-purple-100 text-purple-800` |
| Preferred / Matches | Indigo | `bg-indigo-100 text-indigo-800` |
| Best time / Optimal | Yellow | `bg-yellow-100 text-yellow-800` |
| Local / Region | Teal | `bg-teal-100 text-teal-800` |
| Default | Gray | `bg-gray-100 text-gray-800` |

---

## Job Locking (Redis)

### Lock Keys
```typescript
const LOCK_KEY_BIDDING_PATTERNS = 'job:lock:refresh_bidding_patterns';
const LOCK_KEY_MARKET_CONDITIONS = 'job:lock:refresh_market_conditions';
const LOCK_KEY_HOURLY = 'job:lock:hourly_rollup';
const LOCK_KEY_DAILY = 'job:lock:daily_rollup';
// ... etc
```

### Lock TTL
- Materialized View Refresh: 5 minutes (300s)
- Analytics Aggregation: 1 hour (3600s)
- Accuracy Tracking: 1 hour (3600s)
- Data Maintenance: 2 hours (7200s)
- Schema Evolution: 1 hour (3600s)

---

## Retry Logic

### Exponential Backoff
```typescript
// Attempt 1: 2^1 = 2 seconds
// Attempt 2: 2^2 = 4 seconds
// Attempt 3: 2^3 = 8 seconds
const backoffMs = Math.pow(2, attempt) * 1000;
```

### Max Retries
- Default: 3 attempts
- Configurable per job

---

## Data Retention

| Data Type | Retention Period | Cleanup Job |
|-----------|------------------|-------------|
| Interactions | 2 years | Interactions Cleanup |
| Prediction Logs | 90 days | Log Rotation |
| Recommendation Logs | 90 days | Log Rotation |
| Fraud Detection Logs | 90 days | Log Rotation |

---

## Accuracy Thresholds

### Prediction Accuracy
- Target: ≥88% (within ±12%)
- Alert Threshold: <85%
- Min Sample Size: 10 predictions

### Recommendation Effectiveness
- Target CTR: ≥20%
- Target Conversion: ≥15%
- Alert Threshold: <10% conversion
- Min Sample Size: 50 recommendations

### Algorithm Tuning
- Increase similarity threshold if error rate > 15%
- Decrease similarity threshold if error rate < 10% and bounds accuracy > 85%
- Adjustment step: ±5 points
- Min threshold: 50
- Max threshold: 80

---

## Mobile PWA Features

### Service Worker Caching
- Predictions: 5-minute TTL
- Recommendations: 15-minute TTL
- Static assets: Cache-first
- API calls: Network-first

### Touch Gestures
- Pull-to-refresh on recommendations feed
- Swipe left to dismiss recommendation cards
- Haptic feedback on interactions

### Touch Targets
- Minimum size: 44x44px
- Adequate spacing between interactive elements

---

## File Locations

### Background Jobs
```
src/features/intelligence/jobs/
├── materialized-view-refresh.job.ts
├── analytics-aggregation.job.ts
├── accuracy-tracking.job.ts
├── data-maintenance.job.ts
├── schema-evolution.job.ts
└── index.ts
```

### UI Components
```
src/components/intelligence/
├── prediction-card.tsx
├── prediction-explanation-modal.tsx
├── recommendation-card.tsx
├── recommendations-feed.tsx
└── index.ts
```

### Pages
```
src/app/(dashboard)/vendor/
└── market-insights/
    └── page.tsx
```

---

## Testing Commands

```bash
# Install dependencies
npm install

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Test specific component
npm run test:component -- prediction-card
npm run test:component -- recommendations-feed

# Test specific job
npm run test:job -- materialized-view-refresh
npm run test:job -- analytics-aggregation
```

---

## Troubleshooting

### Jobs Not Running
1. Check if jobs are started: `getJobStatus()`
2. Check Redis connection
3. Check job logs in console
4. Verify cron expressions

### Lock Conflicts
1. Check Redis for stuck locks
2. Manually release lock: `await setCached(lockKey, '', 0)`
3. Restart jobs: `stopAllIntelligenceJobs()` then `startAllIntelligenceJobs()`

### UI Components Not Rendering
1. Check if data is being fetched
2. Verify API endpoints are accessible
3. Check browser console for errors
4. Verify component props are correct

### Accuracy Alerts
1. Check prediction accuracy metrics
2. Review algorithm configuration
3. Verify data quality
4. Check for market anomalies

---

## Performance Optimization

### Background Jobs
- Use `REFRESH MATERIALIZED VIEW CONCURRENTLY` for non-blocking refreshes
- Implement distributed locking to prevent concurrent execution
- Use exponential backoff for retries
- Log execution times for monitoring

### UI Components
- Use React.memo for expensive components
- Implement virtual scrolling for long lists
- Lazy load images and heavy components
- Use Intersection Observer for infinite scroll

### API Calls
- Implement caching with appropriate TTLs
- Use pagination for large datasets
- Implement request debouncing
- Use optimistic updates for better UX

---

## Security Best Practices

### Job Execution
- Validate all inputs
- Use parameterized queries
- Implement rate limiting
- Log all operations

### UI Components
- Sanitize user inputs
- Implement CSRF protection
- Use secure API calls
- Validate all data from API

### Data Privacy
- Implement data retention policies
- Anonymize PII in exports
- Comply with GDPR requirements
- Secure sensitive data

---

## Monitoring

### Job Monitoring
- Track execution times
- Monitor failure rates
- Alert on repeated failures
- Log all operations

### Accuracy Monitoring
- Track prediction accuracy over time
- Monitor recommendation effectiveness
- Alert on accuracy degradation
- Review algorithm performance

### Performance Monitoring
- Track API response times
- Monitor database query performance
- Track component render times
- Monitor bundle sizes

---

## Support

For issues or questions:
1. Check this quick reference
2. Review the complete documentation
3. Check the codebase comments
4. Contact the development team

---

**Last Updated:** January 2025  
**Version:** 1.0  
**Status:** Production Ready
