import { pgTable, uuid, timestamp, numeric, boolean, varchar, pgEnum } from 'drizzle-orm/pg-core';
import { auctions } from './auctions';
import { vendors } from './vendors';
import { users } from './users';

export const paymentMethodEnum = pgEnum('payment_method', [
  'paystack',
  'flutterwave',
  'bank_transfer',
  'escrow_wallet',
]);

export const escrowStatusEnum = pgEnum('escrow_status', ['none', 'frozen', 'released']);

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'verified',
  'rejected',
  'overdue',
]);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  paymentReference: varchar('payment_reference', { length: 255 }),
  paymentProofUrl: varchar('payment_proof_url', { length: 500 }),
  escrowStatus: escrowStatusEnum('escrow_status').notNull().default('none'),
  status: paymentStatusEnum('status').notNull().default('pending'),
  verifiedBy: uuid('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at'),
  autoVerified: boolean('auto_verified').notNull().default(false),
  paymentDeadline: timestamp('payment_deadline').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Indexes are created via SQL in migrations
// CREATE INDEX idx_payments_auction_id ON payments(auction_id);
// CREATE INDEX idx_payments_vendor_id ON payments(vendor_id);
// CREATE INDEX idx_payments_status ON payments(status);
// CREATE INDEX idx_payments_payment_deadline ON payments(payment_deadline);
// CREATE INDEX idx_payments_payment_reference ON payments(payment_reference);
