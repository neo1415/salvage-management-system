import { pgTable, uuid, varchar, decimal, integer, timestamp, jsonb, text, boolean, index } from 'drizzle-orm/pg-core';

export const marketDataCache = pgTable('market_data_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyHash: varchar('property_hash', { length: 64 }).notNull().unique(),
  propertyType: varchar('property_type', { length: 20 }).notNull(),
  propertyDetails: jsonb('property_details').notNull().$type<{
    type: 'vehicle' | 'electronics' | 'building' | 'appliance' | 'property' | 'jewelry' | 'furniture' | 'machinery';
    // Vehicle fields
    make?: string;
    model?: string;
    year?: number;
    mileage?: number;
    condition?: string;
    // Electronics fields
    brand?: string;
    productModel?: string;
    productType?: string;
    storage?: string;
    color?: string;
    // Building fields
    location?: string;
    propertyType?: string;
    size?: number;
    bedrooms?: number;
    // Appliance fields
    applianceType?: string;
    // Jewelry fields
    jewelryType?: string;
    material?: string;
    weight?: string;
    // Furniture fields
    furnitureType?: string;
    // Machinery fields
    machineryType?: string;
    // Universal fields
    condition?: string;
  }>(),
  medianPrice: decimal('median_price', { precision: 12, scale: 2 }).notNull(),
  minPrice: decimal('min_price', { precision: 12, scale: 2 }).notNull(),
  maxPrice: decimal('max_price', { precision: 12, scale: 2 }).notNull(),
  sourceCount: integer('source_count').notNull(),
  scrapedAt: timestamp('scraped_at').notNull().defaultNow(),
  staleAt: timestamp('stale_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  propertyHashIdx: index('idx_market_data_property_hash').on(table.propertyHash),
  staleIdx: index('idx_market_data_stale').on(table.scrapedAt),
  typeIdx: index('idx_market_data_type').on(table.propertyType),
}));

export const marketDataSources = pgTable('market_data_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  cacheId: uuid('cache_id').notNull().references(() => marketDataCache.id, { onDelete: 'cascade' }),
  sourceName: varchar('source_name', { length: 50 }).notNull(),
  price: decimal('price', { precision: 12, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('NGN'),
  listingUrl: text('listing_url').notNull(),
  listingTitle: text('listing_title').notNull(),
  scrapedAt: timestamp('scraped_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  cacheIdx: index('idx_market_sources_cache').on(table.cacheId),
  nameIdx: index('idx_market_sources_name').on(table.sourceName),
}));

export const scrapingLogs = pgTable('scraping_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyHash: varchar('property_hash', { length: 64 }).notNull(),
  sourceName: varchar('source_name', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  pricesFound: integer('prices_found').default(0),
  durationMs: integer('duration_ms').notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  propertyIdx: index('idx_scraping_logs_property').on(table.propertyHash),
  sourceIdx: index('idx_scraping_logs_source').on(table.sourceName, table.createdAt),
  statusIdx: index('idx_scraping_logs_status').on(table.status),
}));

export const backgroundJobs = pgTable('background_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobType: varchar('job_type', { length: 50 }).notNull(),
  propertyHash: varchar('property_hash', { length: 64 }).notNull(),
  propertyDetails: jsonb('property_details').notNull().$type<{
    type: 'vehicle' | 'electronics' | 'building' | 'appliance' | 'property' | 'jewelry' | 'furniture' | 'machinery';
    // Vehicle fields
    make?: string;
    model?: string;
    year?: number;
    mileage?: number;
    condition?: string;
    // Electronics fields
    brand?: string;
    productModel?: string;
    productType?: string;
    storage?: string;
    color?: string;
    // Building fields
    location?: string;
    propertyType?: string;
    size?: number;
    bedrooms?: number;
    // Appliance fields
    applianceType?: string;
    // Jewelry fields
    jewelryType?: string;
    material?: string;
    weight?: string;
    // Furniture fields
    furnitureType?: string;
    // Machinery fields
    machineryType?: string;
    // Universal fields
    condition?: string;
  }>(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  statusIdx: index('idx_background_jobs_status').on(table.status, table.createdAt),
  propertyIdx: index('idx_background_jobs_property').on(table.propertyHash),
}));
