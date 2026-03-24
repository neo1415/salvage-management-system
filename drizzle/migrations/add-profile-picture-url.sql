-- Add profile picture URL column to users table
-- Migration: add-profile-picture-url
-- Created: 2025-01-20

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(500);

-- Add index for faster queries (only for non-null values)
CREATE INDEX IF NOT EXISTS idx_users_profile_picture 
ON users(profile_picture_url) 
WHERE profile_picture_url IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.profile_picture_url IS 'Cloudinary URL for user profile picture. Stored in profile-pictures/{role}s/{userId}/ folder.';
