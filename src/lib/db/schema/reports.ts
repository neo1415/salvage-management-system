/**
 * Reporting System Database Schema
 * 
 * Defines tables for comprehensive reporting system:
 * - report_templates: Reusable report configurations
 * - scheduled_reports: Automated report generation
 * - report_cache: Performance optimization
 * - report_audit_log: Compliance and security tracking
 * - report_favorites: User favorites for quick access
 * 
 * Requirements: Task 2 - Database Schema
 */

import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, boolean, index, unique } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Report Templates Table
 * Stores reusable report configurations
 */
export const reportTemplates = pgTable('report_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(), // 'financial', 'operational', 'user_performance', etc.
  description: text('description'),
  config: jsonb('config').notNull(), // Report configuration
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  typeIdx: index('idx_report_templates_type').on(table.type),
  createdByIdx: index('idx_report_templates_created_by').on(table.createdBy),
}));

/**
 * Scheduled Reports Table
 * Manages automated report generation and distribution
 */
export const scheduledReports = pgTable('scheduled_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reportType: varchar('report_type', { length: 100 }).notNull(),
  frequency: varchar('frequency', { length: 50 }).notNull(), // 'daily', 'weekly', 'monthly', 'quarterly'
  scheduleConfig: jsonb('schedule_config').notNull(), // Cron expression, day, time, etc.
  recipients: jsonb('recipients').notNull(), // Array of email addresses
  filters: jsonb('filters'), // Report filters
  format: varchar('format', { length: 20 }).notNull().default('pdf'), // 'pdf', 'excel', 'csv'
  lastRun: timestamp('last_run'),
  nextRun: timestamp('next_run'),
  status: varchar('status', { length: 50 }).default('active'), // 'active', 'paused', 'failed'
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  userIdx: index('idx_scheduled_reports_user').on(table.userId),
  nextRunIdx: index('idx_scheduled_reports_next_run').on(table.nextRun),
  statusIdx: index('idx_scheduled_reports_status').on(table.status),
}));

/**
 * Report Cache Table
 * Caches generated report data for performance
 */
export const reportCache = pgTable('report_cache', {
  id: uuid('id').primaryKey().defaultRandom(),
  reportKey: varchar('report_key', { length: 255 }).notNull().unique(), // Hash of type + filters
  reportType: varchar('report_type', { length: 100 }).notNull(),
  filters: jsonb('filters'),
  reportData: jsonb('report_data').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  keyIdx: index('idx_report_cache_key').on(table.reportKey),
  expiresIdx: index('idx_report_cache_expires').on(table.expiresAt),
  typeIdx: index('idx_report_cache_type').on(table.reportType),
}));

/**
 * Report Audit Log Table
 * Tracks all report generation and access for compliance
 */
export const reportAuditLog = pgTable('report_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  reportType: varchar('report_type', { length: 100 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(), // 'generate', 'export', 'schedule', 'share'
  filters: jsonb('filters'),
  exportFormat: varchar('export_format', { length: 20 }), // 'pdf', 'excel', 'csv', 'json'
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  executionTimeMs: integer('execution_time_ms'), // Performance tracking
  success: boolean('success').default(true),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdx: index('idx_report_audit_user').on(table.userId),
  createdIdx: index('idx_report_audit_created').on(table.createdAt),
  typeIdx: index('idx_report_audit_type').on(table.reportType),
  actionIdx: index('idx_report_audit_action').on(table.action),
}));

/**
 * Report Favorites Table
 * Allows users to save favorite reports for quick access
 */
export const reportFavorites = pgTable('report_favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reportType: varchar('report_type', { length: 100 }).notNull(),
  filters: jsonb('filters'),
  name: varchar('name', { length: 255 }), // Custom name
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdx: index('idx_report_favorites_user').on(table.userId),
  // Unique constraint on user + report type + filters
  uniqueIdx: unique('idx_report_favorites_unique').on(table.userId, table.reportType, table.filters),
}));

/**
 * TypeScript types for report data structures
 */

export interface ReportConfig {
  metrics: string[];
  groupBy?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  includeCharts?: boolean;
  chartTypes?: string[];
}

export interface ScheduleConfig {
  cronExpression?: string;
  dayOfWeek?: number; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number; // 1-31
  time: string; // HH:MM format
  timezone: string; // e.g., 'Africa/Lagos'
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  assetTypes?: string[];
  regions?: string[];
  userIds?: string[];
  vendorIds?: string[];
  status?: string[];
  minAmount?: number;
  maxAmount?: number;
}

export interface CachedReportData {
  summary: Record<string, any>;
  details?: any[];
  charts?: any[];
  metadata: {
    generatedAt: string;
    recordCount: number;
    executionTimeMs: number;
  };
}
