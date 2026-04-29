-- Migration: Add Push Subscriptions and Notification Preferences
-- Created: 2026-04-27
-- Description: Adds tables for Web Push API subscriptions and user notification preferences

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "endpoint" TEXT NOT NULL UNIQUE,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "user_agent" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "last_used_at" TIMESTAMP
);

-- Create indexes for push_subscriptions
CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_user_id" ON "push_subscriptions"("user_id");
CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_endpoint" ON "push_subscriptions"("endpoint");
CREATE INDEX IF NOT EXISTS "idx_push_subscriptions_active" ON "push_subscriptions"("active");

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "push_enabled" BOOLEAN NOT NULL DEFAULT true,
  "sms_enabled" BOOLEAN NOT NULL DEFAULT true,
  "email_enabled" BOOLEAN NOT NULL DEFAULT true,
  "bid_alerts" BOOLEAN NOT NULL DEFAULT true,
  "auction_ending" BOOLEAN NOT NULL DEFAULT true,
  "payment_reminders" BOOLEAN NOT NULL DEFAULT true,
  "leaderboard_updates" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index for notification_preferences
CREATE INDEX IF NOT EXISTS "idx_notification_preferences_user_id" ON "notification_preferences"("user_id");

-- Create default notification preferences for existing users
INSERT INTO "notification_preferences" ("user_id", "push_enabled", "sms_enabled", "email_enabled", "bid_alerts", "auction_ending", "payment_reminders", "leaderboard_updates")
SELECT 
  "id",
  true,
  true,
  true,
  true,
  true,
  true,
  false
FROM "users"
WHERE "id" NOT IN (SELECT "user_id" FROM "notification_preferences");
