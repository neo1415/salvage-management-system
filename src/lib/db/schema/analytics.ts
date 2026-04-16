/**
 * AI-Powered Marketplace Intelligence - Analytics Schema
 * 
 * Analytics tables for asset performance, temporal patterns, geographic patterns,
 * vendor segments, session analytics, and conversion funnel tracking.
 * 
 * @module analytics
 */

import { 
  pgTable, 
  uuid, 
  numeric, 
  timestamp, 
  varchar, 
  jsonb, 
  index, 
  integer,
  date,
  point
} from 'drizzle-orm/pg-core';
import { assetTypeEnum } from './vendors';
import { damageSeverityEnum } from './cases';

// ============================================================================
// ASSET PERFORMANCE ANALYTICS TABLE
// ============================================================================

export const assetPerformanceAnalytics = pgTable('asset_performance_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetType: assetTypeEnum('asset_type').notNull(),
  make: varchar('make', { length: 100 }),
  model: varchar('model', { length: 100 }),
  year: integer('year'),
  damageSeverity: damageSeverityEnum('damage_severity'),
  // Performance metrics
  totalAuctions: integer('total_auctions').notNull().default(0),
  totalBids: integer('total_bids').notNull().default(0),
  avgBidsPerAuction: numeric('avg_bids_per_auction', { precision: 8, scale: 2 }),
  avgFinalPrice: numeric('avg_final_price', { precision: 12, scale: 2 }),
  avgSellThroughRate: numeric('avg_sell_through_rate', { precision: 5, scale: 4 }), // 0.0000 to 1.0000
  avgTimeToSell: integer('avg_time_to_sell'), // in hours
  demandScore: integer('demand_score').notNull().default(0), // 0-100
  // Date range
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  assetTypeIdx: index('idx_asset_perf_asset_type').on(table.assetType),
  makeModelIdx: index('idx_asset_perf_make_model').on(table.make, table.model),
  demandScoreIdx: index('idx_asset_perf_demand_score').on(table.demandScore),
  periodIdx: index('idx_asset_perf_period').on(table.periodStart, table.periodEnd),
}));

// ============================================================================
// ATTRIBUTE PERFORMANCE ANALYTICS TABLE
// ============================================================================

export const attributePerformanceAnalytics = pgTable('attribute_performance_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetType: assetTypeEnum('asset_type').notNull(),
  attributeType: varchar('attribute_type', { length: 50 }).notNull(), // 'color', 'trim', 'storage', etc.
  attributeValue: varchar('attribute_value', { length: 100 }).notNull(),
  // Performance metrics
  totalAuctions: integer('total_auctions').notNull().default(0),
  avgPricePremium: numeric('avg_price_premium', { precision: 12, scale: 2 }), // vs baseline
  avgBidCount: numeric('avg_bid_count', { precision: 8, scale: 2 }),
  popularityScore: integer('popularity_score').notNull().default(0), // 0-100
  // Date range
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  assetTypeIdx: index('idx_attr_perf_asset_type').on(table.assetType),
  attributeIdx: index('idx_attr_perf_attribute').on(table.attributeType, table.attributeValue),
  popularityIdx: index('idx_attr_perf_popularity').on(table.popularityScore),
  periodIdx: index('idx_attr_perf_period').on(table.periodStart, table.periodEnd),
}));

// ============================================================================
// TEMPORAL PATTERNS ANALYTICS TABLE
// ============================================================================

export const temporalPatternsAnalytics = pgTable('temporal_patterns_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetType: assetTypeEnum('asset_type'),
  hourOfDay: integer('hour_of_day'), // 0-23
  dayOfWeek: integer('day_of_week'), // 0-6 (Sunday-Saturday)
  monthOfYear: integer('month_of_year'), // 1-12
  // Activity metrics
  avgBidCount: numeric('avg_bid_count', { precision: 8, scale: 2 }),
  avgFinalPrice: numeric('avg_final_price', { precision: 12, scale: 2 }),
  avgVendorActivity: numeric('avg_vendor_activity', { precision: 8, scale: 2 }),
  peakActivityScore: integer('peak_activity_score').notNull().default(0), // 0-100
  // Date range
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  assetTypeIdx: index('idx_temporal_asset_type').on(table.assetType),
  hourIdx: index('idx_temporal_hour').on(table.hourOfDay),
  dayIdx: index('idx_temporal_day').on(table.dayOfWeek),
  monthIdx: index('idx_temporal_month').on(table.monthOfYear),
  peakScoreIdx: index('idx_temporal_peak_score').on(table.peakActivityScore),
  periodIdx: index('idx_temporal_period').on(table.periodStart, table.periodEnd),
}));

// ============================================================================
// GEOGRAPHIC PATTERNS ANALYTICS TABLE
// ============================================================================

export const geographicPatternsAnalytics = pgTable('geographic_patterns_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  region: varchar('region', { length: 100 }).notNull(), // State, city, or region name
  gpsCenter: point('gps_center'), // Center point of region
  assetType: assetTypeEnum('asset_type'),
  // Regional metrics
  totalAuctions: integer('total_auctions').notNull().default(0),
  avgFinalPrice: numeric('avg_final_price', { precision: 12, scale: 2 }),
  priceVariance: numeric('price_variance', { precision: 12, scale: 2 }),
  avgVendorCount: numeric('avg_vendor_count', { precision: 8, scale: 2 }),
  demandScore: integer('demand_score').notNull().default(0), // 0-100
  // Date range
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  regionIdx: index('idx_geo_region').on(table.region),
  assetTypeIdx: index('idx_geo_asset_type').on(table.assetType),
  demandScoreIdx: index('idx_geo_demand_score').on(table.demandScore),
  periodIdx: index('idx_geo_period').on(table.periodStart, table.periodEnd),
}));

// ============================================================================
// VENDOR SEGMENTS TABLE
// ============================================================================

export const vendorSegments = pgTable('vendor_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().unique(),
  // Segmentation
  priceSegment: varchar('price_segment', { length: 50 }), // 'bargain_hunter', 'value_seeker', 'premium_buyer'
  categorySegment: varchar('category_segment', { length: 50 }), // 'specialist', 'generalist'
  activitySegment: varchar('activity_segment', { length: 50 }), // 'active_bidder', 'regular_bidder', 'selective_bidder'
  // Behavioral metrics
  avgBidToValueRatio: numeric('avg_bid_to_value_ratio', { precision: 5, scale: 4 }),
  preferredAssetTypes: jsonb('preferred_asset_types').$type<string[]>(),
  preferredPriceRange: jsonb('preferred_price_range').$type<{ min: number; max: number }>(),
  bidsPerWeek: numeric('bids_per_week', { precision: 8, scale: 2 }),
  overallWinRate: numeric('overall_win_rate', { precision: 5, scale: 4 }),
  lastBidAt: timestamp('last_bid_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  vendorIdIdx: index('idx_vendor_segments_vendor_id').on(table.vendorId),
  segmentsIdx: index('idx_vendor_segments_all').on(table.priceSegment, table.categorySegment, table.activitySegment),
  activityIdx: index('idx_vendor_segments_activity').on(table.activitySegment),
}));

// ============================================================================
// SESSION ANALYTICS TABLE
// ============================================================================

export const sessionAnalytics = pgTable('session_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: varchar('session_id', { length: 100 }).notNull().unique(),
  vendorId: uuid('vendor_id'),
  // Session metrics
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  durationSeconds: integer('duration_seconds'),
  pagesViewed: integer('pages_viewed').notNull().default(0),
  auctionsViewed: integer('auctions_viewed').notNull().default(0),
  bidsPlaced: integer('bids_placed').notNull().default(0),
  // Engagement metrics
  bounceRate: numeric('bounce_rate', { precision: 5, scale: 4 }),
  avgTimePerPage: integer('avg_time_per_page'), // in seconds
  conversionRate: numeric('conversion_rate', { precision: 5, scale: 4 }),
  metadata: jsonb('metadata').$type<{
    deviceType?: string;
    referrer?: string;
    userAgent?: string;
  }>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  sessionIdIdx: index('idx_session_analytics_session_id').on(table.sessionId),
  vendorIdIdx: index('idx_session_analytics_vendor_id').on(table.vendorId),
  startTimeIdx: index('idx_session_analytics_start_time').on(table.startTime),
}));

// ============================================================================
// CONVERSION FUNNEL ANALYTICS TABLE
// ============================================================================

export const conversionFunnelAnalytics = pgTable('conversion_funnel_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetType: assetTypeEnum('asset_type'),
  // Funnel stages
  totalViews: integer('total_views').notNull().default(0),
  totalWatches: integer('total_watches').notNull().default(0),
  totalBids: integer('total_bids').notNull().default(0),
  totalWins: integer('total_wins').notNull().default(0),
  // Conversion rates
  viewToWatchRate: numeric('view_to_watch_rate', { precision: 5, scale: 4 }),
  watchToBidRate: numeric('watch_to_bid_rate', { precision: 5, scale: 4 }),
  bidToWinRate: numeric('bid_to_win_rate', { precision: 5, scale: 4 }),
  overallConversionRate: numeric('overall_conversion_rate', { precision: 5, scale: 4 }),
  // Date range
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  assetTypeIdx: index('idx_conversion_asset_type').on(table.assetType),
  periodIdx: index('idx_conversion_period').on(table.periodStart, table.periodEnd),
}));

// ============================================================================
// SCHEMA EVOLUTION LOG TABLE
// ============================================================================

export const schemaEvolutionLog = pgTable('schema_evolution_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  changeType: varchar('change_type', { length: 50 }).notNull(), // 'new_asset_type', 'new_attribute', 'schema_update'
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'asset_type', 'attribute', 'table'
  entityName: varchar('entity_name', { length: 100 }).notNull(),
  changeDetails: jsonb('change_details').$type<{
    oldValue?: any;
    newValue?: any;
    reason?: string;
    impact?: string;
  }>(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'approved', 'rejected', 'applied'
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  appliedAt: timestamp('applied_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  changeTypeIdx: index('idx_schema_evolution_change_type').on(table.changeType),
  statusIdx: index('idx_schema_evolution_status').on(table.status),
  createdAtIdx: index('idx_schema_evolution_created_at').on(table.createdAt),
}));
