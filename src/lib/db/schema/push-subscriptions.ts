import { pgTable, uuid, varchar, text, timestamp, jsonb, index, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Push Subscriptions Schema
 * 
 * Stores Web Push API subscriptions for users to enable push notifications.
 * Each user can have multiple subscriptions (different devices/browsers).
 * 
 * Requirements: Push Notification System
 */

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(), // Public key for encryption
  auth: text('auth').notNull(), // Authentication secret
  userAgent: text('user_agent'), // Browser/device info
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
}, (table) => ({
  userIdIdx: index('idx_push_subscriptions_user_id').on(table.userId),
  endpointIdx: index('idx_push_subscriptions_endpoint').on(table.endpoint),
  activeIdx: index('idx_push_subscriptions_active').on(table.active),
}));

/**
 * Notification Preferences Schema
 * 
 * Stores user preferences for different notification channels and types.
 * 
 * Requirements: Push Notification System
 */

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  
  // Channel preferences
  pushEnabled: boolean('push_enabled').notNull().default(true),
  smsEnabled: boolean('sms_enabled').notNull().default(true),
  emailEnabled: boolean('email_enabled').notNull().default(true),
  
  // Notification type preferences
  bidAlerts: boolean('bid_alerts').notNull().default(true),
  auctionEnding: boolean('auction_ending').notNull().default(true),
  paymentReminders: boolean('payment_reminders').notNull().default(true),
  leaderboardUpdates: boolean('leaderboard_updates').notNull().default(false),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_notification_preferences_user_id').on(table.userId),
}));

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
