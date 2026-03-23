import { pgTable, uuid, timestamp, varchar, jsonb } from 'drizzle-orm/pg-core';
import { users, deviceTypeEnum } from './users';

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  actionType: varchar('action_type', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: varchar('entity_id', { length: 255 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  deviceType: deviceTypeEnum('device_type').notNull(),
  userAgent: varchar('user_agent', { length: 500 }).notNull(),
  beforeState: jsonb('before_state').$type<Record<string, unknown>>(),
  afterState: jsonb('after_state').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Indexes are created via SQL in migrations
// CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
// CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
// CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
// CREATE INDEX idx_audit_logs_entity_id ON audit_logs(entity_id);
// CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
