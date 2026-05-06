import { pgTable, uuid, varchar, timestamp, text, jsonb, pgEnum } from 'drizzle-orm/pg-core';
import { vendors } from './vendors';
import { users } from './users';

export const kycStatusEnum = pgEnum('kyc_status', ['pending_review', 'approved', 'rejected', 'expired']);

export const kycSubmissions = pgTable('kyc_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  // Business Information
  businessName: varchar('business_name', { length: 255 }).notNull(),
  businessType: varchar('business_type', { length: 50 }).notNull(),
  cacNumber: varchar('cac_number', { length: 50 }),
  tin: varchar('tin', { length: 50 }),
  
  // Address
  address: text('address').notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }).notNull(),
  
  // Identity
  nin: varchar('nin', { length: 11 }).notNull(),
  bvn: varchar('bvn', { length: 11 }).notNull(),
  
  // Document URLs
  cacCertificateUrl: varchar('cac_certificate_url', { length: 500 }),
  ninCardUrl: varchar('nin_card_url', { length: 500 }).notNull(),
  utilityBillUrl: varchar('utility_bill_url', { length: 500 }).notNull(),
  bankStatementUrl: varchar('bank_statement_url', { length: 500 }).notNull(),
  photoIdUrl: varchar('photo_id_url', { length: 500 }).notNull(),
  
  // AI Verification
  aiVerificationResult: jsonb('ai_verification_result'),
  
  // Status
  status: kycStatusEnum('status').notNull().default('pending_review'),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  rejectionReason: text('rejection_reason'),
  
  // Approval
  approvedAt: timestamp('approved_at'),
  expiresAt: timestamp('expires_at'),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
