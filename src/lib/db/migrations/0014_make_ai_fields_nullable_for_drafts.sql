-- Migration: Make AI assessment fields nullable for draft cases
-- This allows draft cases to be saved without completing AI assessment
-- Created: 2024

-- Make damage severity nullable (drafts may not have AI assessment yet)
ALTER TABLE salvage_cases 
  ALTER COLUMN damage_severity DROP NOT NULL;

-- Make estimated salvage value nullable (drafts may not have AI assessment yet)
ALTER TABLE salvage_cases 
  ALTER COLUMN estimated_salvage_value DROP NOT NULL;

-- Make reserve price nullable (drafts may not have AI assessment yet)
ALTER TABLE salvage_cases 
  ALTER COLUMN reserve_price DROP NOT NULL;

-- Make ai_assessment nullable (drafts may not have AI assessment yet)
ALTER TABLE salvage_cases 
  ALTER COLUMN ai_assessment DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN salvage_cases.damage_severity IS 'Damage severity from AI assessment. Nullable for draft cases that have not completed AI assessment.';
COMMENT ON COLUMN salvage_cases.estimated_salvage_value IS 'Estimated salvage value from AI assessment. Nullable for draft cases that have not completed AI assessment.';
COMMENT ON COLUMN salvage_cases.reserve_price IS 'Reserve price calculated from AI assessment. Nullable for draft cases that have not completed AI assessment.';
COMMENT ON COLUMN salvage_cases.ai_assessment IS 'AI assessment results. Nullable for draft cases that have not completed AI assessment.';
