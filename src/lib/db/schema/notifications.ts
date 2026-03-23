import { pgTable, uuid, varchar, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Notifications Schema
 * 
 * Stores in-app notifications for users across all roles.
 * Supports 8 notification types for vendors and system notifications for other roles.
 * 
 * Requirements: Phase 3 - Global Notification System
 */

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 50 }).notNull(), // 'outbid', 'auction_won', 'auction_lost', etc.
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  data: jsonb('data'), // Additional context: { auctionId, bidAmount, etc. }
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_notifications_user_id').on(table.userId),
  readIdx: index('idx_notifications_read').on(table.read),
  createdAtIdx: index('idx_notifications_created_at').on(table.createdAt),
  userReadIdx: index('idx_notifications_user_read').on(table.userId, table.read),
}));

/**
 * Notification Types
 * 
 * Vendor Notifications (8 types):
 * - outbid: "You've been outbid!" with auction details
 * - auction_won: "Congratulations! You won the auction"
 * - auction_lost: "Auction closed" (generic, don't reveal winner)
 * - auction_closing_soon: "Auction ending in 1 hour/30 minutes"
 * - new_auction: "New auction matching your interests"
 * - otp_sent: "OTP sent to your phone"
 * - payment_reminder: "Payment deadline approaching"
 * - kyc_update: "KYC status updated"
 * 
 * System Notifications (all roles):
 * - system_alert: General system announcements
 * - account_update: Account-related changes
 */

export type NotificationType =
  | 'outbid'
  | 'auction_won'
  | 'auction_lost'
  | 'auction_closing_soon'
  | 'new_auction'
  | 'otp_sent'
  | 'payment_reminder'
  | 'payment_success'
  | 'kyc_update'
  | 'system_alert'
  | 'account_update'
  | 'DOCUMENT_GENERATED'
  | 'SIGNATURE_REQUIRED'
  | 'DOCUMENT_SIGNED'
  | 'PAYMENT_UNLOCKED'
  | 'PICKUP_AUTHORIZATION_READY'
  | 'PICKUP_CONFIRMED_VENDOR'
  | 'PICKUP_CONFIRMED_ADMIN';

export interface NotificationData {
  auctionId?: string;
  bidAmount?: number;
  caseId?: string;
  paymentId?: string;
  deadline?: string;
  tier?: string;
  documentId?: string;
  documentType?: string;
  vendorId?: string;
  vendorName?: string;
  confirmedAt?: string;
  [key: string]: any;
}
