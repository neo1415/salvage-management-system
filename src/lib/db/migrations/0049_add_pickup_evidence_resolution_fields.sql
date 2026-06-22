ALTER TABLE pickup_evidence
  ADD COLUMN IF NOT EXISTS resolution_status VARCHAR(60) NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS adjustment_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS reimbursement_method VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_pickup_evidence_resolution_status
  ON pickup_evidence(resolution_status);
