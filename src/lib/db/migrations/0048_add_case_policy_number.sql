ALTER TABLE salvage_cases
  ADD COLUMN IF NOT EXISTS policy_number VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_cases_policy_number
  ON salvage_cases(policy_number)
  WHERE policy_number IS NOT NULL;
