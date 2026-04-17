import { pgTable, uuid, varchar, text, jsonb, decimal, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { cases } from './cases';

/**
 * Fraud Attempts Table
 * Stores all fraud attempt details for investigation
 */
export const fraudAttempts = pgTable('fraud_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: varchar('type', { length: 50 }).notNull(), // 'duplicate_vehicle_submission', 'shill_bidding', etc.
  userId: uuid('user_id').notNull().references(() => users.id),
  userEmail: varchar('user_email', { length: 255 }).notNull(),
  userName: varchar('user_name', { length: 255 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  userAgent: text('user_agent'),
  attemptedData: jsonb('attempted_data').notNull(), // The data they tried to submit
  matchedData: jsonb('matched_data'), // The existing data that matched (for duplicates)
  confidence: decimal('confidence', { precision: 3, scale: 2 }), // 0.00-1.00
  timestamp: timestamp('timestamp').notNull(),
  reviewed: boolean('reviewed').default(false),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('fraud_attempts_user_id_idx').on(table.userId),
  typeIdx: index('fraud_attempts_type_idx').on(table.type),
  ipAddressIdx: index('fraud_attempts_ip_address_idx').on(table.ipAddress),
  timestampIdx: index('fraud_attempts_timestamp_idx').on(table.timestamp),
  reviewedIdx: index('fraud_attempts_reviewed_idx').on(table.reviewed),
}));

/**
 * Vendor Interactions Table
 * Tracks vendor interactions with auctions for recommendations
 */
export const vendorInteractions = pgTable('vendor_interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull(),
  auctionId: uuid('auction_id').notNull(),
  interactionType: varchar('interaction_type', { length: 20 }).notNull(), // 'view', 'bid', 'watch'
  timestamp: timestamp('timestamp').notNull(),
  metadata: jsonb('metadata'), // Additional context (e.g., time spent viewing)
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  vendorIdIdx: index('vendor_interactions_vendor_id_idx').on(table.vendorId),
  auctionIdIdx: index('vendor_interactions_auction_id_idx').on(table.auctionId),
  timestampIdx: index('vendor_interactions_timestamp_idx').on(table.timestamp),
  typeIdx: index('vendor_interactions_type_idx').on(table.interactionType),
}));

/**
 * Vendor Recommendations Table
 * Stores generated recommendations with match scores
 */
export const vendorRecommendations = pgTable('vendor_recommendations', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull(),
  auctionId: uuid('auction_id').notNull(),
  matchScore: decimal('match_score', { precision: 5, scale: 2 }).notNull(), // 0-100
  reason: text('reason').notNull(), // Why this auction is recommended
  metadata: jsonb('metadata'), // Additional recommendation context
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at'), // Recommendations expire after auction ends
}, (table) => ({
  vendorIdIdx: index('vendor_recommendations_vendor_id_idx').on(table.vendorId),
  auctionIdIdx: index('vendor_recommendations_auction_id_idx').on(table.auctionId),
  matchScoreIdx: index('vendor_recommendations_match_score_idx').on(table.matchScore),
  createdAtIdx: index('vendor_recommendations_created_at_idx').on(table.createdAt),
}));
