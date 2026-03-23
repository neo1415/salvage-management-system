import { pgTable, uuid, timestamp, numeric, varchar, pgEnum } from 'drizzle-orm/pg-core';
import { vendors } from './vendors';

export const transactionTypeEnum = pgEnum('transaction_type', [
  'credit',
  'debit',
  'freeze',
  'unfreeze',
]);

export const escrowWallets = pgTable('escrow_wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .unique()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  balance: numeric('balance', { precision: 12, scale: 2 }).notNull().default('0.00'),
  frozenAmount: numeric('frozen_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  availableBalance: numeric('available_balance', { precision: 12, scale: 2 })
    .notNull()
    .default('0.00'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const walletTransactions = pgTable('wallet_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletId: uuid('wallet_id')
    .notNull()
    .references(() => escrowWallets.id, { onDelete: 'cascade' }),
  type: transactionTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 12, scale: 2 }).notNull(),
  reference: varchar('reference', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Indexes are created via SQL in migrations
// CREATE INDEX idx_escrow_wallets_vendor_id ON escrow_wallets(vendor_id);
// CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
// CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
// CREATE INDEX idx_wallet_transactions_reference ON wallet_transactions(reference);
