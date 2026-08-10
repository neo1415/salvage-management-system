import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { auctions } from './auctions';
import { users } from './users';

export type AuctionEarlyCloseStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'failed';

export const auctionEarlyCloseRequests = pgTable('auction_early_close_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id').notNull().references(() => auctions.id, { onDelete: 'cascade' }),
  requestedBy: uuid('requested_by').notNull().references(() => users.id),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 20 }).$type<AuctionEarlyCloseStatus>().notNull().default('pending'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewNote: text('review_note'),
  requestedAt: timestamp('requested_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
  executedAt: timestamp('executed_at'),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  auctionIdx: index('auction_early_close_auction_idx').on(table.auctionId),
  statusIdx: index('auction_early_close_status_idx').on(table.status),
  requesterIdx: index('auction_early_close_requester_idx').on(table.requestedBy),
  pendingAuctionIdx: uniqueIndex('auction_early_close_one_pending_idx')
    .on(table.auctionId)
    .where(sql`${table.status} in ('pending', 'processing')`),
}));
