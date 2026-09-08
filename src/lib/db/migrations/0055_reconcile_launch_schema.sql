-- Additive parity for objects previously applied directly to production.
ALTER TABLE bids ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE bids ADD COLUMN IF NOT EXISTS device_fingerprint varchar(64);
ALTER TABLE deposit_events ADD COLUMN IF NOT EXISTS balance_before numeric(12,2);
ALTER TABLE deposit_events ADD COLUMN IF NOT EXISTS frozen_before numeric(12,2);
ALTER TABLE deposit_events ADD COLUMN IF NOT EXISTS available_before numeric(12,2);
ALTER TABLE deposit_events ADD COLUMN IF NOT EXISTS available_after numeric(12,2);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='deposit_events' AND column_name='auction_id' AND udt_name <> 'uuid') THEN
    ALTER TABLE deposit_events ALTER COLUMN auction_id TYPE uuid USING auction_id::uuid;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS fraud_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), type varchar(50) NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_email varchar(255) NOT NULL, user_name varchar(255) NOT NULL,
  ip_address varchar(45) NOT NULL, user_agent text, attempted_data jsonb NOT NULL,
  matched_data jsonb, confidence numeric(3,2), timestamp timestamp NOT NULL,
  reviewed boolean DEFAULT false, reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamp, review_notes text, created_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vendor_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  interaction_type varchar(20) NOT NULL, timestamp timestamp NOT NULL,
  metadata jsonb, created_at timestamp DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vendor_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  match_score numeric(5,2) NOT NULL, reason text NOT NULL,
  metadata jsonb, created_at timestamp DEFAULT now(), expires_at timestamp
);
CREATE TABLE IF NOT EXISTS verification_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  verification_type varchar(50) NOT NULL, cost_amount numeric(10,2) NOT NULL,
  currency varchar(3) NOT NULL DEFAULT 'NGN', dojah_reference_id varchar(100),
  created_at timestamp NOT NULL DEFAULT now()
);
ALTER TABLE fraud_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_costs ENABLE ROW LEVEL SECURITY;
