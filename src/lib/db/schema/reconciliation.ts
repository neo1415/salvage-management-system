import { pgTable, uuid, date, numeric, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Reconciliation Logs
 * 
 * Tracks daily reconciliation between database balances and Paystack balance.
 * This table provides an audit trail of all reconciliation attempts.
 */
export const reconciliationLogs = pgTable(
  'reconciliation_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reconciliationDate: date('reconciliation_date').notNull(),
    paystackBalance: numeric('paystack_balance', { precision: 12, scale: 2 }).notNull(),
    databaseBalance: numeric('database_balance', { precision: 12, scale: 2 }).notNull(),
    discrepancy: numeric('discrepancy', { precision: 12, scale: 2 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(), // 'passed' | 'failed'
    details: jsonb('details'), // Additional context about the reconciliation
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    dateIdx: index('reconciliation_logs_date_idx').on(table.reconciliationDate),
    statusIdx: index('reconciliation_logs_status_idx').on(table.status),
  })
);

/**
 * Unmatched Transactions
 * 
 * Tracks transactions that don't match between Paystack and our database.
 * This helps identify webhook failures, API issues, or data integrity problems.
 */
export const unmatchedTransactions = pgTable(
  'unmatched_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: varchar('source', { length: 20 }).notNull(), // 'paystack' | 'database' | 'both'
    reference: varchar('reference', { length: 255 }).notNull(),
    paystackAmount: numeric('paystack_amount', { precision: 12, scale: 2 }),
    databaseAmount: numeric('database_amount', { precision: 12, scale: 2 }),
    status: varchar('status', { length: 50 }).notNull(), // 'missing_in_database' | 'missing_in_paystack' | 'amount_mismatch'
    resolvedAt: timestamp('resolved_at'),
    resolvedBy: uuid('resolved_by').references(() => users.id),
    resolutionNotes: varchar('resolution_notes', { length: 500 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    referenceIdx: index('unmatched_transactions_reference_idx').on(table.reference),
    statusIdx: index('unmatched_transactions_status_idx').on(table.status),
    createdAtIdx: index('unmatched_transactions_created_at_idx').on(table.createdAt),
  })
);

/**
 * Reconciliation Alerts
 * 
 * Tracks alerts sent to finance officers and system admins when discrepancies are found.
 */
export const reconciliationAlerts = pgTable(
  'reconciliation_alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reconciliationLogId: uuid('reconciliation_log_id').references(() => reconciliationLogs.id),
    alertType: varchar('alert_type', { length: 50 }).notNull(), // 'discrepancy' | 'unmatched_transaction' | 'anomaly'
    severity: varchar('severity', { length: 20 }).notNull(), // 'low' | 'medium' | 'high' | 'critical'
    message: varchar('message', { length: 500 }).notNull(),
    sentTo: jsonb('sent_to').notNull(), // Array of user IDs who received the alert
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
    acknowledgedAt: timestamp('acknowledged_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    typeIdx: index('reconciliation_alerts_type_idx').on(table.alertType),
    severityIdx: index('reconciliation_alerts_severity_idx').on(table.severity),
    createdAtIdx: index('reconciliation_alerts_created_at_idx').on(table.createdAt),
  })
);

// Type exports for TypeScript
export type ReconciliationLog = typeof reconciliationLogs.$inferSelect;
export type NewReconciliationLog = typeof reconciliationLogs.$inferInsert;

export type UnmatchedTransaction = typeof unmatchedTransactions.$inferSelect;
export type NewUnmatchedTransaction = typeof unmatchedTransactions.$inferInsert;

export type ReconciliationAlert = typeof reconciliationAlerts.$inferSelect;
export type NewReconciliationAlert = typeof reconciliationAlerts.$inferInsert;
