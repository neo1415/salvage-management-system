import { pgTable, uuid, timestamp, numeric, integer, pgEnum } from 'drizzle-orm/pg-core';
import { salvageCases } from './cases';
import { vendors } from './vendors';

export const auctionStatusEnum = pgEnum('auction_status', [
  'scheduled',
  'active',
  'extended',
  'closed',
  'cancelled',
]);

export const auctions = pgTable('auctions', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id')
    .notNull()
    .references(() => salvageCases.id, { onDelete: 'cascade' }),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  originalEndTime: timestamp('original_end_time').notNull(),
  extensionCount: integer('extension_count').notNull().default(0),
  currentBid: numeric('current_bid', { precision: 12, scale: 2 }),
  currentBidder: uuid('current_bidder').references(() => vendors.id),
  minimumIncrement: numeric('minimum_increment', { precision: 12, scale: 2 })
    .notNull()
    .default('10000.00'),
  status: auctionStatusEnum('status').notNull().default('scheduled'),
  watchingCount: integer('watching_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Indexes are created via SQL in migrations
// CREATE INDEX idx_auctions_case_id ON auctions(case_id);
// CREATE INDEX idx_auctions_status ON auctions(status);
// CREATE INDEX idx_auctions_end_time ON auctions(end_time);
// CREATE INDEX idx_auctions_status_end_time ON auctions(status, end_time) WHERE status = 'active';
