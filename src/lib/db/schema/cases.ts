import { pgTable, uuid, varchar, timestamp, numeric, jsonb, point, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './users';
import { assetTypeEnum } from './vendors';

export const damageSeverityEnum = pgEnum('damage_severity', ['minor', 'moderate', 'severe']);
export const caseStatusEnum = pgEnum('case_status', [
  'draft',
  'pending_approval',
  'approved',
  'active_auction',
  'sold',
  'cancelled',
]);

export const salvageCases = pgTable('salvage_cases', {
  id: uuid('id').primaryKey().defaultRandom(),
  claimReference: varchar('claim_reference', { length: 100 }).notNull().unique(),
  assetType: assetTypeEnum('asset_type').notNull(),
  assetDetails: jsonb('asset_details')
    .notNull()
    .$type<{
      // Vehicle-specific
      make?: string;
      model?: string;
      year?: number;
      vin?: string;
      // Property-specific
      propertyType?: string;
      address?: string;
      // Electronics-specific
      brand?: string;
      serialNumber?: string;
    }>(),
  marketValue: numeric('market_value', { precision: 12, scale: 2 }).notNull(),
  estimatedSalvageValue: numeric('estimated_salvage_value', { precision: 12, scale: 2 }).notNull(),
  reservePrice: numeric('reserve_price', { precision: 12, scale: 2 }).notNull(),
  damageSeverity: damageSeverityEnum('damage_severity').notNull(),
  aiAssessment: jsonb('ai_assessment')
    .notNull()
    .$type<{
      labels: string[];
      confidenceScore: number;
      damagePercentage: number;
      processedAt: Date;
    }>(),
  gpsLocation: point('gps_location').notNull(),
  locationName: varchar('location_name', { length: 255 }).notNull(),
  photos: varchar('photos').array().notNull(),
  voiceNotes: varchar('voice_notes').array(),
  status: caseStatusEnum('status').notNull().default('draft'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  approvedBy: uuid('approved_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  approvedAt: timestamp('approved_at'),
});

// Indexes are created via SQL in migrations
// CREATE INDEX idx_cases_claim_reference ON salvage_cases(claim_reference);
// CREATE INDEX idx_cases_status ON salvage_cases(status);
// CREATE INDEX idx_cases_created_by ON salvage_cases(created_by);
// CREATE INDEX idx_cases_asset_type ON salvage_cases(asset_type);
// CREATE INDEX idx_cases_created_at ON salvage_cases(created_at DESC);
