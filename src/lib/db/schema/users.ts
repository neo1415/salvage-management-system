import { pgTable, uuid, varchar, timestamp, pgEnum, jsonb } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'vendor',
  'claims_adjuster',
  'salvage_manager',
  'finance_officer',
  'system_admin',
]);

export const userStatusEnum = pgEnum('user_status', [
  'unverified_tier_0',
  'phone_verified_tier_0',
  'verified_tier_1',
  'verified_tier_2',
  'suspended',
  'deleted',
]);

export const deviceTypeEnum = pgEnum('device_type', ['mobile', 'desktop', 'tablet']);

export interface NotificationPreferences {
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  bidAlerts: boolean;
  auctionEnding: boolean;
  paymentReminders: boolean;
  leaderboardUpdates: boolean;
}

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  status: userStatusEnum('status').notNull().default('unverified_tier_0'),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  dateOfBirth: timestamp('date_of_birth').notNull(),
  notificationPreferences: jsonb('notification_preferences')
    .notNull()
    .$type<NotificationPreferences>()
    .default({
      pushEnabled: true,
      smsEnabled: true,
      emailEnabled: true,
      bidAlerts: true,
      auctionEnding: true,
      paymentReminders: true,
      leaderboardUpdates: true,
    }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
  loginDeviceType: deviceTypeEnum('login_device_type'),
});

// Indexes are created via SQL in migrations
// CREATE INDEX idx_users_email ON users(email);
// CREATE INDEX idx_users_phone ON users(phone);
// CREATE INDEX idx_users_role ON users(role);
// CREATE INDEX idx_users_status ON users(status);
// CREATE INDEX idx_users_notification_preferences ON users USING GIN (notification_preferences);
