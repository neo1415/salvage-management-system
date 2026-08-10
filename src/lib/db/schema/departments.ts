import { boolean, index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export type DepartmentKind = 'executive' | 'claims' | 'support';

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 160 }).notNull(),
  kind: varchar('kind', { length: 20 }).$type<DepartmentKind>().notNull().default('claims'),
  insuranceClasses: jsonb('insurance_classes').$type<string[]>().notNull().default([]),
  isSystem: boolean('is_system').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  codeIdx: uniqueIndex('departments_code_idx').on(table.code),
  activeIdx: index('departments_active_idx').on(table.isActive),
}));

export const EXECUTIVE_DEPARTMENT_CODES = [
  'managing_director',
  'executive_director',
  'head_of_claims',
] as const;

