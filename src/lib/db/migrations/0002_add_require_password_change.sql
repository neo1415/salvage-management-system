-- Add require_password_change column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS require_password_change VARCHAR(10) DEFAULT 'false';

-- Add comment to explain the column
COMMENT ON COLUMN users.require_password_change IS 'Flag to force password change on first login for staff accounts created by admin';
