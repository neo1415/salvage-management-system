-- Add insurer-facing workflow fields without changing the physical asset enum.
-- asset_type remains the AI/vendor matching category.

ALTER TABLE salvage_cases
  ADD COLUMN IF NOT EXISTS insurance_class varchar(80),
  ADD COLUMN IF NOT EXISTS broker_name varchar(255),
  ADD COLUMN IF NOT EXISTS agency_name varchar(255),
  ADD COLUMN IF NOT EXISTS branch_name varchar(150);

UPDATE salvage_cases
SET insurance_class = CASE asset_type
  WHEN 'vehicle' THEN 'motor'
  WHEN 'property' THEN 'fire'
  WHEN 'electronics' THEN 'goods_in_transit'
  WHEN 'machinery' THEN 'engineering'
  ELSE 'other'
END
WHERE insurance_class IS NULL;

CREATE INDEX IF NOT EXISTS idx_cases_insurance_class
  ON salvage_cases (insurance_class);

CREATE INDEX IF NOT EXISTS idx_cases_branch_name
  ON salvage_cases (branch_name);

CREATE INDEX IF NOT EXISTS idx_cases_broker_name
  ON salvage_cases (broker_name);

CREATE INDEX IF NOT EXISTS idx_cases_agency_name
  ON salvage_cases (agency_name);
