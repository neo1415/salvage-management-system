/**
 * Damage Response Adapter
 * 
 * Converts different AI assessment formats (Gemini, Vision, Neutral) into a unified
 * DamageAssessmentResult format that maintains backward compatibility while adding
 * new optional fields.
 * 
 * Adapters:
 * - adaptGeminiResponse: Converts Gemini structured scores to unified format
 * - adaptVisionResponse: Converts Vision keyword-based assessment to unified format
 * - generateNeutralResponse: Returns neutral scores when all AI methods fail
 * 
 * Backward Compatibility:
 * - All existing fields are preserved (labels, confidenceScore, damagePercentage, etc.)
 * - New fields are optional (method, detailedScores, airbagDeployed, totalLoss, summary)
 * - Existing calculation functions remain unchanged
 * 
 * Requirements: 4.1-4.10, 5.2, 11.1, 11.2, 11.3, 11.4
 */

import type { GeminiDamageAssessment } from '@/lib/integrations/gemini-damage-detection';
import type { VisionDamageAssessment } from '@/lib/integrations/vision-damage-detection';
import type { VehicleContext } from '@/lib/integrations/gemini-damage-detection';
import { type QualityTier } from '@/features/valuations/services/condition-mapping.service';

/**
 * Unified damage assessment result format
 * Maintains backward compatibility with existing API contracts
 */
export interface DamageAssessmentResult {
  // Existing fields (required for backward compatibility)
  labels: string[];
  confidenceScore: number; // 0-100
  damagePercentage: number; // 0-100
  processedAt: Date;
  damageSeverity: 'minor' | 'moderate' | 'severe';
  estimatedSalvageValue: number;
  reservePrice: number;
  
  // New optional fields (added by Gemini migration)
  method?: 'gemini' | 'vision' | 'neutral';
  detailedScores?: {
    structural: number;
    mechanical: number;
    cosmetic: number;
    electrical: number;
    interior: number;
  };
  airbagDeployed?: boolean;
  totalLoss?: boolean;
  summary?: string;
  
  // Quality tier assessment (Requirement 4.1)
  qualityTier: QualityTier;
}

/**
 * Calculate overall damage percentage from individual category scores
 * 
 * Uses weighted average based on repair cost impact:
 * - Structural: 30% (most expensive to repair)
 * - Mechanical: 25% (expensive, critical for function)
 * - Cosmetic: 20% (visible but less critical)
 * - Electrical: 15% (moderate cost)
 * - Interior: 10% (least expensive)
 * 
 * @param scores - Individual damage scores for each category
 * @returns Overall damage percentage (0-100)
 */
function calculateOverallDamagePercentage(scores: {
  structural: number;
  mechanical: number;
  cosmetic: number;
  electrical: number;
  interior: number;
}): number {
  const weights = {
    structural: 0.30,
    mechanical: 0.25,
    cosmetic: 0.20,
    electrical: 0.15,
    interior: 0.10,
  };

  const weightedSum = 
    scores.structural * weights.structural +
    scores.mechanical * weights.mechanical +
    scores.cosmetic * weights.cosmetic +
    scores.electrical * weights.electrical +
    scores.interior * weights.interior;

  return Math.round(weightedSum);
}

/**
 * Determines quality tier based on damage assessment and vehicle context
 * 
 * Quality Tier Logic (Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6):
 * - Excellent: < 10% damage, recent vehicle (≤3 years old)
 * - Good: 10-30% damage, or older vehicle with minimal damage
 * - Fair: 30-60% damage, significant wear
 * - Poor: > 60% damage, major structural issues
 * 
 * @param damageSeverity - The damage severity classification
 * @param damagePercentage - The overall damage percentage (0-100)
 * @param vehicleContext - Optional vehicle context (make, model, year)
 * @returns Quality tier: "excellent", "good", "fair", or "poor"
 */
function determineQualityTier(
  damageSeverity: 'minor' | 'moderate' | 'severe',
  damagePercentage: number,
  vehicleContext?: VehicleContext
): QualityTier {
  const currentYear = new Date().getFullYear();
  const vehicleAge = vehicleContext?.year ? currentYear - vehicleContext.year : null;
  
  // Excellent: < 10% damage AND recent vehicle (≤3 years old)
  // Requirement 4.3: minimal damage on a recent vehicle
  if (damagePercentage < 10 && vehicleAge !== null && vehicleAge <= 3) {
    return 'excellent';
  }
  
  // Good: 10-30% damage OR older vehicle with minimal damage
  // Requirement 4.4: moderate wear on an imported vehicle
  if (damagePercentage < 30) {
    return 'good';
  }
  
  // Fair: 30-60% damage
  // Requirement 4.5: significant wear on a locally used vehicle
  if (damagePercentage < 60) {
    return 'fair';
  }
  
  // Poor: > 60% damage
  // Requirement 4.6: severe damage or poor maintenance
  return 'poor';
}

/**
 * Generate descriptive labels from Gemini assessment
 * 
 * Creates human-readable labels based on damage scores and flags
 * to maintain compatibility with existing label-based systems
 * 
 * @param assessment - Gemini damage assessment
 * @returns Array of descriptive labels
 */
function generateLabelsFromGemini(assessment: GeminiDamageAssessment): string[] {
  const labels: string[] = ['Vehicle', 'Car'];

  // Add severity-based labels
  if (assessment.severity === 'severe') {
    labels.push('Severe Damage', 'Extensive Damage');
  } else if (assessment.severity === 'moderate') {
    labels.push('Moderate Damage', 'Significant Damage');
  } else {
    labels.push('Minor Damage', 'Light Damage');
  }

  // Add category-specific labels based on scores
  if (assessment.structural > 50) {
    labels.push('Structural Damage', 'Frame Damage');
  }
  if (assessment.mechanical > 50) {
    labels.push('Mechanical Damage', 'Engine Damage');
  }
  if (assessment.cosmetic > 50) {
    labels.push('Cosmetic Damage', 'Body Damage');
  }
  if (assessment.electrical > 50) {
    labels.push('Electrical Damage');
  }
  if (assessment.interior > 50) {
    labels.push('Interior Damage');
  }

  // Add flag-based labels
  if (assessment.airbagDeployed) {
    labels.push('Airbag Deployed', 'Collision');
  }
  if (assessment.totalLoss) {
    labels.push('Total Loss', 'Beyond Repair');
  }

  return labels;
}

/**
 * Adapt Gemini response to unified format
 * 
 * Converts Gemini's structured damage assessment into the unified format
 * that maintains backward compatibility while adding new optional fields.
 * 
 * Process:
 * 1. Calculate overall damage percentage from individual scores (weighted average)
 * 2. Generate descriptive labels from scores and flags
 * 3. Use Gemini's confidence score
 * 4. Calculate estimated salvage value and reserve price
 * 5. Determine quality tier based on damage and vehicle context
 * 6. Add new optional fields (detailedScores, airbagDeployed, totalLoss, summary)
 * 
 * Requirements: 4.1-4.10, 11.1, 11.2, 11.3, 11.4
 * 
 * @param geminiAssessment - Structured assessment from Gemini API
 * @param marketValue - Market value of the vehicle
 * @param vehicleContext - Optional vehicle context for quality tier determination
 * @returns Unified damage assessment result
 */
export function adaptGeminiResponse(
  geminiAssessment: GeminiDamageAssessment,
  marketValue: number,
  vehicleContext?: VehicleContext
): DamageAssessmentResult {
  // Calculate overall damage percentage from individual scores
  const damagePercentage = calculateOverallDamagePercentage({
    structural: geminiAssessment.structural,
    mechanical: geminiAssessment.mechanical,
    cosmetic: geminiAssessment.cosmetic,
    electrical: geminiAssessment.electrical,
    interior: geminiAssessment.interior,
  });

  // Generate descriptive labels for backward compatibility
  const labels = generateLabelsFromGemini(geminiAssessment);

  // Calculate estimated salvage value: marketValue × (100 - damagePercentage) / 100
  const estimatedSalvageValue = marketValue * ((100 - damagePercentage) / 100);

  // Calculate reserve price: estimatedValue × 0.7
  const reservePrice = estimatedSalvageValue * 0.7;
  
  // Determine quality tier based on damage and vehicle context
  const qualityTier = determineQualityTier(
    geminiAssessment.severity,
    damagePercentage,
    vehicleContext
  );

  return {
    // Existing required fields (backward compatibility)
    labels,
    confidenceScore: geminiAssessment.confidence,
    damagePercentage,
    processedAt: new Date(),
    damageSeverity: geminiAssessment.severity,
    estimatedSalvageValue: Math.round(estimatedSalvageValue * 100) / 100,
    reservePrice: Math.round(reservePrice * 100) / 100,
    
    // Quality tier (Requirement 4.1)
    qualityTier,
    
    // New optional fields (Gemini-specific)
    method: 'gemini',
    detailedScores: {
      structural: geminiAssessment.structural,
      mechanical: geminiAssessment.mechanical,
      cosmetic: geminiAssessment.cosmetic,
      electrical: geminiAssessment.electrical,
      interior: geminiAssessment.interior,
    },
    airbagDeployed: geminiAssessment.airbagDeployed,
    totalLoss: geminiAssessment.totalLoss,
    summary: geminiAssessment.summary,
  };
}

/**
 * Adapt Vision response to unified format
 * 
 * Converts Vision API's keyword-based assessment into the unified format.
 * Maintains existing behavior and does not add new optional fields.
 * 
 * Process:
 * 1. Use Vision's existing labels, confidence, and damage percentage
 * 2. Determine severity based on damage percentage (existing logic)
 * 3. Calculate estimated salvage value and reserve price (existing logic)
 * 4. Determine quality tier based on damage and vehicle context
 * 5. Mark method as 'vision'
 * 6. Do not add detailedScores, airbagDeployed, totalLoss, or summary
 * 
 * Requirements: 5.2, 11.1, 11.2, 11.3, 11.4
 * 
 * @param visionAssessment - Assessment from Vision API
 * @param marketValue - Market value of the vehicle
 * @param vehicleContext - Optional vehicle context for quality tier determination
 * @returns Unified damage assessment result
 */
export function adaptVisionResponse(
  visionAssessment: VisionDamageAssessment,
  marketValue: number,
  vehicleContext?: VehicleContext
): DamageAssessmentResult {
  // Determine damage severity based on percentage (existing logic)
  // Minor: 40-60% damage
  // Moderate: 60-80% damage
  // Severe: 80-95% damage
  let damageSeverity: 'minor' | 'moderate' | 'severe';
  if (visionAssessment.damagePercentage >= 40 && visionAssessment.damagePercentage <= 60) {
    damageSeverity = 'minor';
  } else if (visionAssessment.damagePercentage >= 60 && visionAssessment.damagePercentage <= 80) {
    damageSeverity = 'moderate';
  } else {
    damageSeverity = 'severe';
  }

  // Calculate estimated salvage value: marketValue × (100 - damagePercentage) / 100
  const estimatedSalvageValue = marketValue * ((100 - visionAssessment.damagePercentage) / 100);

  // Calculate reserve price: estimatedValue × 0.7
  const reservePrice = estimatedSalvageValue * 0.7;
  
  // Determine quality tier based on damage and vehicle context
  const qualityTier = determineQualityTier(
    damageSeverity,
    visionAssessment.damagePercentage,
    vehicleContext
  );

  return {
    // Existing required fields (backward compatibility)
    labels: visionAssessment.labels,
    confidenceScore: visionAssessment.confidenceScore,
    damagePercentage: visionAssessment.damagePercentage,
    processedAt: new Date(),
    damageSeverity,
    estimatedSalvageValue: Math.round(estimatedSalvageValue * 100) / 100,
    reservePrice: Math.round(reservePrice * 100) / 100,
    
    // Quality tier (Requirement 4.1)
    qualityTier,
    
    // Mark method as 'vision' (no other optional fields)
    method: 'vision',
  };
}

/**
 * Generate neutral response when all AI methods fail
 * 
 * Returns a safe default assessment with neutral scores (50 for all categories)
 * and 'moderate' severity. This ensures the system can continue to function
 * even when both Gemini and Vision APIs are unavailable.
 * 
 * Neutral scores:
 * - All damage scores: 50 (middle of 0-100 range)
 * - Severity: 'moderate' (middle severity level)
 * - Confidence: 0 (no AI assessment available)
 * - Labels: Generic vehicle labels
 * - Quality tier: 'fair' (middle tier, safest default)
 * 
 * Requirements: 5.2, 11.1, 11.2, 11.3, 11.4
 * 
 * @param marketValue - Market value of the vehicle
 * @param vehicleContext - Optional vehicle context for quality tier determination
 * @returns Unified damage assessment result with neutral scores
 */
export function generateNeutralResponse(
  marketValue: number,
  vehicleContext?: VehicleContext
): DamageAssessmentResult {
  const damagePercentage = 50; // Neutral damage percentage
  const damageSeverity = 'moderate'; // Neutral severity

  // Calculate estimated salvage value: marketValue × (100 - damagePercentage) / 100
  const estimatedSalvageValue = marketValue * ((100 - damagePercentage) / 100);

  // Calculate reserve price: estimatedValue × 0.7
  const reservePrice = estimatedSalvageValue * 0.7;
  
  // Determine quality tier (will default to 'fair' for neutral case)
  const qualityTier = determineQualityTier(
    damageSeverity,
    damagePercentage,
    vehicleContext
  );

  return {
    // Existing required fields (backward compatibility)
    labels: ['Vehicle', 'Car', 'Moderate Damage'],
    confidenceScore: 0, // No AI assessment available
    damagePercentage,
    processedAt: new Date(),
    damageSeverity,
    estimatedSalvageValue: Math.round(estimatedSalvageValue * 100) / 100,
    reservePrice: Math.round(reservePrice * 100) / 100,
    
    // Quality tier (Requirement 4.1)
    qualityTier,
    
    // Mark method as 'neutral'
    method: 'neutral',
    
    // Add neutral detailed scores
    detailedScores: {
      structural: 50,
      mechanical: 50,
      cosmetic: 50,
      electrical: 50,
      interior: 50,
    },
    
    // Neutral flags
    airbagDeployed: false,
    totalLoss: false,
    summary: 'AI assessment unavailable. Neutral scores applied. Manual review recommended.',
  };
}
