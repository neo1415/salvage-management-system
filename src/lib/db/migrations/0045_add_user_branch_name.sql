ALTER TABLE users
ADD COLUMN IF NOT EXISTS branch_name VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_users_branch_name
ON users(branch_name)
WHERE branch_name IS NOT NULL;
