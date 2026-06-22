import { index, jsonb, numeric, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { auctions } from './auctions';
import { salvageCases } from './cases';
import { users } from './users';
import { vendors } from './vendors';

export type PickupEvidenceComparisonStatus =
  | 'not_reviewed'
  | 'matches_expected'
  | 'review_needed'
  | 'material_discrepancy';

export type PickupEvidenceComparison = {
  status: PickupEvidenceComparisonStatus;
  confidenceScore: number;
  overallMatchScore?: number;
  assetIdentityScore?: number;
  quantityMatchScore?: number;
  conditionMatchScore?: number;
  reviewBand?: 'acceptable' | 'minor_review' | 'major_review' | 'material_discrepancy';
  findings: string[];
  observedDifferences?: string[];
  recommendedStaffAction?: string;
  provider?: 'gemini' | 'claude';
  originalPhotoCount: number;
  pickupPhotoCount: number;
  comparedAt: string;
  method: 'rule_based' | 'gemini_ai' | 'claude_ai' | 'ai_failed_fallback';
  imageIntegrity?: {
    status: 'passed' | 'warning' | 'failed';
    results?: unknown[];
    clientMetadata?: Array<{
      index: number;
      name?: string;
      size?: number;
      type?: string;
      lastModified?: number;
      captureSource?: string;
      width?: number;
      height?: number;
      hasClientExif?: boolean;
    }>;
  };
};

export type PickupEvidenceResolutionStatus =
  | 'not_required'
  | 'confirmed_no_adjustment'
  | 'external_reimbursement_required'
  | 'external_reimbursement_completed'
  | 'price_adjustment_recorded';

export const pickupEvidence = pgTable('pickup_evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  auctionId: uuid('auction_id')
    .notNull()
    .references(() => auctions.id, { onDelete: 'cascade' }),
  caseId: uuid('case_id')
    .notNull()
    .references(() => salvageCases.id, { onDelete: 'cascade' }),
  vendorId: uuid('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  submittedBy: uuid('submitted_by')
    .notNull()
    .references(() => users.id),
  photoUrls: varchar('photo_urls').array().notNull(),
  notes: text('notes'),
  comparisonStatus: varchar('comparison_status', { length: 40 }).notNull().default('not_reviewed'),
  comparisonSummary: jsonb('comparison_summary').notNull().$type<PickupEvidenceComparison>(),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  resolutionStatus: varchar('resolution_status', { length: 60 }).notNull().default('not_required'),
  adjustmentAmount: numeric('adjustment_amount', { precision: 12, scale: 2 }),
  reimbursementMethod: varchar('reimbursement_method', { length: 80 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  auctionIdx: index('idx_pickup_evidence_auction').on(table.auctionId),
  caseIdx: index('idx_pickup_evidence_case').on(table.caseId),
  vendorIdx: index('idx_pickup_evidence_vendor').on(table.vendorId),
  statusIdx: index('idx_pickup_evidence_status').on(table.comparisonStatus),
  createdAtIdx: index('idx_pickup_evidence_created_at').on(table.createdAt),
}));
