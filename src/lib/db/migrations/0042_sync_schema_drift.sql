-- Sync vendor Tier 2 / KYC columns expected by Drizzle schema (missing from SQL-only bootstrap).
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS nin_encrypted varchar(500);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS nin_verification_data jsonb;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS photo_id_url varchar(500);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS photo_id_type varchar(50);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS photo_id_verified_at timestamp;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS selfie_url varchar(500);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS liveness_score numeric(5, 2);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS biometric_match_score numeric(5, 2);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS biometric_verified_at timestamp;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address_proof_url varchar(500);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address_verified_at timestamp;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS aml_screening_data jsonb;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS aml_risk_level varchar(20);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS aml_screened_at timestamp;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS business_type varchar(50);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS cac_form7_url varchar(500);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS director_ids jsonb;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tier2_submitted_at timestamp;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tier2_approved_at timestamp;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tier2_approved_by uuid REFERENCES users(id);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tier2_rejection_reason text;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tier2_expires_at timestamp;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tier2_dojah_reference_id varchar(100);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS fraud_risk_score numeric(5, 2);
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS fraud_flags jsonb;

-- Profile picture (also lives in drizzle/migrations, duplicated here for bootstrap parity)
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url varchar(500);
CREATE INDEX IF NOT EXISTS idx_users_profile_picture ON users(profile_picture_url) WHERE profile_picture_url IS NOT NULL;
