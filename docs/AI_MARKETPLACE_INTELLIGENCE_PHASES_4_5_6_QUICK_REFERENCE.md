# AI Marketplace Intelligence Phases 4-6 - Quick Reference

## Service Locations

```
src/features/intelligence/services/
├── fraud-detection.service.ts          # Phase 4: Fraud Detection
├── asset-analytics.service.ts          # Phase 5: Asset Analytics
├── temporal-analytics.service.ts       # Phase 5: Temporal Analytics
├── geographic-analytics.service.ts     # Phase 5: Geographic Analytics
├── behavioral-analytics.service.ts     # Phase 5: Behavioral Analytics
├── analytics-aggregation.service.ts    # Phase 5: Aggregation
├── feature-engineering.service.ts      # Phase 6: Feature Engineering
├── ml-dataset.service.ts               # Phase 6: ML Dataset Export
├── schema-evolution.service.ts         # Phase 6: Schema Evolution
└── index.ts                            # Service exports
```

## Quick Import

```typescript
import {
  FraudDetectionService,
  AssetAnalyticsService,
  TemporalAnalyticsService,
  GeographicAnalyticsService,
  BehavioralAnalyticsService,
  AnalyticsAggregationService,
  FeatureEngineeringService,
  MLDatasetService,
  SchemaEvolutionService,
} from '@/features/intelligence/services';
```

## Fraud Detection Cheat Sheet

### Photo Authenticity
```typescript
const service = new FraudDetectionService();
const results = await service.analyzePhotoAuthenticity(caseId, photoUrls);
// Returns: isAuthentic, riskScore, flagReasons, duplicateMatches
```

### Shill Bidding
```typescript
const result = await service.detectShillBidding(auctionId);
// Detects: consecutive bids, rapid bidding, collusion
// Risk threshold: ≥50 = suspicious
```

### Claim Patterns
```typescript
const result = await service.analyzeClaimPatterns(caseId);
// Detects: repeat claimants, similar damage patterns
// Similarity threshold: >0.7 Jaccard similarity
```

### Collusion
```typescript
const result = await service.detectCollusion(vendorId, adjusterId);
// Detects: high win rates (>70%), last-minute bidding
```

## Analytics Cheat Sheet

### Asset Performance
```typescript
const service = new AssetAnalyticsService();
await service.calculateAssetPerformance(periodStart, periodEnd);
// Calculates: demand score, avg price, sell-through rate
```

### Temporal Patterns
```typescript
const service = new TemporalAnalyticsService();
await service.calculateHourlyPatterns(periodStart, periodEnd);
await service.calculateDailyPatterns(periodStart, periodEnd);
await service.calculateSeasonalPatterns(periodStart, periodEnd);
// Calculates: peak activity scores (0-100)
```

### Geographic Patterns
```typescript
const service = new GeographicAnalyticsService();
await service.calculateGeographicPatterns(periodStart, periodEnd);
// Calculates: regional demand, price variance
```

### Vendor Segmentation
```typescript
const service = new BehavioralAnalyticsService();
await service.segmentVendors();
// Segments: bargain_hunter, value_seeker, premium_buyer
//           active_bidder, regular_bidder, selective_bidder
//           specialist, generalist
```

### Aggregation Jobs
```typescript
const service = new AnalyticsAggregationService();
await service.runHourlyRollup();   // Every hour
await service.runDailyRollup();    // Daily at 1 AM
await service.runWeeklyRollup();   // Mondays at 2 AM
await service.runMonthlyRollup();  // 1st of month at 3 AM
```

## ML Training Cheat Sheet

### Feature Engineering
```typescript
const service = new FeatureEngineeringService();
await service.computeAuctionFeatures(auctionId);
await service.computeVendorFeatures(vendorId);
// Generates: feature vectors with cyclical encoding
```

### Dataset Export
```typescript
const service = new MLDatasetService();

// Price prediction dataset
const csv = await service.exportPricePredictionDataset(
  dateRangeStart,
  dateRangeEnd,
  'csv'
);

// Recommendation dataset
const json = await service.exportRecommendationDataset(
  dateRangeStart,
  dateRangeEnd,
  'json'
);
// Formats: csv, json, parquet
// PII automatically anonymized
```

### Schema Evolution
```typescript
const service = new SchemaEvolutionService();
await service.detectNewAssetTypes();    // ≥3 occurrences in 7 days
await service.detectNewAttributes();    // ≥5 occurrences in 7 days
const pending = await service.getPendingChanges();
await service.approveChange(changeId, reviewerId);
```

## Risk Score Thresholds

| Score Range | Risk Level | Action |
|-------------|------------|--------|
| 0-24        | Low        | Monitor |
| 25-49       | Medium     | Review |
| 50-74       | High       | Investigate |
| 75-100      | Critical   | Immediate action |

## Database Tables

### Fraud Detection
- `photo_hashes` - Photo pHash storage
- `photo_hash_index` - Multi-index segments
- `duplicate_photo_matches` - Duplicate results
- `fraud_alerts` - Alert records

### Analytics
- `asset_performance_analytics`
- `attribute_performance_analytics`
- `temporal_patterns_analytics`
- `geographic_patterns_analytics`
- `vendor_segments`
- `conversion_funnel_analytics`

### ML Training
- `ml_training_datasets`
- `feature_vectors`
- `analytics_rollups`
- `prediction_logs`
- `recommendation_logs`
- `fraud_detection_logs`

## Testing

```bash
# Run all tests
npm test tests/unit/intelligence/

# Run specific service tests
npm test fraud-detection.service.test.ts
npm test asset-analytics.service.test.ts
npm test ml-dataset.service.test.ts
```

## Common Patterns

### Error Handling
```typescript
try {
  const result = await service.method();
} catch (error) {
  console.error('Service error:', error);
  // Handle error appropriately
}
```

### Batch Processing
```typescript
// Process in batches to avoid memory issues
const batchSize = 100;
for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  await processBatch(batch);
}
```

### Date Ranges
```typescript
// Last 30 days
const now = new Date();
const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

// Last month
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
```

## Performance Tips

1. **Use indexes**: All date range queries use indexed columns
2. **Batch operations**: Process large datasets in batches
3. **Cache results**: Use Redis for frequently accessed data
4. **Limit queries**: Use LIMIT clauses to prevent large result sets
5. **Async processing**: Use background jobs for heavy computations

## Next Steps

1. Implement cron jobs for analytics aggregation
2. Add Socket.IO notifications for fraud alerts
3. Create API endpoints for services
4. Build admin UI for fraud alert review
5. Add integration tests
6. Optimize queries with EXPLAIN ANALYZE
