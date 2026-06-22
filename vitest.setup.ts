import { beforeAll, afterAll, afterEach } from 'vitest';
import { client } from '@/lib/db/drizzle';

// Global test setup
beforeAll(async () => {
  console.log('[Test Setup] Initializing test environment...');
  
  // Verify database connection
  try {
    await client`SELECT 1 as test`;
    await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_name VARCHAR(150)`;
    await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR(500)`;
    await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS require_password_change VARCHAR(10) DEFAULT 'false'`;
    await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{"pushEnabled":true,"smsEnabled":true,"emailEnabled":true,"bidAlerts":true,"auctionEnding":true,"paymentReminders":true,"leaderboardUpdates":true}'::jsonb`;
    await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT false`;
    await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_channel VARCHAR(20) NOT NULL DEFAULT 'email'`;
    await client`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_phone VARCHAR(20)`;
    await client`CREATE INDEX IF NOT EXISTS idx_users_branch_name ON users(branch_name) WHERE branch_name IS NOT NULL`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS nin_encrypted VARCHAR(500)`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS nin_verification_data JSONB`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS photo_id_url VARCHAR(500)`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS photo_id_type VARCHAR(50)`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS photo_id_verified_at TIMESTAMP`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS selfie_url VARCHAR(500)`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS liveness_score NUMERIC(5, 2)`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS biometric_match_score NUMERIC(5, 2)`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS biometric_verified_at TIMESTAMP`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address_proof_url VARCHAR(500)`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS address_verified_at TIMESTAMP`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS aml_screening_data JSONB`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS aml_risk_level VARCHAR(20)`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS aml_screened_at TIMESTAMP`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS business_type VARCHAR(50)`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS cac_form7_url VARCHAR(500)`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS director_ids JSONB`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tier2_submitted_at TIMESTAMP`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tier2_approved_at TIMESTAMP`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tier2_approved_by UUID REFERENCES users(id)`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tier2_rejection_reason TEXT`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tier2_expires_at TIMESTAMP`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS tier2_dojah_reference_id VARCHAR(100)`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS fraud_risk_score NUMERIC(5, 2)`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS fraud_flags JSONB`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS registration_fee_paid BOOLEAN NOT NULL DEFAULT false`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS registration_fee_amount NUMERIC(12, 2)`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS registration_fee_paid_at TIMESTAMP`;
    await client`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS registration_fee_reference VARCHAR(255)`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS policy_number VARCHAR(120)`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS insurance_class VARCHAR(80)`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS broker_name VARCHAR(255)`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS agency_name VARCHAR(255)`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS branch_name VARCHAR(150)`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS asset_type asset_type DEFAULT 'vehicle'`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS asset_details JSONB DEFAULT '{}'::jsonb`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS market_value NUMERIC(12, 2) DEFAULT 0`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS estimated_salvage_value NUMERIC(12, 2)`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS reserve_price NUMERIC(12, 2)`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS damage_severity damage_severity`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS ai_assessment JSONB`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS gps_location POINT DEFAULT point(0, 0)`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS location_accuracy_meters NUMERIC(10, 2)`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS location_source VARCHAR(50)`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS location_captured_at TIMESTAMP`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS location_manual_override BOOLEAN NOT NULL DEFAULT false`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS photos VARCHAR[] DEFAULT ARRAY[]::varchar[]`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS voice_notes VARCHAR[]`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id)`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id)`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS vehicle_mileage INTEGER`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS vehicle_condition VARCHAR(20)`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS ai_estimates JSONB`;
    await client`ALTER TABLE salvage_cases ADD COLUMN IF NOT EXISTS manager_overrides JSONB`;
    await client`
      CREATE TABLE IF NOT EXISTS image_upload_metadata (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type VARCHAR(40) NOT NULL,
        entity_id UUID NOT NULL,
        image_url TEXT NOT NULL,
        image_index NUMERIC(6, 0),
        purpose VARCHAR(80) NOT NULL DEFAULT 'evidence',
        uploaded_by UUID REFERENCES users(id),
        source VARCHAR(80),
        original_filename VARCHAR(255),
        mime_type VARCHAR(120),
        file_size_bytes NUMERIC(14, 0),
        browser_last_modified_at TIMESTAMP,
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
        captured_at TIMESTAMP,
        gps_latitude NUMERIC(10, 7),
        gps_longitude NUMERIC(10, 7),
        gps_altitude NUMERIC(10, 2),
        device_make VARCHAR(120),
        device_model VARCHAR(120),
        device_software VARCHAR(255),
        orientation NUMERIC(4, 0),
        width NUMERIC(8, 0),
        height NUMERIC(8, 0),
        metadata_status VARCHAR(30) NOT NULL DEFAULT 'unavailable',
        metadata_warnings TEXT[],
        sha256_hash VARCHAR(64),
        raw_metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;
    await client`CREATE INDEX IF NOT EXISTS idx_image_metadata_entity ON image_upload_metadata(entity_type, entity_id)`;
    await client`CREATE INDEX IF NOT EXISTS idx_image_metadata_uploaded_by ON image_upload_metadata(uploaded_by)`;
    await client`CREATE INDEX IF NOT EXISTS idx_image_metadata_image_url ON image_upload_metadata(image_url)`;
    console.log('[Test Setup] Database connection verified');
  } catch (error) {
    console.error('[Test Setup] Database connection failed:', error);
    throw error;
  }
});

// Clean up after each test to prevent connection leaks
afterEach(async () => {
  // Small delay to allow pending queries to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});

// Global test teardown
afterAll(async () => {
  console.log('[Test Setup] Cleaning up test environment...');
  
  // Close all database connections
  try {
    await client.end({ timeout: 5 });
    console.log('[Test Setup] Database connections closed successfully');
  } catch (error) {
    console.error('[Test Setup] Error closing database connections:', error);
  }
});
