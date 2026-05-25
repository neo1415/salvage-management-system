import { boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';
import type { BusinessPolicy, PolicyValidationResult } from '@/features/business-policy/types';

export const businessPolicyVersions = pgTable(
  'business_policy_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    version: varchar('version', { length: 120 }).notNull(),
    status: varchar('status', { length: 30 }).notNull().default('draft'),
    active: boolean('active').notNull().default(false),
    policy: jsonb('policy').$type<BusinessPolicy>().notNull(),
    validationResult: jsonb('validation_result').$type<PolicyValidationResult>(),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id),
    publishedBy: uuid('published_by').references(() => users.id),
    publishedAt: timestamp('published_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    statusCreatedAtIdx: index('idx_business_policy_versions_status_created_at').on(
      table.status,
      table.createdAt
    ),
    activeIdx: index('idx_business_policy_versions_active').on(table.active),
    versionIdx: index('idx_business_policy_versions_version').on(table.version),
  })
);

export const businessPolicySnapshots = pgTable(
  'business_policy_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    policyVersionId: uuid('policy_version_id').references(() => businessPolicyVersions.id),
    policyVersion: varchar('policy_version', { length: 120 }).notNull(),
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    entityId: varchar('entity_id', { length: 255 }).notNull(),
    policy: jsonb('policy').$type<BusinessPolicy>().notNull(),
    reason: text('reason'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    entityIdx: index('idx_business_policy_snapshots_entity').on(table.entityType, table.entityId),
    policyVersionIdx: index('idx_business_policy_snapshots_policy_version').on(table.policyVersion),
  })
);
