/**
 * AI-Powered Marketplace Intelligence - ML Training Schema
 * 
 * ML training tables for datasets, feature vectors, analytics rollups,
 * and prediction/recommendation logs for future ML model training.
 * 
 * @module ml-training
 */

import { 
  pgTable, 
  uuid, 
  numeric, 
  timestamp, 
  varchar, 
  jsonb, 
  index, 
  integer,
  text,
  pgEnum,
  boolean
} from 'drizzle-orm/pg-core';
import { assetTypeEnum } from './vendors';

// ============================================================================
// ENUMS
// ============================================================================

export const datasetTypeEnum = pgEnum('dataset_type', [
  'price_prediction',
  'recommendation',
  'fraud_detection'
]);

export const datasetFormatEnum = pgEnum('dataset_format', [
  'csv',
  'json',
  'parquet'
]);

export const rollupPeriodEnum = pgEnum('rollup_period', [
  'hourly',
  'daily',
  'weekly',
  'monthly'
]);

// ============================================================================
// ML TRAINING DATASETS TABLE
// ============================================================================

export const mlTrainingDatasets = pgTable('ml_training_datasets', {
  id: uuid('id').primaryKey().defaultRandom(),
  datasetType: datasetTypeEnum('dataset_type').notNull(),
  datasetName: varchar('dataset_name', { length: 255 }).notNull(),
  format: datasetFormatEnum('format').notNull(),
  // Dataset metadata
  recordCount: integer('record_count').notNull().default(0),
  featureCount: integer('feature_count').notNull().default(0),
  dateRangeStart: timestamp('date_range_start').notNull(),
  dateRangeEnd: timestamp('date_range_end').notNull(),
  // Split information
  trainSplit: numeric('train_split', { precision: 3, scale: 2 }).notNull().default('0.70'), // 70%
  validationSplit: numeric('validation_split', { precision: 3, scale: 2 }).notNull().default('0.15'), // 15%
  testSplit: numeric('test_split', { precision: 3, scale: 2 }).notNull().default('0.15'), // 15%
  // Storage
  filePath: varchar('file_path', { length: 500 }),
  fileSize: integer('file_size'), // in bytes
  // Schema and features
  schema: jsonb('schema').$type<{
    features: Array<{
      name: string;
      type: string;
      description: string | null;
      nullable: boolean | null;
    }>;
    target: string | null;
  }>(),
  metadata: jsonb('metadata').$type<{
    description: string | null;
    version: string | null;
    anonymized: boolean | null;
    filters: any;
  }>(),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  datasetTypeIdx: index('idx_ml_datasets_type').on(table.datasetType),
  createdAtIdx: index('idx_ml_datasets_created_at').on(table.createdAt),
  dateRangeIdx: index('idx_ml_datasets_date_range').on(table.dateRangeStart, table.dateRangeEnd),
}));

// ============================================================================
// FEATURE VECTORS TABLE
// ============================================================================

export const featureVectors = pgTable('feature_vectors', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'auction', 'vendor', 'case'
  entityId: uuid('entity_id').notNull(),
  // Feature vector data
  features: jsonb('features').$type<{
    // Asset features
    assetType: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    damageSeverity: string | null;
    marketValue: number | null;
    estimatedSalvageValue: number | null;
    // Temporal features (cyclical encoding)
    hourSin: number | null;
    hourCos: number | null;
    dayOfWeekSin: number | null;
    dayOfWeekCos: number | null;
    monthSin: number | null;
    monthCos: number | null;
    // Market condition features
    competitionLevel: number | null;
    avgBidsPerAuction: number | null;
    priceTrend: number | null;
    // Vendor features
    vendorRating: number | null;
    vendorWinRate: number | null;
    vendorTotalBids: number | null;
    vendorAvgBidAmount: number | null;
    // Damage features
    damagedPartsCount: number | null;
    structuralDamageScore: number | null;
    mechanicalDamageScore: number | null;
    cosmeticDamageScore: number | null;
    // Geographic features
    region: string | null;
    regionalDemandScore: number | null;
    regionalPriceVariance: number | null;
  }>(),
  // Normalization metadata
  normalizationParams: jsonb('normalization_params').$type<{
    [key: string]: {
      mean: number | null;
      stddev: number | null;
      min: number | null;
      max: number | null;
    };
  }>(),
  version: varchar('version', { length: 50 }).notNull().default('v1.0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  entityIdx: index('idx_feature_vectors_entity').on(table.entityType, table.entityId),
  versionIdx: index('idx_feature_vectors_version').on(table.version),
  createdAtIdx: index('idx_feature_vectors_created_at').on(table.createdAt),
}));

// ============================================================================
// ANALYTICS ROLLUPS TABLE
// ============================================================================

export const analyticsRollups = pgTable('analytics_rollups', {
  id: uuid('id').primaryKey().defaultRandom(),
  rollupPeriod: rollupPeriodEnum('rollup_period').notNull(),
  assetType: assetTypeEnum('asset_type'),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  // Aggregated metrics
  metrics: jsonb('metrics').$type<{
    // Auction metrics
    totalAuctions: number | null;
    totalBids: number | null;
    avgBidsPerAuction: number | null;
    avgFinalPrice: number | null;
    avgSellThroughRate: number | null;
    // Vendor metrics
    activeVendors: number | null;
    avgVendorActivity: number | null;
    // Prediction metrics
    avgPredictionAccuracy: number | null;
    avgConfidenceScore: number | null;
    totalPredictions: number | null;
    // Recommendation metrics
    avgMatchScore: number | null;
    clickThroughRate: number | null;
    bidConversionRate: number | null;
    totalRecommendations: number | null;
    // Fraud metrics
    fraudAlertsCount: number | null;
    avgRiskScore: number | null;
  }>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  periodIdx: index('idx_analytics_rollups_period').on(table.rollupPeriod, table.periodStart),
  assetTypeIdx: index('idx_analytics_rollups_asset_type').on(table.assetType),
  createdAtIdx: index('idx_analytics_rollups_created_at').on(table.createdAt),
}));

// ============================================================================
// PREDICTION LOGS TABLE
// ============================================================================

export const predictionLogs = pgTable('prediction_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  predictionId: uuid('prediction_id').notNull(),
  auctionId: uuid('auction_id').notNull(),
  // Prediction details
  predictedPrice: numeric('predicted_price', { precision: 12, scale: 2 }).notNull(),
  actualPrice: numeric('actual_price', { precision: 12, scale: 2 }),
  confidenceScore: numeric('confidence_score', { precision: 5, scale: 4 }).notNull(),
  method: varchar('method', { length: 50 }).notNull(),
  algorithmVersion: varchar('algorithm_version', { length: 50 }).notNull(),
  // Calculation details
  calculationDetails: jsonb('calculation_details').$type<{
    similarAuctionsCount: number | null;
    similarAuctionIds: string[] | null;
    weights: { [key: string]: number } | null;
    marketAdjustments: { [key: string]: number } | null;
    confidenceFactors: { [key: string]: number } | null;
  }>(),
  // Performance metrics
  accuracy: numeric('accuracy', { precision: 5, scale: 4 }),
  absoluteError: numeric('absolute_error', { precision: 12, scale: 2 }),
  percentageError: numeric('percentage_error', { precision: 5, scale: 4 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  predictionIdIdx: index('idx_prediction_logs_prediction_id').on(table.predictionId),
  auctionIdIdx: index('idx_prediction_logs_auction_id').on(table.auctionId),
  methodIdx: index('idx_prediction_logs_method').on(table.method),
  accuracyIdx: index('idx_prediction_logs_accuracy').on(table.accuracy),
  createdAtIdx: index('idx_prediction_logs_created_at').on(table.createdAt),
}));

// ============================================================================
// RECOMMENDATION LOGS TABLE
// ============================================================================

export const recommendationLogs = pgTable('recommendation_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  recommendationId: uuid('recommendation_id').notNull(),
  vendorId: uuid('vendor_id').notNull(),
  auctionId: uuid('auction_id').notNull(),
  // Recommendation details
  matchScore: numeric('match_score', { precision: 5, scale: 2 }).notNull(),
  collaborativeScore: numeric('collaborative_score', { precision: 5, scale: 2 }),
  contentScore: numeric('content_score', { precision: 5, scale: 2 }),
  reasonCodes: jsonb('reason_codes').$type<string[]>().notNull(),
  algorithmVersion: varchar('algorithm_version', { length: 50 }).notNull(),
  // Calculation details
  calculationDetails: jsonb('calculation_details').$type<{
    vendorBidCount: number | null;
    collaborativeWeight: number | null;
    contentWeight: number | null;
    similarAuctions: string[] | null;
    vendorPreferences: any;
  }>(),
  // Interaction tracking
  clicked: boolean('clicked').notNull().default(false),
  clickedAt: timestamp('clicked_at'),
  bidPlaced: boolean('bid_placed').notNull().default(false),
  bidPlacedAt: timestamp('bid_placed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  recommendationIdIdx: index('idx_recommendation_logs_recommendation_id').on(table.recommendationId),
  vendorIdIdx: index('idx_recommendation_logs_vendor_id').on(table.vendorId),
  auctionIdIdx: index('idx_recommendation_logs_auction_id').on(table.auctionId),
  clickedIdx: index('idx_recommendation_logs_clicked').on(table.clicked),
  bidPlacedIdx: index('idx_recommendation_logs_bid_placed').on(table.bidPlaced),
  createdAtIdx: index('idx_recommendation_logs_created_at').on(table.createdAt),
}));

// ============================================================================
// FRAUD DETECTION LOGS TABLE
// ============================================================================

export const fraudDetectionLogs = pgTable('fraud_detection_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  fraudAlertId: uuid('fraud_alert_id'),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: uuid('entity_id').notNull(),
  // Detection details
  detectionType: varchar('detection_type', { length: 100 }).notNull(), // 'shill_bidding', 'duplicate_photos', etc.
  riskScore: integer('risk_score').notNull(),
  flagReasons: jsonb('flag_reasons').$type<string[]>().notNull(),
  // Analysis details
  analysisDetails: jsonb('analysis_details').$type<{
    patterns: any;
    evidence: any;
    confidence: number | null;
    falsePositiveRisk: number | null;
  }>(),
  // Outcome
  confirmed: boolean('confirmed'),
  confirmedAt: timestamp('confirmed_at'),
  confirmedBy: uuid('confirmed_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  fraudAlertIdIdx: index('idx_fraud_logs_fraud_alert_id').on(table.fraudAlertId),
  entityIdx: index('idx_fraud_logs_entity').on(table.entityType, table.entityId),
  detectionTypeIdx: index('idx_fraud_logs_detection_type').on(table.detectionType),
  riskScoreIdx: index('idx_fraud_logs_risk_score').on(table.riskScore),
  createdAtIdx: index('idx_fraud_logs_created_at').on(table.createdAt),
}));

// ============================================================================
// ALGORITHM CONFIG HISTORY TABLE
// ============================================================================

export const algorithmConfigHistory = pgTable('algorithm_config_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  configId: uuid('config_id').notNull(),
  configKey: varchar('config_key', { length: 100 }).notNull(),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value').notNull(),
  changeReason: text('change_reason'),
  // Performance impact
  performanceImpact: jsonb('performance_impact').$type<{
    predictionAccuracyBefore: number | null;
    predictionAccuracyAfter: number | null;
    recommendationCTRBefore: number | null;
    recommendationCTRAfter: number | null;
    notes: string | null;
  }>(),
  changedBy: uuid('changed_by'),
  changedAt: timestamp('changed_at').notNull().defaultNow(),
}, (table) => ({
  configIdIdx: index('idx_algorithm_config_history_config_id').on(table.configId),
  configKeyIdx: index('idx_algorithm_config_history_config_key').on(table.configKey),
  changedAtIdx: index('idx_algorithm_config_history_changed_at').on(table.changedAt),
}));
