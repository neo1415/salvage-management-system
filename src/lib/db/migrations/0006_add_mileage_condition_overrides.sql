-- Migration: Add mileage, condition, and price override fields to salvage_cases
-- Feature: case-creation-and-approval-enhancements
-- Requirements: 1.1, 2.1, 6.4, 7.1

-- Add new columns to salvage_cases table
ALTER TABLE salvage_cases
ADD COLUMN vehicle_mileage INTEGER,
ADD COLUMN vehicle_condition VARCHAR(20) CHECK (vehicle_condition IN ('excellent', 'good', 'fair', 'poor')),
ADD COLUMN ai_estimates JSONB,
ADD COLUMN manager_overrides JSONB;

-- Create indexes for performance
CREATE INDEX idx_salvage_cases_mileage ON salvage_cases(vehicle_mileage);
CREATE INDEX idx_salvage_cases_condition ON salvage_cases(vehicle_condition);

-- Add comments for documentation
COMMENT ON COLUMN salvage_cases.vehicle_mileage IS 'Odometer reading in kilometers (optional)';
COMMENT ON COLUMN salvage_cases.vehicle_condition IS 'Pre-accident condition: excellent, good, fair, poor (optional)';
COMMENT ON COLUMN salvage_cases.ai_estimates IS 'Original AI price estimates before manager overrides';
COMMENT ON COLUMN salvage_cases.manager_overrides IS 'Manager price adjustments with reason and metadata';
