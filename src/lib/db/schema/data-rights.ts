import { pgEnum, pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';

export const dataRightRequestTypeEnum = pgEnum('data_right_request_type', [
  'access',
  'export',
  'correction',
  'deactivation',
  'deletion',
  'restriction',
  'objection',
]);

export const dataRightRequestStatusEnum = pgEnum('data_right_request_status', [
  'submitted',
  'in_review',
  'completed',
  'rejected',
  'cancelled',
]);

export const dataRightRequests = pgTable('data_right_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  type: dataRightRequestTypeEnum('type').notNull(),
  status: dataRightRequestStatusEnum('status').notNull().default('submitted'),
  reason: text('reason'),
  requestedData: jsonb('requested_data').$type<Record<string, unknown>>(),
  responseNotes: text('response_notes'),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
