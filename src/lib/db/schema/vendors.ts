import { pgTable, uuid, varchar, timestamp, numeric, jsonb, pgEnum, text, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';

export const vendorTierEnum = pgEnum('vendor_tier', ['tier1_bvn', 'tier2_full']);
export const vendorStatusEnum = pgEnum('vendor_status', ['pending', 'approved', 'suspended']);
export const assetTypeEnum = pgEnum('asset_type', ['vehicle', 'property', 'electronics', 'machinery']);

export const vendors = pgTable('vendors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  businessName: varchar('business_name', { length: 255 }),
  tier: vendorTierEnum('tier').notNull().default('tier1_bvn'),
  bvnEncrypted: varchar('bvn_encrypted', { length: 255 }),
  bvnVerifiedAt: timestamp('bvn_verified_at'),
  cacNumber: varchar('cac_number', { length: 50 }),
  tin: varchar('tin', { length: 50 }),
  bankAccountNumber: varchar('bank_account_number', { length: 20 }),
  bankName: varchar('bank_name', { length: 100 }),
  bankAccountName: varchar('bank_account_name', { length: 255 }),
  categories: assetTypeEnum('categories').array(),
  status: vendorStatusEnum('status').notNull().default('pending'),
  performanceStats: jsonb('performance_stats')
    .notNull()
    .$type<{
      totalBids: number;
      totalWins: number;
      winRate: number;
      avgPaymentTimeHours: number;
      onTimePickupRate: number;
      fraudFlags: number;
    }>()
    .default({
      totalBids: 0,
      totalWins: 0,
      winRate: 0,
      avgPaymentTimeHours: 0,
      onTimePickupRate: 0,
      fraudFlags: 0,
    }),
  rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('0.00'),
  // Tier 2 KYC document URLs
  cacCertificateUrl: varchar('cac_certificate_url', { length: 500 }),
  bankStatementUrl: varchar('bank_statement_url', { length: 500 }),
  ninCardUrl: varchar('nin_card_url', { length: 500 }),
  // Verification flags
  ninVerified: timestamp('nin_verified_at'),
  bankAccountVerified: timestamp('bank_account_verified_at'),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),

  // Tier 2 KYC — NIN
  ninEncrypted: varchar('nin_encrypted', { length: 500 }),
  ninVerificationData: jsonb('nin_verification_data'),
  // ninVerifiedAt already exists as ninVerified (nin_verified_at)

  // Tier 2 KYC — Photo ID
  photoIdUrl: varchar('photo_id_url', { length: 500 }),
  photoIdType: varchar('photo_id_type', { length: 50 }), // passport|voters_card|drivers_license
  photoIdVerifiedAt: timestamp('photo_id_verified_at'),

  // Tier 2 KYC — Biometrics
  selfieUrl: varchar('selfie_url', { length: 500 }),
  livenessScore: numeric('liveness_score', { precision: 5, scale: 2 }), // 0-100
  biometricMatchScore: numeric('biometric_match_score', { precision: 5, scale: 2 }), // 0-100
  biometricVerifiedAt: timestamp('biometric_verified_at'),

  // Tier 2 KYC — Address
  addressProofUrl: varchar('address_proof_url', { length: 500 }),
  addressVerifiedAt: timestamp('address_verified_at'),

  // Tier 2 KYC — AML
  amlScreeningData: jsonb('aml_screening_data'),
  amlRiskLevel: varchar('aml_risk_level', { length: 20 }), // Low|Medium|High
  amlScreenedAt: timestamp('aml_screened_at'),

  // Tier 2 KYC — Business
  businessType: varchar('business_type', { length: 50 }), // individual|sole_proprietor|limited_company
  cacForm7Url: varchar('cac_form7_url', { length: 500 }),
  directorIds: jsonb('director_ids'),

  // Tier 2 KYC — Workflow
  tier2SubmittedAt: timestamp('tier2_submitted_at'),
  tier2ApprovedAt: timestamp('tier2_approved_at'),
  tier2ApprovedBy: uuid('tier2_approved_by').references(() => users.id),
  tier2RejectionReason: text('tier2_rejection_reason'),
  tier2ExpiresAt: timestamp('tier2_expires_at'), // approved_at + 12 months
  tier2DojahReferenceId: varchar('tier2_dojah_reference_id', { length: 100 }),

  // Tier 2 KYC — Fraud
  fraudRiskScore: numeric('fraud_risk_score', { precision: 5, scale: 2 }), // 0-100
  fraudFlags: jsonb('fraud_flags'), // array of flag objects

  // Registration Fee
  registrationFeePaid: boolean('registration_fee_paid').notNull().default(false),
  registrationFeeAmount: numeric('registration_fee_amount', { precision: 12, scale: 2 }),
  registrationFeePaidAt: timestamp('registration_fee_paid_at'),
  registrationFeeReference: varchar('registration_fee_reference', { length: 255 }),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Indexes are created via SQL in migrations
// CREATE INDEX idx_vendors_user_id ON vendors(user_id);
// CREATE INDEX idx_vendors_tier ON vendors(tier);
// CREATE INDEX idx_vendors_status ON vendors(status);
// CREATE INDEX idx_vendors_rating ON vendors(rating DESC);
// CREATE INDEX idx_vendors_nin_verified_at ON vendors(nin_verified_at);
// CREATE INDEX idx_vendors_aml_risk_level ON vendors(aml_risk_level);
// CREATE INDEX idx_vendors_tier_status ON vendors(tier, status);
