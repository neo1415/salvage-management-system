/**
 * AI-Powered Marketplace Intelligence - Fraud Detection Schema
 * 
 * Fraud detection tables for photo hashing, multi-index lookup,
 * and perceptual hash storage for duplicate photo detection.
 * 
 * @module fraud-detection
 */

import { 
  pgTable, 
  uuid, 
  timestamp, 
  varchar, 
  index, 
  integer,
  jsonb,
  boolean
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { salvageCases } from './cases';

// ============================================================================
// PHOTO HASHES TABLE
// ============================================================================

/**
 * Stores perceptual hashes (pHash) for each photo in salvage cases.
 * pHash is a 64-character hexadecimal string representing the image fingerprint.
 * Used for detecting duplicate or similar photos across different cases.
 */
export const photoHashes = pgTable('photo_hashes', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id')
    .notNull()
    .references(() => salvageCases.id, { onDelete: 'cascade' }),
  photoUrl: varchar('photo_url', { length: 500 }).notNull(),
  photoIndex: integer('photo_index').notNull(), // Position in photos array
  // Perceptual hash (64-character hex string)
  pHash: varchar('p_hash', { length: 64 }).notNull(),
  // EXIF metadata
  exifData: jsonb('exif_data').$type<{
    timestamp?: string;
    gpsLatitude?: number;
    gpsLongitude?: number;
    cameraModel?: string;
    cameraManufacturer?: string;
    imageWidth?: number;
    imageHeight?: number;
    orientation?: number;
  }>(),
  // Photo analysis
  complexity: integer('complexity'), // 0-100, low complexity = potential false positive
  isLowComplexity: boolean('is_low_complexity').notNull().default(false),
  // AI authenticity analysis
  authenticityAnalysis: jsonb('authenticity_analysis').$type<{
    isAiGenerated?: boolean;
    hasWatermark?: boolean;
    hasInconsistentLighting?: boolean;
    hasMismatchedDamage?: boolean;
    confidence?: number;
    notes?: string[];
  }>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  caseIdIdx: index('idx_photo_hashes_case_id').on(table.caseId),
  pHashIdx: index('idx_photo_hashes_p_hash').on(table.pHash),
  photoUrlIdx: index('idx_photo_hashes_photo_url').on(table.photoUrl),
  complexityIdx: index('idx_photo_hashes_complexity').on(table.isLowComplexity),
  createdAtIdx: index('idx_photo_hashes_created_at').on(table.createdAt),
}));

export const photoHashesRelations = relations(photoHashes, ({ one }) => ({
  case: one(salvageCases, {
    fields: [photoHashes.caseId],
    references: [salvageCases.id],
  }),
}));

// ============================================================================
// PHOTO HASH INDEX TABLE (Multi-Index Hashing)
// ============================================================================

/**
 * Multi-index hashing table for O(1) lookup performance.
 * Each pHash is split into 4 segments (16 characters each) and stored
 * as separate partition keys for fast similarity matching.
 * 
 * Example:
 * pHash: "ABCD1234EFGH5678IJKL9012MNOP3456QRST7890UVWX1234YZAB5678CDEF9012"
 * Segments:
 *   - segment1: "ABCD1234EFGH5678"
 *   - segment2: "IJKL9012MNOP3456"
 *   - segment3: "QRST7890UVWX1234"
 *   - segment4: "YZAB5678CDEF9012"
 */
export const photoHashIndex = pgTable('photo_hash_index', {
  id: uuid('id').primaryKey().defaultRandom(),
  photoHashId: uuid('photo_hash_id')
    .notNull()
    .references(() => photoHashes.id, { onDelete: 'cascade' }),
  // Segment information
  segmentNumber: integer('segment_number').notNull(), // 1, 2, 3, or 4
  segmentValue: varchar('segment_value', { length: 16 }).notNull(),
  // Full hash for verification
  fullPHash: varchar('full_p_hash', { length: 64 }).notNull(),
  // Reference data
  caseId: uuid('case_id').notNull(),
  photoUrl: varchar('photo_url', { length: 500 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  photoHashIdIdx: index('idx_photo_hash_index_photo_hash_id').on(table.photoHashId),
  segmentIdx: index('idx_photo_hash_index_segment').on(table.segmentNumber, table.segmentValue),
  caseIdIdx: index('idx_photo_hash_index_case_id').on(table.caseId),
  // Composite index for fast segment matching
  segmentValueIdx: index('idx_photo_hash_index_segment_value').on(table.segmentValue),
}));

export const photoHashIndexRelations = relations(photoHashIndex, ({ one }) => ({
  photoHash: one(photoHashes, {
    fields: [photoHashIndex.photoHashId],
    references: [photoHashes.id],
  }),
  case: one(salvageCases, {
    fields: [photoHashIndex.caseId],
    references: [salvageCases.id],
  }),
}));

// ============================================================================
// DUPLICATE PHOTO MATCHES TABLE
// ============================================================================

/**
 * Stores detected duplicate or similar photo matches.
 * Used for fraud detection and investigation.
 */
export const duplicatePhotoMatches = pgTable('duplicate_photo_matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Source photo
  sourcePhotoHashId: uuid('source_photo_hash_id')
    .notNull()
    .references(() => photoHashes.id, { onDelete: 'cascade' }),
  sourceCaseId: uuid('source_case_id').notNull(),
  sourcePhotoUrl: varchar('source_photo_url', { length: 500 }).notNull(),
  // Matched photo
  matchedPhotoHashId: uuid('matched_photo_hash_id')
    .notNull()
    .references(() => photoHashes.id, { onDelete: 'cascade' }),
  matchedCaseId: uuid('matched_case_id').notNull(),
  matchedPhotoUrl: varchar('matched_photo_url', { length: 500 }).notNull(),
  // Similarity metrics
  hammingDistance: integer('hamming_distance').notNull(), // 0-64
  similarityScore: integer('similarity_score').notNull(), // 0-100
  // Contextual analysis
  sameUser: boolean('same_user').notNull(),
  daysBetween: integer('days_between'), // Days between case submissions
  assetMismatch: boolean('asset_mismatch'), // Different make/model/year
  // Fraud risk assessment
  riskScore: integer('risk_score').notNull(), // 0-100
  isFraudulent: boolean('is_fraudulent'),
  reviewedBy: uuid('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  notes: varchar('notes', { length: 1000 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  sourcePhotoHashIdx: index('idx_duplicate_matches_source').on(table.sourcePhotoHashId),
  matchedPhotoHashIdx: index('idx_duplicate_matches_matched').on(table.matchedPhotoHashId),
  sourceCaseIdx: index('idx_duplicate_matches_source_case').on(table.sourceCaseId),
  matchedCaseIdx: index('idx_duplicate_matches_matched_case').on(table.matchedCaseId),
  hammingDistanceIdx: index('idx_duplicate_matches_hamming').on(table.hammingDistance),
  riskScoreIdx: index('idx_duplicate_matches_risk_score').on(table.riskScore),
  isFraudulentIdx: index('idx_duplicate_matches_is_fraudulent').on(table.isFraudulent),
  createdAtIdx: index('idx_duplicate_matches_created_at').on(table.createdAt),
}));

export const duplicatePhotoMatchesRelations = relations(duplicatePhotoMatches, ({ one }) => ({
  sourcePhotoHash: one(photoHashes, {
    fields: [duplicatePhotoMatches.sourcePhotoHashId],
    references: [photoHashes.id],
    relationName: 'sourcePhoto',
  }),
  matchedPhotoHash: one(photoHashes, {
    fields: [duplicatePhotoMatches.matchedPhotoHashId],
    references: [photoHashes.id],
    relationName: 'matchedPhoto',
  }),
  sourceCase: one(salvageCases, {
    fields: [duplicatePhotoMatches.sourceCaseId],
    references: [salvageCases.id],
    relationName: 'sourceCase',
  }),
  matchedCase: one(salvageCases, {
    fields: [duplicatePhotoMatches.matchedCaseId],
    references: [salvageCases.id],
    relationName: 'matchedCase',
  }),
}));
