/**
 * Intelligence Events Index
 * 
 * Exports all Socket.IO event emitters for intelligence features.
 */

export { emitPredictionUpdated } from './prediction-updated.event';
export { emitRecommendationNew } from './recommendation-new.event';
export { emitRecommendationClosingSoon } from './recommendation-closing-soon.event';
export { emitFraudAlert } from './fraud-alert.event';
export { emitSchemaNewAssetType } from './schema-new-asset-type.event';
export { RoomManager } from './room-manager';

export type { PredictionUpdatePayload } from './prediction-updated.event';
export type { RecommendationNewPayload } from './recommendation-new.event';
export type { RecommendationClosingSoonPayload } from './recommendation-closing-soon.event';
export type { FraudAlertPayload } from './fraud-alert.event';
export type { SchemaNewAssetTypePayload } from './schema-new-asset-type.event';
