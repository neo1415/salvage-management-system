import { pgTable, uuid, varchar, decimal, integer, timestamp, jsonb, text, boolean, index } from 'drizzle-orm/pg-core';

/**
 * Internet Search Analytics Schema
 * 
 * This schema supports the Universal AI Internet Search System by providing
 * persistent storage for search metrics, analytics, and performance tracking.
 * 
 * The system uses Redis for 24-hour caching but requires database storage for:
 * - Long-term analytics and reporting
 * - Search performance metrics
 * - API usage tracking
 * - Query optimization insights
 */

/**
 * Internet Search Logs
 * 
 * Tracks all internet search operations for analytics and debugging.
 * Similar to existing scrapingLogs but designed for Serper.dev API searches.
 */
export const internetSearchLogs = pgTable('internet_search_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Search identification
  searchHash: varchar('search_hash', { length: 64 }).notNull(), // Hash of search parameters
  query: text('query').notNull(), // The actual search query sent to Serper.dev
  
  // Item identification
  itemType: varchar('item_type', { length: 20 }).notNull(), // 'vehicle', 'electronics', 'appliance', etc.
  itemDetails: jsonb('item_details').notNull().$type<{
    type: 'vehicle' | 'electronics' | 'appliance' | 'property';
    // Vehicle fields
    make?: string;
    model?: string;
    year?: number;
    mileage?: number;
    condition?: string;
    // Electronics fields
    brand?: string;
    model?: string;
    storage?: string;
    condition?: string;
    // Universal fields
    category?: string;
    description?: string;
  }>(),
  
  // Search results
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'error', 'timeout', 'rate_limited'
  resultCount: integer('result_count').default(0), // Number of search results returned
  pricesFound: integer('prices_found').default(0), // Number of valid prices extracted
  confidence: decimal('confidence', { precision: 5, scale: 2 }).default('0'), // 0-100 confidence score
  
  // Performance metrics
  responseTime: integer('response_time_ms').notNull(), // API response time in milliseconds
  dataSource: varchar('data_source', { length: 20 }).notNull(), // 'internet', 'cache', 'database'
  
  // API usage
  apiProvider: varchar('api_provider', { length: 20 }).notNull().default('serper'), // 'serper', 'fallback'
  apiCost: decimal('api_cost', { precision: 8, scale: 4 }).default('0'), // Cost in USD
  
  // Error handling
  errorMessage: text('error_message'),
  errorCode: varchar('error_code', { length: 50 }),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  // Performance indexes
  searchHashIdx: index('idx_internet_search_hash').on(table.searchHash),
  itemTypeIdx: index('idx_internet_search_item_type').on(table.itemType),
  statusIdx: index('idx_internet_search_status').on(table.status),
  dataSourceIdx: index('idx_internet_search_data_source').on(table.dataSource),
  createdAtIdx: index('idx_internet_search_created_at').on(table.createdAt),
  
  // Analytics indexes
  performanceIdx: index('idx_internet_search_performance').on(table.responseTime, table.createdAt),
  confidenceIdx: index('idx_internet_search_confidence').on(table.confidence, table.createdAt),
}));

/**
 * Internet Search Results
 * 
 * Stores detailed search results for analysis and debugging.
 * Links to internetSearchLogs for complete search context.
 */
export const internetSearchResults = pgTable('internet_search_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Link to search log
  searchLogId: uuid('search_log_id').notNull().references(() => internetSearchLogs.id, { onDelete: 'cascade' }),
  
  // Result details
  title: text('title').notNull(),
  snippet: text('snippet').notNull(),
  url: text('url').notNull(),
  source: varchar('source', { length: 100 }).notNull(), // Domain or source name
  
  // Price extraction
  extractedPrice: decimal('extracted_price', { precision: 12, scale: 2 }),
  currency: varchar('currency', { length: 3 }).default('NGN'),
  priceConfidence: decimal('price_confidence', { precision: 5, scale: 2 }).default('0'), // 0-100
  
  // Result ranking
  position: integer('position').notNull(), // Position in search results (1-based)
  relevanceScore: decimal('relevance_score', { precision: 5, scale: 2 }).default('0'), // 0-100
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  searchLogIdx: index('idx_internet_search_results_log').on(table.searchLogId),
  sourceIdx: index('idx_internet_search_results_source').on(table.source),
  priceIdx: index('idx_internet_search_results_price').on(table.extractedPrice),
  positionIdx: index('idx_internet_search_results_position').on(table.position),
}));

/**
 * Internet Search Metrics
 * 
 * Aggregated metrics for performance monitoring and analytics.
 * Updated periodically by background jobs for dashboard reporting.
 */
export const internetSearchMetrics = pgTable('internet_search_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Time period
  periodType: varchar('period_type', { length: 10 }).notNull(), // 'hour', 'day', 'week', 'month'
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  
  // Search volume
  totalSearches: integer('total_searches').notNull().default(0),
  successfulSearches: integer('successful_searches').notNull().default(0),
  failedSearches: integer('failed_searches').notNull().default(0),
  cachedSearches: integer('cached_searches').notNull().default(0),
  
  // Performance metrics
  avgResponseTime: decimal('avg_response_time', { precision: 8, scale: 2 }).default('0'),
  avgConfidence: decimal('avg_confidence', { precision: 5, scale: 2 }).default('0'),
  avgPricesFound: decimal('avg_prices_found', { precision: 5, scale: 2 }).default('0'),
  
  // API usage
  totalApiCalls: integer('total_api_calls').notNull().default(0),
  totalApiCost: decimal('total_api_cost', { precision: 10, scale: 4 }).default('0'),
  
  // Item type breakdown
  vehicleSearches: integer('vehicle_searches').default(0),
  electronicsSearches: integer('electronics_searches').default(0),
  applianceSearches: integer('appliance_searches').default(0),
  otherSearches: integer('other_searches').default(0),
  
  // Cache performance
  cacheHitRate: decimal('cache_hit_rate', { precision: 5, scale: 2 }).default('0'), // 0-100
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  periodIdx: index('idx_internet_search_metrics_period').on(table.periodType, table.periodStart),
  createdAtIdx: index('idx_internet_search_metrics_created').on(table.createdAt),
}));

/**
 * Popular Search Queries
 * 
 * Tracks frequently searched queries for cache warming and optimization.
 * Updated in real-time by the cache integration service.
 */
export const popularSearchQueries = pgTable('popular_search_queries', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Query details
  queryHash: varchar('query_hash', { length: 64 }).notNull().unique(),
  query: text('query').notNull(),
  itemType: varchar('item_type', { length: 20 }).notNull(),
  
  // Usage statistics
  searchCount: integer('search_count').notNull().default(1),
  lastSearched: timestamp('last_searched').notNull().defaultNow(),
  
  // Performance data
  avgResponseTime: decimal('avg_response_time', { precision: 8, scale: 2 }).default('0'),
  avgConfidence: decimal('avg_confidence', { precision: 5, scale: 2 }).default('0'),
  successRate: decimal('success_rate', { precision: 5, scale: 2 }).default('100'), // 0-100
  
  // Cache optimization
  shouldPreCache: boolean('should_pre_cache').default(false),
  lastCached: timestamp('last_cached'),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  queryHashIdx: index('idx_popular_queries_hash').on(table.queryHash),
  itemTypeIdx: index('idx_popular_queries_item_type').on(table.itemType),
  searchCountIdx: index('idx_popular_queries_count').on(table.searchCount),
  lastSearchedIdx: index('idx_popular_queries_last_searched').on(table.lastSearched),
  preCacheIdx: index('idx_popular_queries_pre_cache').on(table.shouldPreCache, table.lastCached),
}));

/**
 * API Usage Tracking
 * 
 * Detailed tracking of API usage for cost monitoring and rate limiting.
 * Essential for staying within Serper.dev free tier limits.
 */
export const apiUsageTracking = pgTable('api_usage_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // API details
  provider: varchar('provider', { length: 20 }).notNull().default('serper'),
  endpoint: varchar('endpoint', { length: 100 }).notNull(),
  
  // Usage metrics
  requestCount: integer('request_count').notNull().default(0),
  successCount: integer('success_count').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  
  // Cost tracking
  totalCost: decimal('total_cost', { precision: 10, scale: 4 }).default('0'),
  avgCostPerRequest: decimal('avg_cost_per_request', { precision: 8, scale: 4 }).default('0'),
  
  // Rate limiting
  rateLimitHits: integer('rate_limit_hits').default(0),
  quotaUsed: integer('quota_used').default(0),
  quotaLimit: integer('quota_limit').default(2500), // Serper.dev free tier limit
  
  // Time period (daily tracking)
  trackingDate: timestamp('tracking_date').notNull(),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  providerDateIdx: index('idx_api_usage_provider_date').on(table.provider, table.trackingDate),
  trackingDateIdx: index('idx_api_usage_tracking_date').on(table.trackingDate),
  quotaIdx: index('idx_api_usage_quota').on(table.quotaUsed, table.quotaLimit),
}));