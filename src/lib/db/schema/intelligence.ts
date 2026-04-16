/**
 * AI-Powered Marketplace Intelligence Schema
 * 
 * Core intelligence tables for predictions, recommendations, interactions,
 * fraud detection, and algorithm configuration.
 * 
 * @module intelligence
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
  boolean,
  pgEnum,
  text
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { auctions } from './auctions';
import { vendors } from './vendors';
import { users } from './users';
import { salvageCases } from './cases';

// ============================================================================
// ENUMS
// ============================================================================

export const predictionMethodEnum = pgEnum('prediction_method', [
  'historical',
  'salvage_value',
  'market_value_calc',
  'no_prediction'
]);

export const confidenceLevelEnum = pgEnum('confidence_level', [
  'High',
  'Medium',
  'Low'
]);

export const interactionTypeEnum = pgEnum('interaction_type', [
  'view',
  'bid',
  'win',
  'watch',
  'unwatch'
]);

export const fraudEntityTypeEnum = pgEnum('fraud_entity_type', [
  'vendor',
  'case',
  'auction',
  'user'
]);

export const fraudAlertStatusEnum = pgEnum('fraud_alert_status', [
  'pending',
  'reviewed',
  'dismissed',
  'confirmed'
]);

// ============================================================================
// PREDICTIONS TABLE
// ============================================================================

export const predictions = pgTable('predictions', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  predictedPrice: numeric('predicted_price', { precision: 12, scale: 2 }).notNull(),
  lowerBound: numeric('lower_bound', { precision: 12, scale: 2 }).notNull(),
  upperBound: numeric('upper_bound', { precision: 12, scale: 2 }).notNull(),
  confidenceScore: numeric('confidence_score', { precision: 5, scale: 4 }).notNull(), // 0.0000 to 1.0000
  confidenceLevel: confidenceLevelEnum('confidence_level').notNull(),
  algorithmVersion: varchar('algorithm_version', { length: 50 }).notNull().default('v1.0'),
  method: predictionMethodEnum('method').notNull(),
  sampleSize: integer('sample_size').notNull().default(0),
  metadata: jsonb('metadata').$type<{
    similarAuctions?: number;
    marketAdjustment?: number;
    competitionLevel?: string;
    seasonalFactor?: number;
    warnings?: string[];
    notes?: string[];
  }>(),
  // Accuracy tracking (filled after auction closes)
  actualPrice: numeric('actual_price', { precision: 12, scale: 2 }),
  accuracy: numeric('accuracy', { precision: 5, scale: 4 }), // Percentage error
  absoluteError: numeric('absolute_error', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  auctionIdIdx: index('idx_predictions_auction_id').on(table.auctionId),
  createdAtIdx: index('idx_predictions_created_at').on(table.createdAt),
  accuracyIdx: index('idx_predictions_accuracy').on(table.accuracy),
  methodIdx: index('idx_predictions_method').on(table.method),
  confidenceIdx: index('idx_predictions_confidence').on(table.confidenceScore),
}));

export const predictionsRelations = relations(predictions, ({ one }) => ({
  auction: one(auctions, {
    fields: [predictions.auctionId],
    references: [auctions.id],
  }),
}));

// ============================================================================
// RECOMMENDATIONS TABLE
// ============================================================================

export const recommendations = pgTable('recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  matchScore: numeric('match_score', { precision: 5, scale: 2 }).notNull(), // 0.00 to 100.00
  collaborativeScore: numeric('collaborative_score', { precision: 5, scale: 2 }),
  contentScore: numeric('content_score', { precision: 5, scale: 2 }),
  popularityBoost: numeric('popularity_boost', { precision: 5, scale: 2 }),
  winRateBoost: numeric('win_rate_boost', { precision: 5, scale: 2 }),
  reasonCodes: jsonb('reason_codes').$type<string[]>().notNull(),
  algorithmVersion: varchar('algorithm_version', { length: 50 }).notNull().default('v1.0'),
  // Interaction tracking
  clicked: boolean('clicked').notNull().default(false),
  clickedAt: timestamp('clicked_at'),
  bidPlaced: boolean('bid_placed').notNull().default(false),
  bidPlacedAt: timestamp('bid_placed_at'),
  bidAmount: numeric('bid_amount', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  vendorIdIdx: index('idx_recommendations_vendor_id').on(table.vendorId),
  auctionIdIdx: index('idx_recommendations_auction_id').on(table.auctionId),
  matchScoreIdx: index('idx_recommendations_match_score').on(table.matchScore),
  createdAtIdx: index('idx_recommendations_created_at').on(table.createdAt),
  clickedIdx: index('idx_recommendations_clicked').on(table.clicked),
  bidPlacedIdx: index('idx_recommendations_bid_placed').on(table.bidPlaced),
  vendorAuctionIdx: index('idx_recommendations_vendor_auction').on(table.vendorId, table.auctionId),
}));

export const recommendationsRelations = relations(recommendations, ({ one }) => ({
  vendor: one(vendors, {
    fields: [recommendations.vendorId],
    references: [vendors.id],
  }),
  auction: one(auctions, {
    fields: [recommendations.auctionId],
    references: [auctions.id],
  }),
}));

// ============================================================================
// INTERACTIONS TABLE
// ============================================================================

export const interactions = pgTable('interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  eventType: interactionTypeEnum('event_type').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  sessionId: varchar('session_id', { length: 100 }),
  metadata: jsonb('metadata').$type<{
    predictionShown?: {
      predictedPrice: number;
      confidenceScore: number;
    };
    bidAmount?: number;
    deviceType?: string;
    referrer?: string;
    timeOnPage?: number;
  }>(),
}, (table) => ({
  vendorIdIdx: index('idx_interactions_vendor_id').on(table.vendorId),
  auctionIdIdx: index('idx_interactions_auction_id').on(table.auctionId),
  eventTypeIdx: index('idx_interactions_event_type').on(table.eventType),
  timestampIdx: index('idx_interactions_timestamp').on(table.timestamp),
  vendorEventIdx: index('idx_interactions_vendor_event').on(table.vendorId, table.eventType),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  vendor: one(vendors, {
    fields: [interactions.vendorId],
    references: [vendors.id],
  }),
  auction: one(auctions, {
    fields: [interactions.auctionId],
    references: [auctions.id],
  }),
}));

// ============================================================================
// FRAUD ALERTS TABLE
// ============================================================================

export const fraudAlerts = pgTable('fraud_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: fraudEntityTypeEnum('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  riskScore: integer('risk_score').notNull(), // 0-100
  flagReasons: jsonb('flag_reasons').$type<string[]>().notNull(),
  status: fraudAlertStatusEnum('status').notNull().default('pending'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  metadata: jsonb('metadata').$type<{
    duplicatePhotoHashes?: string[];
    collusionPairs?: Array<{ vendorId: string; adjusterId: string; winRate: number }>;
    bidTimingPatterns?: Array<{ timestamp: string; amount: number }>;
    photoAnalysis?: {
      hammingDistance?: number;
      exifMismatch?: boolean;
      aiGenerated?: boolean;
    };
  }>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  entityIdx: index('idx_fraud_alerts_entity').on(table.entityType, table.entityId),
  statusIdx: index('idx_fraud_alerts_status').on(table.status),
  riskScoreIdx: index('idx_fraud_alerts_risk_score').on(table.riskScore),
  createdAtIdx: index('idx_fraud_alerts_created_at').on(table.createdAt),
}));

export const fraudAlertsRelations = relations(fraudAlerts, ({ one }) => ({
  reviewer: one(users, {
    fields: [fraudAlerts.reviewedBy],
    references: [users.id],
  }),
}));

// ============================================================================
// ALGORITHM CONFIG TABLE
// ============================================================================

export const algorithmConfig = pgTable('algorithm_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  configKey: varchar('config_key', { length: 100 }).notNull().unique(),
  configValue: jsonb('config_value').notNull(),
  description: text('description'),
  version: varchar('version', { length: 50 }).notNull().default('v1.0'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  configKeyIdx: index('idx_algorithm_config_key').on(table.configKey),
  isActiveIdx: index('idx_algorithm_config_active').on(table.isActive),
}));

export const algorithmConfigRelations = relations(algorithmConfig, ({ one }) => ({
  creator: one(users, {
    fields: [algorithmConfig.createdBy],
    references: [users.id],
  }),
}));
