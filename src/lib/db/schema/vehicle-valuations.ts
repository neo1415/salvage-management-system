import { pgTable, uuid, varchar, decimal, integer, timestamp, text, jsonb, index, unique, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';

// Enum for damage levels
export const damageLevelEnum = pgEnum('damage_level', ['minor', 'moderate', 'severe']);

// Vehicle Valuations Table
export const vehicleValuations = pgTable('vehicle_valuations', {
  id: uuid('id').primaryKey().defaultRandom(),
  make: varchar('make', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  year: integer('year').notNull(),
  conditionCategory: varchar('condition_category', { length: 50 }).notNull(),
  
  // Price ranges in NGN
  lowPrice: decimal('low_price', { precision: 12, scale: 2 }).notNull(),
  highPrice: decimal('high_price', { precision: 12, scale: 2 }).notNull(),
  averagePrice: decimal('average_price', { precision: 12, scale: 2 }).notNull(),
  
  // Mileage ranges in kilometers
  mileageLow: integer('mileage_low'),
  mileageHigh: integer('mileage_high'),
  
  // Market intelligence
  marketNotes: text('market_notes'),
  dataSource: varchar('data_source', { length: 100 }).notNull(), // e.g., "Audi Guide 2024"
  
  // Metadata
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Composite unique constraint
  uniqueValuation: unique().on(table.make, table.model, table.year, table.conditionCategory),
  // Indexes for fast lookups
  makeModelIdx: index('idx_valuations_make_model').on(table.make, table.model),
  yearIdx: index('idx_valuations_year').on(table.year),
  makeModelYearIdx: index('idx_valuations_make_model_year').on(table.make, table.model, table.year),
}));

// Damage Deductions Table
export const damageDeductions = pgTable('damage_deductions', {
  id: uuid('id').primaryKey().defaultRandom(),
  make: varchar('make', { length: 100 }), // Nullable for generic deductions
  component: varchar('component', { length: 100 }).notNull(),
  damageLevel: damageLevelEnum('damage_level').notNull(),
  
  // Range-based deduction data
  repairCostLow: decimal('repair_cost_low', { precision: 12, scale: 2 }).notNull(),
  repairCostHigh: decimal('repair_cost_high', { precision: 12, scale: 2 }).notNull(),
  valuationDeductionLow: decimal('valuation_deduction_low', { precision: 12, scale: 2 }).notNull(),
  valuationDeductionHigh: decimal('valuation_deduction_high', { precision: 12, scale: 2 }).notNull(),
  
  // Additional context
  notes: text('notes'),
  
  // Metadata
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  // Composite unique constraint including make
  uniqueDeduction: unique().on(table.make, table.component, table.damageLevel),
  // Indexes for fast lookups
  makeIdx: index('idx_deductions_make').on(table.make),
  componentIdx: index('idx_deductions_component').on(table.component),
}));

// Valuation Audit Log Table
export const valuationAuditLogs = pgTable('valuation_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: varchar('action', { length: 20 }).notNull(), // 'create', 'update', 'delete'
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'valuation', 'deduction'
  entityId: uuid('entity_id').notNull(),
  
  // Change tracking
  changedFields: jsonb('changed_fields').$type<Record<string, { old: any; new: any }>>(),
  
  // User tracking
  userId: uuid('user_id').notNull().references(() => users.id),
  
  // Timestamps
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  entityIdx: index('idx_valuation_audit_entity').on(table.entityType, table.entityId),
  userIdx: index('idx_valuation_audit_user').on(table.userId),
  createdAtIdx: index('idx_valuation_audit_created').on(table.createdAt),
}));
