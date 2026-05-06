/**
 * Double-Entry Ledger System Schema
 * 
 * Provides true accounting integrity by ensuring every transaction has two sides:
 * - Debit (money coming in)
 * - Credit (money going out)
 * 
 * INVARIANT: For each transactionId, SUM(debit) = SUM(credit)
 * 
 * This allows us to detect if money "appears" or "disappears" in the system.
 */

import { pgTable, uuid, varchar, numeric, timestamp, index } from 'drizzle-orm/pg-core';

/**
 * Ledger Accounts
 * 
 * Represents all accounts in the system:
 * - vendor_wallet: Individual vendor escrow wallets
 * - nem_paystack: NEM's Paystack merchant account
 * - nem_bank: NEM's bank account (for settlements)
 */
export const ledgerAccounts = pgTable('ledger_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountType: varchar('account_type', { length: 50 }).notNull(), // 'vendor_wallet', 'nem_paystack', 'nem_bank'
  accountId: varchar('account_id', { length: 255 }).notNull(), // vendorId or 'nem'
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  accountTypeIdx: index('ledger_accounts_type_idx').on(table.accountType),
  accountIdIdx: index('ledger_accounts_account_id_idx').on(table.accountId),
}));

/**
 * Ledger Entries
 * 
 * Every financial transaction creates TWO ledger entries:
 * 1. Debit entry (increases an account)
 * 2. Credit entry (decreases an account)
 * 
 * Example: Vendor funds wallet with ₦100k
 * - Entry 1: Debit vendor_wallet ₦100k (vendor balance increases)
 * - Entry 2: Credit nem_paystack ₦100k (NEM Paystack balance increases)
 * 
 * CRITICAL INVARIANT: SUM(debit) = SUM(credit) for each transactionId
 */
export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull(), // Groups entries into a transaction
  accountId: uuid('account_id').notNull().references(() => ledgerAccounts.id),
  debit: numeric('debit', { precision: 12, scale: 2 }).notNull().default('0.00'),
  credit: numeric('credit', { precision: 12, scale: 2 }).notNull().default('0.00'),
  description: varchar('description', { length: 500 }).notNull(),
  reference: varchar('reference', { length: 255 }), // Link to walletTransactions.reference
  metadata: varchar('metadata', { length: 1000 }), // JSON string for additional context
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  transactionIdIdx: index('ledger_entries_transaction_id_idx').on(table.transactionId),
  accountIdIdx: index('ledger_entries_account_id_idx').on(table.accountId),
  referenceIdx: index('ledger_entries_reference_idx').on(table.reference),
  createdAtIdx: index('ledger_entries_created_at_idx').on(table.createdAt),
}));

/**
 * Ledger Transaction Summary
 * 
 * Materialized view for quick transaction validation
 * Shows total debits and credits for each transaction
 */
export const ledgerTransactionSummary = pgTable('ledger_transaction_summary', {
  transactionId: uuid('transaction_id').primaryKey(),
  totalDebit: numeric('total_debit', { precision: 12, scale: 2 }).notNull(),
  totalCredit: numeric('total_credit', { precision: 12, scale: 2 }).notNull(),
  isBalanced: varchar('is_balanced', { length: 10 }).notNull(), // 'true' or 'false'
  discrepancy: numeric('discrepancy', { precision: 12, scale: 2 }).notNull(),
  entryCount: numeric('entry_count', { precision: 10, scale: 0 }).notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type LedgerAccount = typeof ledgerAccounts.$inferSelect;
export type NewLedgerAccount = typeof ledgerAccounts.$inferInsert;
export type LedgerEntry = typeof ledgerEntries.$inferSelect;
export type NewLedgerEntry = typeof ledgerEntries.$inferInsert;
export type LedgerTransactionSummary = typeof ledgerTransactionSummary.$inferSelect;
