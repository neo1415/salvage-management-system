import { pgTable, uuid, varchar, text, timestamp, jsonb, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';
import { vendors } from './vendors';

export type VerificationStatus =
  | 'pending'
  | 'passed'
  | 'failed'
  | 'review_required'
  | 'provider_unavailable'
  | 'expired';

export type VerificationRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export const providerVerificationRecords = pgTable('provider_verification_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: varchar('provider', { length: 50 }).notNull().default('dojah'),
  providerReference: varchar('provider_reference', { length: 150 }),
  workflowReference: varchar('workflow_reference', { length: 150 }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  vendorId: uuid('vendor_id').references(() => vendors.id, { onDelete: 'cascade' }),
  verificationType: varchar('verification_type', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  riskLevel: varchar('risk_level', { length: 30 }).notNull().default('low'),
  checksCompleted: jsonb('checks_completed').$type<string[]>().notNull().default([]),
  pendingChecks: jsonb('pending_checks').$type<string[]>().notNull().default([]),
  failedChecks: jsonb('failed_checks').$type<string[]>().notNull().default([]),
  reasonCodes: jsonb('reason_codes').$type<string[]>().notNull().default([]),
  displayMessage: text('display_message'),
  normalizedResult: jsonb('normalized_result').$type<Record<string, unknown>>(),
  rawPayloadEncrypted: text('raw_payload_encrypted'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  finalDecision: varchar('final_decision', { length: 50 }),
  decisionReason: text('decision_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  providerReferenceIdx: index('idx_provider_verifications_reference').on(table.provider, table.providerReference),
  workflowReferenceIdx: index('idx_provider_verifications_workflow').on(table.workflowReference),
  vendorStatusIdx: index('idx_provider_verifications_vendor_status').on(table.vendorId, table.status),
  riskLevelIdx: index('idx_provider_verifications_risk_level').on(table.riskLevel),
  createdAtIdx: index('idx_provider_verifications_created_at').on(table.createdAt),
  providerTypeReferenceUnique: uniqueIndex('uq_provider_verification_reference_type')
    .on(table.provider, table.providerReference, table.verificationType),
}));

export const providerWebhookEvents = pgTable('provider_webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: varchar('provider', { length: 50 }).notNull().default('dojah'),
  eventId: varchar('event_id', { length: 200 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  providerReference: varchar('provider_reference', { length: 150 }),
  workflowReference: varchar('workflow_reference', { length: 150 }),
  signatureValid: boolean('signature_valid').notNull().default(false),
  processingStatus: varchar('processing_status', { length: 50 }).notNull().default('received'),
  rawPayloadEncrypted: text('raw_payload_encrypted'),
  errorMessage: text('error_message'),
  receivedAt: timestamp('received_at').notNull().defaultNow(),
  processedAt: timestamp('processed_at'),
}, (table) => ({
  providerEventUnique: uniqueIndex('uq_provider_webhook_event').on(table.provider, table.eventId),
  referenceIdx: index('idx_provider_webhook_events_reference').on(table.providerReference),
  statusIdx: index('idx_provider_webhook_events_status').on(table.processingStatus),
  receivedAtIdx: index('idx_provider_webhook_events_received_at').on(table.receivedAt),
}));
