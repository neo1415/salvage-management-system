/**
 * One-time migration script: adds Tier 2 KYC columns to vendors table
 * and creates the verification_costs table.
 *
 * Run with: npx tsx scripts/add-kyc-columns.ts
 */
import { config } from 'dotenv';
config();

import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

async function run() {
  console.log('Adding Tier 2 KYC columns to vendors table...');

  await sql`
    ALTER TABLE vendors
      ADD COLUMN IF NOT EXISTS nin_encrypted VARCHAR(500),
      ADD COLUMN IF NOT EXISTS nin_verification_data JSONB,
      ADD COLUMN IF NOT EXISTS photo_id_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS photo_id_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS photo_id_verified_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS selfie_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS liveness_score NUMERIC(5,2),
      ADD COLUMN IF NOT EXISTS biometric_match_score NUMERIC(5,2),
      ADD COLUMN IF NOT EXISTS biometric_verified_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS address_proof_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS address_verified_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS aml_screening_data JSONB,
      ADD COLUMN IF NOT EXISTS aml_risk_level VARCHAR(20),
      ADD COLUMN IF NOT EXISTS aml_screened_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS business_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS cac_form7_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS director_ids JSONB,
      ADD COLUMN IF NOT EXISTS tier2_submitted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS tier2_approved_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS tier2_approved_by UUID REFERENCES users(id),
      ADD COLUMN IF NOT EXISTS tier2_rejection_reason TEXT,
      ADD COLUMN IF NOT EXISTS tier2_expires_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS tier2_dojah_reference_id VARCHAR(100),
      ADD COLUMN IF NOT EXISTS fraud_risk_score NUMERIC(5,2),
      ADD COLUMN IF NOT EXISTS fraud_flags JSONB
  `;
  console.log('✓ vendors columns added');

  await sql`
    CREATE TABLE IF NOT EXISTS verification_costs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      verification_type VARCHAR(50) NOT NULL,
      cost_amount NUMERIC(10,2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'NGN',
      dojah_reference_id VARCHAR(100),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  console.log('✓ verification_costs table created');

  await sql`CREATE INDEX IF NOT EXISTS idx_vendors_nin_verified_at ON vendors(nin_verified_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_vendors_aml_risk_level ON vendors(aml_risk_level)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_vendors_tier_status ON vendors(tier, status)`;
  console.log('✓ indexes created');

  await sql.end();
  console.log('\nMigration complete.');
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
