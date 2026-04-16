-- Add before/after fields to deposit_events table for complete transaction history
-- This allows the UI to show "₦X → ₦Y" transitions

ALTER TABLE deposit_events
ADD COLUMN balance_before NUMERIC(12, 2),
ADD COLUMN frozen_before NUMERIC(12, 2),
ADD COLUMN available_before NUMERIC(12, 2),
ADD COLUMN available_after NUMERIC(12, 2);

-- Add comment explaining the fields
COMMENT ON COLUMN deposit_events.balance_before IS 'Total wallet balance before the event';
COMMENT ON COLUMN deposit_events.balance_after IS 'Total wallet balance after the event';
COMMENT ON COLUMN deposit_events.frozen_before IS 'Frozen amount before the event';
COMMENT ON COLUMN deposit_events.frozen_after IS 'Frozen amount after the event';
COMMENT ON COLUMN deposit_events.available_before IS 'Available balance before the event';
COMMENT ON COLUMN deposit_events.available_after IS 'Available balance after the event';

-- Note: These fields are nullable for backward compatibility with existing records
-- New records should always populate these fields
