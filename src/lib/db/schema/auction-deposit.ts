import { pgTable, uuid, timestamp, numeric, integer, varchar, text, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { auctions } from './auctions';
import { vendors } from './vendors';
import { users } from './users';

// Enums
export const winnerStatusEnum = pgEnum('winner_status', [
  'active',
  'failed_to_sign',
  'failed_to_pay',
  'completed',
]);

export const documentTypeEnum = pgEnum('document_type', [
  'bill_of_sale',
  'liability_waiver',
]);

export const documentStatusEnum = pgEnum('document_status', [
  'pending',
  'signed',
  'voided',
]);

export const extensionTypeEnum = pgEnum('extension_type', [
  'document_signing',
  'payment',
]);

export const depositEventTypeEnum = pgEnum('deposit_event_type', [
  'freeze',
  'unfreeze',
  'forfeit',
]);

export const configDataTypeEnum = pgEnum('config_data_type', [
  'number',
  'boolean',
  'string',
]);

// Auction Winners Table
export const auctionWinners = pgTable('auction_winners', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  bidAmount: numeric('bid_amount', { precision: 12, scale: 2 }).notNull(),
  depositAmount: numeric('deposit_amount', { precision: 12, scale: 2 }).notNull(),
  rank: integer('rank').notNull(), // 1 = winner, 2-3 = fallback candidates
  status: winnerStatusEnum('status').notNull().default('active'),
  promotedAt: timestamp('promoted_at'),
  failedAt: timestamp('failed_at'),
  failureReason: varchar('failure_reason', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Auction Documents Table
export const auctionDocuments = pgTable('auction_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  type: documentTypeEnum('type').notNull(),
  content: text('content').notNull(),
  status: documentStatusEnum('status').notNull().default('pending'),
  signedAt: timestamp('signed_at'),
  signatureData: text('signature_data'),
  validityDeadline: timestamp('validity_deadline').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Grace Extensions Table
export const graceExtensions = pgTable('grace_extensions', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  grantedBy: uuid('granted_by')
    .notNull()
    .references(() => users.id),
  extensionType: extensionTypeEnum('extension_type').notNull(),
  durationHours: integer('duration_hours').notNull(),
  reason: text('reason'),
  oldDeadline: timestamp('old_deadline').notNull(),
  newDeadline: timestamp('new_deadline').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Deposit Forfeitures Table
export const depositForfeitures = pgTable('deposit_forfeitures', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  depositAmount: numeric('deposit_amount', { precision: 12, scale: 2 }).notNull(),
  forfeiturePercentage: integer('forfeiture_percentage').notNull(),
  forfeitedAmount: numeric('forfeited_amount', { precision: 12, scale: 2 }).notNull(),
  reason: varchar('reason', { length: 100 }).notNull(),
  transferredAt: timestamp('transferred_at'),
  transferredBy: uuid('transferred_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// System Configuration Table
export const systemConfig = pgTable('system_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  parameter: varchar('parameter', { length: 100 }).notNull().unique(),
  value: text('value').notNull(),
  dataType: configDataTypeEnum('data_type').notNull(),
  description: text('description'),
  minValue: numeric('min_value', { precision: 12, scale: 2 }),
  maxValue: numeric('max_value', { precision: 12, scale: 2 }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => users.id),
});

// Configuration Change History Table
export const configChangeHistory = pgTable('config_change_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  parameter: varchar('parameter', { length: 100 }).notNull(),
  oldValue: text('old_value').notNull(),
  newValue: text('new_value').notNull(),
  changedBy: uuid('changed_by')
    .notNull()
    .references(() => users.id),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Deposit Events Table (for vendor transparency)
export const depositEvents = pgTable('deposit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  eventType: depositEventTypeEnum('event_type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  balanceBefore: numeric('balance_before', { precision: 12, scale: 2 }),
  balanceAfter: numeric('balance_after', { precision: 12, scale: 2 }).notNull(),
  frozenBefore: numeric('frozen_before', { precision: 12, scale: 2 }),
  frozenAfter: numeric('frozen_after', { precision: 12, scale: 2 }).notNull(),
  availableBefore: numeric('available_before', { precision: 12, scale: 2 }),
  availableAfter: numeric('available_after', { precision: 12, scale: 2 }),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Relations
export const auctionWinnersRelations = relations(auctionWinners, ({ one }) => ({
  auction: one(auctions, {
    fields: [auctionWinners.auctionId],
    references: [auctions.id],
  }),
  vendor: one(vendors, {
    fields: [auctionWinners.vendorId],
    references: [vendors.id],
  }),
}));

export const auctionDocumentsRelations = relations(auctionDocuments, ({ one }) => ({
  auction: one(auctions, {
    fields: [auctionDocuments.auctionId],
    references: [auctions.id],
  }),
  vendor: one(vendors, {
    fields: [auctionDocuments.vendorId],
    references: [vendors.id],
  }),
}));

export const graceExtensionsRelations = relations(graceExtensions, ({ one }) => ({
  auction: one(auctions, {
    fields: [graceExtensions.auctionId],
    references: [auctions.id],
  }),
  grantedByUser: one(users, {
    fields: [graceExtensions.grantedBy],
    references: [users.id],
  }),
}));

export const depositForfeituresRelations = relations(depositForfeitures, ({ one }) => ({
  auction: one(auctions, {
    fields: [depositForfeitures.auctionId],
    references: [auctions.id],
  }),
  vendor: one(vendors, {
    fields: [depositForfeitures.vendorId],
    references: [vendors.id],
  }),
  transferredByUser: one(users, {
    fields: [depositForfeitures.transferredBy],
    references: [users.id],
  }),
}));

export const systemConfigRelations = relations(systemConfig, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [systemConfig.updatedBy],
    references: [users.id],
  }),
}));

export const configChangeHistoryRelations = relations(configChangeHistory, ({ one }) => ({
  changedByUser: one(users, {
    fields: [configChangeHistory.changedBy],
    references: [users.id],
  }),
}));

export const depositEventsRelations = relations(depositEvents, ({ one }) => ({
  vendor: one(vendors, {
    fields: [depositEvents.vendorId],
    references: [vendors.id],
  }),
  auction: one(auctions, {
    fields: [depositEvents.auctionId],
    references: [auctions.id],
  }),
}));

// Indexes are created via SQL in migrations
// CREATE INDEX idx_auction_winners_auction_id ON auction_winners(auction_id);
// CREATE INDEX idx_auction_winners_vendor_id ON auction_winners(vendor_id);
// CREATE INDEX idx_auction_winners_status ON auction_winners(status);
// CREATE INDEX idx_auction_documents_auction_id ON auction_documents(auction_id);
// CREATE INDEX idx_auction_documents_vendor_id ON auction_documents(vendor_id);
// CREATE INDEX idx_auction_documents_status ON auction_documents(status);
// CREATE INDEX idx_grace_extensions_auction_id ON grace_extensions(auction_id);
// CREATE INDEX idx_grace_extensions_granted_by ON grace_extensions(granted_by);
// CREATE INDEX idx_deposit_forfeitures_auction_id ON deposit_forfeitures(auction_id);
// CREATE INDEX idx_deposit_forfeitures_vendor_id ON deposit_forfeitures(vendor_id);
// CREATE INDEX idx_config_change_history_parameter ON config_change_history(parameter);
// CREATE INDEX idx_config_change_history_changed_by ON config_change_history(changed_by);
// CREATE INDEX idx_config_change_history_created_at ON config_change_history(created_at DESC);
// CREATE INDEX idx_deposit_events_vendor_id ON deposit_events(vendor_id);
// CREATE INDEX idx_deposit_events_auction_id ON deposit_events(auction_id);
// CREATE INDEX idx_deposit_events_created_at ON deposit_events(created_at DESC);
