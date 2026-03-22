-- Migration: Add Notifications System
-- Description: Creates notifications table for in-app notification center
-- Date: 2026-01-21
-- Phase: 3 - Global Notification System

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);

-- Add comment for documentation
COMMENT ON TABLE notifications IS 'In-app notifications for all users. Supports 8 vendor notification types and system notifications.';
COMMENT ON COLUMN notifications.type IS 'Notification type: outbid, auction_won, auction_lost, auction_closing_soon, new_auction, otp_sent, payment_reminder, kyc_update, system_alert, account_update';
COMMENT ON COLUMN notifications.data IS 'Additional context as JSON: auctionId, bidAmount, caseId, paymentId, deadline, tier, etc.';
