-- Optional cache of full_name split for BVN (parsed at registration). App UI still uses full_name.
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name varchar(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name varchar(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name varchar(100);
