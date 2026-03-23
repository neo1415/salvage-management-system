import { pgTable, uuid, varchar, integer, timestamp, text, index } from 'drizzle-orm/pg-core';

/**
 * Seed Registry Table
 * 
 * Tracks execution history of seed scripts to enable idempotent seeding.
 * Each seed script execution is recorded with its status, record counts,
 * and execution time for audit and debugging purposes.
 * 
 * Feature: enterprise-data-seeding-system
 * Requirements: 5.2, 11.1
 */
export const seedRegistry = pgTable('seed_registry', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // Script identification
  scriptName: varchar('script_name', { length: 255 }).notNull().unique(),
  
  // Execution tracking
  executedAt: timestamp('executed_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull(), // 'running', 'completed', 'failed'
  
  // Record statistics
  recordsAffected: integer('records_affected').default(0),
  recordsImported: integer('records_imported').default(0),
  recordsUpdated: integer('records_updated').default(0),
  recordsSkipped: integer('records_skipped').default(0),
  
  // Error tracking
  errorMessage: text('error_message'),
  
  // Performance tracking
  executionTimeMs: integer('execution_time_ms'),
  
  // Metadata
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Indexes for fast lookups
  scriptNameIdx: index('idx_seed_registry_script_name').on(table.scriptName),
  statusIdx: index('idx_seed_registry_status').on(table.status),
  executedAtIdx: index('idx_seed_registry_executed_at').on(table.executedAt),
}));

/**
 * TypeScript type for seed registry records
 */
export type SeedRegistry = typeof seedRegistry.$inferSelect;
export type NewSeedRegistry = typeof seedRegistry.$inferInsert;

/**
 * Seed execution status enum
 */
export type SeedStatus = 'running' | 'completed' | 'failed';

/**
 * Seed execution statistics interface
 */
export interface SeedExecutionStats {
  recordsImported: number;
  recordsUpdated: number;
  recordsSkipped: number;
  executionTimeMs: number;
}
