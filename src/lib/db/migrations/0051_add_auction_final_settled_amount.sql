-- Batch B5: Price adjustment final settled amount on auctions
-- adjustment_amount from pickup evidence becomes the authoritative sale price when recorded.

ALTER TABLE auctions
  ADD COLUMN IF NOT EXISTS final_settled_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS price_adjusted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS original_winning_bid NUMERIC(12, 2);

COMMENT ON COLUMN auctions.final_settled_amount IS
  'Authoritative post-pickup sale amount when price_adjustment_recorded; null keeps payment/bid amounts.';

COMMENT ON COLUMN auctions.price_adjusted_at IS
  'Timestamp when final_settled_amount was set during admin pickup confirmation.';

COMMENT ON COLUMN auctions.original_winning_bid IS
  'Winning bid/payment amount preserved before price adjustment for audit.';
