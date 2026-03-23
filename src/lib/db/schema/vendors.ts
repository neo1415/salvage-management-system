import { pgTable, uuid, varchar, timestamp, numeric, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';

export const vendorTierEnum = pgEnum('vendor_tier', ['tier1_bvn', 'tier2_full']);
export const vendorStatusEnum = pgEnum('vendor_status', ['pending', 'approved', 'suspended']);
export const assetTypeEnum = pgEnum('asset_type', ['vehicle', 'property', 'electronics']);

export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  businessName: varchar('business_name', { length: 255 }),
  tier: vendorTierEnum('tier').notNull().default('tier1_bvn'),
  bvnEncrypted: varchar('bvn_encrypted', { length: 255 }),
  bvnVerifiedAt: timestamp('bvn_verified_at'),
  cacNumber: varchar('cac_number', { length: 50 }),
  tin: varchar('tin', { length: 50 }),
  bankAccountNumber: varchar('bank_account_number', { length: 20 }),
  bankName: varchar('bank_name', { length: 100 }),
  bankAccountName: varchar('bank_account_name', { length: 255 }),
  categories: assetTypeEnum('categories').array(),
  status: vendorStatusEnum('status').notNull().default('pending'),
  performanceStats: jsonb('performance_stats')
    .notNull()
    .$type<{
      totalBids: number;
      totalWins: number;
      winRate: number;
      avgPaymentTimeHours: number;
      onTimePickupRate: number;
      fraudFlags: number;
    }>()
    .default({
      totalBids: 0,
      totalWins: 0,
      winRate: 0,
      avgPaymentTimeHours: 0,
      onTimePickupRate: 0,
      fraudFlags: 0,
    }),
  rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('0.00'),
  // Tier 2 KYC document URLs
  cacCertificateUrl: varchar('cac_certificate_url', { length: 500 }),
  bankStatementUrl: varchar('bank_statement_url', { length: 500 }),
  ninCardUrl: varchar('nin_card_url', { length: 500 }),
  // Verification flags
  ninVerified: timestamp('nin_verified_at'),
  bankAccountVerified: timestamp('bank_account_verified_at'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Indexes are created via SQL in migrations
// CREATE INDEX idx_vendors_user_id ON vendors(user_id);
// CREATE INDEX idx_vendors_tier ON vendors(tier);
// CREATE INDEX idx_vendors_status ON vendors(status);
// CREATE INDEX idx_vendors_rating ON vendors(rating DESC);
