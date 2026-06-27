/**
 * Enhanced AI Damage Assessment Service
 * 
 * Improvements over basic version:
 * 1. Uses vehicle context (make/model/year)
 * 2. Real market data from web scraping
 * 3. Confidence scoring and validation
 * 4. Multi-stage analysis
 * 5. Sanity checks
 * 6. Detailed explanations
 * 
 * Usage:
 * ```typescript
 * const assessment = await assessDamageEnhanced({
 *   photos: ['data:image/jpeg;base64,...'],
 *   vehicleInfo: {
 *     make: 'Toyota',
 *     model: 'Camry',
 *     year: 2020,
 *     marketValue: 8500000
 *   }
 * });
 * ```
 */

import { getMarketPrice } from '@/features/market-data/services/market-data.service';
import type { PropertyIdentifier } from '@/features/market-data/types';
import { internetSearchService } from '@/features/internet-search/services/internet-search.service';
import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';
import type { UniversalCondition } from '@/features/internet-search/services/query-builder.service';
import { valuationQueryService } from '@/features/valuations/services/valuation-query.service';
import { damageCalculationService } from '@/features/valuations/services/damage-calculation.service';
import type { DamageInput } from '@/features/valuations/types';
import { assessDamageWithClaude, initializeClaudeService, isClaudeEnabled } from '@/lib/integrations/claude-damage-detection';
import { assessDamageWithGemini, initializeGeminiService } from '@/lib/integrations/gemini-damage-detection';
import { assessDamageWithVision } from '@/lib/integrations/vision-damage-detection';
import { isGeminiEnabled } from '@/lib/integrations/gemini-damage-detection';
import { getClaudeRateLimiter } from '@/lib/integrations/claude-rate-limiter';
import { getGeminiRateLimiter } from '@/lib/integrations/gemini-rate-limiter';
import {
  type QualityTier,
  mapAnyConditionToQuality,
  resolveRealisticMarketSearchCondition,
} from '@/features/valuations/services/condition-mapping.service';
import { getValuationPolicyConfig, shouldRequireManualReview } from '@/features/valuations/services/valuation-policy.service';
import { isClaudeDamageFallbackEnabled } from '@/lib/ai/provider-cost-controls';

const MOCK_MODE = process.env.MOCK_AI_ASSESSMENT === 'true';
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
 * @param vehicleInfo - Optional vehicle info (includes year)
 * @returns Quality tier: "excellent", "good", "fair", or "poor"
 */
function determineQualityTier(
  damageSeverity: 'minor' | 'moderate' | 'severe',
  damagePercentage: number,
  vehicleInfo?: VehicleInfo
): QualityTier {
  const currentYear = new Date().getFullYear();
  const vehicleAge = vehicleInfo?.year ? currentYear - vehicleInfo.year : null;
  
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

// Universal Item Information (replaces VehicleInfo)
export interface UniversalItemInfo {
  // Universal fields
  type:
    | 'vehicle'
    | 'electronics'
    | 'appliance'
    | 'property'
    | 'watch'
    | 'jewelry'
    | 'furniture'
    | 'artwork'
    | 'equipment'
    | 'machinery'
    | 'stock'
    | 'goods_in_transit'
    | 'building_materials'
    | 'scrap'
    | 'agriculture'
    | 'medical_equipment'
    | 'energy_equipment'
    | 'aviation_equipment'
    | 'other';
  condition: 'Brand New' | 'Foreign Used (Tokunbo)' | 'Nigerian Used' | 'Heavily Used';

  // Vehicle-specific fields
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;

  // Electronics-specific fields
  brand?: string;
  storageCapacity?: string;
  batteryHealth?: number;

  // Watch-specific fields
  movementType?: 'automatic' | 'quartz' | 'manual';

  // Property-specific fields
  propertyType?: string;
  location?: string;
  bedrooms?: number;

  // Machinery/furniture/jewelry helper fields
  machineryType?: string;
  material?: string;

  // Universal fields
  age?: number; // Years since manufacture
  brandPrestige?: 'luxury' | 'premium' | 'standard' | 'budget';
  description?: string;
  marketValue?: number; // Claims paid / user-provided asset value
  marketValueSource?: 'manual' | 'ai';
  quantity?: string;
  unitOfMeasure?: string;
  packagingType?: string;
  batchOrSerial?: string;
  declaredCondition?: string;
}

const REPAIRABLE_TOTAL_LOSS_ASSET_TYPES = new Set<UniversalItemInfo['type']>([
  'vehicle',
  'electronics',
  'appliance',
  'machinery',
  'equipment',
  'medical_equipment',
  'energy_equipment',
  'aviation_equipment',
]);

const BULK_RECOVERY_ASSET_TYPES = new Set<UniversalItemInfo['type']>([
  'stock',
  'goods_in_transit',
  'building_materials',
  'scrap',
  'agriculture',
]);

export function shouldApplyTotalLossCap(input: {
  itemType?: UniversalItemInfo['type'];
  aiTotalLoss?: boolean;
  damageCalculationTotalLoss?: boolean;
  totalDeductionPercent?: number;
  partPricesFound?: number;
  damagePercentage?: number;
}): { applyCap: boolean; aiOnlyNonVehicleReview: boolean; reason: 'damage_calculation' | 'ai_vehicle' | 'ai_unpriced_high_damage' | 'none' } {
  const itemType = input.itemType || 'vehicle';
  const isVehicle = itemType === 'vehicle';
  const repairableTotalLossType = REPAIRABLE_TOTAL_LOSS_ASSET_TYPES.has(itemType);
  const aiTotalLoss = input.aiTotalLoss === true;
  const calculationTotalLoss = repairableTotalLossType && (
    input.damageCalculationTotalLoss === true || (input.totalDeductionPercent ?? 0) >= 0.7
  ) && (
    (input.partPricesFound ?? 0) > 0 ||
    ((input.totalDeductionPercent ?? 0) >= 0.85 && (input.damagePercentage ?? 0) >= 95)
  );

  if (calculationTotalLoss) {
    return { applyCap: true, aiOnlyNonVehicleReview: false, reason: 'damage_calculation' };
  }

  if (isVehicle && aiTotalLoss) {
    return { applyCap: true, aiOnlyNonVehicleReview: false, reason: 'ai_vehicle' };
  }

  if (isVehicle && (input.damagePercentage ?? 0) >= 55 && (input.partPricesFound ?? 0) < 3) {
    return { applyCap: true, aiOnlyNonVehicleReview: false, reason: 'ai_vehicle' };
  }

  const noPartEvidence = (input.partPricesFound ?? 0) === 0;
  const veryHighDamage = (input.damagePercentage ?? 0) >= 80;
  if (!isVehicle && aiTotalLoss && noPartEvidence && veryHighDamage) {
    return { applyCap: true, aiOnlyNonVehicleReview: false, reason: 'ai_unpriced_high_damage' };
  }

  return {
    applyCap: false,
    aiOnlyNonVehicleReview: !isVehicle && aiTotalLoss,
    reason: 'none',
  };
}

export function computeVisualEvidenceDeductionFloor(input: {
  itemType?: UniversalItemInfo['type'];
  damagePercentage: number;
  damagedParts?: Array<{ part: string; severity: 'minor' | 'moderate' | 'severe'; confidence: number }>;
  aiTotalLoss?: boolean;
}): number {
  const itemType = input.itemType || 'general_asset';
  if (BULK_RECOVERY_ASSET_TYPES.has(itemType as UniversalItemInfo['type'])) return 0;

  const damagedParts = input.damagedParts || [];
  const severityValue = { minor: 0.2, moderate: 0.48, severe: 0.86 } as const;
  const confidenceWeightedSeverity = damagedParts.length > 0
    ? damagedParts.reduce((sum, part) => {
        const confidenceWeight = Math.max(0.45, Math.min(1, part.confidence / 100));
        return sum + severityValue[part.severity] * confidenceWeight;
      }, 0) / damagedParts.length
    : 0;
  const visibleDamageRatio = Math.max(input.damagePercentage / 100, confidenceWeightedSeverity * 0.85);
  const severeRatio = damagedParts.length > 0
    ? damagedParts.filter((part) => part.severity === 'severe').length / damagedParts.length
    : 0;
  const partSpread = damagedParts.length > 0
    ? Math.min(1, Math.log1p(damagedParts.length) / Math.log1p(12))
    : 0;

  const policyByType: Partial<Record<UniversalItemInfo['type'] | 'general_asset', {
    damageWeight: number;
    severeWeight: number;
    spreadWeight: number;
    totalLossMinimum: number;
    maximum: number;
  }>> = {
    vehicle: { damageWeight: 0.72, severeWeight: 0.16, spreadWeight: 0.12, totalLossMinimum: 0.72, maximum: 0.9 },
    electronics: { damageWeight: 0.64, severeWeight: 0.14, spreadWeight: 0.1, totalLossMinimum: 0.7, maximum: 0.88 },
    appliance: { damageWeight: 0.62, severeWeight: 0.14, spreadWeight: 0.1, totalLossMinimum: 0.68, maximum: 0.86 },
    machinery: { damageWeight: 0.62, severeWeight: 0.14, spreadWeight: 0.1, totalLossMinimum: 0.68, maximum: 0.86 },
    equipment: { damageWeight: 0.62, severeWeight: 0.14, spreadWeight: 0.1, totalLossMinimum: 0.68, maximum: 0.86 },
    medical_equipment: { damageWeight: 0.66, severeWeight: 0.14, spreadWeight: 0.1, totalLossMinimum: 0.72, maximum: 0.9 },
    energy_equipment: { damageWeight: 0.64, severeWeight: 0.14, spreadWeight: 0.1, totalLossMinimum: 0.7, maximum: 0.88 },
    aviation_equipment: { damageWeight: 0.66, severeWeight: 0.14, spreadWeight: 0.1, totalLossMinimum: 0.72, maximum: 0.9 },
    property: { damageWeight: 0.58, severeWeight: 0.12, spreadWeight: 0.1, totalLossMinimum: 0.65, maximum: 0.85 },
    furniture: { damageWeight: 0.56, severeWeight: 0.12, spreadWeight: 0.08, totalLossMinimum: 0.62, maximum: 0.82 },
    watch: { damageWeight: 0.48, severeWeight: 0.1, spreadWeight: 0.06, totalLossMinimum: 0.55, maximum: 0.78 },
    jewelry: { damageWeight: 0.42, severeWeight: 0.08, spreadWeight: 0.05, totalLossMinimum: 0.5, maximum: 0.72 },
    artwork: { damageWeight: 0.68, severeWeight: 0.14, spreadWeight: 0.08, totalLossMinimum: 0.75, maximum: 0.92 },
    general_asset: { damageWeight: 0.58, severeWeight: 0.12, spreadWeight: 0.08, totalLossMinimum: 0.65, maximum: 0.85 },
  };

  const policy = policyByType[itemType] || policyByType.general_asset!;
  const floor = (visibleDamageRatio * policy.damageWeight)
    + (severeRatio * policy.severeWeight)
    + (partSpread * policy.spreadWeight);
  const withTotalLoss = input.aiTotalLoss ? Math.max(floor, policy.totalLossMinimum) : floor;

  return Math.max(0, Math.min(policy.maximum, withTotalLoss));
}

// Backward compatibility alias
export interface VehicleInfo {
  type?: 'vehicle';
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  marketValue?: number; // User-provided market value
  condition?: 'Brand New' | 'Foreign Used (Tokunbo)' | 'Nigerian Used' | 'Heavily Used';
  age?: number;
  brandPrestige?: 'luxury' | 'premium' | 'standard' | 'budget';
  description?: string;
}


export interface DamageScore {
  structural: number;    // 0-100
  mechanical: number;    // 0-100
  cosmetic: number;      // 0-100
  electrical: number;    // 0-100
  interior: number;      // 0-100
}

/**
 * Convert damagedParts array from Gemini to legacy DamageScore format
 * 
 * This function maps specific damaged parts to the 5 damage categories:
 * - structural: frame, chassis, pillars, structural components
 * - mechanical: engine, transmission, suspension, drivetrain
 * - cosmetic: body panels, paint, trim, glass
 * - electrical: wiring, lights, electronics, battery
 * - interior: seats, dashboard, controls, upholstery
 * 
 * @param damagedParts - Array of damaged parts from Gemini
 * @returns DamageScore with 0-100 scores for each category
 */
function convertDamagedPartsToScores(damagedParts: Array<{ part: string; severity: 'minor' | 'moderate' | 'severe'; confidence: number }>): DamageScore {
  // Initialize scores
  const scores: DamageScore = {
    structural: 0,
    mechanical: 0,
    cosmetic: 0,
    electrical: 0,
    interior: 0
  };

  // If no damaged parts, return all zeros
  if (damagedParts.length === 0) {
    return scores;
  }

  // Category keywords for mapping parts to categories
  const categoryKeywords = {
    structural: ['frame', 'chassis', 'pillar', 'a-pillar', 'b-pillar', 'c-pillar', 'd-pillar', 'rocker', 'floor pan', 'structural', 'housing', 'body structure'],
    mechanical: ['engine', 'transmission', 'suspension', 'drivetrain', 'axle', 'wheel', 'tire', 'brake', 'exhaust', 'motor', 'gearbox', 'drive shaft', 'belt', 'chain', 'bearing', 'hydraulic', 'pump', 'valve'],
    cosmetic: ['bumper', 'hood', 'trunk', 'door', 'fender', 'quarter panel', 'panel', 'paint', 'trim', 'glass', 'windshield', 'window', 'mirror', 'grille', 'headlight', 'taillight', 'light', 'lens', 'screen', 'display'],
    electrical: ['wiring', 'wire', 'battery', 'alternator', 'starter', 'sensor', 'control module', 'electrical', 'electronics', 'charging port', 'port', 'circuit', 'motherboard'],
    interior: ['seat', 'dashboard', 'steering wheel', 'console', 'door panel', 'airbag', 'upholstery', 'interior', 'control panel']
  };

  // Severity to score mapping
  const severityScores = {
    minor: 30,
    moderate: 60,
    severe: 90
  };

  // Count parts in each category
  const categoryCounts = {
    structural: 0,
    mechanical: 0,
    cosmetic: 0,
    electrical: 0,
    interior: 0
  };

  // Map each damaged part to categories and accumulate scores
  damagedParts.forEach(damagedPart => {
    const partLower = damagedPart.part.toLowerCase();
    const baseScore = severityScores[damagedPart.severity];

    // Check which category this part belongs to
    let categorized = false;

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => partLower.includes(keyword))) {
        const cat = category as keyof DamageScore;
        scores[cat] = Math.max(scores[cat], baseScore); // Use max score for category
        categoryCounts[cat]++;
        categorized = true;
        break; // Part assigned to first matching category
      }
    }

    // If part doesn't match any category, add to cosmetic as fallback
    if (!categorized) {
      scores.cosmetic = Math.max(scores.cosmetic, baseScore);
      categoryCounts.cosmetic++;
    }
  });

  return scores;
}

function hasUsableUniversalContext(itemInfo?: UniversalItemInfo): boolean {
  if (!itemInfo) return false;
  return Boolean(
    (itemInfo.brand && itemInfo.model) ||
    itemInfo.description ||
    itemInfo.propertyType ||
    itemInfo.machineryType ||
    itemInfo.material ||
    itemInfo.quantity ||
    itemInfo.batchOrSerial
  );
}

export function buildUniversalProviderContext(itemInfo: UniversalItemInfo): {
  make: string;
  model: string;
  year?: number;
  itemType: string;
} {
  const quantityContext = [itemInfo.quantity, itemInfo.unitOfMeasure].filter(Boolean).join(' ');
  const isBulk = isBulkRecoveryAsset(itemInfo);
  const make =
    itemInfo.brand ||
    itemInfo.make ||
    (isBulk ? itemInfo.description : undefined) ||
    itemInfo.propertyType ||
    itemInfo.machineryType ||
    itemInfo.material ||
    itemInfo.type;

  const model =
    itemInfo.description ||
    (!isBulk ? itemInfo.model : undefined) ||
    quantityContext ||
    itemInfo.packagingType ||
    itemInfo.batchOrSerial ||
    itemInfo.model ||
    itemInfo.type;

  return {
    make,
    model,
    year: itemInfo.year,
    itemType: itemInfo.type,
  };
}

function isBulkRecoveryAsset(itemInfo?: UniversalItemInfo): boolean {
  return Boolean(itemInfo?.type && BULK_RECOVERY_ASSET_TYPES.has(itemInfo.type));
}

const LUXURY_JEWELRY_BRAND_FLOORS_NGN: Record<string, number> = {
  rolex: 8_000_000,
  cartier: 3_500_000,
  'patek philippe': 20_000_000,
  audemars: 14_000_000,
  'audemars piguet': 14_000_000,
  omega: 2_500_000,
  'vacheron constantin': 18_000_000,
  'van cleef': 2_500_000,
  'van cleef & arpels': 2_500_000,
  tiffany: 1_500_000,
  bvlgari: 2_000_000,
  bulgari: 2_000_000,
  chopard: 2_500_000,
};

function itemSearchText(itemInfo?: UniversalItemInfo): string {
  return [
    itemInfo?.brand,
    itemInfo?.make,
    itemInfo?.model,
    itemInfo?.description,
    itemInfo?.material,
    itemInfo?.batchOrSerial,
  ].filter(Boolean).join(' ').toLowerCase();
}

function luxuryJewelryBrandMatches(itemInfo?: UniversalItemInfo): string[] {
  const text = itemSearchText(itemInfo);
  return Object.keys(LUXURY_JEWELRY_BRAND_FLOORS_NGN).filter((brand) => text.includes(brand));
}

function isLuxuryJewelryValuation(itemInfo?: UniversalItemInfo): boolean {
  return Boolean(
    itemInfo &&
    (itemInfo.type === 'jewelry' || itemInfo.type === 'watch') &&
    luxuryJewelryBrandMatches(itemInfo).length > 0
  );
}

function isMultiItemJewelryValuation(itemInfo?: UniversalItemInfo): boolean {
  if (!itemInfo || (itemInfo.type !== 'jewelry' && itemInfo.type !== 'watch')) return false;
  const text = [
    itemInfo.brand,
    itemInfo.model,
    itemInfo.description,
  ].filter(Boolean).join(' ');
  return /[,;+/&]|\band\b/i.test(text) || luxuryJewelryBrandMatches(itemInfo).length > 1;
}

function estimateLuxuryJewelryManualReviewValue(itemInfo: UniversalItemInfo): number {
  const matches = luxuryJewelryBrandMatches(itemInfo);
  const matchedFloor = matches.reduce((sum, brand) => sum + LUXURY_JEWELRY_BRAND_FLOORS_NGN[brand], 0);
  const materialFloor = /\b(18k|18ct|750|gold|diamond|platinum)\b/i.test(itemSearchText(itemInfo)) ? 1_500_000 : 0;
  return Math.max(matchedFloor, materialFloor, 1_000_000);
}

export function enrichItemInfoWithAiIdentification(
  itemInfo: UniversalItemInfo | undefined,
  damageAnalysis: {
    itemDetails?: {
      detectedMake?: string;
      detectedModel?: string;
      notes?: string;
    };
  }
): UniversalItemInfo | undefined {
  if (!itemInfo || !damageAnalysis.itemDetails) return itemInfo;

  const details = damageAnalysis.itemDetails;
  const enriched: UniversalItemInfo = { ...itemInfo };

  if (!enriched.brand && details.detectedMake) {
    enriched.brand = details.detectedMake;
  }

  if (enriched.type === 'vehicle' && details.detectedMake) {
    enriched.make = details.detectedMake;
    enriched.brand = enriched.brand || details.detectedMake;
  }

  if (details.detectedModel) {
    enriched.model = details.detectedModel;
    if (enriched.type === 'vehicle') {
      enriched.description = details.detectedModel;
    }
  }

  const detectedYear = (details as { detectedYear?: string | number }).detectedYear;
  if (enriched.type === 'vehicle' && !enriched.year && detectedYear) {
    const parsedYear = parseInt(String(detectedYear), 10);
    if (parsedYear > 1980 && parsedYear <= new Date().getFullYear() + 1) {
      enriched.year = parsedYear;
    }
  }

  if ((!enriched.description || /^\d+(?:\s+\w+)?$/.test(enriched.description)) && details.detectedModel) {
    enriched.description = details.detectedModel;
  }

  if (isBulkRecoveryAsset(enriched)) {
    const makeLabel = details.detectedMake?.trim();
    const brandLabel = (enriched.brand || enriched.make)?.trim();
    const modelLabel = stripBulkNarrative(details.detectedModel);
    const primaryBrand =
      makeLabel && brandLabel && makeLabel.toLowerCase() !== brandLabel.toLowerCase()
        ? makeLabel
        : makeLabel || brandLabel;

    if (primaryBrand) {
      enriched.brand = enriched.brand || primaryBrand;
    }

    const labelParts = [primaryBrand, modelLabel].filter((part, index, parts) => {
      if (!part) return false;
      const lower = part.toLowerCase();
      return parts.findIndex((candidate) => candidate?.toLowerCase() === lower) === index;
    });

    if (labelParts.length > 0) {
      enriched.description = stripBulkNarrative(labelParts.join(' '));
    }

    const quantitySource = details.notes || '';

    if (!enriched.unitOfMeasure && /\bbags?\b/i.test(quantitySource)) {
      enriched.unitOfMeasure = 'bags';
    }

    if (!enriched.quantity && quantitySource) {
      enriched.quantity = extractBulkUnitCount(quantitySource);
    }

    if (!enriched.packagingType && /\b25\s*kg\b/i.test(`${modelLabel} ${quantitySource}`)) {
      enriched.packagingType = '25kg bag';
    }
  }

  return enriched;
}

export function parseQuantityValue(value?: string): number | undefined {
  if (!value) return undefined;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function stripBulkNarrative(value?: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  const cut = trimmed.search(/\s+(approximately|stored in|across photos|all bags|surrounding|consistent with|no intact)/i);
  const short = cut > 0 ? trimmed.slice(0, cut) : trimmed;
  return short.replace(/\s+/g, ' ').trim().slice(0, 80);
}

export function extractBulkUnitCount(text: string): string | undefined {
  const normalized = text.replace(/\s+/g, ' ');
  const rangeMatch = normalized.match(
    /\b(?:approximately|about|around)?\s*(\d{1,4})\s*[-–]\s*(\d{1,4})\s*(?:bags?|sacks?|cartons?|units?)\b/i
  );
  if (rangeMatch) {
    const low = Math.min(Number(rangeMatch[1]), Number(rangeMatch[2]));
    if (low > 0) return String(low);
  }

  const singleMatch = normalized.match(
    /\b(?:approximately|about|around)?\s*(\d{1,4})\s*(?:bags?|sacks?|cartons?|units?)\b/i
  );
  if (singleMatch) return singleMatch[1];

  return undefined;
}

function getBulkQuantityReviewReasons(
  itemInfo: UniversalItemInfo | undefined,
  aiNotes?: string,
  userQuantityBeforeAi?: string
): string[] {
  if (!itemInfo || !isBulkRecoveryAsset(itemInfo)) return [];

  const userQuantity = parseQuantityValue(userQuantityBeforeAi);
  if (userQuantity) return [];

  const notes = aiNotes || '';
  const hasApproximateCount =
    /\b(approximately|about|around)\b/i.test(notes)
    || /\d+\s*[-–]\s*\d+\s*(?:bags?|sacks?|cartons?|units?|pallets?)\b/i.test(notes);
  const mentionsOffCameraStock =
    /\b(across photos|warehouse|off-camera|full consignment|policy schedule|stated quantity)\b/i.test(notes);

  if (!hasApproximateCount && !mentionsOffCameraStock) return [];

  return [
    'AI stock count is approximate or inferred — confirm total units/weight from policy schedule or adjuster verification before relying on the market value total',
  ];
}

export function scaleBulkInternetSearchPrice(
  itemInfo: UniversalItemInfo,
  unitPrice: number
): {
  totalValue: number;
  unitPrice: number;
  quantity: number;
  quantityMissing: boolean;
} {
  const quantity = parseQuantityValue(itemInfo.quantity);
  const roundedUnitPrice = Math.round(unitPrice);

  if (!quantity || quantity <= 0) {
    return {
      totalValue: roundedUnitPrice,
      unitPrice: roundedUnitPrice,
      quantity: 1,
      quantityMissing: true,
    };
  }

  return {
    totalValue: Math.round(roundedUnitPrice * quantity),
    unitPrice: roundedUnitPrice,
    quantity,
    quantityMissing: false,
  };
}

export function estimateKnownBulkUnitMarketValue(itemInfo: UniversalItemInfo): number | null {
  const quantity = parseQuantityValue(itemInfo.quantity);
  if (!quantity) return null;

  const text = [
    itemInfo.brand,
    itemInfo.model,
    itemInfo.description,
    itemInfo.unitOfMeasure,
    itemInfo.packagingType,
  ].filter(Boolean).join(' ').toLowerCase();

  const packText = `${itemInfo.model || ''} ${itemInfo.packagingType || ''}`.toLowerCase();
  const unitText = `${itemInfo.unitOfMeasure || ''}`.toLowerCase();
  const looksLikeBaggedCement =
    (/\bcement\b/.test(text) || /\blafarge\b/.test(text) || /\bdangote\b/.test(text))
    && /\bbags?\b|\bsacks?\b/.test(`${text} ${unitText}`)
    && !/\b(sugar|flour|rice|salt|pasta|noodles|feed)\b/.test(text);

  if (looksLikeBaggedCement) {
    const isHalfBag = /\b25\s*kg\b/.test(packText);
    const estimatedBagPrice = isHalfBag ? 6000 : 11000;
    return Math.round(quantity * estimatedBagPrice);
  }

  return null;
}

function calculateBulkDamagePercentage(
  damagedParts: Array<{ part: string; severity: 'minor' | 'moderate' | 'severe'; confidence: number }> | undefined,
  fallbackDamageScore: DamageScore
): number {
  if (!damagedParts || damagedParts.length === 0) {
    return calculateDamagePercentage(fallbackDamageScore);
  }

  const severityWeights = {
    minor: 25,
    moderate: 55,
    severe: 90,
  } as const;

  const weighted = damagedParts.reduce((sum, part) => {
    const confidence = Math.max(0.35, Math.min(1, part.confidence / 100));
    return sum + severityWeights[part.severity] * confidence;
  }, 0) / damagedParts.length;

  return Math.round(Math.max(0, Math.min(100, weighted)));
}

function calculateBulkRecoverySalvage(
  marketValue: number,
  damagedParts: Array<{ part: string; severity: 'minor' | 'moderate' | 'severe'; confidence: number }> | undefined,
  damageScore: DamageScore,
  itemInfo?: UniversalItemInfo,
  aiTotalLoss?: boolean
): {
  salvageValue: number;
  repairCost: number;
  damageBreakdown: Array<{
    component: string;
    damageLevel: 'minor' | 'moderate' | 'severe';
    repairCost: number;
    deductionPercent: number;
    deductionAmount: number;
  }>;
  damageRatio: number;
  reviewReason: string;
} {
  const severityWeights = {
    minor: 0.18,
    moderate: 0.45,
    severe: 0.72,
  } as const;

  if (aiTotalLoss) {
    const parts = damagedParts && damagedParts.length > 0
      ? damagedParts
      : [{
          part: itemInfo?.description || itemInfo?.type || 'visible stock',
          severity: 'severe' as const,
          confidence: 70,
        }];

    return {
      salvageValue: 0,
      repairCost: Math.round(marketValue),
      damageBreakdown: parts.map((part) => ({
        component: part.part,
        damageLevel: part.severity,
        repairCost: Math.round(marketValue),
        deductionPercent: 1,
        deductionAmount: Math.round(marketValue),
      })),
      damageRatio: 1,
      reviewReason: 'AI classified this bulk/cargo stock as a commercial total loss. Salvage value is set to zero unless a manager confirms recoverable resale value.',
    };
  }

  const visibleDamageRatio = damagedParts && damagedParts.length > 0
    ? damagedParts.reduce((total, part) => {
        const confidenceWeight = Math.max(0.4, Math.min(1, part.confidence / 100));
        return total + severityWeights[part.severity] * confidenceWeight;
      }, 0) / damagedParts.length
    : Math.max(damageScore.structural, damageScore.mechanical, damageScore.cosmetic, damageScore.electrical, damageScore.interior) / 100;

  const declaredConditionPenalty = itemInfo?.declaredCondition
    ? /contaminat|mould|mold|unsafe|burn|soak|flood|wet|harden/i.test(itemInfo.declaredCondition)
      ? 0.08
      : 0.03
    : 0;

  const rawDamageRatio = visibleDamageRatio + declaredConditionPenalty + (aiTotalLoss ? 0.08 : 0);
  const damageRatio = Math.max(0.1, Math.min(0.85, rawDamageRatio));
  const salvageValue = Math.round(marketValue * (1 - damageRatio));
  const repairCost = Math.round(marketValue - salvageValue);

  const parts = damagedParts && damagedParts.length > 0
    ? damagedParts
    : [{
        part: itemInfo?.description || itemInfo?.type || 'visible stock',
        severity: (damageRatio >= 0.65 ? 'severe' : damageRatio >= 0.35 ? 'moderate' : 'minor') as 'minor' | 'moderate' | 'severe',
        confidence: 60,
      }];

  const damageBreakdown = parts.map((part) => {
    const deductionPercent = severityWeights[part.severity];
    return {
      component: part.part,
      damageLevel: part.severity,
      repairCost: Math.round(marketValue * deductionPercent),
      deductionPercent,
      deductionAmount: Math.round(marketValue * deductionPercent),
    };
  });

  return {
    salvageValue,
    repairCost,
    damageBreakdown,
    damageRatio,
    reviewReason: 'Bulk/cargo salvage uses recoverable-quantity and contamination logic. Verify visible quantity, safety, and resale legality before approval.',
  };
}

export interface AssessmentConfidence {
  overall: number;
  vehicleDetection: number;
  damageDetection: number;
  valuationAccuracy: number;
  photoQuality: number;
  reasons: string[];
}

export interface EnhancedDamageAssessment {
  // Basic info
  labels: string[];
  confidenceScore: number;
  damagePercentage: number;
  damageSeverity: 'minor' | 'moderate' | 'severe';
  
  // Enhanced info
  damageScore: DamageScore;
  confidence: AssessmentConfidence;
  
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
  
  // Financial estimates
  marketValue: number;
  estimatedRepairCost: number;
  estimatedSalvageValue: number;
  reservePrice: number;
  
  // NEW: Damage breakdown and total loss indicator (Requirement 6.3)
  damageBreakdown?: Array<{
    component: string;
    damageLevel: string;
    repairCost: number;
    deductionPercent: number;
    deductionAmount: number;
  }>;
  isTotalLoss?: boolean;
  priceSource?: string; // NEW: Indicates if from database or scraping (Requirement 6.3)
  
  // Quality tier assessment (Requirement 4.1)
  qualityTier: QualityTier;
  
  // Recommendations
  isRepairable: boolean;
  recommendation: string;
  summary?: string; // CRITICAL FIX: Gemini's summary for display in purple box
  warnings: string[];
  manualReviewRequired?: boolean;
  reviewReasons?: string[];
  valuationEvidence?: {
    marketEvidence?: Record<string, unknown>;
    partEvidence?: Record<string, unknown>;
    decisionSummary?: Record<string, unknown>;
    policySnapshot?: Record<string, unknown>;
  };
  
  // Metadata
  processedAt: Date;
  photoCount: number;
  analysisMethod: 'claude' | 'gemini' | 'vision' | 'neutral' | 'mock';
}

/**
 * Enhanced damage assessment with universal item support
 */
export async function assessDamageEnhanced(params: {
  photos: string[];
  vehicleInfo?: VehicleInfo; // For backward compatibility
  universalItemInfo?: UniversalItemInfo; // New universal support
  forceRefresh?: boolean;
  requireDetailedAnalysis?: boolean;
}): Promise<EnhancedDamageAssessment> {
  const { photos, vehicleInfo, universalItemInfo, forceRefresh = false, requireDetailedAnalysis = false } = params;
  
  // Use universal item info if provided, otherwise fall back to vehicle info
  const itemInfo = universalItemInfo || (vehicleInfo ? {
    type: 'vehicle' as const,
    make: vehicleInfo.make,
    model: vehicleInfo.model,
    year: vehicleInfo.year,
    mileage: vehicleInfo.mileage,
    condition: vehicleInfo.condition || 'Nigerian Used',
    age: vehicleInfo.year ? new Date().getFullYear() - vehicleInfo.year : undefined,
  } : undefined);
  const valuationPolicy = await getValuationPolicyConfig();
  const assetTypeForPolicy = itemInfo?.type || 'general_asset';
  const photoRequirement = valuationPolicy.photoRequirements[assetTypeForPolicy]
    || valuationPolicy.photoRequirements.general_asset;
  const photoReviewReasons: string[] = [];
  const valuationReviewReasons: string[] = [];
  if (photoRequirement && photos.length < photoRequirement.minimumPhotos) {
    photoReviewReasons.push(
      `${assetTypeForPolicy} assessment needs at least ${photoRequirement.minimumPhotos} photos for reliable AI review`
    );
  } else if (photoRequirement && photos.length < photoRequirement.recommendedPhotos) {
    photoReviewReasons.push(
      `${assetTypeForPolicy} assessment has ${photos.length} photos; ${photoRequirement.recommendedPhotos} is recommended for stronger valuation confidence`
    );
  }
  
  // Initialize AI services if not already initialized
  await initializeClaudeService();
  await initializeGeminiService();
  
  console.log('🔍 Starting enhanced AI assessment...');
  console.log('📸 Photos:', photos.length);
  console.log('🎯 Item type:', itemInfo?.type || 'unknown');
  console.log('🏷️ Item details:', itemInfo?.brand || itemInfo?.make, itemInfo?.model, itemInfo?.year);
  
  // Validate inputs
  if (!photos || photos.length === 0) {
    throw new Error('At least one photo is required');
  }
  
  // Step 1: Analyze photos with Gemini → Vision fallback chain
  const damageAnalysis = await analyzePhotosWithFallback(photos, vehicleInfo, itemInfo);
  const detailedAnalysisAvailable =
    damageAnalysis.method === 'gemini' ||
    damageAnalysis.method === 'claude' ||
    MOCK_MODE;
  if (requireDetailedAnalysis && !detailedAnalysisAvailable) {
    throw new Error(
      'Detailed AI damage analysis is temporarily unavailable. Gemini quota is unavailable and paid Claude fallback is disabled or unavailable. No valuation was saved; retry after Gemini quota resets or complete a manual assessment.'
    );
  }
  const visionResults = damageAnalysis.visionResults;
  const geminiTotalLoss = damageAnalysis.geminiTotalLoss; // Capture Gemini's total loss flag
  
  // Step 2: Calculate damage scores
  const damageScore = damageAnalysis.damageScore;
  const damagePercentage = isBulkRecoveryAsset(itemInfo)
    ? calculateBulkDamagePercentage(damageAnalysis.damagedParts, damageScore)
    : calculateDamagePercentage(damageScore);
  
  // Step 3: Determine market value (with universal item support)
  const userQuantityBeforeAi = itemInfo?.quantity;
  const enrichedItemInfo = enrichItemInfoWithAiIdentification(itemInfo, damageAnalysis);
  valuationReviewReasons.push(
    ...getBulkQuantityReviewReasons(
      enrichedItemInfo,
      damageAnalysis.itemDetails?.notes,
      userQuantityBeforeAi
    )
  );
  const marketLookupItemInfo = enrichedItemInfo;
  const marketValueResult = await getUniversalMarketValue(marketLookupItemInfo, { forceRefresh });
  const marketValue = marketValueResult.value;
  const marketDataConfidence = marketValueResult.confidence;
  const priceSource = marketValueResult.source;
  const marketReviewReasons = Array.isArray(marketValueResult.evidence?.reviewReasons)
    ? marketValueResult.evidence.reviewReasons.filter((reason): reason is string => typeof reason === 'string')
    : [];
  valuationReviewReasons.push(...marketReviewReasons);
  
  // Step 4: Calculate damage-adjusted salvage value using database (Requirements 6.2, 6.3)
  let salvageValue: number;
  let repairCost: number;
  let damageBreakdown: Array<{
    component: string;
    damageLevel: string;
    repairCost: number;
    deductionPercent: number;
    deductionAmount: number;
  }> | undefined;
  let isTotalLoss: boolean | undefined;
  let partPrices: Awaited<ReturnType<typeof searchUniversalPartPrices>> = [];
  
  // Use AI-identified damaged parts for every asset type when available.
  let damages: DamageInput[];
  if (damageAnalysis.damagedParts && damageAnalysis.damagedParts.length > 0) {
    damages = damageAnalysis.damagedParts.map(part => ({
      component: part.part,
      damageLevel: part.severity
    }));
    console.log(`Using AI loss evidence for ${itemInfo?.type || 'asset'}:`, damages.map(d => d.component).join(', '));
  } else {
    damages = identifyDamagedComponents(damageScore);
  }
  
  // PRISTINE CONDITION HANDLING: If no damage detected, use universal adjustments
  if (damages.length === 0) {
    console.log('✅ No damage detected - using pristine pricing with universal adjustments');
    
    // For pristine items, salvage value = market value with universal adjustments
    let pristineValue = marketValue;
    
    // Apply universal adjustments for pristine items (works for all item types)
    if (itemInfo) {
      // Skip condition adjustment only for internet search (already condition-specific)
      const skipConditionAdjustment = priceSource === 'internet_search' || priceSource === 'user_provided';
      const universalAdjustment = getUniversalAdjustment(itemInfo, skipConditionAdjustment);
      pristineValue = marketValue * universalAdjustment;
      
      if (skipConditionAdjustment) {
        console.log(`🔧 Applied universal adjustment (type-specific only): ${universalAdjustment} for ${itemInfo.type} (${itemInfo.condition})`);
      } else {
        console.log(`🔧 Applied universal adjustment (condition + type-specific): ${universalAdjustment} for ${itemInfo.type} (${itemInfo.condition})`);
      }
    }
    
    salvageValue = Math.round(pristineValue);
    
    // CRITICAL: Ensure salvage value never exceeds market value
    if (salvageValue > marketValue) {
      console.warn(`⚠️ Salvage value (${salvageValue}) exceeds market value (${marketValue}), capping at market value`);
      salvageValue = marketValue;
    }
    repairCost = 0; // No repair needed for pristine items
    isTotalLoss = false;
    
    // No damage breakdown for pristine items
    damageBreakdown = [];
    
    console.log('✅ Pristine item pricing complete:', {
      basePrice: marketValue,
      adjustedPrice: salvageValue,
      repairCost: 0
    });
  } else if (damages.length > 0 && marketValue > 0) {
    try {
      console.log('🔧 Calculating salvage value with damage deductions...');
      console.log(`📊 Base market value: ₦${marketValue.toLocaleString()} (source: ${priceSource})`);
      console.log(`🏷️ Item condition: ${itemInfo?.condition || 'Unknown'} (age: ${itemInfo?.age || 'Unknown'} years)`);
      
      // Apply condition-based adjustment to market value for damaged items
      // This is important because:
      // 1. Internet search may return prices for different conditions
      // 2. Condition affects how well an item retains value after damage
      // 3. Foreign Used items retain more value than Nigerian Used
      let conditionAdjustedMarketValue = marketValue;
      
      if (itemInfo && !isBulkRecoveryAsset(itemInfo) && priceSource !== 'internet_search' && priceSource !== 'user_provided') {
        // Only apply condition adjustment if NOT from internet search (which already includes condition)
        const conditionAdjustment = getConditionAdjustment(itemInfo.condition);
        conditionAdjustedMarketValue = marketValue * conditionAdjustment;
        console.log(`🔧 Applied condition adjustment: ${conditionAdjustment} for ${itemInfo.condition}`);
        console.log(`📊 Condition-adjusted market value: ₦${conditionAdjustedMarketValue.toLocaleString()}`);
      } else if (itemInfo) {
        console.log(`ℹ️ Skipping condition adjustment - already included in ${priceSource} price`);
      }
      
      let calculationDeductionPercent = 0;
      if (isBulkRecoveryAsset(itemInfo)) {
        const bulkCalc = calculateBulkRecoverySalvage(
          conditionAdjustedMarketValue,
          damageAnalysis.damagedParts,
          damageScore,
          itemInfo,
          geminiTotalLoss
        );

        salvageValue = bulkCalc.salvageValue;
        repairCost = bulkCalc.repairCost;
        damageBreakdown = bulkCalc.damageBreakdown;
        calculationDeductionPercent = bulkCalc.damageRatio;
        isTotalLoss = geminiTotalLoss === true && bulkCalc.damageRatio >= 0.8;
        valuationReviewReasons.push(bulkCalc.reviewReason);
        console.log('Bulk/cargo salvage calculation complete:', {
          assetType: itemInfo?.type,
          damageRatio: bulkCalc.damageRatio,
          salvageValue,
          repairCost,
          isTotalLoss,
        });
      } else {
      // NEW: Search for part prices to enhance salvage calculations (Task 7.4)
      partPrices = await searchUniversalPartPrices(marketLookupItemInfo ?? itemInfo, damages, { forceRefresh });
      console.log(`🔍 Part price search results: ${partPrices.filter(p => p.searchedPrice).length}/${partPrices.length} found`);
      
      // Extract item make/brand for make-specific deductions (Requirement 6.1)
      const itemMake = itemInfo?.make || itemInfo?.brand;
      if (itemMake) {
        console.log(`🏭 Using make/brand-specific deductions for: ${itemMake}`);
      }
      
      // Call Enhanced DamageCalculationService with part prices (NEW)
      // Use condition-adjusted market value as the base
      const salvageCalc = await damageCalculationService.calculateSalvageValueWithPartPrices(
        conditionAdjustedMarketValue,
        damages,
        partPrices.map(p => ({
          component: p.component,
          partPrice: p.searchedPrice,
          confidence: p.confidence,
          source: p.searchedPrice
            ? (p.source === 'ai_estimate' ? 'ai_estimate' as const : 'internet_search' as const)
            : 'not_found' as const,
          evidence: {
            reason: typeof p.evidence?.reason === 'string' ? p.evidence.reason : undefined,
          },
        })),
        itemMake // Pass item make/brand for make-specific deductions
      );
      calculationDeductionPercent = salvageCalc.totalDeductionPercent;
      
      salvageValue = Math.round(salvageCalc.salvageValue);
      const partPricesFound = partPrices.filter(p => p.searchedPrice).length;
      const partPriceCoverage = damages.length > 0 ? partPricesFound / damages.length : 0;
      const visualEvidenceFloor = computeVisualEvidenceDeductionFloor({
        itemType: itemInfo?.type,
        damagePercentage,
        damagedParts: damageAnalysis.damagedParts,
        aiTotalLoss: geminiTotalLoss,
      });

      if (visualEvidenceFloor > 0 && calculationDeductionPercent < visualEvidenceFloor) {
        const originalSalvageValue = salvageValue;
        calculationDeductionPercent = visualEvidenceFloor;
        salvageValue = Math.round(conditionAdjustedMarketValue * (1 - visualEvidenceFloor));
        repairCost = Math.round(conditionAdjustedMarketValue - salvageValue);
        valuationReviewReasons.push(
          `Photo evidence indicates a minimum ${(visualEvidenceFloor * 100).toFixed(0)}% value loss for this ${itemInfo?.type || 'asset'}; part-price repair evidence was lower and has been treated as incomplete.`
        );
        console.log('Applied visual evidence deduction floor:', {
          assetType: itemInfo?.type,
          originalSalvageValue,
          adjustedSalvageValue: salvageValue,
          originalDeduction: salvageCalc.totalDeductionPercent,
          adjustedDeduction: visualEvidenceFloor,
          damagePercentage,
          partPriceCoverage,
          aiTotalLoss: geminiTotalLoss,
        });
      }

      if (partPriceCoverage < 0.35 && damages.length >= 5) {
        const severeCount = damages.filter((d) => d.damageLevel === 'severe').length;
        const evidenceMinDeduction = Math.min(
          0.85,
          0.22 + (damages.length / 18) * 0.42 + (severeCount / damages.length) * 0.32
        );
        if (calculationDeductionPercent < evidenceMinDeduction) {
          const originalSalvageValue = salvageValue;
          calculationDeductionPercent = evidenceMinDeduction;
          salvageValue = Math.round(conditionAdjustedMarketValue * (1 - evidenceMinDeduction));
          repairCost = Math.round(conditionAdjustedMarketValue - salvageValue);
          valuationReviewReasons.push(
            `Only ${partPricesFound}/${damages.length} part prices found; applied evidence-based minimum deduction of ${(evidenceMinDeduction * 100).toFixed(0)}%. Review photos and pricing evidence before approval.`
          );
          console.log('Applied evidence minimum deduction for thin part-price coverage:', {
            originalSalvageValue,
            adjustedSalvageValue: salvageValue,
            originalDeduction: salvageCalc.totalDeductionPercent,
            adjustedDeduction: evidenceMinDeduction,
            partPriceCoverage,
            damageParts: damages.length,
          });
        }
      }
      
      // CRITICAL: Ensure salvage value never exceeds condition-adjusted market value
      if (salvageValue > conditionAdjustedMarketValue) {
        console.warn(`⚠️ Salvage value (${salvageValue}) exceeds condition-adjusted market value (${conditionAdjustedMarketValue}), capping at condition-adjusted market value`);
        salvageValue = conditionAdjustedMarketValue;
      }
      
      const totalLossDecision = shouldApplyTotalLossCap({
        itemType: itemInfo?.type,
        aiTotalLoss: geminiTotalLoss,
        damageCalculationTotalLoss: calculationDeductionPercent >= 0.85,
        totalDeductionPercent: calculationDeductionPercent,
        partPricesFound,
        damagePercentage,
      });
      const isActuallyTotalLoss = totalLossDecision.applyCap;
      
      if (geminiTotalLoss === true && !salvageCalc.isTotalLoss && totalLossDecision.applyCap) {
        console.log(`🚨 AI TOTAL-LOSS OVERRIDE: ${damageAnalysis.method} detected total loss but damage calculation did not. Forcing total loss.`);
      }
      
      if (geminiTotalLoss === true && !salvageCalc.isTotalLoss && totalLossDecision.aiOnlyNonVehicleReview) {
        valuationReviewReasons.push(
          `${damageAnalysis.method} flagged total loss, but non-vehicle repair/part pricing did not cross the total-loss threshold; review before applying a total-loss cap.`
        );
        console.log(`âš ï¸ AI total-loss flag retained as manual review only for ${itemInfo?.type || 'asset'}; repair math did not support the cap.`);
      }

      // TOTAL LOSS OVERRIDE: Cap salvage value at 30% of condition-adjusted market value for total loss items
      const totalLossSalvageCapRatio = valuationPolicy.totalLossSalvageCapRatio;
      if (isActuallyTotalLoss && salvageValue > conditionAdjustedMarketValue * totalLossSalvageCapRatio) {
        const originalSalvage = salvageValue;
        salvageValue = Math.round(conditionAdjustedMarketValue * totalLossSalvageCapRatio);
        console.log(`🚨 Total loss override applied: Salvage value capped from ₦${originalSalvage.toLocaleString()} to ₦${salvageValue.toLocaleString()} (${Math.round(totalLossSalvageCapRatio * 100)}% of condition-adjusted market value ₦${conditionAdjustedMarketValue.toLocaleString()})`);
        console.log(`   Source: ${geminiTotalLoss === true ? `${damageAnalysis.method} AI` : 'Damage Calculation'}`);
      }
      
      // Update isTotalLoss to reflect Gemini's determination
      isTotalLoss = isActuallyTotalLoss;
      
      repairCost = Math.max(0, Math.round(conditionAdjustedMarketValue - salvageValue));
      
      // Map deductions to ensure all required fields are present (Requirement 6.3)
      damageBreakdown = salvageCalc.deductions.map(d => {
        // Try to find matching part price from internet search
        const partPrice = partPrices.find(p => p.component === d.component);
        
        return {
          component: d.component,
          damageLevel: d.damageLevel,
          repairCost: partPrice?.searchedPrice || d.repairCost || 0,
          deductionPercent: d.deductionPercent || 0,
          deductionAmount: d.deductionAmount || 0,
        };
      });
      }
      
      console.log('✅ Salvage calculation complete:', {
        basePrice: marketValue,
        totalDeduction: calculationDeductionPercent,
        salvageValue,
        isTotalLoss,
        partPricesUsed: partPrices.filter(p => p.searchedPrice).length
      });
    } catch (error) {
      console.error('❌ Damage calculation failed, using fallback:', error);
      // Fallback to existing estimation logic
      repairCost = estimateRepairCost(damageScore, marketValue);
      salvageValue = marketValue - repairCost;
      
      // CRITICAL: Ensure salvage value is never negative
      if (salvageValue < 0) {
        console.warn(`⚠️ Salvage value (${salvageValue}) is negative, setting to 0`);
        salvageValue = 0;
      }
    }
  } else {
    // Fallback to existing estimation logic
    repairCost = estimateRepairCost(damageScore, marketValue);
    salvageValue = marketValue - repairCost;
    
    // CRITICAL: Ensure salvage value is never negative
    if (salvageValue < 0) {
      console.warn(`⚠️ Salvage value (${salvageValue}) is negative, setting to 0`);
      salvageValue = 0;
    }
  }
  
  const reservePrice = salvageValue * valuationPolicy.reservePriceRatio;
  
  // Step 5: Determine severity
  let damageSeverity = determineSeverity(damagePercentage);
  
  // Use model severity as authoritative when available; percentage remains the deterministic fallback.
  if ((damageAnalysis.method === 'gemini' || damageAnalysis.method === 'claude') && damageAnalysis.severity) {
    console.log(`🎯 Using AI severity assessment: ${damageAnalysis.severity} (overriding calculated: ${damageSeverity})`);
    damageSeverity = damageAnalysis.severity;
  }
  
  // Step 6: Assess repairability (with item type for proper language)
  const repairability = assessRepairability(damageScore, repairCost, marketValue, itemInfo?.type);
  
  // Step 7: Calculate confidence (with universal item support)
  const confidence = calculateUniversalConfidence(
    photos,
    itemInfo,
    visionResults,
    damageScore,
    marketDataConfidence,
    photoRequirement
  );
  
  // Step 8: Validate and generate warnings
  const warnings = validateAssessment({
    marketValue,
    salvageValue,
    reservePrice,
    damagePercentage,
    damageSeverity,
    confidence: confidence.overall,
    reservePriceRatio: valuationPolicy.reservePriceRatio,
    suppressSeverityPercentageMismatch:
      isLuxuryJewelryValuation(itemInfo) || isMultiItemJewelryValuation(itemInfo),
  });
  
  // Step 9: Determine quality tier based on damage and item context
  const qualityTier = determineUniversalQualityTier(
    damageSeverity,
    damagePercentage,
    itemInfo
  );
  const partEvidence = typeof partPrices !== 'undefined'
    ? {
        searchedParts: partPrices.map(part => ({
          component: part.component,
          found: !!part.searchedPrice,
          price: part.searchedPrice,
          confidence: part.confidence,
          source: part.source,
          evidence: part.evidence,
        })),
      }
    : { searchedParts: [] };
  const partAdjudicationReviewReasons = partEvidence.searchedParts.flatMap((part) => {
    const adjudication = part.evidence && typeof part.evidence === 'object'
      ? (part.evidence as { adjudication?: { reviewReasons?: string[] } }).adjudication
      : undefined;
    return adjudication?.reviewReasons || [];
  });
  const specialistAppraisalRequired =
    typeof marketValueResult.evidence?.reason === 'string' &&
    marketValueResult.evidence.reason === 'luxury_jewelry_specialist_appraisal_required';
  const manualReviewDecision = specialistAppraisalRequired
    ? { required: true, reasons: [] }
    : shouldRequireManualReview({
        policy: valuationPolicy,
        overallConfidence: confidence.overall,
        marketConfidence: marketDataConfidence,
        damageConfidence: confidence.damageDetection,
        uniqueSourceCount: marketValueResult.uniqueSourceCount ?? 0,
        priceSpreadPercent: marketValueResult.priceSpreadPercent ?? 0,
      });
  const reviewReasons = [
    ...photoReviewReasons,
    ...valuationReviewReasons,
    ...partAdjudicationReviewReasons,
    ...manualReviewDecision.reasons,
  ];
  const manualReviewRequired = reviewReasons.length > 0;
  const valuationEvidence = {
    marketEvidence: marketValueResult.evidence || {
      source: priceSource,
      value: marketValue,
      confidence: marketDataConfidence,
    },
    partEvidence,
    decisionSummary: {
      marketConfidence: marketDataConfidence,
      damageConfidence: confidence.damageDetection,
      overallConfidence: confidence.overall,
      uniqueSourceCount: marketValueResult.uniqueSourceCount,
      priceSpreadPercent: marketValueResult.priceSpreadPercent,
      manualReviewRequired,
      reviewReasons,
      photoCount: photos.length,
      requiredPhotoCount: photoRequirement?.minimumPhotos,
      recommendedPhotoCount: photoRequirement?.recommendedPhotos,
    },
    policySnapshot: {
      minimumOverallConfidence: valuationPolicy.minimumOverallConfidence,
      minimumMarketConfidence: valuationPolicy.minimumMarketConfidence,
      minimumDamageConfidence: valuationPolicy.minimumDamageConfidence,
      minimumMarketSourceCount: valuationPolicy.minimumMarketSourceCount,
      sourceDiversityRequired: valuationPolicy.sourceDiversityRequired,
      maxAllowedPriceSpreadPercent: valuationPolicy.maxAllowedPriceSpreadPercent,
      reservePriceRatio: valuationPolicy.reservePriceRatio,
      totalLossSalvageCapRatio: valuationPolicy.totalLossSalvageCapRatio,
      repairCostMultipliers: valuationPolicy.repairCostMultipliers,
    },
  };
  
  const assessment: EnhancedDamageAssessment = {
    labels: visionResults.labels.map(l => l.description),
    confidenceScore: Math.round(confidence.overall),
    damagePercentage: Math.round(damagePercentage),
    damageSeverity,
    damageScore,
    confidence,
    itemDetails: damageAnalysis.itemDetails, // NEW: Include detailed item identification
    damagedParts: damageAnalysis.damagedParts, // NEW: Include detailed damaged parts list
    marketValue: Math.round(marketValue),
    estimatedRepairCost: Math.round(repairCost),
    estimatedSalvageValue: Math.round(salvageValue),
    reservePrice: Math.round(reservePrice),
    damageBreakdown, // NEW: Detailed breakdown (Requirement 6.3)
    isTotalLoss, // NEW: Total loss indicator (Requirement 6.3)
    priceSource, // NEW: Indicates source (Requirement 6.3)
    qualityTier, // NEW: Quality tier assessment (Requirement 4.1)
    isRepairable: repairability.isRepairable,
    recommendation: repairability.recommendation,
    summary: damageAnalysis.summary, // CRITICAL FIX: Include Gemini's summary for display
    warnings: manualReviewRequired
      ? [...warnings, ...reviewReasons.map(reason => `Manual review: ${reason}`)]
      : warnings,
    manualReviewRequired,
    reviewReasons,
    valuationEvidence,
    processedAt: new Date(),
    photoCount: photos.length,
    analysisMethod: MOCK_MODE ? 'mock' : damageAnalysis.method
  };
  
  console.log('✅ Assessment complete:', {
    severity: assessment.damageSeverity,
    confidence: assessment.confidenceScore,
    salvageValue: assessment.estimatedSalvageValue
  });
  
  return assessment;
}

/**
 * Analyze photos with Gemini → Claude → Vision fallback chain
 * 
 * This function implements the complete fallback chain:
 * 1. Try Gemini 2.5 Flash FIRST (FREE - if enabled, rate limit allows, and item context provided)
 * 2. Fall back to Claude Sonnet 4.6 if Gemini fails or is unavailable (PAID backup)
 * 3. Fall back to Vision API if both Claude and Gemini fail
 * 4. Return neutral scores if all fail
 * 
 * Cost Strategy: Gemini handles 95%+ of cases for FREE, Claude only picks up the slack
 */
async function analyzePhotosWithFallback(
  photos: string[],
  vehicleInfo?: VehicleInfo,
  universalItemInfo?: UniversalItemInfo
): Promise<{
  damageScore: DamageScore;
  visionResults: { labels: Array<{ description: string; score: number }>; totalConfidence: number };
  method: 'claude' | 'gemini' | 'vision' | 'neutral';
  geminiTotalLoss?: boolean; // Capture AI's total loss flag (Claude or Gemini)
  severity?: 'minor' | 'moderate' | 'severe'; // Capture AI's severity assessment
  summary?: string; // Capture AI's summary for display
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
}> {
  const requestId = `enhanced-assess-${Date.now()}`;
  
  // Support both vehicle and universal item contexts
  const hasVehicleContext = vehicleInfo?.make && vehicleInfo?.model && vehicleInfo?.year;
  const hasUniversalContext = hasUsableUniversalContext(universalItemInfo);
  const hasItemContext = hasVehicleContext || hasUniversalContext;
  
  // ATTEMPT 1: Try Gemini FIRST (FREE - if enabled, rate limit allows, and item context provided)
  if (isGeminiEnabled() && hasItemContext) {
    try {
      // Check rate limiter
      const rateLimiter = getGeminiRateLimiter();
      const quotaStatus = rateLimiter.checkQuota();
      
      if (quotaStatus.allowed) {
        console.log('🤖 Attempting Gemini damage detection (FREE)...');
        console.log(`   Quota: ${quotaStatus.minuteRemaining}/minute, ${quotaStatus.dailyRemaining}/day`);
        
        // Prepare context for Gemini - support both vehicle and universal items
        let geminiContext: any;
        if (hasVehicleContext) {
          geminiContext = {
            make: vehicleInfo!.make,
            model: vehicleInfo!.model,
            year: vehicleInfo!.year,
          };
          console.log(`   Vehicle context: ${vehicleInfo!.make} ${vehicleInfo!.model} ${vehicleInfo!.year}`);
        } else if (hasUniversalContext) {
          geminiContext = buildUniversalProviderContext(universalItemInfo!);
          console.log(`   Universal item context: ${geminiContext.make} ${geminiContext.model} (${geminiContext.itemType})`);
        }
        
        rateLimiter.recordRequest();
        const geminiResult = await assessDamageWithGemini(photos, geminiContext);
        
        console.log('✅ Gemini assessment successful (FREE)');
        console.log(`   Severity: ${geminiResult.severity}`);
        console.log(`   Damaged parts: ${geminiResult.damagedParts.length}`);
        
        // Convert Gemini's damagedParts array to legacy DamageScore format
        const damageScore: DamageScore = convertDamagedPartsToScores(geminiResult.damagedParts);
        
        if (isBulkRecoveryAsset(universalItemInfo)) {
          console.log(`   Bulk loss evidence score: ${calculateBulkDamagePercentage(geminiResult.damagedParts, damageScore)}%`);
        } else {
          console.log(`   Converted scores - Structural: ${damageScore.structural}, Mechanical: ${damageScore.mechanical}`);
          console.log(`   Cosmetic: ${damageScore.cosmetic}, Electrical: ${damageScore.electrical}, Interior: ${damageScore.interior}`);
        }
        
        // Create mock vision results for backward compatibility
        const visionResults = {
          labels: [
            { description: geminiResult.summary, score: geminiResult.confidence / 100 },
          ],
          totalConfidence: geminiResult.confidence / 100,
        };
        
        // CRITICAL: Capture Gemini's total loss flag to override damage calculation
        return { 
          damageScore, 
          visionResults, 
          method: 'gemini',
          geminiTotalLoss: geminiResult.totalLoss, // Pass through Gemini's total loss determination
          severity: geminiResult.severity, // Pass through Gemini's severity assessment
          summary: geminiResult.summary, // CRITICAL FIX: Pass through Gemini's summary for display
          itemDetails: geminiResult.itemDetails, // Pass through detailed item identification
          damagedParts: geminiResult.damagedParts // Pass through detailed damaged parts list
        };
      } else {
        const reason = quotaStatus.dailyRemaining === 0 
          ? `Daily quota exhausted`
          : `Minute quota exhausted`;
        console.warn(`⚠️ Gemini rate limit exceeded: ${reason}. Falling back to Claude.`);
      }
    } catch (geminiError: any) {
      const geminiErrorMessage = geminiError?.message || String(geminiError);
      if (/429|quota exceeded|resource[_\s-]?exhausted/i.test(geminiErrorMessage)) {
        getGeminiRateLimiter().markQuotaExceeded();
      }
      console.error('❌ Gemini assessment failed:', geminiError?.message || 'Unknown error');
      console.log('   Falling back to Claude...');
    }
  } else {
    if (!isGeminiEnabled()) {
      console.log('ℹ️ Gemini not enabled. Trying Claude.');
    } else if (!hasItemContext) {
      console.log('ℹ️ Item context incomplete. Trying Claude.');
    }
  }
  
  // ATTEMPT 2: Try Claude as BACKUP (PAID - only if Gemini failed or unavailable)
  const claudeFallbackEnabled = isClaudeDamageFallbackEnabled();
  if (claudeFallbackEnabled && isClaudeEnabled() && hasItemContext) {
    try {
      // Check rate limiter
      const claudeRateLimiter = getClaudeRateLimiter();
      const quotaStatus = claudeRateLimiter.checkQuota();
      
      if (quotaStatus.allowed) {
        console.log('🤖 Attempting Claude damage detection (PAID - Gemini failed)...');
        console.log(`   Quota: ${quotaStatus.minuteRemaining}/minute, ${quotaStatus.dailyRemaining}/day`);
        
        // Prepare context for Claude - support both vehicle and universal items
        let claudeContext: any;
        if (hasVehicleContext) {
          claudeContext = {
            make: vehicleInfo!.make,
            model: vehicleInfo!.model,
            year: vehicleInfo!.year,
          };
          console.log(`   Vehicle context: ${vehicleInfo!.make} ${vehicleInfo!.model} ${vehicleInfo!.year}`);
        } else if (hasUniversalContext) {
          claudeContext = buildUniversalProviderContext(universalItemInfo!);
          console.log(`   Universal item context: ${claudeContext.make} ${claudeContext.model} (${claudeContext.itemType})`);
        }
        
        const claudeResult = await assessDamageWithClaude(photos, claudeContext);
        
        // Record successful request
        claudeRateLimiter.recordRequest();
        
        console.log('✅ Claude assessment successful (PAID backup)');
        console.log(`   Severity: ${claudeResult.severity}`);
        console.log(`   Damaged parts: ${claudeResult.damagedParts.length}`);
        
        // Convert Claude's damagedParts array to legacy DamageScore format
        const damageScore: DamageScore = convertDamagedPartsToScores(claudeResult.damagedParts);
        
        if (isBulkRecoveryAsset(universalItemInfo)) {
          console.log(`   Bulk loss evidence score: ${calculateBulkDamagePercentage(claudeResult.damagedParts, damageScore)}%`);
        } else {
          console.log(`   Converted scores - Structural: ${damageScore.structural}, Mechanical: ${damageScore.mechanical}`);
          console.log(`   Cosmetic: ${damageScore.cosmetic}, Electrical: ${damageScore.electrical}, Interior: ${damageScore.interior}`);
        }
        
        // Create mock vision results for backward compatibility
        const visionResults = {
          labels: [
            { description: claudeResult.summary, score: claudeResult.confidence / 100 },
          ],
          totalConfidence: claudeResult.confidence / 100,
        };
        
        return { 
          damageScore, 
          visionResults, 
          method: 'claude',
          geminiTotalLoss: claudeResult.totalLoss,
          severity: claudeResult.severity,
          summary: claudeResult.summary,
          itemDetails: claudeResult.itemDetails,
          damagedParts: claudeResult.damagedParts
        };
      } else {
        const reason = quotaStatus.dailyRemaining === 0 
          ? `Daily quota exhausted`
          : `Minute quota exhausted`;
        console.warn(`⚠️ Claude rate limit exceeded: ${reason}. Falling back to Vision API.`);
      }
    } catch (claudeError: any) {
      console.error('❌ Claude assessment failed:', claudeError?.message || 'Unknown error');
      console.log('   Falling back to Vision API...');
    }
  } else {
    if (!claudeFallbackEnabled) {
      console.log('Paid Claude damage fallback is disabled. Set CLAUDE_DAMAGE_FALLBACK_ENABLED=true to opt in.');
    } else if (!isClaudeEnabled()) {
      console.log('ℹ️ Claude not enabled. Using Vision API.');
    } else if (!hasItemContext) {
      console.log('ℹ️ Item context incomplete. Using Vision API.');
    }
  }
  
  // ATTEMPT 3: Fall back to Vision API
  try {
    console.log('👁️ Using Vision API for damage detection...');
    const visionAssessment = await assessDamageWithVision(photos);
    
    // Calculate damage scores from Vision labels
    const visionResults = {
      labels: visionAssessment.labels.map(label => ({
        description: label,
        score: visionAssessment.confidenceScore / 100,
      })),
      totalConfidence: visionAssessment.confidenceScore / 100,
    };
    
    const damageScore = calculateDamageScore(visionResults.labels);
    
    console.log('✅ Vision API assessment successful');
    
    return { damageScore, visionResults, method: 'vision', geminiTotalLoss: undefined, itemDetails: undefined, damagedParts: undefined };
  } catch (visionError: any) {
    console.error('❌ Vision API assessment failed:', visionError?.message || 'Unknown error');
    console.log('   Using neutral scores...');
  }
  
  // ATTEMPT 4: Return neutral scores if all fail
  console.warn('⚠️ All AI services failed (Gemini, Claude, Vision). Using neutral scores.');
  const neutralScore: DamageScore = {
    structural: 50,
    mechanical: 50,
    cosmetic: 50,
    electrical: 50,
    interior: 50,
  };
  
  const neutralVisionResults = {
    labels: [],
    totalConfidence: 0,
  };
  
  return { damageScore: neutralScore, visionResults: neutralVisionResults, method: 'neutral', geminiTotalLoss: undefined, itemDetails: undefined, damagedParts: undefined };
}

/**
 * Calculate damage scores by category
 */
function calculateDamageScore(labels: Array<{ description: string; score: number }>): DamageScore {
  // CRITICAL FIX: Only detect ACTUAL damage keywords, not normal car parts
  // Google Vision returns "bumper", "door", "wheel" for EVERY car photo
  // We need to look for damage-specific keywords only
  
  const damageKeywords = [
    // Explicit damage words
    'damage', 'damaged', 'broken', 'crack', 'cracked', 'dent', 'dented',
    'scratch', 'scratched', 'rust', 'rusted', 'collision', 'bent',
    'crushed', 'shattered', 'torn', 'missing', 'detached', 'smashed',
    'destroyed', 'wrecked', 'wreck', 'junk', 'salvage', 'totaled',
    // Severe damage indicators
    'debris', 'rubble', 'scrap', 'mangled', 'twisted', 'burned',
    'fire damage', 'water damage', 'flood', 'corroded', 'corrosion'
  ];
  
  // Check if ANY damage keywords are present
  let totalDamageScore = 0;
  let damageCount = 0;
  
  labels.forEach(label => {
    const desc = label.description.toLowerCase();
    const isDamage = damageKeywords.some(keyword => desc.includes(keyword));
    
    if (isDamage) {
      totalDamageScore += label.score * 100;
      damageCount++;
      console.log(`🚨 Damage detected: "${label.description}" (score: ${label.score})`);
    }
  });
  
  // If NO damage keywords detected, return all zeros
  if (damageCount === 0) {
    console.log('✅ No damage keywords detected - vehicle appears to be in good condition');
    return {
      structural: 0,
      mechanical: 0,
      cosmetic: 0,
      electrical: 0,
      interior: 0
    };
  }
  
  // If damage detected, categorize it
  console.log(`⚠️ Damage detected in ${damageCount} labels, total score: ${totalDamageScore}`);
  
  // Categorize damage by type (look at the context of damage keywords)
  const structuralDamage = labels.filter(l => {
    const desc = l.description.toLowerCase();
    return damageKeywords.some(k => desc.includes(k)) &&
           (desc.includes('frame') || desc.includes('chassis') || desc.includes('structural') ||
            desc.includes('pillar') || desc.includes('roof') || desc.includes('floor') ||
            desc.includes('collision') || desc.includes('wreck') || desc.includes('totaled')); // Collision implies structural damage
  });
  
  const mechanicalDamage = labels.filter(l => {
    const desc = l.description.toLowerCase();
    return damageKeywords.some(k => desc.includes(k)) &&
           (desc.includes('engine') || desc.includes('transmission') || desc.includes('axle') ||
            desc.includes('suspension') || desc.includes('brake') || desc.includes('wheel') ||
            desc.includes('collision') || desc.includes('wreck') || desc.includes('accident')); // Collision implies mechanical damage
  });
  
  const cosmeticDamage = labels.filter(l => {
    const desc = l.description.toLowerCase();
    return damageKeywords.some(k => desc.includes(k)) &&
           (desc.includes('bumper') || desc.includes('panel') || desc.includes('body') ||
            desc.includes('paint') || desc.includes('door') || desc.includes('hood') ||
            desc.includes('fender') || desc.includes('trunk'));
  });
  
  const electricalDamage = labels.filter(l => {
    const desc = l.description.toLowerCase();
    return damageKeywords.some(k => desc.includes(k)) &&
           (desc.includes('light') || desc.includes('headlight') || desc.includes('taillight') ||
            desc.includes('wire') || desc.includes('electrical') || desc.includes('battery'));
  });
  
  const interiorDamage = labels.filter(l => {
    const desc = l.description.toLowerCase();
    return damageKeywords.some(k => desc.includes(k)) &&
           (desc.includes('seat') || desc.includes('airbag') || desc.includes('dashboard') ||
            desc.includes('interior') || desc.includes('upholstery') || desc.includes('console'));
  });
  
  // Calculate scores for each category
  const avgScore = totalDamageScore / damageCount;
  
  // Count how many categories have damage
  const categorizedCount = structuralDamage.length + mechanicalDamage.length + 
                           cosmeticDamage.length + electricalDamage.length + 
                           interiorDamage.length;
  
  // CRITICAL FIX: If damage detected but not categorized, check for collision/accident keywords
  // Collision damage should be assigned to structural AND mechanical, not just cosmetic
  if (categorizedCount === 0 && damageCount > 0) {
    const hasCollisionKeyword = labels.some(l => {
      const desc = l.description.toLowerCase();
      return (desc.includes('collision') || desc.includes('accident') || desc.includes('wreck'));
    });
    
    if (hasCollisionKeyword) {
      console.log(`⚠️ Collision detected but not categorized - assigning to structural AND mechanical (score: ${avgScore})`);
      return {
        structural: avgScore,  // Collision implies structural damage
        mechanical: avgScore,  // Collision implies mechanical damage
        cosmetic: avgScore,    // Collision also has cosmetic damage
        electrical: 0,
        interior: 0
      };
    }
    
    console.log(`⚠️ Damage detected but not categorized - assigning to cosmetic (score: ${avgScore})`);
    return {
      structural: 0,
      mechanical: 0,
      cosmetic: avgScore,  // Assign uncategorized damage to cosmetic
      electrical: 0,
      interior: 0
    };
  }
  
  return {
    structural: structuralDamage.length > 0 ? avgScore : 0,
    mechanical: mechanicalDamage.length > 0 ? avgScore : 0,
    cosmetic: cosmeticDamage.length > 0 ? avgScore : 0,
    electrical: electricalDamage.length > 0 ? avgScore : 0,
    interior: interiorDamage.length > 0 ? avgScore : 0
  };
}

/**
 * Score a damage category based on detected labels
 */
function scoreCategory(
  labels: Array<{ description: string; score: number }>,
  keywords: string[]
): number {
  let score = 0;
  let count = 0;
  
  labels.forEach(label => {
    const isMatch = keywords.some(keyword => 
      label.description.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (isMatch) {
      score += label.score * 100;
      count++;
    }
  });
  
  if (count === 0) return 0;
  
  // Average score, capped at 100
  return Math.min(100, score / count);
}

/**
 * Get market value with database-first approach and internet search fallback
 * 
 * Requirements: 5.1, 5.2, 6.1, 6.4
 */
async function getMarketValueWithScraping(vehicleInfo?: VehicleInfo): Promise<{
  value: number;
  confidence: number;
  source: 'database' | 'user_provided' | 'internet_search' | 'scraping' | 'estimated';
}> {
  // If user provided market value, use it with high confidence
  if (vehicleInfo?.marketValue && vehicleInfo.marketValue > 0) {
    console.log('💰 Using user-provided market value:', vehicleInfo.marketValue);
    return {
      value: vehicleInfo.marketValue,
      confidence: 90,
      source: 'user_provided'
    };
  }
  
  // Use the updated market data service (internet-search-first with database fallback)
  if (vehicleInfo?.make && vehicleInfo?.model && vehicleInfo?.year) {
    try {
      console.log('🌐 Using market data service (internet-search-first)...');
      
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: vehicleInfo.make,
        model: vehicleInfo.model,
        year: vehicleInfo.year,
        mileage: vehicleInfo.mileage,
        condition: vehicleInfo.condition // Pass condition to market data service
      };
      
      const marketPrice = await getMarketPrice(property);
      
      console.log('✅ Market data service result:', {
        median: marketPrice.median,
        sources: marketPrice.count,
        confidence: marketPrice.confidence,
        isFresh: marketPrice.isFresh,
        dataSource: marketPrice.dataSource
      });
      
      // Apply universal adjustments if needed
      let adjustedPrice = marketPrice.median;
      
      if (vehicleInfo) {
        const universalItem: UniversalItemInfo = {
          type: 'vehicle',
          condition: vehicleInfo.condition || 'Nigerian Used',
          make: vehicleInfo.make,
          model: vehicleInfo.model,
          year: vehicleInfo.year,
          mileage: vehicleInfo.mileage,
          age: vehicleInfo.year ? new Date().getFullYear() - vehicleInfo.year : undefined,
          brandPrestige: vehicleInfo.brandPrestige,
          description: vehicleInfo.description
        };
        
        // Skip condition adjustment only for internet search (already condition-specific)
        const skipConditionAdjustment = marketPrice.dataSource === 'internet_search';
        const universalAdjustment = getUniversalAdjustment(universalItem, skipConditionAdjustment);
        adjustedPrice *= universalAdjustment;
        
        if (skipConditionAdjustment) {
          console.log('🔧 Applied universal adjustment (mileage only):', universalAdjustment);
        } else {
          console.log('🔧 Applied universal adjustment (condition + mileage):', universalAdjustment);
        }
      }
      
      // Convert confidence to percentage and determine source
      const confidencePercent = Math.round(marketPrice.confidence * 100);
      const source = marketPrice.dataSource === 'internet_search' ? 'internet_search' : 
                    marketPrice.dataSource === 'database' ? 'database' : 'scraping';
      const adjudication = (marketPrice as { adjudication?: { reviewReasons?: string[] } }).adjudication;
      
      return {
        value: Math.round(adjustedPrice),
        confidence: confidencePercent,
        source
      };
    } catch (error) {
      console.error('❌ Market data service failed, falling back to estimation:', error);
      // Fall back to existing estimation logic
      const estimatedValue = estimateMarketValue(vehicleInfo, 5);
      return {
        value: estimatedValue,
        confidence: 30,
        source: 'estimated'
      };
    }
  }
  
  // Fall back to existing estimation logic
  console.log('⚠️ No vehicle info provided, using generic estimation');
  const estimatedValue = estimateMarketValue(vehicleInfo, 5);
  return {
    value: estimatedValue,
    confidence: 30,
    source: 'estimated'
  };
}

/**
 * Search for part prices using internet search (NEW for Task 7.4)
 */
async function searchPartPrices(
  vehicleInfo: VehicleInfo | undefined,
  damages: DamageInput[]
): Promise<Array<{
  component: string;
  searchedPrice?: number;
  confidence?: number;
  source: 'internet_search' | 'ai_estimate' | 'not_found';
  evidence?: Record<string, unknown>;
}>> {
  if (!vehicleInfo?.make || !vehicleInfo?.model || damages.length === 0) {
    return [];
  }

  const itemIdentifier: ItemIdentifier = {
    type: 'vehicle',
    make: vehicleInfo.make,
    model: vehicleInfo.model,
    year: vehicleInfo.year
  };

  // Map damage components to searchable part names
  const partMapping: Record<string, string> = {
    'structure': 'body panel',
    'engine': 'engine parts',
    'body': 'bumper',
    'electrical': 'headlight',
    'interior': 'seat'
  };

  const partSearchPromises = damages.map(async (damage) => {
    const partName = partMapping[damage.component] || damage.component;
    
    try {
      console.log(`🔍 Searching for part price: ${partName} for ${vehicleInfo.make} ${vehicleInfo.model}`);
      
      const partResult = await internetSearchService.searchPartPrice({
        item: itemIdentifier,
        partName,
        damageType: damage.damageLevel,
        maxResults: 8,
        timeout: 5000,
      });

      const resolved = resolvePartPriceFromSearchResult(partResult);

      if (resolved.price) {
        console.log(`✅ Found part price for ${partName}: ₦${resolved.price.toLocaleString()} (${resolved.source})`);

        return {
          component: damage.component,
          searchedPrice: resolved.price,
          confidence: resolved.confidence,
          source: resolved.source,
          evidence: {
            query: partResult.query,
            resultsProcessed: partResult.resultsProcessed,
            priceData: partResult.priceData,
            adjudication: partResult.adjudication,
            priceSource: resolved.source,
          },
        };
      } else {
        console.log(`⚠️ No price found for ${partName}`);
        return {
          component: damage.component,
          source: 'not_found' as const,
          evidence: {
            searchedPart: partName,
            reason: partResult.error || 'no_average_price',
          },
        };
      }
    } catch (error) {
      console.error(`❌ Part search failed for ${partName}:`, error);
      return {
        component: damage.component,
        source: 'not_found' as const,
        evidence: {
          searchedPart: partName,
          reason: error instanceof Error ? error.message : 'search_failed',
        },
      };
    }
  });

  try {
    return await Promise.all(partSearchPromises);
  } catch (error) {
    console.error('❌ Part search batch failed:', error);
    return damages.map(damage => ({
      component: damage.component,
      source: 'not_found' as const
    }));
  }
}
/**
 * Identify damaged components from damage score
 * Maps damage scores to component-level damage inputs
 * Requirements: 6.2
 * 
 * PRISTINE CONDITION FIX: Only apply damage deductions when actual damage is detected
 */
function identifyDamagedComponents(damageScore: DamageScore): DamageInput[] {
  const damages: DamageInput[] = [];
  
  // PRISTINE CONDITION FIX: Use individual component thresholds instead of total score
  // This ensures that when Gemini says "no damage", we don't apply any deductions
  const DAMAGE_THRESHOLD = 15; // Lowered threshold but applied per component
  
  // Calculate total damage score for logging
  const totalScore = damageScore.structural + damageScore.mechanical + 
                     damageScore.cosmetic + damageScore.electrical + 
                     damageScore.interior;
  
  console.log(`🔍 Damage assessment - total score: ${totalScore}`);
  
  // PRISTINE CONDITION FIX: Check each component individually
  // Only add components that have actual damage above threshold
  
  // Map structural damage
  if (damageScore.structural > DAMAGE_THRESHOLD) {
    const level = damageScore.structural > 70 ? 'severe' : 
                  damageScore.structural > 40 ? 'moderate' : 'minor';
    damages.push({ component: 'structure', damageLevel: level });
    console.log(`  - Structural damage: ${level} (score: ${damageScore.structural})`);
  }
  
  // Map mechanical damage
  if (damageScore.mechanical > DAMAGE_THRESHOLD) {
    const level = damageScore.mechanical > 70 ? 'severe' : 
                  damageScore.mechanical > 40 ? 'moderate' : 'minor';
    damages.push({ component: 'engine', damageLevel: level });
    console.log(`  - Mechanical damage: ${level} (score: ${damageScore.mechanical})`);
  }
  
  // Map cosmetic damage
  if (damageScore.cosmetic > DAMAGE_THRESHOLD) {
    const level = damageScore.cosmetic > 70 ? 'severe' : 
                  damageScore.cosmetic > 40 ? 'moderate' : 'minor';
    damages.push({ component: 'body', damageLevel: level });
    console.log(`  - Cosmetic damage: ${level} (score: ${damageScore.cosmetic})`);
  }
  
  // Map electrical damage
  if (damageScore.electrical > DAMAGE_THRESHOLD) {
    const level = damageScore.electrical > 70 ? 'severe' : 
                  damageScore.electrical > 40 ? 'moderate' : 'minor';
    damages.push({ component: 'electrical', damageLevel: level });
    console.log(`  - Electrical damage: ${level} (score: ${damageScore.electrical})`);
  }
  
  // Map interior damage
  if (damageScore.interior > DAMAGE_THRESHOLD) {
    const level = damageScore.interior > 70 ? 'severe' : 
                  damageScore.interior > 40 ? 'moderate' : 'minor';
    damages.push({ component: 'interior', damageLevel: level });
    console.log(`  - Interior damage: ${level} (score: ${damageScore.interior})`);
  }
  
  if (damages.length === 0) {
    console.log('✅ No components exceeded damage threshold - vehicle appears pristine');
  }
  
  return damages;
}

/**
 * Estimate market value if not provided
 */
function estimateMarketValue(vehicleInfo?: VehicleInfo, photoCount: number = 5): number {
  // If we have vehicle info, use it
  if (vehicleInfo?.make && vehicleInfo?.model && vehicleInfo?.year) {
    // Simple estimation based on year (should be replaced with real valuation API)
    const currentYear = new Date().getFullYear();
    const age = currentYear - vehicleInfo.year;
    
    // Base values for common vehicles (in Naira)
    const baseValues: Record<string, number> = {
      'Toyota Camry': 10000000,
      'Honda Accord': 9500000,
      'Toyota Corolla': 7500000,
      'Honda Civic': 7000000,
      'Toyota RAV4': 12000000,
      'Lexus ES': 15000000,
    };
    
    const key = `${vehicleInfo.make} ${vehicleInfo.model}`;
    const baseValue = baseValues[key] || 8000000; // Default
    
    // Apply depreciation (15% per year)
    let depreciatedValue = baseValue * Math.pow(0.85, age);
    
    // Apply universal adjustments instead of vehicle-specific ones
    if (vehicleInfo) {
      const universalItem: UniversalItemInfo = {
        type: 'vehicle',
        condition: vehicleInfo.condition || 'Nigerian Used',
        make: vehicleInfo.make,
        model: vehicleInfo.model,
        year: vehicleInfo.year,
        mileage: vehicleInfo.mileage,
        age: age,
        ...vehicleInfo
      };
      
      const universalAdjustment = getUniversalAdjustment(universalItem);
      depreciatedValue *= universalAdjustment;
    }
    
    return Math.round(depreciatedValue);
  }
  
  // Fallback: estimate based on photo count (very rough)
  // Fallback: estimate based on photo count (very rough)
  return 2500000 + (photoCount * 100000); // Reasonable fallback: 2.5M + 100k per photo
}

/**
 * Get mileage adjustment factor for pristine vehicles
 * Based on research: every 20,000 miles reduces value by ~20%
 * Nigerian average: ~15,000 km per year
 */
function getMileageAdjustment(mileage: number, age: number, vehicleMake?: string): number {
  // Research shows 0.5% depreciation per 1,000 miles (not 20% per 20,000 miles!)
  // Source: thundersaidenergy.com - "0.5% per 1,000 miles"

  // Convert km to miles if needed (assuming input is in km for Nigerian market)
  const mileageInKm = mileage;
  const mileageInMiles = mileageInKm * 0.621371;

  // Expected mileage: ~15,000 km per year in Nigeria
  const expectedKm = age * 15000;
  const expectedMiles = expectedKm * 0.621371;

  // Calculate excess mileage in thousands of miles
  const excessMiles = Math.max(0, mileageInMiles - expectedMiles);
  const excessThousands = excessMiles / 1000;

  // Luxury vehicles depreciate less aggressively with mileage
  const isLuxury = vehicleMake && ['Lamborghini', 'Ferrari', 'Porsche', 'Bentley', 'Rolls-Royce', 'Aston Martin', 'McLaren', 'Bugatti', 'Maserati'].includes(vehicleMake);
  
  // Apply different depreciation rates for luxury vs regular vehicles
  const depreciationRatePerThousandMiles = isLuxury ? 0.003 : 0.005; // 0.3% vs 0.5% per 1,000 miles
  const depreciationRate = excessThousands * depreciationRatePerThousandMiles;

  // Cap maximum depreciation differently for luxury vs regular vehicles
  const maxDepreciation = isLuxury ? 0.25 : 0.30; // 25% vs 30% max
  const cappedDepreciation = Math.min(depreciationRate, maxDepreciation);

  // Return adjustment factor (1.0 = no change, 0.9 = 10% reduction)
  const minValue = isLuxury ? 0.75 : 0.70; // Minimum 75% vs 70% of value
  return Math.max(minValue, 1.0 - cappedDepreciation);
}
// Universal adjustment system for all item types
function getUniversalAdjustment(itemInfo: UniversalItemInfo, skipConditionAdjustment: boolean = false): number {
  let adjustment = 1.0;

  // Apply condition adjustment (universal for all items) - but skip if already condition-adjusted
  if (!skipConditionAdjustment) {
    adjustment *= getConditionAdjustment(itemInfo.condition);
  }

  // Apply item-specific adjustments
  switch (itemInfo.type) {
    case 'vehicle':
      if (itemInfo.mileage && itemInfo.age) {
        adjustment *= getMileageAdjustment(itemInfo.mileage, itemInfo.age, itemInfo.make);
      }
      break;

    case 'electronics':
      adjustment *= getElectronicsAdjustment(itemInfo);
      break;

    case 'watch':
    case 'jewelry':
      adjustment *= getWatchAdjustment(itemInfo);
      break;

    case 'appliance':
      adjustment *= getApplianceAdjustment(itemInfo);
      break;

    case 'property':
      adjustment *= getPropertyAdjustment(itemInfo);
      break;

    case 'furniture':
      adjustment *= getFurnitureAdjustment(itemInfo);
      break;

    case 'artwork':
      adjustment *= getArtworkAdjustment(itemInfo);
      break;

    case 'equipment':
      adjustment *= getEquipmentAdjustment(itemInfo);
      break;

    case 'machinery':
      adjustment *= getMachineryAdjustment(itemInfo);
      break;

    case 'other':
    default:
      // For unknown items, only use condition adjustment
      break;
  }

  // Apply brand prestige adjustment (universal)
  if (itemInfo.brandPrestige) {
    adjustment *= getBrandPrestigeAdjustment(itemInfo.brandPrestige);
  }

  return adjustment;
}


// Electronics-specific adjustments
function getElectronicsAdjustment(itemInfo: UniversalItemInfo): number {
  let adjustment = 1.0;

  // Age depreciation for electronics (more realistic)
  if (itemInfo.age) {
    // Electronics depreciate ~15% per year for first 2 years, then 10% per year
    let ageDepreciation = 0;
    if (itemInfo.age <= 2) {
      ageDepreciation = itemInfo.age * 0.15; // 15% per year for first 2 years
    } else {
      ageDepreciation = 0.30 + ((itemInfo.age - 2) * 0.10); // 30% for first 2 years, then 10% per year
    }
    ageDepreciation = Math.min(ageDepreciation, 0.60); // Max 60% depreciation
    adjustment *= (1.0 - ageDepreciation);
  }

  // Battery health adjustment (for phones, laptops) - less aggressive
  if (itemInfo.batteryHealth !== undefined) {
    // Battery health below 80% affects value, but minimally
    if (itemInfo.batteryHealth < 80) {
      const batteryPenalty = (80 - itemInfo.batteryHealth) * 0.002; // 0.2% per point below 80%
      adjustment *= (1.0 - batteryPenalty);
    }
  }

  // Storage capacity premium (for phones, laptops) - much more modest
  if (itemInfo.storageCapacity) {
    const storage = parseInt(itemInfo.storageCapacity);
    if (storage >= 512) {
      adjustment *= 1.10; // +10% for high storage
    } else if (storage >= 256) {
      adjustment *= 1.05; // +5% for medium storage
    } else if (storage >= 128) {
      adjustment *= 1.02; // +2% for standard storage
    } else if (storage <= 64) {
      adjustment *= 0.95; // -5% for low storage
    }
  }

  return Math.max(0.20, adjustment); // Minimum 20% of value
}

// Watch-specific adjustments
function getWatchAdjustment(itemInfo: UniversalItemInfo): number {
  let adjustment = 1.0;

  // Movement type affects value retention
  if (itemInfo.movementType) {
    switch (itemInfo.movementType) {
      case 'automatic':
        adjustment *= 1.20; // +20% for automatic (luxury)
        break;
      case 'manual':
        adjustment *= 1.10; // +10% for manual (craftsmanship)
        break;
      case 'quartz':
        adjustment *= 0.95; // -5% for quartz (common)
        break;
    }
  }

  // Age depreciation (watches hold value better than electronics)
  if (itemInfo.age) {
    const ageDepreciation = Math.min(itemInfo.age * 0.05, 0.30); // 5% per year, max 30%
    adjustment *= (1.0 - ageDepreciation);
  }

  return Math.max(0.20, adjustment); // Minimum 20% of value
}

// Appliance-specific adjustments
function getApplianceAdjustment(itemInfo: UniversalItemInfo): number {
  let adjustment = 1.0;

  // Age depreciation for appliances
  if (itemInfo.age) {
    const ageDepreciation = Math.min(itemInfo.age * 0.15, 0.60); // 15% per year, max 60%
    adjustment *= (1.0 - ageDepreciation);
  }

  return Math.max(0.15, adjustment); // Minimum 15% of value
}

function getPropertyAdjustment(itemInfo: UniversalItemInfo): number {
  let adjustment = 1.0;

  // Property age matters, but land/buildings tend to retain value better than movable assets.
  if (itemInfo.age) {
    const ageDepreciation = Math.min(itemInfo.age * 0.01, 0.20);
    adjustment *= (1.0 - ageDepreciation);
  }

  return Math.max(0.60, adjustment);
}

function getFurnitureAdjustment(itemInfo: UniversalItemInfo): number {
  let adjustment = 1.0;

  if (itemInfo.age) {
    const ageDepreciation = Math.min(itemInfo.age * 0.12, 0.65);
    adjustment *= (1.0 - ageDepreciation);
  }

  return Math.max(0.15, adjustment);
}

// Artwork-specific adjustments
function getArtworkAdjustment(itemInfo: UniversalItemInfo): number {
  let adjustment = 1.0;

  // Artwork often appreciates or holds value well
  // Age can actually increase value for some pieces
  if (itemInfo.age && itemInfo.age > 10) {
    adjustment *= 1.05; // +5% for vintage pieces
  }

  return Math.max(0.30, adjustment); // Minimum 30% of value
}

// Equipment-specific adjustments
function getEquipmentAdjustment(itemInfo: UniversalItemInfo): number {
  let adjustment = 1.0;

  // Equipment depreciation similar to vehicles
  if (itemInfo.age) {
    const ageDepreciation = Math.min(itemInfo.age * 0.12, 0.50); // 12% per year, max 50%
    adjustment *= (1.0 - ageDepreciation);
  }

  return Math.max(0.20, adjustment); // Minimum 20% of value
}

// Machinery-specific adjustments (heavy equipment like excavators)
function getMachineryAdjustment(itemInfo: UniversalItemInfo): number {
  let adjustment = 1.0;

  // Heavy machinery depreciation (slower than vehicles, faster than buildings)
  // Heavy equipment like CAT excavators depreciate ~10% per year for first 5 years, then 5% per year
  if (itemInfo.age) {
    let ageDepreciation = 0;
    if (itemInfo.age <= 5) {
      ageDepreciation = itemInfo.age * 0.10; // 10% per year for first 5 years
    } else {
      ageDepreciation = 0.50 + ((itemInfo.age - 5) * 0.05); // 50% for first 5 years, then 5% per year
    }
    ageDepreciation = Math.min(ageDepreciation, 0.70); // Max 70% depreciation
    adjustment *= (1.0 - ageDepreciation);
  }

  // Condition-based adjustment for machinery (more significant than vehicles)
  // Foreign Used machinery is better maintained than Nigerian Used
  // This is applied ON TOP of the base condition adjustment
  if (itemInfo.condition === 'Nigerian Used') {
    adjustment *= 0.85; // Additional -15% for local use (harsher conditions)
  } else if (itemInfo.condition === 'Heavily Used') {
    adjustment *= 0.70; // Additional -30% for heavy use
  }

  return Math.max(0.15, adjustment); // Minimum 15% of value (lower than vehicles due to salvage parts value)
}


// Brand prestige adjustment (universal)
function getBrandPrestigeAdjustment(prestige: 'luxury' | 'premium' | 'standard' | 'budget'): number {
  switch (prestige) {
    case 'luxury':
      return 1.10; // +10% for luxury brands (more modest)
    case 'premium':
      return 1.05; // +5% for premium brands
    case 'standard':
      return 1.00; // No adjustment
    case 'budget':
      return 0.90; // -10% for budget brands
    default:
      return 1.00;
  }
}

/**
 * Detect electronics brand prestige
 */
function getElectronicsBrandPrestige(brand?: string): 'luxury' | 'premium' | 'standard' | 'budget' {
  if (!brand) return 'standard';
  
  const brandLower = brand.toLowerCase();
  
  const luxuryBrands = ['apple', 'bang & olufsen', 'vertu', 'goldvish', 'samsung galaxy z'];
  const premiumBrands = ['samsung', 'sony', 'lg', 'dell', 'hp', 'lenovo', 'asus', 'microsoft'];
  const budgetBrands = ['tecno', 'infinix', 'itel', 'xiaomi', 'oppo', 'vivo'];
  
  if (luxuryBrands.some(b => brandLower.includes(b))) return 'luxury';
  if (premiumBrands.some(b => brandLower.includes(b))) return 'premium';
  if (budgetBrands.some(b => brandLower.includes(b))) return 'budget';
  
  return 'standard';
}


/**
 * Get condition adjustment factor using quality tier system
 */
function getConditionAdjustment(condition: string): number {
  // Map any condition format to quality tier first
  const qualityTier = mapAnyConditionToQuality(condition, 'AI assessment');
  
  const adjustments = {
    'excellent': 1.05,              // +5% (modest premium for brand new)
    'good': 1.00,                   // No adjustment (foreign used is market baseline)
    'fair': 0.90,                   // -10% (standard local market)
    'poor': 0.70                    // -30% (significant wear)
  };
  
  return adjustments[qualityTier] || 1.0; // Default to no adjustment
}

/**
 * Estimate repair cost based on damage scores
 */
function estimateRepairCost(damageScore: DamageScore, marketValue: number): number {
  const costs = {
    structural: damageScore.structural * 50000,
    mechanical: damageScore.mechanical * 30000,
    cosmetic: damageScore.cosmetic * 10000,
    electrical: damageScore.electrical * 20000,
    interior: damageScore.interior * 15000,
  };

  const totalCost = Object.values(costs).reduce((sum, cost) => sum + cost, 0);
  const weightedDamage =
    damageScore.structural * 0.4 +
    damageScore.mechanical * 0.3 +
    damageScore.cosmetic * 0.1 +
    damageScore.electrical * 0.1 +
    damageScore.interior * 0.1;
  const evidenceFloor = marketValue * Math.min(0.85, Math.max(0.25, (weightedDamage / 100) * 0.9));

  return Math.min(marketValue * 0.9, Math.max(totalCost, evidenceFloor));
}

/**
 * Calculate overall damage percentage
 */
function calculateDamagePercentage(damageScore: DamageScore): number {
  // Weighted average (structural damage is most important)
  const weighted = 
    (damageScore.structural * 0.4) +
    (damageScore.mechanical * 0.3) +
    (damageScore.cosmetic * 0.1) +
    (damageScore.electrical * 0.1) +
    (damageScore.interior * 0.1);
  
  // Cap at 95% max damage, but allow 0% for perfect condition vehicles
  return Math.min(95, weighted);
}

/**
 * Determine damage severity
 */
function determineSeverity(damagePercentage: number): 'minor' | 'moderate' | 'severe' {
  if (damagePercentage < 15) return 'minor';  // 0-15% = minor (includes pristine)
  if (damagePercentage < 50) return 'moderate';  // 15-50% = moderate
  return 'severe';  // 50%+ = severe
}

/**
 * Assess if item is repairable (universal for all item types)
 */
function assessRepairability(
  damageScore: DamageScore,
  repairCost: number,
  marketValue: number,
  itemType?: UniversalItemInfo['type']
): {
  isRepairable: boolean;
  recommendation: string;
} {
  const itemName = itemType || 'item';
  const itemLabel = itemType === 'vehicle' ? 'vehicle' :
                    itemType === 'electronics' ? 'device' :
                    itemType === 'appliance' ? 'appliance' :
                    itemType === 'property' ? 'property' :
                    itemType === 'watch' ? 'watch' :
                    itemType === 'jewelry' ? 'jewelry item' :
                    itemType === 'furniture' ? 'furniture item' :
                    itemType === 'machinery' ? 'machinery' :
                    itemType === 'artwork' ? 'artwork' :
                    itemType === 'equipment' ? 'equipment' :
                    'item';
  
  // Structural damage > 70% = likely total loss
  if (damageScore.structural > 70) {
    return {
      isRepairable: false,
      recommendation: `Total loss recommended - severe structural damage detected on ${itemLabel}`
    };
  }
  
  // Repair cost > 70% of value = total loss
  if (repairCost > marketValue * 0.7) {
    return {
      isRepairable: false,
      recommendation: `Total loss recommended - repair cost (₦${repairCost.toLocaleString()}) exceeds 70% of ${itemLabel} value`
    };
  }
  
  // Repairable
  return {
    isRepairable: true,
    recommendation: `${itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} is repairable - estimated repair cost: ₦${repairCost.toLocaleString()}`
  };
}

/**
 * Calculate confidence scores
 */
function calculateConfidence(
  photos: string[],
  vehicleInfo: VehicleInfo | undefined,
  visionResults: { labels: Array<{ description: string; score: number }>; totalConfidence: number },
  damageScore: DamageScore,
  marketDataConfidence?: number
): AssessmentConfidence {
  const confidence: AssessmentConfidence = {
    overall: 0,
    vehicleDetection: 0,
    damageDetection: 0,
    valuationAccuracy: 0,
    photoQuality: 0,
    reasons: []
  };
  
  // Photo quality (need 5+ photos for good assessment)
  if (photos.length < 3) {
    confidence.photoQuality = 30;
    confidence.reasons.push('Very few photos - need at least 5 for accurate assessment');
  } else if (photos.length < 5) {
    confidence.photoQuality = 60;
    confidence.reasons.push('Limited photos - 5+ recommended for best accuracy');
  } else {
    confidence.photoQuality = Math.min(100, 60 + (photos.length * 8));
  }
  
  // Vehicle detection
  if (vehicleInfo?.make && vehicleInfo?.model && vehicleInfo?.year) {
    // Base confidence for having make/model/year
    confidence.vehicleDetection = 90;
    
    // Bonus for having mileage
    if (vehicleInfo.mileage) {
      confidence.vehicleDetection = Math.min(95, confidence.vehicleDetection + 3);
    } else {
      confidence.reasons.push('Mileage not provided - using estimated mileage for valuation');
    }
    
    // Bonus for having condition
    if (vehicleInfo.condition) {
      confidence.vehicleDetection = Math.min(98, confidence.vehicleDetection + 3);
    } else {
      confidence.reasons.push('Condition not provided - assuming "good" condition for valuation');
    }
  } else if (vehicleInfo?.make || vehicleInfo?.model) {
    confidence.vehicleDetection = 60;
    confidence.reasons.push('Incomplete vehicle information - affects valuation accuracy');
  } else {
    confidence.vehicleDetection = 30;
    confidence.reasons.push('No vehicle information provided - using generic estimates');
  }
  
  // Damage detection (based on Vision API confidence)
  confidence.damageDetection = Math.round(visionResults.totalConfidence * 100);
  
  // Debug logging
  console.log(`🔍 Regular confidence calculation:`, {
    visionResultsTotalConfidence: visionResults.totalConfidence,
    damageDetection: confidence.damageDetection
  });
  
  if (confidence.damageDetection < 70) {
    confidence.reasons.push('Low AI confidence in damage detection - manual review recommended');
  }
  
  // Valuation accuracy (enhanced with market data confidence)
  if (marketDataConfidence !== undefined) {
    // Use market data confidence directly
    confidence.valuationAccuracy = marketDataConfidence;
    
    if (marketDataConfidence >= 90) {
      confidence.reasons.push(`Market value from real market data (${marketDataConfidence}% confidence)`);
    } else if (marketDataConfidence >= 70) {
      confidence.reasons.push(`Market value from limited market data (${marketDataConfidence}% confidence)`);
    } else if (marketDataConfidence >= 50) {
      confidence.reasons.push(`Market value from single source (${marketDataConfidence}% confidence)`);
    } else {
      confidence.reasons.push(`Market value estimated - limited data available (${marketDataConfidence}% confidence)`);
    }
  } else if (vehicleInfo?.marketValue && vehicleInfo.marketValue > 0) {
    // User provided market value - highest confidence
    confidence.valuationAccuracy = 90;
    
    // Bonus if we also have mileage and condition to validate the value
    if (vehicleInfo.mileage && vehicleInfo.condition) {
      confidence.valuationAccuracy = 95;
    }
  } else if (vehicleInfo?.make && vehicleInfo?.model && vehicleInfo?.year) {
    // Estimated from vehicle info
    let baseAccuracy = 60;
    
    // Bonus for having mileage
    if (vehicleInfo.mileage) {
      baseAccuracy += 10;
    }
    
    // Bonus for having condition
    if (vehicleInfo.condition) {
      baseAccuracy += 10;
    }
    
    confidence.valuationAccuracy = baseAccuracy;
    confidence.reasons.push('Market value estimated from vehicle info - actual value may vary');
  } else {
    confidence.valuationAccuracy = 30;
    confidence.reasons.push('Market value estimated without vehicle info - high uncertainty');
  }
  
  // Overall confidence (weighted average)
  confidence.overall = Math.round(
    (confidence.vehicleDetection * 0.25) +
    (confidence.damageDetection * 0.35) +
    (confidence.valuationAccuracy * 0.25) +
    (confidence.photoQuality * 0.15)
  );
  
  return confidence;
}

function resolveSearchConditionForItem(
  itemInfo: UniversalItemInfo,
  assetType: string,
  year?: number,
  model?: string
): UniversalCondition {
  return resolveRealisticMarketSearchCondition(itemInfo.condition, {
    assetType,
    year,
    model,
  }).searchCondition as UniversalCondition;
}

async function getUniversalMarketValue(itemInfo?: UniversalItemInfo, options: { forceRefresh?: boolean } = {}): Promise<{
  value: number;
  confidence: number;
  source: 'database' | 'user_provided' | 'internet_search' | 'scraping' | 'estimated';
  evidence?: Record<string, unknown>;
  uniqueSourceCount?: number;
  priceSpreadPercent?: number;
}> {
  // If no item info, use generic estimation
  if (!itemInfo) {
    console.log('⚠️ No item info provided, using generic estimation');
    return {
      value: 3000000, // Default 3M Naira for unknown items
      confidence: 30,
      source: 'estimated',
      evidence: { reason: 'missing_item_info' },
    };
  }

  if (itemInfo.marketValueSource === 'manual' && itemInfo.marketValue && itemInfo.marketValue > 0) {
    console.log('Using user-provided claims paid / asset value:', itemInfo.marketValue);
    return {
      value: Math.round(itemInfo.marketValue),
      confidence: 95,
      source: 'user_provided',
      uniqueSourceCount: 1,
      priceSpreadPercent: 0,
      evidence: {
        provider: 'adjuster_input',
        source: 'user_provided',
        value: Math.round(itemInfo.marketValue),
        confidence: 95,
        skippedMarketSearch: true,
      },
    };
  }

  if (isLuxuryJewelryValuation(itemInfo) || isMultiItemJewelryValuation(itemInfo)) {
    const provisionalValue = estimateLuxuryJewelryManualReviewValue(itemInfo);
    const brandMatches = luxuryJewelryBrandMatches(itemInfo);
    const reviewReasons = [
      'Luxury or multi-item jewelry/watch valuation requires declared insured value, purchase receipt, hallmark/serial verification, and specialist appraisal.',
      'Generic marketplace prices are not accepted for Rolex, Cartier, diamond, gold, or mixed jewelry lots.',
    ];
    console.warn('Luxury jewelry valuation requires specialist appraisal; skipping generic internet market price.', {
      itemType: itemInfo.type,
      brand: itemInfo.brand || itemInfo.make,
      model: itemInfo.model,
      provisionalValue,
      brandMatches,
    });
    return {
      value: provisionalValue,
      confidence: 15,
      source: 'estimated',
      uniqueSourceCount: 0,
      priceSpreadPercent: 0,
      evidence: {
        reason: 'luxury_jewelry_specialist_appraisal_required',
        provisionalValue,
        brandMatches,
        reviewReasons,
        skippedMarketSearch: true,
      },
    };
  }

  // For vehicles, use existing vehicle market data service
  if (itemInfo.type === 'vehicle' && itemInfo.make && itemInfo.model && itemInfo.year) {
    try {
      console.log('🌐 Using vehicle market data service...');
      
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: itemInfo.make,
        model: itemInfo.model,
        year: itemInfo.year,
        mileage: itemInfo.mileage,
        condition: itemInfo.condition,
      };
      
      const marketPrice = await getMarketPrice(property, { forceRefresh: options.forceRefresh });
      
      console.log('✅ Vehicle market data result:', {
        median: marketPrice.median,
        sources: marketPrice.count,
        confidence: marketPrice.confidence,
        dataSource: marketPrice.dataSource
      });
      
      const confidencePercent = Math.round(marketPrice.confidence * 100);
      const source = marketPrice.dataSource === 'internet_search' ? 'internet_search' : 
                    marketPrice.dataSource === 'database' ? 'database' : 'scraping';
      const adjudication = (marketPrice as { adjudication?: { reviewReasons?: string[] } }).adjudication;
      
      return {
        value: Math.round(marketPrice.median),
        confidence: confidencePercent,
        source,
        uniqueSourceCount: marketPrice.count,
        evidence: {
          provider: 'market-data-service',
          source,
          median: marketPrice.median,
          count: marketPrice.count,
          confidence: confidencePercent,
          adjudication,
          reviewReasons: adjudication?.reviewReasons || [],
        },
      };
    } catch (error) {
      console.error('❌ Vehicle market data failed, using estimation:', error);
    }
  }

  // For non-vehicles, use internet search or estimation
  if (itemInfo.type === 'property' && itemInfo.propertyType && itemInfo.location) {
    try {
      console.log(`🌐 Searching for property market price: ${itemInfo.propertyType} in ${itemInfo.location}...`);

      const searchResult = await internetSearchService.searchMarketPrice({
        item: {
          type: 'property',
          propertyType: itemInfo.propertyType,
          location: itemInfo.location,
          bedrooms: itemInfo.bedrooms,
          condition: resolveSearchConditionForItem(itemInfo, 'property', undefined, itemInfo.propertyType),
        },
        maxResults: 10,
        timeout: 5000,
        forceRefresh: options.forceRefresh,
      });

      if (searchResult.success && searchResult.priceData.averagePrice) {
        const adjudicationReviewReasons = searchResult.adjudication?.reviewReasons || [];
        const rawPrice = searchResult.priceData.medianPrice || searchResult.priceData.averagePrice;
        return {
          value: Math.round(rawPrice),
          confidence: Math.round(searchResult.priceData.confidence),
          source: 'internet_search',
          uniqueSourceCount: searchResult.priceData.evidenceSummary?.uniqueSourceCount,
          priceSpreadPercent: searchResult.priceData.evidenceSummary?.priceSpreadPercent,
          evidence: {
            query: searchResult.query,
            resultsProcessed: searchResult.resultsProcessed,
            priceData: searchResult.priceData,
            adjudication: searchResult.adjudication,
            reviewReasons: adjudicationReviewReasons,
          },
        };
      }
    } catch (error) {
      console.error('❌ Property market search failed, using estimation:', error);
    }
  }

  const searchIdentifier = buildUniversalSearchIdentifier(itemInfo);
  if (searchIdentifier) {
    try {
      console.log(`Searching for ${itemInfo.type} market price with category-specific search terms...`);

      const searchResult = await internetSearchService.searchMarketPrice({
        item: searchIdentifier,
        maxResults: isBulkRecoveryAsset(itemInfo) ? 15 : 10,
        timeout: 5000,
        forceRefresh: options.forceRefresh,
      });

      if (searchResult.success && searchResult.priceData.averagePrice) {
        const rawUnitPrice = searchResult.priceData.medianPrice || searchResult.priceData.averagePrice;
        const adjudicationReviewReasons = searchResult.adjudication?.reviewReasons || [];
        let marketValue = Math.round(rawUnitPrice);
        let bulkPriceScaling: ReturnType<typeof scaleBulkInternetSearchPrice> | undefined;

        if (isBulkRecoveryAsset(itemInfo)) {
          bulkPriceScaling = scaleBulkInternetSearchPrice(itemInfo, rawUnitPrice);
          marketValue = bulkPriceScaling.totalValue;
          if (bulkPriceScaling.quantityMissing) {
            adjudicationReviewReasons.push(
              'Visible stock quantity not established — market value shown is per unit until staff confirms total bag/unit count'
            );
          } else if (bulkPriceScaling.quantity > 1) {
            adjudicationReviewReasons.push(
              `Market search price ₦${bulkPriceScaling.unitPrice.toLocaleString()} per unit × ${bulkPriceScaling.quantity} units = ₦${bulkPriceScaling.totalValue.toLocaleString()}`
            );
          }
        }

        console.log(`Found ${itemInfo.type} price: NGN ${marketValue.toLocaleString()}`);

        return {
          value: marketValue,
          confidence: Math.round(searchResult.priceData.confidence),
          source: 'internet_search',
          uniqueSourceCount: searchResult.priceData.evidenceSummary?.uniqueSourceCount,
          priceSpreadPercent: searchResult.priceData.evidenceSummary?.priceSpreadPercent,
          evidence: {
            query: searchResult.query,
            resultsProcessed: searchResult.resultsProcessed,
            priceData: searchResult.priceData,
            adjudication: searchResult.adjudication,
            reviewReasons: adjudicationReviewReasons,
            bulkPriceScaling,
          },
        };
      }
    } catch (error) {
      console.error(`Category-specific internet search failed for ${itemInfo.type}:`, error);
    }
  }

  if (isBulkRecoveryAsset(itemInfo)) {
    const knownUnitMarketValue = estimateKnownBulkUnitMarketValue(itemInfo);
    if (knownUnitMarketValue !== null) {
      return {
        value: knownUnitMarketValue,
        confidence: 55,
        source: 'estimated',
        evidence: {
          reason: 'known_bulk_unit_price_estimation',
          itemType: itemInfo.type,
          brand: itemInfo.brand,
          model: itemInfo.model,
          quantity: itemInfo.quantity,
          unitOfMeasure: itemInfo.unitOfMeasure,
        },
      };
    }
  }

  if (itemInfo.brand && itemInfo.model) {
    try {
      console.log(`🌐 Searching for ${itemInfo.type} market price: ${itemInfo.brand} ${itemInfo.model}...`);
      
      let itemIdentifier: ItemIdentifier;
      
      if (itemInfo.type === 'electronics') {
        itemIdentifier = {
          type: 'electronics',
          brand: itemInfo.brand || '',
          model: itemInfo.model || '',
          storage: itemInfo.storageCapacity,
          condition: resolveSearchConditionForItem(itemInfo, 'electronics', undefined, itemInfo.model),
        };
      } else if (itemInfo.type === 'vehicle') {
        itemIdentifier = {
          type: 'vehicle',
          make: itemInfo.make || '',
          model: itemInfo.model || '',
          year: itemInfo.year
        };
      } else if (itemInfo.type === 'appliance') {
        itemIdentifier = {
          type: 'appliance',
          brand: itemInfo.brand || '',
          model: itemInfo.model || ''
        };
      } else if (itemInfo.type === 'machinery') {
        itemIdentifier = {
          type: 'machinery',
          brand: itemInfo.brand || '',
          machineryType: itemInfo.machineryType || 'equipment',
          model: itemInfo.model,
          year: itemInfo.year,
          condition: resolveSearchConditionForItem(itemInfo, 'machinery', itemInfo.year, itemInfo.model),
        };
      } else {
        // For watch, artwork, equipment, other - use machinery as fallback
        itemIdentifier = {
          type: 'machinery',
          brand: itemInfo.brand || '',
          machineryType: itemInfo.type,
          model: itemInfo.model
        };
      }
      
      const searchResult = await internetSearchService.searchMarketPrice({
        item: itemIdentifier,
        maxResults: 10,
        timeout: 5000,
        forceRefresh: options.forceRefresh,
      });

      if (searchResult.success && searchResult.priceData.averagePrice) {
        const rawPrice = searchResult.priceData.medianPrice || searchResult.priceData.averagePrice;
        const marketValue = Math.round(rawPrice);
        const adjudicationReviewReasons = searchResult.adjudication?.reviewReasons || [];
        
        console.log(`✅ Found ${itemInfo.type} price: ₦${marketValue.toLocaleString()}`);
        
        return {
          value: marketValue,
          confidence: Math.round(searchResult.priceData.confidence),
          source: 'internet_search',
          uniqueSourceCount: searchResult.priceData.evidenceSummary?.uniqueSourceCount,
          priceSpreadPercent: searchResult.priceData.evidenceSummary?.priceSpreadPercent,
          evidence: {
            query: searchResult.query,
            resultsProcessed: searchResult.resultsProcessed,
            priceData: searchResult.priceData,
            adjudication: searchResult.adjudication,
            reviewReasons: adjudicationReviewReasons,
          },
        };
      } else {
        console.log(`⚠️ No market price found for ${itemInfo.brand} ${itemInfo.model}, using estimation`);
      }
    } catch (error) {
      console.error(`❌ Internet search failed for ${itemInfo.type}:`, error);
    }
  }

  // Fall back to type-based estimation
  const estimatedValue = estimateUniversalMarketValue(itemInfo);
  return {
    value: estimatedValue,
    confidence: 40,
    source: 'estimated',
    evidence: {
      reason: 'fallback_type_estimation',
      itemType: itemInfo.type,
      brand: itemInfo.brand || itemInfo.make,
      model: itemInfo.model,
      condition: itemInfo.condition,
    },
  };
}

function buildUniversalSearchIdentifier(itemInfo: UniversalItemInfo): ItemIdentifier | null {
  const brand = itemInfo.brand || itemInfo.make;
  const description = itemInfo.description || itemInfo.propertyType || itemInfo.machineryType || itemInfo.model;

  switch (itemInfo.type) {
    case 'vehicle':
      const vehicleMake = itemInfo.make || itemInfo.brand;
      if (!vehicleMake || !itemInfo.model) return null;
      return {
        type: 'vehicle',
        make: vehicleMake,
        model: itemInfo.model,
        year: itemInfo.year,
        condition: resolveSearchConditionForItem(itemInfo, 'vehicle', itemInfo.year, itemInfo.model),
      };
    case 'property':
      if (!itemInfo.propertyType || !itemInfo.location) return null;
      return {
        type: 'property',
        propertyType: itemInfo.propertyType,
        location: itemInfo.location,
        bedrooms: itemInfo.bedrooms,
        condition: resolveSearchConditionForItem(itemInfo, 'property', undefined, itemInfo.propertyType),
      };
    case 'electronics':
      if (!brand || !itemInfo.model) return null;
      return {
        type: 'electronics',
        brand,
        model: itemInfo.model,
        storage: itemInfo.storageCapacity,
        condition: resolveSearchConditionForItem(itemInfo, 'electronics', undefined, itemInfo.model),
      };
    case 'appliance':
      if (!brand || !itemInfo.model) return null;
      return {
        type: 'appliance',
        brand,
        model: itemInfo.model,
        condition: resolveSearchConditionForItem(itemInfo, 'appliance', undefined, itemInfo.model),
      };
    case 'machinery':
      if (!brand && !description) return null;
      return {
        type: 'machinery',
        brand: brand || description || 'industrial',
        machineryType: itemInfo.machineryType || description || 'equipment',
        model: itemInfo.model,
        year: itemInfo.year,
        condition: resolveSearchConditionForItem(itemInfo, 'machinery', itemInfo.year, itemInfo.model),
      };
    case 'furniture':
      if (!description && !itemInfo.model && !brand) return null;
      return {
        type: 'furniture',
        furnitureType: itemInfo.model || description || 'furniture',
        brand,
        material: itemInfo.material,
        size: itemInfo.quantity || itemInfo.unitOfMeasure,
        condition: resolveSearchConditionForItem(itemInfo, 'furniture', undefined, itemInfo.model),
      };
    case 'jewelry':
    case 'watch':
      if (!description && !itemInfo.model && !brand && !itemInfo.material) return null;
      return {
        type: 'jewelry',
        jewelryType: itemInfo.model || description || itemInfo.type,
        brand,
        material: itemInfo.material,
        weight: itemInfo.quantity || itemInfo.unitOfMeasure,
        condition: resolveSearchConditionForItem(itemInfo, 'jewelry', undefined, itemInfo.model),
      };
    case 'stock':
    case 'goods_in_transit':
    case 'building_materials':
    case 'scrap':
    case 'agriculture':
      if (!brand && !itemInfo.model) return null;
      return {
        type: itemInfo.type,
        brand,
        model: stripBulkNarrative(itemInfo.model),
        packagingType: itemInfo.packagingType,
      };
    case 'equipment':
    case 'medical_equipment':
    case 'energy_equipment':
    case 'aviation_equipment':
    case 'other':
      if (!brand && !description && !itemInfo.model) return null;
      return {
        type: itemInfo.type,
        description,
        brand,
        model: itemInfo.model,
        quantity: itemInfo.quantity,
        unitOfMeasure: itemInfo.unitOfMeasure,
        year: itemInfo.year,
        condition: resolveSearchConditionForItem(itemInfo, itemInfo.type, itemInfo.year, itemInfo.model),
      };
    default:
      return null;
  }
}

/**
 * Estimate market value for universal items
 */
function estimateUniversalMarketValue(itemInfo: UniversalItemInfo): number {
  if (isBulkRecoveryAsset(itemInfo)) {
    const knownUnitMarketValue = estimateKnownBulkUnitMarketValue(itemInfo);
    if (knownUnitMarketValue !== null) {
      return knownUnitMarketValue;
    }
  }

  // Base values by item type (in Naira) - Updated to reflect realistic Nigerian market prices
  const baseValues: Record<string, number> = {
    'vehicle': 8000000,      // 8M default for vehicles
    'electronics': 1200000,  // 1.2M default for electronics (increased from 500K)
    'appliance': 800000,     // 800K default for appliances (increased from 300K)
    'property': 25000000,    // 25M default for property when search is unavailable
    'watch': 300000,         // 300K default for watches (increased from 150K)
    'jewelry': 300000,       // 300K default for jewelry/watches
    'furniture': 500000,     // 500K default for furniture
    'artwork': 500000,       // 500K default for artwork (increased from 200K)
    'equipment': 1500000,    // 1.5M default for equipment (increased from 1M)
    'machinery': 2500000,    // 2.5M default for machinery/equipment
    'stock': 250000,         // conservative fallback; claims paid or market search should override
    'goods_in_transit': 250000,
    'building_materials': 250000,
    'scrap': 150000,
    'agriculture': 250000,
    'medical_equipment': 2500000,
    'energy_equipment': 3000000,
    'aviation_equipment': 5000000,
    'other': 800000,         // 800K default for other items (increased from 500K)
  };

  let baseValue = baseValues[itemInfo.type] || baseValues['other'];

  // Apply brand prestige adjustment (more significant for electronics)
  if (itemInfo.brandPrestige) {
    const prestigeMultiplier = getBrandPrestigeAdjustment(itemInfo.brandPrestige);
    baseValue *= prestigeMultiplier;
    
    // For electronics, brand prestige has even more impact
    if (itemInfo.type === 'electronics' && itemInfo.brandPrestige === 'luxury') {
      baseValue *= 1.5; // Additional 50% for luxury electronics brands like Apple
    }
  } else if (itemInfo.type === 'electronics' && itemInfo.brand) {
    // Auto-detect brand prestige for electronics if not provided
    const detectedPrestige = getElectronicsBrandPrestige(itemInfo.brand);
    const prestigeMultiplier = getBrandPrestigeAdjustment(detectedPrestige);
    baseValue *= prestigeMultiplier;
    
    if (detectedPrestige === 'luxury') {
      baseValue *= 1.5; // Additional 50% for luxury electronics brands
    }
  }

  // Apply age depreciation
  if (itemInfo.age) {
    const depreciationRates: Record<string, number> = {
      'electronics': 0.25,    // 25% per year
      'appliance': 0.15,      // 15% per year
      'vehicle': 0.12,        // 12% per year
      'equipment': 0.12,      // 12% per year
      'watch': 0.05,          // 5% per year (holds value better)
      'artwork': -0.02,       // Appreciates 2% per year
      'other': 0.10,          // 10% per year
    };

    const rate = depreciationRates[itemInfo.type] || 0.10;
    const maxDepreciation = itemInfo.type === 'electronics' ? 0.80 : 0.60; // Electronics depreciate more
    const depreciation = Math.min(itemInfo.age * rate, maxDepreciation);
    
    if (rate > 0) {
      baseValue *= (1.0 - depreciation);
    } else {
      baseValue *= (1.0 + Math.abs(depreciation)); // For appreciating items
    }
  }

  // Apply condition adjustment only for item classes where "new/used" is meaningful.
  if (!isBulkRecoveryAsset(itemInfo)) {
    baseValue *= getConditionAdjustment(itemInfo.condition);
  }

  return Math.round(Math.max(50000, baseValue)); // Minimum 50K Naira
}

/**
 * Search for universal part prices
 */
function resolvePartPriceFromSearchResult(
  partResult: Awaited<ReturnType<typeof internetSearchService.searchPartPrice>>
): {
  price?: number;
  confidence?: number;
  source: 'internet_search' | 'ai_estimate' | 'not_found';
} {
  const adjudication = partResult.adjudication;
  const aiSources = new Set(['gemini_grounded', 'claude_web_search']);

  if (adjudication?.selectedPrice && adjudication.selectedPrice > 0) {
    return {
      price: adjudication.selectedPrice,
      confidence: adjudication.confidence ?? partResult.priceData.confidence,
      source: aiSources.has(adjudication.selectedSource) ? 'ai_estimate' : 'internet_search',
    };
  }

  const extractedPrice = partResult.priceData.medianPrice || partResult.priceData.averagePrice;
  if (partResult.success && extractedPrice && extractedPrice > 0) {
    return {
      price: extractedPrice,
      confidence: partResult.priceData.confidence,
      source: 'internet_search',
    };
  }

  return { source: 'not_found' };
}

async function searchUniversalPartPrices(
  itemInfo: UniversalItemInfo | undefined,
  damages: DamageInput[],
  options: { forceRefresh?: boolean } = {}
): Promise<Array<{
  component: string;
  searchedPrice?: number;
  confidence?: number;
  source: 'internet_search' | 'ai_estimate' | 'not_found';
  evidence?: Record<string, unknown>;
}>> {
  if (!itemInfo || damages.length === 0) {
    return [];
  }

  if (isLuxuryJewelryValuation(itemInfo) || isMultiItemJewelryValuation(itemInfo)) {
    console.warn('Skipping internet part-price search for luxury or multi-item jewelry; specialist repair/appraisal required.');
    return damages.map((damage) => ({
      component: damage.component,
      source: 'not_found' as const,
      evidence: {
        reason: 'specialist_jewelry_repair_pricing_required',
        damageLevel: damage.damageLevel,
      },
    }));
  }

  const itemIdentifier = buildUniversalSearchIdentifier(itemInfo);
  if (!itemIdentifier) return [];

  // Map damage components to searchable part names by item type
  const getPartMapping = (itemType: string): Record<string, string> => {
    switch (itemType) {
      case 'vehicle':
        return {
          'structure': 'body panel',
          'engine': 'engine parts',
          'body': 'bumper',
          'electrical': 'headlight',
          'interior': 'seat'
        };
      case 'electronics':
        // For electronics, return empty mapping - we'll use the specific part names directly
        return {};
      case 'appliance':
        return {
          'structure': 'housing',
          'engine': 'motor', // Map mechanical/engine to motor for appliances
          'electrical': 'motor',
          'body': 'door',
          'interior': 'internal parts'
        };
      case 'watch':
      case 'jewelry':
        return {
          'structure': 'case',
          'engine': 'movement', // Map mechanical/engine to movement for watches
          'electrical': 'movement',
          'body': 'crystal',
          'interior': 'mechanism'
        };
      case 'property':
        return {
          'structure': 'structural repair',
          'engine': 'building services repair',
          'electrical': 'electrical repair',
          'body': 'wall roof exterior repair',
          'interior': 'interior repair'
        };
      case 'machinery':
        return {
          'structure': 'frame',
          'engine': 'engine parts',
          'electrical': 'electrical parts',
          'body': 'body panel',
          'interior': 'cabin parts'
        };
      case 'artwork':
        return {
          'structure': 'frame',
          'engine': 'canvas', // Map mechanical/engine to canvas for artwork (unlikely but safe)
          'body': 'canvas',
          'interior': 'surface'
        };
      case 'equipment':
        return {
          'structure': 'housing',
          'engine': 'motor', // Map mechanical/engine to motor for equipment
          'electrical': 'motor',
          'body': 'exterior',
          'interior': 'internal parts'
        };
      default:
        return {
          'structure': 'frame',
          'engine': 'internal parts', // Generic fallback for mechanical/engine
          'electrical': 'electrical parts',
          'body': 'exterior parts',
          'interior': 'internal parts'
        };
    }
  };

  const partMapping = getPartMapping(itemInfo.type);

  const maxPartSearches = Math.max(1, Number(process.env.PART_PRICE_SEARCH_LIMIT) || 8);
  const severityRank: Record<DamageInput['damageLevel'], number> = {
    severe: 3,
    moderate: 2,
    minor: 1,
  };
  const seenPartNames = new Set<string>();
  const prioritizedDamages = [...damages].sort(
    (left, right) => severityRank[right.damageLevel] - severityRank[left.damageLevel]
  );
  const searchableDamages = prioritizedDamages.filter((damage) => {
    const partName = itemInfo.type === 'electronics'
      ? damage.component
      : (partMapping[damage.component] || damage.component);
    const key = partName.trim().toLowerCase();
    if (!key || seenPartNames.has(key) || seenPartNames.size >= maxPartSearches) return false;
    seenPartNames.add(key);
    return true;
  });
  const searchableComponents = new Set(searchableDamages.map((damage) => damage.component));
  const skippedDamages = damages.filter((damage) => !searchableComponents.has(damage.component));

  if (skippedDamages.length > 0) {
    console.info(
      `[Part Pricing] Limited searches to ${searchableDamages.length}/${damages.length} prioritized unique parts. ` +
      'Set PART_PRICE_SEARCH_LIMIT to adjust the cap.'
    );
  }

  const partSearchPromises = searchableDamages.map(async (damage) => {
    // For electronics, use the component name directly (it's already specific from Gemini)
    // For other types, use the mapping
    const partName = itemInfo.type === 'electronics' ? damage.component : (partMapping[damage.component] || damage.component);
    
    try {
      console.log(`🔍 Searching for ${itemInfo.type} part price: ${partName} for ${itemInfo.brand || itemInfo.make} ${itemInfo.model}`);
      
      const partResult = await internetSearchService.searchPartPrice({
        item: itemIdentifier,
        partName,
        damageType: damage.damageLevel,
        maxResults: 8,
        timeout: 7500,
        forceRefresh: options.forceRefresh,
      });

      const resolved = resolvePartPriceFromSearchResult(partResult);

      if (resolved.price) {
        console.log(
          `✅ Found ${itemInfo.type} part price for ${partName}: ₦${resolved.price.toLocaleString()} (${resolved.source})`
        );

        return {
          component: damage.component,
          searchedPrice: resolved.price,
          confidence: resolved.confidence,
          source: resolved.source,
          evidence: {
            query: partResult.query,
            resultsProcessed: partResult.resultsProcessed,
            priceData: partResult.priceData,
            adjudication: partResult.adjudication,
            priceSource: resolved.source,
          },
        };
      } else {
        console.log(`⚠️ No price found for ${itemInfo.type} part: ${partName}`);
        return {
          component: damage.component,
          source: 'not_found' as const,
          evidence: {
            searchedPart: partName,
            reason: partResult.error || 'No average price returned',
          },
        };
      }
    } catch (error) {
      console.error(`❌ ${itemInfo.type} part search failed for ${partName}:`, error);
      return {
        component: damage.component,
        source: 'not_found' as const,
        evidence: {
          searchedPart: partName,
          reason: error instanceof Error ? error.message : 'Unknown search error',
        },
      };
    }
  });

  try {
    const searchedResults = await Promise.all(partSearchPromises);
    return [
      ...searchedResults,
      ...skippedDamages.map((damage) => ({
        component: damage.component,
        source: 'not_found' as const,
        evidence: {
          reason: 'part_search_budget_cap',
          damageLevel: damage.damageLevel,
        },
      })),
    ];
  } catch (error) {
    console.error(`❌ ${itemInfo.type} part search batch failed:`, error);
    return damages.map(damage => ({
      component: damage.component,
      source: 'not_found' as const
    }));
  }
}

/**
 * Determine quality tier for universal items
 */
function determineUniversalQualityTier(
  damageSeverity: 'minor' | 'moderate' | 'severe',
  damagePercentage: number,
  itemInfo?: UniversalItemInfo
): QualityTier {
  const currentYear = new Date().getFullYear();
  const itemAge = itemInfo?.age || (itemInfo?.year ? currentYear - itemInfo.year : null);
  
  // Excellent: < 10% damage AND recent item (≤2 years old for electronics, ≤3 years for others)
  const recentThreshold = itemInfo?.type === 'electronics' ? 2 : 3;
  if (damagePercentage < 10 && itemAge !== null && itemAge <= recentThreshold) {
    return 'excellent';
  }
  
  // Good: 10-30% damage OR older item with minimal damage
  if (damagePercentage < 30) {
    return 'good';
  }
  
  // Fair: 30-60% damage
  if (damagePercentage < 60) {
    return 'fair';
  }
  
  // Poor: > 60% damage
  return 'poor';
}

/**
 * Calculate confidence for universal items
 */
function calculateUniversalConfidence(
  photos: string[],
  itemInfo: UniversalItemInfo | undefined,
  visionResults: { labels: Array<{ description: string; score: number }>; totalConfidence: number },
  damageScore: DamageScore,
  marketDataConfidence?: number,
  photoRequirement?: { minimumPhotos: number; recommendedPhotos: number; requiredAngles?: string[] }
): AssessmentConfidence {
  const confidence: AssessmentConfidence = {
    overall: 0,
    vehicleDetection: 0, // Renamed to itemDetection conceptually
    damageDetection: 0,
    valuationAccuracy: 0,
    photoQuality: 0,
    reasons: []
  };
  
  const minimumPhotos = photoRequirement?.minimumPhotos ?? 3;
  const recommendedPhotos = photoRequirement?.recommendedPhotos ?? 5;

  // Photo quality is policy-driven per asset type. A vehicle needs more evidence
  // than a small electronics item because angles and hidden damage matter more.
  if (photos.length < minimumPhotos) {
    confidence.photoQuality = 30;
    confidence.reasons.push(`Very few photos - need at least ${minimumPhotos} for reliable ${itemInfo?.type || 'asset'} assessment`);
  } else if (photos.length < recommendedPhotos) {
    confidence.photoQuality = 60;
    confidence.reasons.push(`Limited photos - ${recommendedPhotos}+ recommended for best ${itemInfo?.type || 'asset'} accuracy`);
  } else {
    const extraPhotos = Math.max(0, photos.length - recommendedPhotos);
    confidence.photoQuality = Math.min(100, 85 + (extraPhotos * 3));
  }
  
  // Item detection (universal)
  if (itemInfo?.brand || itemInfo?.make) {
    confidence.vehicleDetection = 85; // Base confidence for having brand/make
    
    if (itemInfo.model) {
      confidence.vehicleDetection = Math.min(95, confidence.vehicleDetection + 5);
    }
    
    if (itemInfo.year || itemInfo.age) {
      confidence.vehicleDetection = Math.min(98, confidence.vehicleDetection + 3);
    }
    
    if (itemInfo.condition) {
      confidence.vehicleDetection = Math.min(100, confidence.vehicleDetection + 2);
    } else {
      confidence.reasons.push(`${itemInfo.type} condition not provided - assuming standard condition`);
    }
  } else if (itemInfo?.type) {
    confidence.vehicleDetection = 50;
    confidence.reasons.push(`${itemInfo.type} type identified but missing brand/make information`);
  } else {
    confidence.vehicleDetection = 30;
    confidence.reasons.push('No item information provided - using generic estimates');
  }
  
  // Damage detection (same as before)
  confidence.damageDetection = Math.round(visionResults.totalConfidence * 100);
  
  // Debug logging
  console.log(`🔍 Universal confidence calculation:`, {
    visionResultsTotalConfidence: visionResults.totalConfidence,
    damageDetection: confidence.damageDetection
  });
  
  if (confidence.damageDetection < 70) {
    confidence.reasons.push('Low AI confidence in damage detection - manual review recommended');
  }
  
  // Valuation accuracy (enhanced with market data confidence)
  if (marketDataConfidence !== undefined) {
    confidence.valuationAccuracy = marketDataConfidence;
    
    if (marketDataConfidence >= 90) {
      confidence.reasons.push(`Market value from real market data (${marketDataConfidence}% confidence)`);
    } else if (marketDataConfidence >= 70) {
      confidence.reasons.push(`Market value from limited market data (${marketDataConfidence}% confidence)`);
    } else if (marketDataConfidence >= 50) {
      confidence.reasons.push(`Market value from single source (${marketDataConfidence}% confidence)`);
    } else {
      confidence.reasons.push(`Market value estimated - limited data available (${marketDataConfidence}% confidence)`);
    }
  } else if (itemInfo?.brand || itemInfo?.make) {
    let baseAccuracy = 60;
    
    if (itemInfo.model) baseAccuracy += 10;
    if (itemInfo.year || itemInfo.age) baseAccuracy += 10;
    if (itemInfo.condition) baseAccuracy += 5;
    
    confidence.valuationAccuracy = Math.min(85, baseAccuracy);
    confidence.reasons.push(`Market value estimated from ${itemInfo.type} info - actual value may vary`);
  } else {
    confidence.valuationAccuracy = 30;
    confidence.reasons.push(`Market value estimated without ${itemInfo?.type || 'item'} info - high uncertainty`);
  }
  
  // Overall confidence (weighted average)
  confidence.overall = Math.round(
    (confidence.vehicleDetection * 0.25) +
    (confidence.damageDetection * 0.35) +
    (confidence.valuationAccuracy * 0.25) +
    (confidence.photoQuality * 0.15)
  );
  
  return confidence;
}

/**
 * Validate assessment and generate warnings
 */
function validateAssessment(params: {
  marketValue: number;
  salvageValue: number;
  reservePrice: number;
  damagePercentage: number;
  damageSeverity: string;
  confidence: number;
  reservePriceRatio?: number;
  suppressSeverityPercentageMismatch?: boolean;
}): string[] {
  const warnings: string[] = [];
  
  // Salvage value shouldn't exceed market value
  if (params.salvageValue > params.marketValue) {
    warnings.push('⚠️ Salvage value exceeds market value - review required');
  }
  
  // Salvage value shouldn't be negative
  if (params.salvageValue < 0) {
    warnings.push('⚠️ Negative salvage value - vehicle may be total loss');
  }
  
  // Reserve price validation
  const expectedReserve = params.salvageValue * (params.reservePriceRatio ?? 0.7);
  if (Math.abs(params.reservePrice - expectedReserve) > expectedReserve * 0.2) {
    warnings.push('⚠️ Reserve price calculation may need review');
  }
  
  // Severity vs percentage mismatch
  if (!params.suppressSeverityPercentageMismatch && params.damageSeverity === 'minor' && params.damagePercentage > 60) {
    warnings.push(`Damage is labelled minor but calculated at ${params.damagePercentage}% - review damaged parts and severity classification`);
  }
  if (!params.suppressSeverityPercentageMismatch && params.damageSeverity === 'severe' && params.damagePercentage < 70) {
    warnings.push(`Damage is labelled severe but calculated at ${params.damagePercentage}% - confirm whether visible damage affects core functionality`);
  }
  
  // Low confidence warning
  if (params.confidence < 60) {
    warnings.push('⚠️ Low confidence score - manual review strongly recommended');
  }
  
  return warnings;
}

function getSalvageDiscount(itemType: string, condition?: string): number {
  // Salvage discount factors - internet search often finds retail prices
  // but salvage market is typically lower

  const baseDiscounts: Record<string, number> = {
    'electronics': 0.55,    // Electronics salvage ~55% of retail (more aggressive)
    'appliance': 0.65,      // Appliances salvage ~65% of retail
    'watch': 0.50,          // Watches salvage ~50% of retail
    'artwork': 0.70,        // Artwork holds value better
    'equipment': 0.65,      // Equipment salvage ~65% of retail
    'vehicle': 0.80,        // Vehicles already handled separately
    'other': 0.60           // Default salvage discount
  };

  let discount = baseDiscounts[itemType] || baseDiscounts['other'];

  // Adjust based on condition - Brand New should get HIGHER salvage value than used items
  if (condition) {
    const qualityTier = mapAnyConditionToQuality(condition, 'Salvage discount');
    switch (qualityTier) {
      case 'excellent':
        discount *= 1.25; // Brand new items get highest salvage value
        break;
      case 'good':
        discount *= 1.10; // Foreign used items get moderate salvage value
        break;
      case 'fair':
        discount *= 1.00; // Fair condition gets base salvage value
        break;
      case 'poor':
        discount *= 0.85; // Poor condition gets reduced salvage value
        break;
    }
  }

  return Math.min(discount, 0.85); // Cap at 85% of retail
}
