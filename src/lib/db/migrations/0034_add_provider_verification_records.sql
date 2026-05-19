BEGIN;

CREATE TABLE IF NOT EXISTS provider_verification_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(50) NOT NULL DEFAULT 'dojah',
  provider_reference varchar(150),
  workflow_reference varchar(150),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES vendors(id) ON DELETE CASCADE,
  verification_type varchar(50) NOT NULL,
  status varchar(50) NOT NULL,
  risk_level varchar(30) NOT NULL DEFAULT 'low',
  checks_completed jsonb NOT NULL DEFAULT '[]'::jsonb,
  pending_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  failed_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_message text,
  normalized_result jsonb,
  raw_payload_encrypted text,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp,
  final_decision varchar(50),
  decision_reason text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_verification_reference_type
  ON provider_verification_records(provider, provider_reference, verification_type);
CREATE INDEX IF NOT EXISTS idx_provider_verifications_reference
  ON provider_verification_records(provider, provider_reference);
CREATE INDEX IF NOT EXISTS idx_provider_verifications_workflow
  ON provider_verification_records(workflow_reference);
CREATE INDEX IF NOT EXISTS idx_provider_verifications_vendor_status
  ON provider_verification_records(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_provider_verifications_risk_level
  ON provider_verification_records(risk_level);
CREATE INDEX IF NOT EXISTS idx_provider_verifications_created_at
  ON provider_verification_records(created_at DESC);

CREATE TABLE IF NOT EXISTS provider_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(50) NOT NULL DEFAULT 'dojah',
  event_id varchar(200) NOT NULL,
  event_type varchar(100) NOT NULL,
  provider_reference varchar(150),
  workflow_reference varchar(150),
  signature_valid boolean NOT NULL DEFAULT false,
  processing_status varchar(50) NOT NULL DEFAULT 'received',
  raw_payload_encrypted text,
  error_message text,
  received_at timestamp NOT NULL DEFAULT now(),
  processed_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_webhook_event
  ON provider_webhook_events(provider, event_id);
CREATE INDEX IF NOT EXISTS idx_provider_webhook_events_reference
  ON provider_webhook_events(provider_reference);
CREATE INDEX IF NOT EXISTS idx_provider_webhook_events_status
  ON provider_webhook_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_provider_webhook_events_received_at
  ON provider_webhook_events(received_at DESC);

ALTER TABLE provider_verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON provider_verification_records FROM anon, authenticated;
REVOKE ALL ON provider_webhook_events FROM anon, authenticated;

COMMIT;
