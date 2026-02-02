-- Add notification preferences column to users table
ALTER TABLE users ADD COLUMN notification_preferences JSONB NOT NULL DEFAULT '{
  "pushEnabled": true,
  "smsEnabled": true,
  "emailEnabled": true,
  "bidAlerts": true,
  "auctionEnding": true,
  "paymentReminders": true,
  "leaderboardUpdates": true
}'::jsonb;

-- Add index for faster queries
CREATE INDEX idx_users_notification_preferences ON users USING GIN (notification_preferences);

-- Add comment for documentation
COMMENT ON COLUMN users.notification_preferences IS 'User notification channel and type preferences. Critical notifications (OTP, payment deadlines, account suspension) cannot be disabled.';
