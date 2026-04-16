## 3. Advanced Analytics Database Schemas

### 3.1 Asset Performance Analytics

Tracks granular performance metrics for specific asset attributes (make, model, year, color, trim).

**Drizzle ORM Schema:**

```typescript
// src/lib/db/schema/intelligence/asset-performance.ts
import { pgTable, uuid, varchar, integer, numeric, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { assetTypeEnum } from '../vendors';

export const assetPerformanceAnalytics = pgTable('asset_performance_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetType: assetTypeEnum('asset_type').notNull(),
  make: varchar('make', { length: 100 }),
  model: varchar('model', { length: 100 }),
  year: integer('year'),
  color: varchar('color', { length: 50 }),
  trim: varchar('trim', { length: 100 }),
  bodyStyle: varchar('body_style', { length: 50 }),
  mileageRange: varchar('mileage_range', { length: 50 }), // "0-50k", "50k-100k", etc.
  conditionScore: integer('condition_score'), // 0-100
  
  // Performance metrics
  avgFinalPrice: numeric('avg_final_price', { precision: 12, scale: 2 }),
  avgBidCount: numeric('avg_bid_count', { precision: 5, scale: 2 }),
  avgTimeToSell: integer('avg_time_to_sell'), // hours
  avgDaysToSell: integer('avg_days_to_sell'),
  totalAuctions: integer('total_auctions').notNull().default(0),
  totalSold: integer('total_sold').notNull().default(0),
  sellThroughRate: numeric('sell_through_rate', { precision: 5, scale: 2 }), // percentage
  priceAppreciation: numeric('price_appreciation', { precision: 5, scale: 2 }), // percentage change
  
  // Attribute-specific pricing
  pricePerAttribute: jsonb('price_per_attribute').$type<{
    color?: Record<string, number>; // percentage impact
    trim?: Record<string, number>;
    bodyStyle?: Record<string, number>;
  }>(),
  
  sampleSize: integer('sample_size').notNull().default(0),
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
}, (table) => ({
  assetTypeIdx: index('idx_asset_perf_type').on(table.assetType),
  makeModelIdx: index('idx_asset_perf_make_model').on(table.make, table.model),
  makeModelYearIdx: index('idx_asset_perf_make_model_year').on(table.make, table.model, table.year),
  avgPriceIdx: index('idx_asset_perf_avg_price').on(table.avgFinalPrice),
  sellThroughIdx: index('idx_asset_perf_sell_through').on(table.sellThroughRate),
  lastUpdatedIdx: index('idx_asset_perf_last_updated').on(table.lastUpdated),
}));
```

**SQL Migration:**

```sql
CREATE TABLE asset_performance_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type asset_type NOT NULL,
  make VARCHAR(100),
  model VARCHAR(100),
  year INTEGER,
  color VARCHAR(50),
  trim VARCHAR(100),
  body_style VARCHAR(50),
  mileage_range VARCHAR(50),
  condition_score INTEGER CHECK (condition_score >= 0 AND condition_score <= 100),
  
  avg_final_price NUMERIC(12, 2),
  avg_bid_count NUMERIC(5, 2),
  avg_time_to_sell INTEGER,
  avg_days_to_sell INTEGER,
  total_auctions INTEGER NOT NULL DEFAULT 0,
  total_sold INTEGER NOT NULL DEFAULT 0,
  sell_through_rate NUMERIC(5, 2),
  price_appreciation NUMERIC(5, 2),
  
  price_per_attribute JSONB,
  sample_size INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_asset_perf_type ON asset_performance_analytics(asset_type);
CREATE INDEX idx_asset_perf_make_model ON asset_performance_analytics(make, model);
CREATE INDEX idx_asset_perf_make_model_year ON asset_performance_analytics(make, model, year);
CREATE INDEX idx_asset_perf_avg_price ON asset_performance_analytics(avg_final_price DESC);
CREATE INDEX idx_asset_perf_sell_through ON asset_performance_analytics(sell_through_rate DESC);
CREATE INDEX idx_asset_perf_last_updated ON asset_performance_analytics(last_updated DESC);
```

### 3.2 Attribute Performance Analytics

Tracks performance of specific attributes (color, trim, storage) across asset types.

**Drizzle ORM Schema:**

```typescript
export const attributePerformanceAnalytics = pgTable('attribute_performance_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetType: assetTypeEnum('asset_type').notNull(),
  attributeName: varchar('attribute_name', { length: 50 }).notNull(), // 'color', 'trim', 'storage'
  attributeValue: varchar('attribute_value', { length: 100 }).notNull(), // 'black', 'limited', '256GB'
  
  avgFinalPrice: numeric('avg_final_price', { precision: 12, scale: 2 }),
  totalAuctions: integer('total_auctions').notNull().default(0),
  sellThroughRate: numeric('sell_through_rate', { precision: 5, scale: 2 }),
  avgDaysToSell: integer('avg_days_to_sell'),
  popularityRank: integer('popularity_rank'), // 1 = most popular
  
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
}, (table) => ({
  assetTypeAttrIdx: index('idx_attr_perf_type_attr').on(table.assetType, table.attributeName),
  popularityIdx: index('idx_attr_perf_popularity').on(table.popularityRank),
  avgPriceIdx: index('idx_attr_perf_avg_price').on(table.avgFinalPrice),
}));
```

**SQL Migration:**

```sql
CREATE TABLE attribute_performance_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type asset_type NOT NULL,
  attribute_name VARCHAR(50) NOT NULL,
  attribute_value VARCHAR(100) NOT NULL,
  
  avg_final_price NUMERIC(12, 2),
  total_auctions INTEGER NOT NULL DEFAULT 0,
  sell_through_rate NUMERIC(5, 2),
  avg_days_to_sell INTEGER,
  popularity_rank INTEGER,
  
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(asset_type, attribute_name, attribute_value)
);

CREATE INDEX idx_attr_perf_type_attr ON attribute_performance_analytics(asset_type, attribute_name);
CREATE INDEX idx_attr_perf_popularity ON attribute_performance_analytics(popularity_rank);
CREATE INDEX idx_attr_perf_avg_price ON attribute_performance_analytics(avg_final_price DESC);
```

### 3.3 Temporal Patterns Analytics

Tracks time-based patterns in bidding and auction performance.

**Drizzle ORM Schema:**

```typescript
export const patternTypeEnum = pgEnum('pattern_type', ['hourly', 'daily', 'weekly', 'monthly', 'seasonal']);

export const temporalPatternsAnalytics = pgTable('temporal_patterns_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  patternType: patternTypeEnum('pattern_type').notNull(),
  timeSegment: varchar('time_segment', { length: 50 }).notNull(), // "14" (hour), "Monday", "January"
  assetType: assetTypeEnum('asset_type'),
  
  avgBidCount: integer('avg_bid_count'),
  avgFinalPrice: numeric('avg_final_price', { precision: 12, scale: 2 }),
  avgVendorActivity: integer('avg_vendor_activity'), // unique vendors
  conversionRate: numeric('conversion_rate', { precision: 5, scale: 2 }), // percentage
  peakActivityScore: integer('peak_activity_score'), // 0-100
  
  sampleSize: integer('sample_size').notNull().default(0),
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
}, (table) => ({
  patternTypeIdx: index('idx_temporal_pattern_type').on(table.patternType),
  timeSegmentIdx: index('idx_temporal_time_segment').on(table.timeSegment),
  assetTypeIdx: index('idx_temporal_asset_type').on(table.assetType),
  peakScoreIdx: index('idx_temporal_peak_score').on(table.peakActivityScore),
}));
```

**SQL Migration:**

```sql
CREATE TYPE pattern_type AS ENUM ('hourly', 'daily', 'weekly', 'monthly', 'seasonal');

CREATE TABLE temporal_patterns_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type pattern_type NOT NULL,
  time_segment VARCHAR(50) NOT NULL,
  asset_type asset_type,
  
  avg_bid_count INTEGER,
  avg_final_price NUMERIC(12, 2),
  avg_vendor_activity INTEGER,
  conversion_rate NUMERIC(5, 2),
  peak_activity_score INTEGER CHECK (peak_activity_score >= 0 AND peak_activity_score <= 100),
  
  sample_size INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(pattern_type, time_segment, asset_type)
);

CREATE INDEX idx_temporal_pattern_type ON temporal_patterns_analytics(pattern_type);
CREATE INDEX idx_temporal_time_segment ON temporal_patterns_analytics(time_segment);
CREATE INDEX idx_temporal_asset_type ON temporal_patterns_analytics(asset_type);
CREATE INDEX idx_temporal_peak_score ON temporal_patterns_analytics(peak_activity_score DESC);
```

### 3.4 Geographic Patterns Analytics

Tracks regional preferences and pricing variations.

**Drizzle ORM Schema:**

```typescript
export const geographicPatternsAnalytics = pgTable('geographic_patterns_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  region: varchar('region', { length: 100 }).notNull(), // "Lagos", "Abuja", etc.
  locationId: varchar('location_id', { length: 50 }),
  assetType: assetTypeEnum('asset_type'),
  make: varchar('make', { length: 100 }),
  model: varchar('model', { length: 100 }),
  
  avgFinalPrice: numeric('avg_final_price', { precision: 12, scale: 2 }),
  totalAuctions: integer('total_auctions').notNull().default(0),
  avgBidCount: integer('avg_bid_count'),
  regionalDemandScore: integer('regional_demand_score'), // 0-100
  priceVariance: numeric('price_variance', { precision: 5, scale: 2 }), // % diff from national avg
  
  topAssetTypes: jsonb('top_asset_types').$type<Array<{
    assetType: string;
    count: number;
    percentage: number;
  }>>(),
  regionalPreferences: jsonb('regional_preferences').$type<Record<string, number>>(), // price premiums by type
  avgDistanceTraveled: numeric('avg_distance_traveled', { precision: 10, scale: 2 }), // km
  distanceImpactScore: numeric('distance_impact_score', { precision: 5, scale: 2 }),
  
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
}, (table) => ({
  regionIdx: index('idx_geo_region').on(table.region),
  assetTypeIdx: index('idx_geo_asset_type').on(table.assetType),
  demandScoreIdx: index('idx_geo_demand_score').on(table.regionalDemandScore),
  priceVarianceIdx: index('idx_geo_price_variance').on(table.priceVariance),
}));
```

**SQL Migration:**

```sql
CREATE TABLE geographic_patterns_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region VARCHAR(100) NOT NULL,
  location_id VARCHAR(50),
  asset_type asset_type,
  make VARCHAR(100),
  model VARCHAR(100),
  
  avg_final_price NUMERIC(12, 2),
  total_auctions INTEGER NOT NULL DEFAULT 0,
  avg_bid_count INTEGER,
  regional_demand_score INTEGER CHECK (regional_demand_score >= 0 AND regional_demand_score <= 100),
  price_variance NUMERIC(5, 2),
  
  top_asset_types JSONB,
  regional_preferences JSONB,
  avg_distance_traveled NUMERIC(10, 2),
  distance_impact_score NUMERIC(5, 2),
  
  last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_geo_region ON geographic_patterns_analytics(region);
CREATE INDEX idx_geo_asset_type ON geographic_patterns_analytics(asset_type);
CREATE INDEX idx_geo_demand_score ON geographic_patterns_analytics(regional_demand_score DESC);
CREATE INDEX idx_geo_price_variance ON geographic_patterns_analytics(price_variance DESC);
```

### 3.5 Vendor Segments

Classifies vendors into behavioral segments for personalized recommendations.

**Drizzle ORM Schema:**

```typescript
export const segmentTypeEnum = pgEnum('segment_type', [
  'bargain_hunter',
  'premium_buyer',
  'specialist',
  'generalist',
  'active_bidder',
  'selective_bidder',
  'new_vendor',
  'dormant_vendor'
]);

export const vendorSegments = pgTable('vendor_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  segmentType: segmentTypeEnum('segment_type').notNull(),
  segmentScore: integer('segment_score').notNull(), // 0-100, confidence in classification
  
  segmentCharacteristics: jsonb('segment_characteristics').$type<{
    avgBidAmount?: number;
    preferredAssetTypes?: string[];
    avgMarketValue?: number;
    winRate?: number;
    bidFrequency?: number;
    priceRange?: { min: number; max: number };
    preferredDamageSeverity?: string;
    preferredTimeOfDay?: number; // hour 0-23
    preferredDayOfWeek?: number; // 0-6
  }>(),
  
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  lastUpdated: timestamp('last_updated').notNull().defaultNow(),
}, (table) => ({
  vendorIdIdx: index('idx_vendor_segments_vendor_id').on(table.vendorId),
  segmentTypeIdx: index('idx_vendor_segments_type').on(table.segmentType),
  segmentScoreIdx: index('idx_vendor_segments_score').on(table.segmentScore),
  lastUpdatedIdx: index('idx_vendor_segments_last_updated').on(table.lastUpdated),
}));
```

**SQL Migration:**

```sql
CREATE TYPE segment_type AS ENUM (
  'bargain_hunter',
  'premium_buyer',
  'specialist',
  'generalist',
  'active_bidder',
  'selective_bidder',
  'new_vendor',
  'dormant_vendor'
);

CREATE TABLE vendor_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  segment_type segment_type NOT NULL,
  segment_score INTEGER NOT NULL CHECK (segment_score >= 0 AND segment_score <= 100),
  
  segment_characteristics JSONB,
  
  assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendor_segments_vendor_id ON vendor_segments(vendor_id);
CREATE INDEX idx_vendor_segments_type ON vendor_segments(segment_type);
CREATE INDEX idx_vendor_segments_score ON vendor_segments(segment_score DESC);
CREATE INDEX idx_vendor_segments_last_updated ON vendor_segments(last_updated DESC);
```


### 3.6 Session Analytics

Tracks vendor browsing sessions for engagement analysis.

**Drizzle ORM Schema:**

```typescript
export const conversionTypeEnum = pgEnum('conversion_type', ['bid_placed', 'auction_won', 'no_conversion']);

export const sessionAnalytics = pgTable('session_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: varchar('session_id', { length: 100 }).notNull().unique(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  duration: integer('duration'), // seconds
  
  pageViews: integer('page_views').notNull().default(0),
  auctionsViewed: integer('auctions_viewed').notNull().default(0),
  auctionsBid: integer('auctions_bid').notNull().default(0),
  searchQueries: integer('search_queries').notNull().default(0),
  
  bounceRate: boolean('bounce_rate').notNull().default(false),
  conversionType: conversionTypeEnum('conversion_type').notNull().default('no_conversion'),
  
  deviceType: varchar('device_type', { length: 50 }),
  referrerSource: varchar('referrer_source', { length: 255 }),
  exitPage: varchar('exit_page', { length: 255 }),
  
  metadata: jsonb('metadata').$type<{
    pageSequence?: Array<{ page: string; timestamp: string; duration: number }>;
    searchTerms?: string[];
    auctionIds?: string[];
  }>(),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  vendorIdIdx: index('idx_session_vendor_id').on(table.vendorId),
  startTimeIdx: index('idx_session_start_time').on(table.startTime),
  conversionTypeIdx: index('idx_session_conversion_type').on(table.conversionType),
  deviceTypeIdx: index('idx_session_device_type').on(table.deviceType),
}));
```

**SQL Migration:**

```sql
CREATE TYPE conversion_type AS ENUM ('bid_placed', 'auction_won', 'no_conversion');

CREATE TABLE session_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  duration INTEGER,
  
  page_views INTEGER NOT NULL DEFAULT 0,
  auctions_viewed INTEGER NOT NULL DEFAULT 0,
  auctions_bid INTEGER NOT NULL DEFAULT 0,
  search_queries INTEGER NOT NULL DEFAULT 0,
  
  bounce_rate BOOLEAN NOT NULL DEFAULT FALSE,
  conversion_type conversion_type NOT NULL DEFAULT 'no_conversion',
  
  device_type VARCHAR(50),
  referrer_source VARCHAR(255),
  exit_page VARCHAR(255),
  
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_vendor_id ON session_analytics(vendor_id);
CREATE INDEX idx_session_start_time ON session_analytics(start_time DESC);
CREATE INDEX idx_session_conversion_type ON session_analytics(conversion_type);
CREATE INDEX idx_session_device_type ON session_analytics(device_type);
```

### 3.7 Conversion Funnel Analytics

Tracks vendor progression through the bidding funnel.

**Drizzle ORM Schema:**

```typescript
export const funnelStageEnum = pgEnum('funnel_stage', [
  'marketplace_visit',
  'auction_view',
  'auction_watch',
  'bid_intent',
  'bid_placed',
  'bid_won'
]);

export const conversionFunnelAnalytics = pgTable('conversion_funnel_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: varchar('session_id', { length: 100 }).notNull(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  funnelStage: funnelStageEnum('funnel_stage').notNull(),
  stageTimestamp: timestamp('stage_timestamp').notNull(),
  timeInStage: integer('time_in_stage'), // seconds
  nextStage: varchar('next_stage', { length: 50 }),
  dropped: boolean('dropped').notNull().default(false),
  dropReason: varchar('drop_reason', { length: 255 }),
  
  metadata: jsonb('metadata').$type<{
    auctionId?: string;
    bidAmount?: number;
    competitionLevel?: string;
  }>(),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  vendorIdIdx: index('idx_funnel_vendor_id').on(table.vendorId),
  funnelStageIdx: index('idx_funnel_stage').on(table.funnelStage),
  droppedIdx: index('idx_funnel_dropped').on(table.dropped),
  stageTimestampIdx: index('idx_funnel_stage_timestamp').on(table.stageTimestamp),
}));
```

**SQL Migration:**

```sql
CREATE TYPE funnel_stage AS ENUM (
  'marketplace_visit',
  'auction_view',
  'auction_watch',
  'bid_intent',
  'bid_placed',
  'bid_won'
);

CREATE TABLE conversion_funnel_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(100) NOT NULL,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  funnel_stage funnel_stage NOT NULL,
  stage_timestamp TIMESTAMP NOT NULL,
  time_in_stage INTEGER,
  next_stage VARCHAR(50),
  dropped BOOLEAN NOT NULL DEFAULT FALSE,
  drop_reason VARCHAR(255),
  
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_funnel_vendor_id ON conversion_funnel_analytics(vendor_id);
CREATE INDEX idx_funnel_stage ON conversion_funnel_analytics(funnel_stage);
CREATE INDEX idx_funnel_dropped ON conversion_funnel_analytics(dropped) WHERE dropped = TRUE;
CREATE INDEX idx_funnel_stage_timestamp ON conversion_funnel_analytics(stage_timestamp DESC);
```

### 3.8 Schema Evolution Log

Tracks detection and integration of new asset types and attributes.

**Drizzle ORM Schema:**

```typescript
export const entityTypeEnum = pgEnum('entity_type', ['asset_type', 'asset_attribute', 'damage_type']);
export const schemaStatusEnum = pgEnum('schema_status', ['detected', 'validated', 'integrated']);

export const schemaEvolutionLog = pgTable('schema_evolution_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: entityTypeEnum('entity_type').notNull(),
  entityName: varchar('entity_name', { length: 100 }).notNull(),
  detectedValue: varchar('detected_value', { length: 255 }).notNull(),
  
  firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
  occurrenceCount: integer('occurrence_count').notNull().default(1),
  adoptionRate: numeric('adoption_rate', { precision: 5, scale: 2 }), // percentage
  
  status: schemaStatusEnum('status').notNull().default('detected'),
  validatedBy: uuid('validated_by').references(() => users.id),
  validatedAt: timestamp('validated_at'),
  integratedAt: timestamp('integrated_at'),
  
  metadata: jsonb('metadata').$type<{
    sampleCaseIds?: string[];
    attributeDataType?: string;
    suggestedIndexes?: string[];
    relatedAttributes?: string[];
  }>(),
}, (table) => ({
  entityTypeIdx: index('idx_schema_evolution_entity_type').on(table.entityType),
  statusIdx: index('idx_schema_evolution_status').on(table.status),
  occurrenceCountIdx: index('idx_schema_evolution_occurrence').on(table.occurrenceCount),
  firstSeenIdx: index('idx_schema_evolution_first_seen').on(table.firstSeenAt),
}));
```

**SQL Migration:**

```sql
CREATE TYPE entity_type AS ENUM ('asset_type', 'asset_attribute', 'damage_type');
CREATE TYPE schema_status AS ENUM ('detected', 'validated', 'integrated');

CREATE TABLE schema_evolution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type entity_type NOT NULL,
  entity_name VARCHAR(100) NOT NULL,
  detected_value VARCHAR(255) NOT NULL,
  
  first_seen_at TIMESTAMP NOT NULL DEFAULT NOW(),
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  adoption_rate NUMERIC(5, 2),
  
  status schema_status NOT NULL DEFAULT 'detected',
  validated_by UUID REFERENCES users(id),
  validated_at TIMESTAMP,
  integrated_at TIMESTAMP,
  
  metadata JSONB,
  UNIQUE(entity_type, entity_name, detected_value)
);

CREATE INDEX idx_schema_evolution_entity_type ON schema_evolution_log(entity_type);
CREATE INDEX idx_schema_evolution_status ON schema_evolution_log(status);
CREATE INDEX idx_schema_evolution_occurrence ON schema_evolution_log(occurrence_count DESC);
CREATE INDEX idx_schema_evolution_first_seen ON schema_evolution_log(first_seen_at DESC);
```

### 3.9 ML Training Datasets

Tracks exported datasets for machine learning model training.

**Drizzle ORM Schema:**

```typescript
export const datasetTypeEnum = pgEnum('dataset_type', [
  'price_prediction',
  'recommendation',
  'fraud_detection',
  'vendor_segmentation'
]);
export const exportFormatEnum = pgEnum('export_format', ['csv', 'json', 'parquet']);

export const mlTrainingDatasets = pgTable('ml_training_datasets', {
  id: uuid('id').primaryKey().defaultRandom(),
  datasetName: varchar('dataset_name', { length: 255 }).notNull(),
  datasetType: datasetTypeEnum('dataset_type').notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  
  recordCount: integer('record_count').notNull(),
  featureCount: integer('feature_count').notNull(),
  targetVariable: varchar('target_variable', { length: 100 }),
  
  dateRange: jsonb('date_range').$type<{
    start: string;
    end: string;
  }>().notNull(),
  
  exportFormat: exportFormatEnum('export_format').notNull(),
  filePath: varchar('file_path', { length: 500 }),
  fileUrl: varchar('file_url', { length: 500 }),
  fileSize: bigint('file_size', { mode: 'number' }), // bytes
  
  generatedBy: uuid('generated_by')
    .notNull()
    .references(() => users.id),
  generatedAt: timestamp('generated_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
  
  metadata: jsonb('metadata').$type<{
    schemaDescription?: string;
    featureNames?: string[];
    splitRatio?: { train: number; validation: number; test: number };
    anonymized?: boolean;
  }>(),
}, (table) => ({
  datasetTypeIdx: index('idx_ml_datasets_type').on(table.datasetType),
  generatedAtIdx: index('idx_ml_datasets_generated_at').on(table.generatedAt),
  expiresAtIdx: index('idx_ml_datasets_expires_at').on(table.expiresAt),
}));
```

**SQL Migration:**

```sql
CREATE TYPE dataset_type AS ENUM ('price_prediction', 'recommendation', 'fraud_detection', 'vendor_segmentation');
CREATE TYPE export_format AS ENUM ('csv', 'json', 'parquet');

CREATE TABLE ml_training_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_name VARCHAR(255) NOT NULL,
  dataset_type dataset_type NOT NULL,
  version VARCHAR(50) NOT NULL,
  
  record_count INTEGER NOT NULL,
  feature_count INTEGER NOT NULL,
  target_variable VARCHAR(100),
  
  date_range JSONB NOT NULL,
  export_format export_format NOT NULL,
  file_path VARCHAR(500),
  file_url VARCHAR(500),
  file_size BIGINT,
  
  generated_by UUID NOT NULL REFERENCES users(id),
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  metadata JSONB
);

CREATE INDEX idx_ml_datasets_type ON ml_training_datasets(dataset_type);
CREATE INDEX idx_ml_datasets_generated_at ON ml_training_datasets(generated_at DESC);
CREATE INDEX idx_ml_datasets_expires_at ON ml_training_datasets(expires_at);
```

### 3.10 Feature Vectors

Stores pre-computed feature vectors for ML model inference.

**Drizzle ORM Schema:**

```typescript
export const featureEntityTypeEnum = pgEnum('feature_entity_type', ['auction', 'vendor']);

export const featureVectors = pgTable('feature_vectors', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: featureEntityTypeEnum('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  
  featureVector: jsonb('feature_vector').notNull(), // or use vector type if pgvector extension
  featureVersion: varchar('feature_version', { length: 50 }).notNull(),
  
  computedAt: timestamp('computed_at').notNull().defaultNow(),
  
  metadata: jsonb('metadata').$type<{
    featureNames?: string[];
    normalizationParams?: Record<string, { min: number; max: number }>;
    encodingMappings?: Record<string, Record<string, number>>;
  }>(),
}, (table) => ({
  entityTypeIdIdx: index('idx_feature_vectors_entity').on(table.entityType, table.entityId),
  featureVersionIdx: index('idx_feature_vectors_version').on(table.featureVersion),
  computedAtIdx: index('idx_feature_vectors_computed_at').on(table.computedAt),
}));
```

**SQL Migration:**

```sql
CREATE TYPE feature_entity_type AS ENUM ('auction', 'vendor');

CREATE TABLE feature_vectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type feature_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  
  feature_vector JSONB NOT NULL,
  feature_version VARCHAR(50) NOT NULL,
  
  computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB,
  
  UNIQUE(entity_type, entity_id, feature_version)
);

CREATE INDEX idx_feature_vectors_entity ON feature_vectors(entity_type, entity_id);
CREATE INDEX idx_feature_vectors_version ON feature_vectors(feature_version);
CREATE INDEX idx_feature_vectors_computed_at ON feature_vectors(computed_at DESC);
```

### 3.11 Analytics Rollups

Pre-computed analytics aggregations at multiple time granularities.

**Drizzle ORM Schema:**

```typescript
export const rollupTypeEnum = pgEnum('rollup_type', ['hourly', 'daily', 'weekly', 'monthly']);

export const analyticsRollups = pgTable('analytics_rollups', {
  id: uuid('id').primaryKey().defaultRandom(),
  rollupType: rollupTypeEnum('rollup_type').notNull(),
  rollupPeriod: timestamp('rollup_period').notNull(),
  assetType: assetTypeEnum('asset_type'),
  
  metrics: jsonb('metrics').$type<{
    totalAuctions?: number;
    totalBids?: number;
    avgBidAmount?: number;
    avgFinalPrice?: number;
    uniqueVendors?: number;
    activeVendors?: number;
    totalRevenue?: number;
    newVendors?: number;
    avgSessionDuration?: number;
    bounceRate?: number;
    conversionRate?: number;
    topSellingMake?: string;
    topSellingModel?: string;
    topSellingAssets?: Array<{ make: string; model: string; count: number }>;
    marketTrends?: { priceMovement: number; volumeChange: number };
  }>().notNull(),
  
  dimensionBreakdown: jsonb('dimension_breakdown').$type<{
    byAssetType?: Record<string, any>;
    byDamageSeverity?: Record<string, any>;
    byPriceRange?: Record<string, any>;
    byRegion?: Record<string, any>;
    byVendorSegment?: Record<string, any>;
  }>(),
  
  recordCount: integer('record_count').notNull(),
  computedAt: timestamp('computed_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
}, (table) => ({
  rollupTypeIdx: index('idx_rollups_type').on(table.rollupType),
  rollupPeriodIdx: index('idx_rollups_period').on(table.rollupPeriod),
  assetTypeIdx: index('idx_rollups_asset_type').on(table.assetType),
  computedAtIdx: index('idx_rollups_computed_at').on(table.computedAt),
}));
```

**SQL Migration:**

```sql
CREATE TYPE rollup_type AS ENUM ('hourly', 'daily', 'weekly', 'monthly');

CREATE TABLE analytics_rollups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rollup_type rollup_type NOT NULL,
  rollup_period TIMESTAMP NOT NULL,
  asset_type asset_type,
  
  metrics JSONB NOT NULL,
  dimension_breakdown JSONB,
  
  record_count INTEGER NOT NULL,
  computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  UNIQUE(rollup_type, rollup_period, asset_type)
);

CREATE INDEX idx_rollups_type ON analytics_rollups(rollup_type);
CREATE INDEX idx_rollups_period ON analytics_rollups(rollup_period DESC);
CREATE INDEX idx_rollups_asset_type ON analytics_rollups(asset_type);
CREATE INDEX idx_rollups_computed_at ON analytics_rollups(computed_at DESC);
```


### 3.12 Prediction Logs

Comprehensive logging of all prediction requests for ML training.

**Drizzle ORM Schema:**

```typescript
export const predictionLogs = pgTable('prediction_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id').references(() => vendors.id, { onDelete: 'set null' }),
  
  requestTimestamp: timestamp('request_timestamp').notNull().defaultNow(),
  responseTime: integer('response_time').notNull(), // milliseconds
  
  predictedPrice: numeric('predicted_price', { precision: 12, scale: 2 }).notNull(),
  lowerBound: numeric('lower_bound', { precision: 12, scale: 2 }).notNull(),
  upperBound: numeric('upper_bound', { precision: 12, scale: 2 }).notNull(),
  confidenceScore: numeric('confidence_score', { precision: 5, scale: 4 }).notNull(),
  
  algorithmVersion: varchar('algorithm_version', { length: 50 }).notNull(),
  fallbackMethod: varchar('fallback_method', { length: 50 }),
  similarAuctionCount: integer('similar_auction_count'),
  
  contributingFactors: jsonb('contributing_factors').$type<{
    colorMatch?: boolean;
    trimMatch?: boolean;
    highDemandAsset?: boolean;
    peakHourAuction?: boolean;
    regionalPremium?: number;
    marketAdjustment?: number;
  }>(),
  
  deviceType: varchar('device_type', { length: 50 }),
  sessionId: varchar('session_id', { length: 100 }),
}, (table) => ({
  auctionIdIdx: index('idx_prediction_logs_auction').on(table.auctionId),
  vendorIdIdx: index('idx_prediction_logs_vendor').on(table.vendorId),
  requestTimestampIdx: index('idx_prediction_logs_timestamp').on(table.requestTimestamp),
  responseTimeIdx: index('idx_prediction_logs_response_time').on(table.responseTime),
}));
```

**SQL Migration:**

```sql
CREATE TABLE prediction_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  
  request_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  response_time INTEGER NOT NULL,
  
  predicted_price NUMERIC(12, 2) NOT NULL,
  lower_bound NUMERIC(12, 2) NOT NULL,
  upper_bound NUMERIC(12, 2) NOT NULL,
  confidence_score NUMERIC(5, 4) NOT NULL,
  
  algorithm_version VARCHAR(50) NOT NULL,
  fallback_method VARCHAR(50),
  similar_auction_count INTEGER,
  
  contributing_factors JSONB,
  device_type VARCHAR(50),
  session_id VARCHAR(100)
);

CREATE INDEX idx_prediction_logs_auction ON prediction_logs(auction_id);
CREATE INDEX idx_prediction_logs_vendor ON prediction_logs(vendor_id);
CREATE INDEX idx_prediction_logs_timestamp ON prediction_logs(request_timestamp DESC);
CREATE INDEX idx_prediction_logs_response_time ON prediction_logs(response_time);

-- Partition by month
CREATE TABLE prediction_logs_2025_01 PARTITION OF prediction_logs
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### 3.13 Recommendation Logs

Comprehensive logging of all recommendation requests.

**Drizzle ORM Schema:**

```typescript
export const recommendationLogs = pgTable('recommendation_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  
  requestTimestamp: timestamp('request_timestamp').notNull().defaultNow(),
  responseTime: integer('response_time').notNull(), // milliseconds
  
  recommendationCount: integer('recommendation_count').notNull(),
  topMatchScore: numeric('top_match_score', { precision: 5, scale: 2 }),
  avgMatchScore: numeric('avg_match_score', { precision: 5, scale: 2 }),
  
  algorithmVersion: varchar('algorithm_version', { length: 50 }).notNull(),
  vendorSegment: varchar('vendor_segment', { length: 50 }),
  
  sessionId: varchar('session_id', { length: 100 }),
  deviceType: varchar('device_type', { length: 50 }),
}, (table) => ({
  vendorIdIdx: index('idx_recommendation_logs_vendor').on(table.vendorId),
  requestTimestampIdx: index('idx_recommendation_logs_timestamp').on(table.requestTimestamp),
  responseTimeIdx: index('idx_recommendation_logs_response_time').on(table.responseTime),
}));
```

**SQL Migration:**

```sql
CREATE TABLE recommendation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  
  request_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  response_time INTEGER NOT NULL,
  
  recommendation_count INTEGER NOT NULL,
  top_match_score NUMERIC(5, 2),
  avg_match_score NUMERIC(5, 2),
  
  algorithm_version VARCHAR(50) NOT NULL,
  vendor_segment VARCHAR(50),
  
  session_id VARCHAR(100),
  device_type VARCHAR(50)
);

CREATE INDEX idx_recommendation_logs_vendor ON recommendation_logs(vendor_id);
CREATE INDEX idx_recommendation_logs_timestamp ON recommendation_logs(request_timestamp DESC);
CREATE INDEX idx_recommendation_logs_response_time ON recommendation_logs(response_time);
```

### 3.14 Fraud Detection Logs

Logs all fraud detection analyses for audit and improvement.

**Drizzle ORM Schema:**

```typescript
export const fraudDetectionLogs = pgTable('fraud_detection_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'vendor', 'case', 'auction'
  entityId: uuid('entity_id').notNull(),
  
  analysisTimestamp: timestamp('analysis_timestamp').notNull().defaultNow(),
  riskScore: integer('risk_score').notNull(), // 0-100
  
  flagReasons: jsonb('flag_reasons').$type<string[]>().notNull(),
  detectionMethod: varchar('detection_method', { length: 100 }).notNull(),
  
  falsePositive: boolean('false_positive'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  
  metadata: jsonb('metadata').$type<{
    bidVelocity?: number;
    ipAddressChanges?: number;
    photoHashSimilarity?: number;
    collusionScore?: number;
  }>(),
}, (table) => ({
  entityTypeIdIdx: index('idx_fraud_logs_entity').on(table.entityType, table.entityId),
  analysisTimestampIdx: index('idx_fraud_logs_timestamp').on(table.analysisTimestamp),
  riskScoreIdx: index('idx_fraud_logs_risk_score').on(table.riskScore),
}));
```

**SQL Migration:**

```sql
CREATE TABLE fraud_detection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  
  analysis_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  
  flag_reasons JSONB NOT NULL,
  detection_method VARCHAR(100) NOT NULL,
  
  false_positive BOOLEAN,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  
  metadata JSONB
);

CREATE INDEX idx_fraud_logs_entity ON fraud_detection_logs(entity_type, entity_id);
CREATE INDEX idx_fraud_logs_timestamp ON fraud_detection_logs(analysis_timestamp DESC);
CREATE INDEX idx_fraud_logs_risk_score ON fraud_detection_logs(risk_score DESC);
```

### 3.15 Algorithm Config History

Tracks all changes to algorithm configuration parameters.

**Drizzle ORM Schema:**

```typescript
export const algorithmConfigHistory = pgTable('algorithm_config_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  configKey: varchar('config_key', { length: 100 }).notNull(),
  
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value').notNull(),
  
  changedBy: uuid('changed_by')
    .notNull()
    .references(() => users.id),
  changedAt: timestamp('changed_at').notNull().defaultNow(),
  
  reason: text('reason'),
  impactMetrics: jsonb('impact_metrics').$type<{
    beforeAccuracy?: number;
    afterAccuracy?: number;
    beforeCTR?: number;
    afterCTR?: number;
  }>(),
}, (table) => ({
  configKeyIdx: index('idx_config_history_key').on(table.configKey),
  changedAtIdx: index('idx_config_history_changed_at').on(table.changedAt),
  changedByIdx: index('idx_config_history_changed_by').on(table.changedBy),
}));
```

**SQL Migration:**

```sql
CREATE TABLE algorithm_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key VARCHAR(100) NOT NULL,
  
  old_value JSONB,
  new_value JSONB NOT NULL,
  
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  reason TEXT,
  impact_metrics JSONB
);

CREATE INDEX idx_config_history_key ON algorithm_config_history(config_key);
CREATE INDEX idx_config_history_changed_at ON algorithm_config_history(changed_at DESC);
CREATE INDEX idx_config_history_changed_by ON algorithm_config_history(changed_by);
```

## 4. Enhanced Algorithm Designs

### 4.1 Enhanced Prediction Algorithm with Granular Data

The enhanced prediction algorithm incorporates granular asset attributes (color, trim, mileage, temporal patterns, geographic patterns) to improve accuracy.

**Enhanced Similarity Matching:**

```sql
WITH enhanced_similar_auctions AS (
  SELECT 
    a.id AS auction_id,
    a.current_bid AS final_price,
    sc.asset_details,
    sc.ai_assessment,
    sc.damage_severity,
    sc.market_value,
    sc.vehicle_mileage,
    a.end_time,
    COUNT(b.id) AS bid_count,
    -- Enhanced similarity score with granular attributes
    (
      -- Base matching (make/model/year): 100 points
      CASE 
        WHEN sc.asset_details->>'make' = $target_make 
         AND sc.asset_details->>'model' = $target_model THEN 100
        WHEN sc.asset_details->>'make' = $target_make THEN 50
        ELSE 0
      END +
      
      -- Year proximity: 20 points
      CASE 
        WHEN (sc.asset_details->>'year')::int = $target_year THEN 20
        WHEN ABS((sc.asset_details->>'year')::int - $target_year) = 1 THEN 15
        WHEN ABS((sc.asset_details->>'year')::int - $target_year) = 2 THEN 10
        ELSE 0
      END +
      
      -- NEW: Color matching: 10 points
      CASE 
        WHEN sc.ai_assessment->'itemDetails'->>'color' = $target_color THEN 10
        ELSE 0
      END +
      
      -- NEW: Trim level matching: 15 points
      CASE 
        WHEN sc.ai_assessment->'itemDetails'->>'trim' = $target_trim THEN 15
        WHEN sc.ai_assessment->'itemDetails'->>'trim' IS NOT NULL 
         AND $target_trim IS NOT NULL THEN 5  -- Partial credit for having trim data
        ELSE 0
      END +
      
      -- NEW: Mileage range matching: 20 points
      CASE 
        WHEN ABS(sc.vehicle_mileage - $target_mileage) < 10000 THEN 20
        WHEN ABS(sc.vehicle_mileage - $target_mileage) < 25000 THEN 15
        WHEN ABS(sc.vehicle_mileage - $target_mileage) < 50000 THEN 10
        ELSE 0
      END +
      
      -- NEW: Body style matching: 15 points
      CASE 
        WHEN sc.ai_assessment->'itemDetails'->>'bodyStyle' = $target_body_style THEN 15
        ELSE 0
      END +
      
      -- Damage severity: 30 points
      CASE 
        WHEN sc.damage_severity = $target_damage THEN 30
        WHEN (
          (sc.damage_severity = 'minor' AND $target_damage = 'moderate') OR
          (sc.damage_severity = 'moderate' AND $target_damage IN ('minor', 'severe')) OR
          (sc.damage_severity = 'severe' AND $target_damage = 'moderate')
        ) THEN 15
        ELSE 0
      END +
      
      -- Market value proximity: 10 points
      CASE 
        WHEN ABS(sc.market_value - $target_market_value) / $target_market_value < 0.2 THEN 10
        ELSE 0
      END
    ) AS similarity_score,
    
    -- Time decay weight
    EXP(-EXTRACT(EPOCH FROM (NOW() - a.end_time)) / (6 * 30 * 24 * 60 * 60)) AS time_weight,
    
    -- NEW: Attribute completeness score
    (
      CASE WHEN sc.ai_assessment->'itemDetails'->>'color' IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN sc.ai_assessment->'itemDetails'->>'trim' IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN sc.vehicle_mileage IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN sc.ai_assessment->'itemDetails'->>'bodyStyle' IS NOT NULL THEN 1 ELSE 0 END
    ) AS attribute_completeness
  FROM auctions a
  JOIN salvage_cases sc ON a.case_id = sc.id
  LEFT JOIN bids b ON b.auction_id = a.id
  WHERE 
    a.status = 'closed'
    AND a.current_bid IS NOT NULL
    AND sc.asset_type = $target_asset_type
    AND a.end_time > NOW() - INTERVAL '12 months'
    AND (
      sc.asset_details->>'make' = $target_make
      OR sc.damage_severity = $target_damage
    )
  GROUP BY a.id, sc.id
  HAVING similarity_score >= 60
  ORDER BY similarity_score DESC, attribute_completeness DESC, time_weight DESC
  LIMIT 50
)
SELECT * FROM enhanced_similar_auctions;
```

**Enhanced Market Adjustments:**

```typescript
// Pseudocode for enhanced market adjustments
interface EnhancedMarketAdjustments {
  baseAdjustment: number;
  temporalAdjustment: number;
  geographicAdjustment: number;
  attributeAdjustment: number;
  totalAdjustment: number;
}

async function calculateEnhancedMarketAdjustments(
  auction: Auction,
  targetAttributes: AssetAttributes
): Promise<EnhancedMarketAdjustments> {
  // Base market adjustment (competition, trend, seasonal)
  const baseAdjustment = await calculateBaseMarketAdjustment(auction);
  
  // NEW: Temporal adjustment based on auction end time
  const temporalData = await db.query(`
    SELECT peak_activity_score, avg_final_price
    FROM temporal_patterns_analytics
    WHERE pattern_type = 'hourly'
      AND time_segment = EXTRACT(HOUR FROM $1)::text
      AND asset_type = $2
  `, [auction.endTime, auction.assetType]);
  
  const temporalAdjustment = temporalData.peakActivityScore > 80 ? 1.08 : 
                             temporalData.peakActivityScore < 30 ? 0.92 : 1.0;
  
  // NEW: Geographic adjustment based on region
  const geoData = await db.query(`
    SELECT price_variance
    FROM geographic_patterns_analytics
    WHERE region = $1
      AND asset_type = $2
  `, [auction.region, auction.assetType]);
  
  const geographicAdjustment = 1 + (geoData.priceVariance / 100);
  
  // NEW: Attribute adjustment based on color/trim performance
  const attrData = await db.query(`
    SELECT attribute_name, attribute_value, avg_final_price
    FROM attribute_performance_analytics
    WHERE asset_type = $1
      AND ((attribute_name = 'color' AND attribute_value = $2)
        OR (attribute_name = 'trim' AND attribute_value = $3))
  `, [auction.assetType, targetAttributes.color, targetAttributes.trim]);
  
  let attributeAdjustment = 1.0;
  if (attrData.color && attrData.color.popularityRank <= 3) {
    attributeAdjustment *= 1.05; // 5% boost for popular colors
  }
  if (attrData.trim && attrData.trim.avgFinalPrice > marketAverage) {
    attributeAdjustment *= 1.07; // 7% boost for premium trims
  }
  
  const totalAdjustment = baseAdjustment * temporalAdjustment * 
                          geographicAdjustment * attributeAdjustment;
  
  return {
    baseAdjustment,
    temporalAdjustment,
    geographicAdjustment,
    attributeAdjustment,
    totalAdjustment: Math.max(0.85, Math.min(1.20, totalAdjustment)) // Clamp to ±20%
  };
}
```

**Enhanced Confidence Score Calculation:**

```typescript
interface EnhancedConfidenceFactors {
  baseFactor: number;
  sampleSizeFactor: number;
  recencyFactor: number;
  varianceFactor: number;
  attributeCompletenessFactor: number;
  demandFactor: number;
  finalScore: number;
}

function calculateEnhancedConfidenceScore(
  sampleSize: number,
  avgTimeWeight: number,
  priceVariance: number,
  avgPrice: number,
  attributeCompleteness: number, // 0-4 (number of granular attributes matched)
  sellThroughRate: number // from asset_performance_analytics
): EnhancedConfidenceFactors {
  const baseFactor = 0.85;
  const sampleSizeFactor = Math.min(1.0, sampleSize / 10);
  const recencyFactor = avgTimeWeight;
  const varianceFactor = 1 / (1 + (priceVariance / avgPrice));
  
  // NEW: Attribute completeness factor
  const attributeCompletenessFactor = 0.85 + (attributeCompleteness / 4) * 0.15; // 0.85 to 1.0
  
  // NEW: Demand factor based on sell-through rate
  const demandFactor = sellThroughRate > 0.75 ? 1.10 : 
                       sellThroughRate > 0.50 ? 1.05 :
                       sellThroughRate < 0.30 ? 0.90 : 1.0;
  
  const finalScore = Math.min(1.0,
    baseFactor * sampleSizeFactor * recencyFactor * varianceFactor * 
    attributeCompletenessFactor * demandFactor
  );
  
  return {
    baseFactor,
    sampleSizeFactor,
    recencyFactor,
    varianceFactor,
    attributeCompletenessFactor,
    demandFactor,
    finalScore
  };
}
```

