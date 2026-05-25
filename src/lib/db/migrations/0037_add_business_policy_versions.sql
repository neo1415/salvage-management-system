-- Add versioned business policy storage for white-label configuration.
-- Additive only: if no policy is published, the app keeps using current NEM defaults
-- plus the existing legacy system_config overrides.

CREATE TABLE IF NOT EXISTS business_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version varchar(120) NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'draft',
  active boolean NOT NULL DEFAULT false,
  policy jsonb NOT NULL,
  validation_result jsonb,
  notes text,
  created_by uuid REFERENCES users(id),
  published_by uuid REFERENCES users(id),
  published_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT business_policy_versions_status_check
    CHECK (status IN ('draft', 'published', 'archived')),
  CONSTRAINT business_policy_versions_publish_consistency
    CHECK (
      (status = 'published' AND published_at IS NOT NULL)
      OR (status <> 'published')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_policy_versions_one_active
  ON business_policy_versions(active)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_business_policy_versions_status_created_at
  ON business_policy_versions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_policy_versions_active
  ON business_policy_versions(active);

CREATE INDEX IF NOT EXISTS idx_business_policy_versions_version
  ON business_policy_versions(version);

CREATE TABLE IF NOT EXISTS business_policy_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version_id uuid REFERENCES business_policy_versions(id),
  policy_version varchar(120) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id varchar(255) NOT NULL,
  policy jsonb NOT NULL,
  reason text,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_policy_snapshots_entity
  ON business_policy_snapshots(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_business_policy_snapshots_policy_version
  ON business_policy_snapshots(policy_version);
