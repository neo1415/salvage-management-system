-- 0040_add_data_right_requests.sql
-- Adds a first-party privacy/data-rights request workflow for NDPA/GDPR-style
-- access, export, correction, deactivation, deletion, restriction, and objection
-- requests. Fulfilment remains policy/legal-review driven.

DO $$ BEGIN
  CREATE TYPE data_right_request_type AS ENUM (
    'access',
    'export',
    'correction',
    'deactivation',
    'deletion',
    'restriction',
    'objection'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE data_right_request_status AS ENUM (
    'submitted',
    'in_review',
    'completed',
    'rejected',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS data_right_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  type data_right_request_type NOT NULL,
  status data_right_request_status NOT NULL DEFAULT 'submitted',
  reason text,
  requested_data jsonb,
  response_notes text,
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_right_requests_user_id ON data_right_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_right_requests_type ON data_right_requests(type);
CREATE INDEX IF NOT EXISTS idx_data_right_requests_status ON data_right_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_right_requests_created_at ON data_right_requests(created_at DESC);
