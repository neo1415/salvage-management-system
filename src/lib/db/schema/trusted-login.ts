import { boolean, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userTrustedLoginContexts = pgTable('user_trusted_login_contexts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  deviceFingerprintHash: varchar('device_fingerprint_hash', { length: 64 }).notNull(),
  ipPrefixHash: varchar('ip_prefix_hash', { length: 64 }).notNull(),
  userAgentHash: varchar('user_agent_hash', { length: 64 }).notNull(),
  successfulLoginCount: integer('successful_login_count').notNull().default(0),
  trusted: boolean('trusted').notNull().default(false),
  trustedAt: timestamp('trusted_at'),
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const loginRiskEvents = pgTable('login_risk_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  deviceFingerprintHash: varchar('device_fingerprint_hash', { length: 64 }).notNull(),
  ipPrefixHash: varchar('ip_prefix_hash', { length: 64 }).notNull(),
  userAgentHash: varchar('user_agent_hash', { length: 64 }).notNull(),
  riskType: varchar('risk_type', { length: 80 }).notNull(),
  riskScore: integer('risk_score').notNull(),
  decision: varchar('decision', { length: 80 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

