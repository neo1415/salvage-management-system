/**
 * Intelligence Services Index
 * 
 * Exports all intelligence services for easy importing
 */

export { PredictionService } from './prediction.service';
export { RecommendationService } from './recommendation.service';
export { FraudDetectionService } from './fraud-detection.service';
export { AssetAnalyticsService } from './asset-analytics.service';
export { TemporalAnalyticsService } from './temporal-analytics.service';
export { GeographicAnalyticsService } from './geographic-analytics.service';
export { BehavioralAnalyticsService } from './behavioral-analytics.service';
export { AnalyticsAggregationService } from './analytics-aggregation.service';
export { FeatureEngineeringService } from './feature-engineering.service';
export { MLDatasetService } from './ml-dataset.service';
export { SchemaEvolutionService } from './schema-evolution.service';

// Re-export types
export type {
  PredictionResult,
  RecommendationResult,
  VendorBiddingPattern,
  MarketConditions,
  SimilarAuction,
} from '../types';

export type {
  PhotoAuthenticityResult,
  ShillBiddingResult,
  ClaimPatternResult,
  CollusionResult,
} from './fraud-detection.service';
