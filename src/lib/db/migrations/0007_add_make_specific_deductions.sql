-- Migration: Add make-specific support to damage deductions
-- Feature: make-specific-damage-deductions
-- Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 8.4

-- Begin transaction for atomic migration
BEGIN;

-- Store record count before migration for validation
DO $$
DECLARE
  record_count_before INTEGER;
  record_count_after INTEGER;
  null_make_count INTEGER;
  invalid_range_count INTEGER;
  invalid_low_high_count INTEGER;
BEGIN
  -- Get initial record count
  SELECT COUNT(*) INTO record_count_before FROM damage_deductions;
  RAISE NOTICE 'Records before migration: %', record_count_before;

  -- Step 1: Add new columns
  RAISE NOTICE 'Step 1: Adding new columns...';
  ALTER TABLE damage_deductions 
    ADD COLUMN make varchar(100),
    ADD COLUMN repair_cost_low numeric(12, 2),
    ADD COLUMN repair_cost_high numeric(12, 2),
    ADD COLUMN valuation_deduction_low numeric(12, 2),
    ADD COLUMN valuation_deduction_high numeric(12, 2),
    ADD COLUMN notes text;

  -- Step 2: Migrate existing Toyota records
  RAISE NOTICE 'Step 2: Migrating existing data to Toyota...';
  
  -- Set make to 'Toyota' for all existing records
  UPDATE damage_deductions SET make = 'Toyota';
  
  -- Copy repair cost estimate to both low and high
  UPDATE damage_deductions 
  SET 
    repair_cost_low = repair_cost_estimate,
    repair_cost_high = repair_cost_estimate;
  
  -- Calculate valuation deduction ranges (±10% of original percentage)
  UPDATE damage_deductions 
  SET 
    valuation_deduction_low = valuation_deduction_percent * 0.90,
    valuation_deduction_high = valuation_deduction_percent * 1.10;
  
  -- Copy description to notes
  UPDATE damage_deductions 
  SET notes = description;

  -- Step 3: Update unique constraint
  RAISE NOTICE 'Step 3: Updating unique constraint...';
  
  -- Drop old unique constraint
  ALTER TABLE damage_deductions 
    DROP CONSTRAINT damage_deductions_component_damage_level_unique;
  
  -- Add new unique constraint including make
  ALTER TABLE damage_deductions 
    ADD CONSTRAINT damage_deductions_make_component_level_unique 
    UNIQUE(make, component, damage_level);

  -- Step 4: Add index on make field
  RAISE NOTICE 'Step 4: Adding index on make field...';
  CREATE INDEX idx_deductions_make ON damage_deductions(make);

  -- Step 5: Drop deprecated columns
  RAISE NOTICE 'Step 5: Dropping deprecated columns...';
  ALTER TABLE damage_deductions 
    DROP COLUMN repair_cost_estimate,
    DROP COLUMN valuation_deduction_percent,
    DROP COLUMN description;

  -- Step 6: Validation checks
  RAISE NOTICE 'Step 6: Running validation checks...';
  
  -- Verify record count matches
  SELECT COUNT(*) INTO record_count_after FROM damage_deductions;
  IF record_count_after != record_count_before THEN
    RAISE EXCEPTION 'Record count mismatch: before=%, after=%', record_count_before, record_count_after;
  END IF;
  RAISE NOTICE 'Record count validation passed: %', record_count_after;
  
  -- Verify all records have non-null make
  SELECT COUNT(*) INTO null_make_count FROM damage_deductions WHERE make IS NULL;
  IF null_make_count > 0 THEN
    RAISE EXCEPTION 'Found % records with NULL make after migration', null_make_count;
  END IF;
  RAISE NOTICE 'Make field validation passed: all records have non-null make';
  
  -- Verify all range fields are valid (non-null and numeric)
  SELECT COUNT(*) INTO invalid_range_count 
  FROM damage_deductions 
  WHERE repair_cost_low IS NULL 
     OR repair_cost_high IS NULL
     OR valuation_deduction_low IS NULL
     OR valuation_deduction_high IS NULL;
  IF invalid_range_count > 0 THEN
    RAISE EXCEPTION 'Found % records with NULL range fields', invalid_range_count;
  END IF;
  RAISE NOTICE 'Range field validation passed: all range fields populated';
  
  -- Verify low <= high for all ranges
  SELECT COUNT(*) INTO invalid_low_high_count 
  FROM damage_deductions 
  WHERE repair_cost_low > repair_cost_high
     OR valuation_deduction_low > valuation_deduction_high;
  IF invalid_low_high_count > 0 THEN
    RAISE EXCEPTION 'Found % records where low > high', invalid_low_high_count;
  END IF;
  RAISE NOTICE 'Low/High validation passed: all low values <= high values';
  
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Total records migrated: %', record_count_after;
END $$;

-- Commit transaction
COMMIT;

-- Add comments for documentation
COMMENT ON COLUMN damage_deductions.make IS 'Vehicle manufacturer (e.g., Toyota, Audi). Nullable for generic deductions applicable to all makes.';
COMMENT ON COLUMN damage_deductions.repair_cost_low IS 'Minimum estimated repair cost in NGN';
COMMENT ON COLUMN damage_deductions.repair_cost_high IS 'Maximum estimated repair cost in NGN';
COMMENT ON COLUMN damage_deductions.valuation_deduction_low IS 'Minimum valuation deduction amount in NGN';
COMMENT ON COLUMN damage_deductions.valuation_deduction_high IS 'Maximum valuation deduction amount in NGN';
COMMENT ON COLUMN damage_deductions.notes IS 'Additional context about repair costs, parts availability, or make-specific considerations';
