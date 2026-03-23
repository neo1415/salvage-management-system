import { pgTable, uuid, timestamp, integer, varchar, jsonb } from 'drizzle-orm/pg-core';
import { vendors } from './vendors';
import { auctions } from './auctions';
import { users } from './users';

export const ratings = pgTable('ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  ratedBy: uuid('rated_by')
    .notNull()
    .references(() => users.id),
  overallRating: integer('overall_rating').notNull(), // 1-5 stars
  categoryRatings: jsonb('category_ratings')
    .notNull()
    .$type<{
      paymentSpeed: number; // 1-5
      communication: number; // 1-5
      pickupPunctuality: number; // 1-5
    }>(),
  review: varchar('review', { length: 500 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Indexes are created via SQL in migrations
// CREATE INDEX idx_ratings_vendor_id ON ratings(vendor_id);
// CREATE INDEX idx_ratings_auction_id ON ratings(auction_id);
// CREATE UNIQUE INDEX idx_ratings_auction_vendor_unique ON ratings(auction_id, vendor_id);
