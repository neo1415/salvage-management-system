import { pgTable, uuid, varchar, timestamp, numeric, jsonb, point, pgEnum, integer, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { assetTypeEnum } from './vendors';

export const damageSeverityEnum = pgEnum('damage_severity', ['none', 'minor', 'moderate', 'severe']);
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
  policyNumber: varchar('policy_number', { length: 120 }),
  insuranceClass: varchar('insurance_class', { length: 80 }),
  brokerName: varchar('broker_name', { length: 255 }),
  agencyName: varchar('agency_name', { length: 255 }),
  branchName: varchar('branch_name', { length: 150 }),
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
      propertyUse?: string;
      damageArea?: string;
      // Electronics-specific
      brand?: string;
      serialNumber?: string;
      storage?: string;
      color?: string;
      // Insurance salvage general fields
      type?: string;
      description?: string;
      quantity?: string;
      unitOfMeasure?: string;
      packagingType?: string;
      batchOrSerial?: string;
      consignmentReference?: string;
      serialOrReference?: string;
      declaredCondition?: string;
      condition?: string;
    }>(),
  marketValue: numeric('market_value', { precision: 12, scale: 2 }).notNull(),
  estimatedSalvageValue: numeric('estimated_salvage_value', { precision: 12, scale: 2 }),
  reservePrice: numeric('reserve_price', { precision: 12, scale: 2 }),
  damageSeverity: damageSeverityEnum('damage_severity'),
  aiAssessment: jsonb('ai_assessment')
    .$type<{
      // Basic info
      labels: string[];
      confidenceScore: number;
      damagePercentage: number;
      processedAt: Date;
      
      // NEW: Detailed Gemini analysis results
      itemDetails?: {
        detectedMake?: string;
        detectedModel?: string;
        detectedYear?: string;
        color?: string;
        trim?: string;
        bodyStyle?: string;
        storage?: string;
        overallCondition?: string;
        notes?: string;
      };
      damagedParts?: Array<{
        part: string;
        severity: 'minor' | 'moderate' | 'severe';
        confidence: number;
      }>;
      
      // Enhanced fields for accuracy and transparency
      damageScore?: {
        structural: number;
        mechanical: number;
        cosmetic: number;
        electrical: number;
        interior: number;
      };
      confidence?: {
        overall: number;
        vehicleDetection: number;
        damageDetection: number;
        valuationAccuracy: number;
        photoQuality: number;
        reasons: string[];
      };
      estimatedRepairCost?: number;
      isRepairable?: boolean;
      recommendation?: string;
      warnings?: string[];
      analysisMethod?: 'gemini' | 'vision' | 'neutral' | 'mock' | 'google-vision' | 'claude';
      photoCount?: number;
      manualReviewRequired?: boolean;
      reviewReasons?: string[];
      valuationEvidenceId?: string;
      valuationEvidence?: Record<string, unknown>;
    }>(),
  gpsLocation: point('gps_location').notNull(),
  locationName: varchar('location_name', { length: 255 }).notNull(),
  locationAccuracyMeters: numeric('location_accuracy_meters', { precision: 10, scale: 2 }),
  locationSource: varchar('location_source', { length: 50 }),
  locationCapturedAt: timestamp('location_captured_at'),
  locationManualOverride: boolean('location_manual_override').notNull().default(false),
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
  
  // NEW: Vehicle mileage and condition for enhanced AI assessment
  vehicleMileage: integer('vehicle_mileage'),
  vehicleCondition: varchar('vehicle_condition', { length: 20 }),
  
  // NEW: Price tracking for manager overrides
  aiEstimates: jsonb('ai_estimates').$type<{
    marketValue: number;
    repairCost: number;
    salvageValue: number;
    reservePrice: number;
    confidence: number;
  }>(),
  managerOverrides: jsonb('manager_overrides').$type<{
    marketValue?: number;
    repairCost?: number;
    salvageValue?: number;
    reservePrice?: number;
    reason: string;
    overriddenBy: string;
    overriddenAt: string;
  }>(),
});

export const valuationEvidence = pgTable('valuation_evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id').references(() => salvageCases.id),
  assetType: assetTypeEnum('asset_type').notNull(),
  itemIdentifier: jsonb('item_identifier').notNull().$type<Record<string, unknown>>(),
  marketEvidence: jsonb('market_evidence').notNull().$type<Record<string, unknown>>(),
  partEvidence: jsonb('part_evidence').$type<Record<string, unknown>>(),
  decisionSummary: jsonb('decision_summary').notNull().$type<{
    marketConfidence: number;
    damageConfidence: number;
    overallConfidence: number;
    uniqueSourceCount: number;
    priceSpreadPercent: number;
    manualReviewRequired: boolean;
    reviewReasons: string[];
  }>(),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  caseIdx: index('idx_valuation_evidence_case').on(table.caseId),
  assetTypeIdx: index('idx_valuation_evidence_asset_type').on(table.assetType),
  createdAtIdx: index('idx_valuation_evidence_created_at').on(table.createdAt),
}));

// Indexes are created via SQL in migrations
// CREATE INDEX idx_cases_claim_reference ON salvage_cases(claim_reference);
// CREATE INDEX idx_cases_status ON salvage_cases(status);
// CREATE INDEX idx_cases_created_by ON salvage_cases(created_by);
// CREATE INDEX idx_cases_asset_type ON salvage_cases(asset_type);
// CREATE INDEX idx_cases_created_at ON salvage_cases(created_at DESC);
// CREATE INDEX idx_salvage_cases_mileage ON salvage_cases(vehicle_mileage);
// CREATE INDEX idx_salvage_cases_condition ON salvage_cases(vehicle_condition);
