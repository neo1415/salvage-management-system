import { pgTable, uuid, varchar, decimal, integer, timestamp, jsonb, date, boolean, index, unique } from 'drizzle-orm/pg-core';

/**
 * Search Analytics Schema
 * 
 * Comprehensive analytics tables for the Universal AI Internet Search System.
 * These tables support real-time dashboards, performance monitoring, cost tracking,
 * and business intelligence for search operations.
 * 
 * Integration:
 * - Works with existing internet_search_logs for detailed tracking
 * - Supports dashboard APIs and real-time monitoring
 * - Enables proactive cost management and optimization
 */

/**
 * Search Performance Metrics
 * 
 * Real-time tracking of search performance for monitoring and alerting.
 * Aggregates performance data by time periods (minute, hour, day).
 */
export const searchPerformanceMetrics = pgTable('search_performance_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Time period tracking
  metricTimestamp: timestamp('metric_timestamp').notNull().defaultNow(),
  periodType: varchar('period_type', { length: 10 }).notNull(), // 'minute', 'hour', 'day'
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  
  // Performance metrics
  totalSearches: integer('total_searches').notNull().default(0),
  successfulSearches: integer('successful_searches').notNull().default(0),
  failedSearches: integer('failed_searches').notNull().default(0),
  timeoutSearches: integer('timeout_searches').notNull().default(0),
  avgResponseTimeMs: decimal('avg_response_time_ms', { precision: 8, scale: 2 }).default('0'),
  p95ResponseTimeMs: decimal('p95_response_time_ms', { precision: 8, scale: 2 }).default('0'),
  p99ResponseTimeMs: decimal('p99_response_time_ms', { precision: 8, scale: 2 }).default('0'),
  
  // Cache performance
  cacheHits: integer('cache_hits').notNull().default(0),
  cacheMisses: integer('cache_misses').notNull().default(0),
  cacheHitRate: decimal('cache_hit_rate', { precision: 5, scale: 2 }).default('0'), // 0-100%
  
  // Data source breakdown
  internetSearches: integer('internet_searches').notNull().default(0),
  databaseFallbacks: integer('database_fallbacks').notNull().default(0),
  cacheResponses: integer('cache_responses').notNull().default(0),
  
  // Error tracking
  apiErrors: integer('api_errors').notNull().default(0),
  rateLimitErrors: integer('rate_limit_errors').notNull().default(0),
  parsingErrors: integer('parsing_errors').notNull().default(0),
  validationErrors: integer('validation_errors').notNull().default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  timestampIdx: index('idx_search_perf_timestamp').on(table.metricTimestamp),
  periodIdx: index('idx_search_perf_period').on(table.periodType, table.periodStart),
  createdIdx: index('idx_search_perf_created').on(table.createdAt),
}));
/**
 * Search Usage Analytics
 * 
 * Track user behavior patterns and search usage for business intelligence.
 * Provides insights into search patterns, popular items, and user behavior.
 */
export const searchUsageAnalytics = pgTable('search_usage_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Time tracking
  analyticsDate: date('analytics_date').notNull(),
  hourOfDay: integer('hour_of_day'), // 0-23 for hourly analytics, null for daily
  
  // Item type analytics
  vehicleSearches: integer('vehicle_searches').default(0),
  electronicsSearches: integer('electronics_searches').default(0),
  applianceSearches: integer('appliance_searches').default(0),
  propertySearches: integer('property_searches').default(0),
  jewelrySearches: integer('jewelry_searches').default(0),
  furnitureSearches: integer('furniture_searches').default(0),
  machinerySearches: integer('machinery_searches').default(0),
  otherSearches: integer('other_searches').default(0),
  
  // Search pattern analytics
  uniqueQueries: integer('unique_queries').default(0),
  repeatQueries: integer('repeat_queries').default(0),
  avgQueryLength: decimal('avg_query_length', { precision: 5, scale: 2 }).default('0'),
  mostCommonBrands: jsonb('most_common_brands').default('[]'),
  mostCommonModels: jsonb('most_common_models').default('[]'),
  
  // User behavior
  peakSearchHour: integer('peak_search_hour'), // Hour with most searches
  avgSearchesPerSession: decimal('avg_searches_per_session', { precision: 5, scale: 2 }).default('0'),
  searchAbandonmentRate: decimal('search_abandonment_rate', { precision: 5, scale: 2 }).default('0'),
  
  // Geographic patterns
  topLocations: jsonb('top_locations').default('[]'),
  locationSearchPatterns: jsonb('location_search_patterns').default('{}'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  dateIdx: index('idx_search_usage_date').on(table.analyticsDate),
  hourIdx: index('idx_search_usage_hour').on(table.analyticsDate, table.hourOfDay),
  brandsIdx: index('idx_search_usage_brands').on(table.mostCommonBrands).using('gin'),
  locationsIdx: index('idx_search_usage_locations').on(table.topLocations).using('gin'),
  uniqueDateHour: unique('unique_usage_analytics_date').on(table.analyticsDate, table.hourOfDay),
}));
/**
 * Search Quality Metrics
 * 
 * Track search result quality, confidence scores, and accuracy metrics.
 * Essential for monitoring and improving search result quality.
 */
export const searchQualityMetrics = pgTable('search_quality_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Time tracking
  qualityDate: date('quality_date').notNull(),
  itemType: varchar('item_type', { length: 20 }).notNull(),
  
  // Quality metrics
  totalSearches: integer('total_searches').notNull().default(0),
  highConfidenceSearches: integer('high_confidence_searches').default(0), // confidence > 80%
  mediumConfidenceSearches: integer('medium_confidence_searches').default(0), // confidence 50-80%
  lowConfidenceSearches: integer('low_confidence_searches').default(0), // confidence < 50%
  avgConfidenceScore: decimal('avg_confidence_score', { precision: 5, scale: 2 }).default('0'),
  
  // Result quality
  avgResultsPerSearch: decimal('avg_results_per_search', { precision: 5, scale: 2 }).default('0'),
  avgPricesFound: decimal('avg_prices_found', { precision: 5, scale: 2 }).default('0'),
  priceExtractionSuccessRate: decimal('price_extraction_success_rate', { precision: 5, scale: 2 }).default('0'),
  
  // Source quality
  reliableSourcesCount: integer('reliable_sources_count').default(0),
  unknownSourcesCount: integer('unknown_sources_count').default(0),
  sourceDiversityScore: decimal('source_diversity_score', { precision: 5, scale: 2 }).default('0'),
  
  // Accuracy tracking
  userFeedbackCount: integer('user_feedback_count').default(0),
  positiveFeedback: integer('positive_feedback').default(0),
  negativeFeedback: integer('negative_feedback').default(0),
  accuracyScore: decimal('accuracy_score', { precision: 5, scale: 2 }).default('0'),
  
  // Price validation
  outlierPricesFiltered: integer('outlier_prices_filtered').default(0),
  priceValidationFailures: integer('price_validation_failures').default(0),
  avgPriceVariance: decimal('avg_price_variance', { precision: 8, scale: 2 }).default('0'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  dateIdx: index('idx_search_quality_date').on(table.qualityDate),
  typeIdx: index('idx_search_quality_type').on(table.itemType),
  confidenceIdx: index('idx_search_quality_confidence').on(table.avgConfidenceScore),
  accuracyIdx: index('idx_search_quality_accuracy').on(table.accuracyScore),
  uniqueDateType: unique('unique_quality_metrics_date_type').on(table.qualityDate, table.itemType),
}));
/**
 * API Cost Analytics
 * 
 * Detailed tracking of API usage, costs, and rate limiting for budget management.
 * Critical for staying within Serper.dev free tier limits and cost optimization.
 */
export const apiCostAnalytics = pgTable('api_cost_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Time tracking
  costDate: date('cost_date').notNull(),
  apiProvider: varchar('api_provider', { length: 20 }).notNull().default('serper'),
  
  // Usage metrics
  totalRequests: integer('total_requests').notNull().default(0),
  successfulRequests: integer('successful_requests').notNull().default(0),
  failedRequests: integer('failed_requests').notNull().default(0),
  rateLimitedRequests: integer('rate_limited_requests').notNull().default(0),
  
  // Cost tracking
  totalCostUsd: decimal('total_cost_usd', { precision: 10, scale: 4 }).default('0'),
  avgCostPerRequest: decimal('avg_cost_per_request', { precision: 8, scale: 4 }).default('0'),
  projectedMonthlyCost: decimal('projected_monthly_cost', { precision: 10, scale: 4 }).default('0'),
  
  // Quota management
  quotaUsed: integer('quota_used').default(0),
  quotaLimit: integer('quota_limit').default(2500), // Serper.dev free tier
  quotaUtilizationRate: decimal('quota_utilization_rate', { precision: 5, scale: 2 }).default('0'),
  daysUntilQuotaReset: integer('days_until_quota_reset').default(30),
  
  // Efficiency metrics
  costPerSuccessfulSearch: decimal('cost_per_successful_search', { precision: 8, scale: 4 }).default('0'),
  costSavingsFromCache: decimal('cost_savings_from_cache', { precision: 10, scale: 4 }).default('0'),
  cacheHitCostAvoidance: integer('cache_hit_cost_avoidance').default(0),
  
  // Budget alerts
  budgetAlertThreshold: decimal('budget_alert_threshold', { precision: 5, scale: 2 }).default('80'),
  budgetAlertTriggered: boolean('budget_alert_triggered').default(false),
  projectedOverageAmount: decimal('projected_overage_amount', { precision: 10, scale: 4 }).default('0'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  dateIdx: index('idx_api_cost_date').on(table.costDate),
  providerIdx: index('idx_api_cost_provider').on(table.apiProvider),
  quotaIdx: index('idx_api_cost_quota').on(table.quotaUtilizationRate),
  budgetAlertIdx: index('idx_api_cost_budget_alert').on(table.budgetAlertTriggered, table.costDate),
  uniqueDateProvider: unique('unique_cost_analytics_date_provider').on(table.costDate, table.apiProvider),
}));
/**
 * Search Trend Analytics
 * 
 * Business intelligence data for market trends and popular items.
 * Provides insights for business decisions and market analysis.
 */
export const searchTrendAnalytics = pgTable('search_trend_analytics', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Time tracking
  trendDate: date('trend_date').notNull(),
  trendPeriod: varchar('trend_period', { length: 10 }).notNull(), // 'daily', 'weekly', 'monthly'
  
  // Trending items
  trendingVehicles: jsonb('trending_vehicles').default('[]'), // [{make, model, search_count, avg_price}]
  trendingElectronics: jsonb('trending_electronics').default('[]'),
  trendingAppliances: jsonb('trending_appliances').default('[]'),
  trendingProperties: jsonb('trending_properties').default('[]'),
  
  // Market insights
  priceTrends: jsonb('price_trends').default('{}'), // {item_type: {trend: 'up/down/stable', change_pct: number}}
  popularConditions: jsonb('popular_conditions').default('{}'), // {condition: search_count}
  seasonalPatterns: jsonb('seasonal_patterns').default('{}'),
  
  // Search volume trends
  totalSearchVolume: integer('total_search_volume').default(0),
  searchVolumeChangePct: decimal('search_volume_change_pct', { precision: 5, scale: 2 }).default('0'),
  peakSearchCategories: jsonb('peak_search_categories').default('[]'),
  
  // Geographic trends
  regionalSearchPatterns: jsonb('regional_search_patterns').default('{}'),
  locationBasedPriceVariations: jsonb('location_based_price_variations').default('{}'),
  
  // Business metrics
  conversionRate: decimal('conversion_rate', { precision: 5, scale: 2 }).default('0'), // % of searches leading to case creation
  userEngagementScore: decimal('user_engagement_score', { precision: 5, scale: 2 }).default('0'),
  searchToActionTimeAvg: integer('search_to_action_time_avg').default(0), // seconds
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  dateIdx: index('idx_search_trend_date').on(table.trendDate),
  periodIdx: index('idx_search_trend_period').on(table.trendPeriod),
  vehiclesIdx: index('idx_search_trend_vehicles').on(table.trendingVehicles).using('gin'),
  electronicsIdx: index('idx_search_trend_electronics').on(table.trendingElectronics).using('gin'),
  priceTrendsIdx: index('idx_search_trend_price_trends').on(table.priceTrends).using('gin'),
  uniqueDatePeriod: unique('unique_trend_analytics_date_period').on(table.trendDate, table.trendPeriod),
}));

/**
 * Type definitions for analytics data structures
 */
export type SearchPerformanceMetric = typeof searchPerformanceMetrics.$inferSelect;
export type SearchUsageAnalytic = typeof searchUsageAnalytics.$inferSelect;
export type SearchQualityMetric = typeof searchQualityMetrics.$inferSelect;
export type ApiCostAnalytic = typeof apiCostAnalytics.$inferSelect;
export type SearchTrendAnalytic = typeof searchTrendAnalytics.$inferSelect;

export type NewSearchPerformanceMetric = typeof searchPerformanceMetrics.$inferInsert;
export type NewSearchUsageAnalytic = typeof searchUsageAnalytics.$inferInsert;
export type NewSearchQualityMetric = typeof searchQualityMetrics.$inferInsert;
export type NewApiCostAnalytic = typeof apiCostAnalytics.$inferInsert;
export type NewSearchTrendAnalytic = typeof searchTrendAnalytics.$inferInsert;