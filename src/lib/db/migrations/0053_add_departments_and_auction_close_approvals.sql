CREATE TABLE IF NOT EXISTS departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(80) NOT NULL UNIQUE,
  name varchar(160) NOT NULL,
  kind varchar(20) NOT NULL DEFAULT 'claims' CHECK (kind IN ('executive', 'claims', 'support')),
  insurance_classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS departments_active_idx ON departments (is_active);

INSERT INTO departments (code, name, kind, is_system)
VALUES
  ('managing_director', 'Managing Director', 'executive', true),
  ('executive_director', 'Executive Director', 'executive', true),
  ('head_of_claims', 'Head of Claims', 'executive', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  is_system = true,
  is_active = true,
  updated_at = now();

ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_department_head boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS users_department_idx ON users (department_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_one_department_head_idx
  ON users (department_id)
  WHERE department_id IS NOT NULL AND is_department_head = true AND status <> 'deleted';

CREATE TABLE IF NOT EXISTS auction_early_close_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'failed')),
  reviewed_by uuid REFERENCES users(id),
  review_note text,
  requested_at timestamp NOT NULL DEFAULT now(),
  reviewed_at timestamp,
  executed_at timestamp,
  failure_reason text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auction_early_close_auction_idx ON auction_early_close_requests (auction_id);
CREATE INDEX IF NOT EXISTS auction_early_close_status_idx ON auction_early_close_requests (status);
CREATE INDEX IF NOT EXISTS auction_early_close_requester_idx ON auction_early_close_requests (requested_by);
CREATE UNIQUE INDEX IF NOT EXISTS auction_early_close_one_pending_idx
  ON auction_early_close_requests (auction_id)
  WHERE status IN ('pending', 'processing');

-- Legacy auction deposits remain available for a deliberate future rollout, but are disabled now.
UPDATE system_config
SET value = 'false', updated_at = now()
WHERE parameter = 'deposit_system_enabled';
