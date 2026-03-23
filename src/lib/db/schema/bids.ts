import { pgTable, uuid, timestamp, numeric, boolean, varchar } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { auctions } from './auctions';
import { vendors } from './vendors';
import { deviceTypeEnum } from './users';

export const bids = pgTable('bids', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  otpVerified: boolean('otp_verified').notNull().default(false),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  deviceType: deviceTypeEnum('device_type').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations
export const bidsRelations = relations(bids, ({ one }) => ({
  auction: one(auctions, {
    fields: [bids.auctionId],
    references: [auctions.id],
  }),
  vendor: one(vendors, {
    fields: [bids.vendorId],
    references: [vendors.id],
  }),
}));

// Indexes are created via SQL in migrations
// CREATE INDEX idx_bids_auction_id ON bids(auction_id);
// CREATE INDEX idx_bids_vendor_id ON bids(vendor_id);
// CREATE INDEX idx_bids_created_at ON bids(created_at DESC);
// CREATE INDEX idx_bids_auction_amount ON bids(auction_id, amount DESC);
