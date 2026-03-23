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
import { assessDamageWithGemini, initializeGeminiService } from '@/lib/integrations/gemini-damage-detection';
import { assessDamageWithVision } from '@/lib/integrations/vision-damage-detection';
import { isGeminiEnabled } from '@/lib/integrations/gemini-damage-detection';
import { getGeminiRateLimiter } from '@/lib/integrations/gemini-rate-limiter';
import { type QualityTier, mapAnyConditionToQuality } from '@/features/valuations/services/condition-mapping.service';

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
  type: 'vehicle' | 'electronics' | 'appliance' | 'watch' | 'artwork' | 'equipment' | 'other';
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

  // Universal fields
  age?: number; // Years since manufacture
  brandPrestige?: 'luxury' | 'premium' | 'standard' | 'budget';
  description?: string;
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
  warnings: string[];
  
  // Metadata
  processedAt: Date;
  photoCount: number;
  analysisMethod: 'gemini' | 'vision' | 'neutral' | 'mock';
}

/**
 * Enhanced damage assessment with universal item support
 */
export async function assessDamageEnhanced(params: {
  photos: string[];
  vehicleInfo?: VehicleInfo; // For backward compatibility
  universalItemInfo?: UniversalItemInfo; // New universal support
}): Promise<EnhancedDamageAssessment> {
  const { photos, vehicleInfo, universalItemInfo } = params;
  
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
  
  // Initialize Gemini service if not already initialized
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
  const visionResults = damageAnalysis.visionResults;
  const geminiTotalLoss = damageAnalysis.geminiTotalLoss; // Capture Gemini's total loss flag
  
  // Step 2: Calculate damage scores
  const damageScore = damageAnalysis.damageScore;
  
  // Step 3: Determine market value (with universal item support)
  const marketValueResult = await getUniversalMarketValue(itemInfo);
  const marketValue = marketValueResult.value;
  const marketDataConfidence = marketValueResult.confidence;
  const priceSource = marketValueResult.source;
  
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
  
  // Identify damaged components from damage score (Requirement 6.2)
  const damages = identifyDamagedComponents(damageScore);
  
  // PRISTINE CONDITION HANDLING: If no damage detected, use universal adjustments
  if (damages.length === 0) {
    console.log('✅ No damage detected - using pristine pricing with universal adjustments');
    
    // For pristine items, salvage value = market value with universal adjustments
    let pristineValue = marketValue;
    
    // Apply universal adjustments for pristine items (works for all item types)
    if (itemInfo) {
      // Skip condition adjustment only for internet search (already condition-specific)
      const skipConditionAdjustment = priceSource === 'internet_search';
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
      
      // NEW: Search for part prices to enhance salvage calculations (Task 7.4)
      const partPrices = await searchUniversalPartPrices(itemInfo, damages);
      console.log(`🔍 Part price search results: ${partPrices.filter(p => p.searchedPrice).length}/${partPrices.length} found`);
      
      // Extract item make/brand for make-specific deductions (Requirement 6.1)
      const itemMake = itemInfo?.make || itemInfo?.brand;
      if (itemMake) {
        console.log(`🏭 Using make/brand-specific deductions for: ${itemMake}`);
      }
      
      // Call Enhanced DamageCalculationService with part prices (NEW)
      const salvageCalc = await damageCalculationService.calculateSalvageValueWithPartPrices(
        marketValue,
        damages,
        partPrices.map(p => ({
          component: p.component,
          partPrice: p.searchedPrice,
          confidence: p.confidence,
          source: p.searchedPrice ? 'internet_search' as const : 'not_found' as const
        })),
        itemMake // Pass item make/brand for make-specific deductions
      );
      
      salvageValue = Math.round(salvageCalc.salvageValue);
      
      // CRITICAL: Ensure salvage value never exceeds market value
      if (salvageValue > marketValue) {
        console.warn(`⚠️ Salvage value (${salvageValue}) exceeds market value (${marketValue}), capping at market value`);
        salvageValue = marketValue;
      }
      
      // CRITICAL FIX: Use Gemini's total loss flag to override damage calculation
      // Gemini is the authoritative source for total loss determination
      const isActuallyTotalLoss = geminiTotalLoss === true || salvageCalc.isTotalLoss;
      
      if (geminiTotalLoss === true && !salvageCalc.isTotalLoss) {
        console.log(`🚨 GEMINI OVERRIDE: Gemini detected total loss but damage calculation did not. Forcing total loss.`);
      }
      
      // TOTAL LOSS OVERRIDE: Cap salvage value at 30% of market value for total loss items
      if (isActuallyTotalLoss && salvageValue > marketValue * 0.3) {
        const originalSalvage = salvageValue;
        salvageValue = Math.round(marketValue * 0.3);
        console.log(`🚨 Total loss override applied: Salvage value capped from ₦${originalSalvage.toLocaleString()} to ₦${salvageValue.toLocaleString()} (30% of market value)`);
        console.log(`   Source: ${geminiTotalLoss === true ? 'Gemini AI' : 'Damage Calculation'}`);
      }
      
      // Update isTotalLoss to reflect Gemini's determination
      isTotalLoss = isActuallyTotalLoss;
      
      repairCost = Math.round(salvageCalc.totalDeductionAmount);
      
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
      
      console.log('✅ Salvage calculation complete:', {
        basePrice: marketValue,
        totalDeduction: salvageCalc.totalDeductionPercent,
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
  
  const reservePrice = salvageValue * 0.7;
  
  // Step 5: Determine severity
  const damagePercentage = calculateDamagePercentage(damageScore);
  let damageSeverity = determineSeverity(damagePercentage);
  
  // CRITICAL FIX: Use Gemini's severity as authoritative when available
  if (damageAnalysis.method === 'gemini' && damageAnalysis.severity) {
    console.log(`🎯 Using Gemini's severity assessment: ${damageAnalysis.severity} (overriding calculated: ${damageSeverity})`);
    damageSeverity = damageAnalysis.severity;
  }
  
  // Step 6: Assess repairability (with item type for proper language)
  const repairability = assessRepairability(damageScore, repairCost, marketValue, itemInfo?.type);
  
  // Step 7: Calculate confidence (with universal item support)
  const confidence = calculateUniversalConfidence(photos, itemInfo, visionResults, damageScore, marketDataConfidence);
  
  // Step 8: Validate and generate warnings
  const warnings = validateAssessment({
    marketValue,
    salvageValue,
    reservePrice,
    damagePercentage,
    damageSeverity,
    confidence: confidence.overall
  });
  
  // Step 9: Determine quality tier based on damage and item context
  const qualityTier = determineUniversalQualityTier(
    damageSeverity,
    damagePercentage,
    itemInfo
  );
  
  const assessment: EnhancedDamageAssessment = {
    labels: visionResults.labels.map(l => l.description),
    confidenceScore: Math.round(confidence.overall),
    damagePercentage: Math.round(damagePercentage),
    damageSeverity,
    damageScore,
    confidence,
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
    warnings,
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
 * Analyze photos with Gemini → Vision fallback chain
 * 
 * This function implements the fallback chain from the Gemini migration:
 * 1. Try Gemini 2.0 Flash (if enabled, rate limit allows, and vehicle context provided)
 * 2. Fall back to Vision API if Gemini fails or is unavailable
 * 3. Return neutral scores if both fail
 */
async function analyzePhotosWithFallback(
  photos: string[],
  vehicleInfo?: VehicleInfo,
  universalItemInfo?: UniversalItemInfo
): Promise<{
  damageScore: DamageScore;
  visionResults: { labels: Array<{ description: string; score: number }>; totalConfidence: number };
  method: 'gemini' | 'vision' | 'neutral';
  geminiTotalLoss?: boolean; // NEW: Capture Gemini's total loss flag
  severity?: 'minor' | 'moderate' | 'severe'; // NEW: Capture Gemini's severity assessment
}> {
  const requestId = `enhanced-assess-${Date.now()}`;
  
  // ATTEMPT 1: Try Gemini (if enabled, rate limit allows, and item context provided)
  // Support both vehicle and universal item contexts
  const hasVehicleContext = vehicleInfo?.make && vehicleInfo?.model && vehicleInfo?.year;
  const hasUniversalContext = universalItemInfo?.brand && universalItemInfo?.model;
  const hasItemContext = hasVehicleContext || hasUniversalContext;
  
  if (isGeminiEnabled() && hasItemContext) {
    try {
      // Check rate limiter
      const rateLimiter = getGeminiRateLimiter();
      const quotaStatus = rateLimiter.checkQuota();
      
      if (quotaStatus.allowed) {
        console.log('🤖 Attempting Gemini damage detection...');
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
          // For universal items, adapt to Gemini's expected format
          geminiContext = {
            make: universalItemInfo!.brand, // Use brand as "make"
            model: universalItemInfo!.model,
            year: universalItemInfo!.year || new Date().getFullYear(), // Use current year if not specified
            itemType: universalItemInfo!.type, // Add item type for context
          };
          console.log(`   Universal item context: ${universalItemInfo!.brand} ${universalItemInfo!.model} (${universalItemInfo!.type})`);
        }
        
        const geminiResult = await assessDamageWithGemini(photos, geminiContext);
        
        // Record successful request
        rateLimiter.recordRequest();
        
        console.log('✅ Gemini assessment successful');
        console.log(`   Severity: ${geminiResult.severity}`);
        console.log(`   Structural: ${geminiResult.structural}, Mechanical: ${geminiResult.mechanical}`);
        console.log(`   Cosmetic: ${geminiResult.cosmetic}, Electrical: ${geminiResult.electrical}, Interior: ${geminiResult.interior}`);
        
        // Convert Gemini response to damage score format
        const damageScore: DamageScore = {
          structural: geminiResult.structural,
          mechanical: geminiResult.mechanical,
          cosmetic: geminiResult.cosmetic,
          electrical: geminiResult.electrical,
          interior: geminiResult.interior,
        };
        
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
          severity: geminiResult.severity // Pass through Gemini's severity assessment
        };
      } else {
        const reason = quotaStatus.dailyRemaining === 0 
          ? `Daily quota exhausted`
          : `Minute quota exhausted`;
        console.warn(`⚠️ Gemini rate limit exceeded: ${reason}. Falling back to Vision API.`);
      }
    } catch (geminiError: any) {
      console.error('❌ Gemini assessment failed:', geminiError?.message || 'Unknown error');
      console.log('   Falling back to Vision API...');
    }
  } else {
    if (!isGeminiEnabled()) {
      console.log('ℹ️ Gemini not enabled. Using Vision API.');
    } else if (!hasItemContext) {
      console.log('ℹ️ Item context incomplete. Using Vision API.');
      console.log(`   Vehicle context: ${hasVehicleContext ? 'available' : 'missing'}`);
      console.log(`   Universal context: ${hasUniversalContext ? 'available' : 'missing'}`);
    }
  }
  
  // ATTEMPT 2: Fall back to Vision API
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
    
    return { damageScore, visionResults, method: 'vision', geminiTotalLoss: undefined };
  } catch (visionError: any) {
    console.error('❌ Vision API assessment failed:', visionError?.message || 'Unknown error');
    console.log('   Using neutral scores...');
  }
  
  // ATTEMPT 3: Return neutral scores if both fail
  console.warn('⚠️ Both Gemini and Vision failed. Using neutral scores.');
  const neutralScore: DamageScore = {
    structural: 50,
    mechanical: 50,
    cosmetic: 50,
    electrical: 50,
    interior: 50,
  };
  
  const neutralVisionResults = {
    labels: [{ description: 'Assessment unavailable', score: 0.5 }],
    totalConfidence: 0.5,
  };
  
  return { damageScore: neutralScore, visionResults: neutralVisionResults, method: 'neutral', geminiTotalLoss: undefined };
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
  source: 'internet_search' | 'not_found';
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
        maxResults: 5,
        timeout: 2000 // Shorter timeout for part searches
      });

      if (partResult.success && partResult.priceData.averagePrice) {
        console.log(`✅ Found part price for ${partName}: ₦${partResult.priceData.averagePrice.toLocaleString()}`);
        
        return {
          component: damage.component,
          searchedPrice: partResult.priceData.averagePrice,
          confidence: partResult.priceData.confidence,
          source: 'internet_search' as const
        };
      } else {
        console.log(`⚠️ No price found for ${partName}`);
        return {
          component: damage.component,
          source: 'not_found' as const
        };
      }
    } catch (error) {
      console.error(`❌ Part search failed for ${partName}:`, error);
      return {
        component: damage.component,
        source: 'not_found' as const
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
      adjustment *= getWatchAdjustment(itemInfo);
      break;

    case 'appliance':
      adjustment *= getApplianceAdjustment(itemInfo);
      break;

    case 'artwork':
      adjustment *= getArtworkAdjustment(itemInfo);
      break;

    case 'equipment':
      adjustment *= getEquipmentAdjustment(itemInfo);
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
  // Cost multipliers for each category
  const costs = {
    structural: damageScore.structural * 50000,  // ₦50k per point
    mechanical: damageScore.mechanical * 30000,  // ₦30k per point
    cosmetic: damageScore.cosmetic * 10000,      // ₦10k per point
    electrical: damageScore.electrical * 20000,  // ₦20k per point
    interior: damageScore.interior * 15000,      // ₦15k per point
  };
  
  const totalCost = Object.values(costs).reduce((sum, cost) => sum + cost, 0);
  
  // Cap repair cost at 90% of market value
  return Math.min(totalCost, marketValue * 0.9);
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
  itemType?: 'vehicle' | 'electronics' | 'appliance' | 'watch' | 'artwork' | 'equipment' | 'other'
): {
  isRepairable: boolean;
  recommendation: string;
} {
  const itemName = itemType || 'item';
  const itemLabel = itemType === 'vehicle' ? 'vehicle' :
                    itemType === 'electronics' ? 'device' :
                    itemType === 'appliance' ? 'appliance' :
                    itemType === 'watch' ? 'watch' :
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

/**
 * Get universal market value for any item type
 */
async function getUniversalMarketValue(itemInfo?: UniversalItemInfo): Promise<{
  value: number;
  confidence: number;
  source: 'database' | 'user_provided' | 'internet_search' | 'scraping' | 'estimated';
}> {
  // If no item info, use generic estimation
  if (!itemInfo) {
    console.log('⚠️ No item info provided, using generic estimation');
    return {
      value: 3000000, // Default 3M Naira for unknown items
      confidence: 30,
      source: 'estimated'
    };
  }

  // For vehicles, use existing vehicle market data service
  if (itemInfo.type === 'vehicle' && itemInfo.make && itemInfo.model && itemInfo.year) {
    try {
      console.log('🌐 Using vehicle market data service...');
      
      // CRITICAL FIX: Convert quality tiers to universal conditions for search
      let searchCondition: 'Brand New' | 'Foreign Used (Tokunbo)' | 'Nigerian Used' | 'Heavily Used' = 'Nigerian Used';
      if (itemInfo.condition) {
        // Map quality tiers to universal conditions for accurate search results
        const qualityToUniversalMapping: Record<string, 'Brand New' | 'Foreign Used (Tokunbo)' | 'Nigerian Used' | 'Heavily Used'> = {
          'excellent': 'Brand New',
          'good': 'Foreign Used (Tokunbo)', 
          'fair': 'Nigerian Used',
          'poor': 'Heavily Used',
          'Brand New': 'Brand New',
          'Foreign Used (Tokunbo)': 'Foreign Used (Tokunbo)',
          'Nigerian Used': 'Nigerian Used',
          'Heavily Used': 'Heavily Used'
        };
        
        searchCondition = qualityToUniversalMapping[itemInfo.condition] || 'Nigerian Used';
        if (qualityToUniversalMapping[itemInfo.condition] !== itemInfo.condition) {
          console.log(`🔄 Converted quality tier "${itemInfo.condition}" → "${searchCondition}" for search`);
        }
      }
      
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: itemInfo.make,
        model: itemInfo.model,
        year: itemInfo.year,
        mileage: itemInfo.mileage,
        condition: searchCondition
      };
      
      const marketPrice = await getMarketPrice(property);
      
      console.log('✅ Vehicle market data result:', {
        median: marketPrice.median,
        sources: marketPrice.count,
        confidence: marketPrice.confidence,
        dataSource: marketPrice.dataSource
      });
      
      const confidencePercent = Math.round(marketPrice.confidence * 100);
      const source = marketPrice.dataSource === 'internet_search' ? 'internet_search' : 
                    marketPrice.dataSource === 'database' ? 'database' : 'scraping';
      
      return {
        value: Math.round(marketPrice.median),
        confidence: confidencePercent,
        source
      };
    } catch (error) {
      console.error('❌ Vehicle market data failed, using estimation:', error);
    }
  }

  // For non-vehicles, use internet search or estimation
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
          condition: itemInfo.condition as UniversalCondition
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
        timeout: 5000
      });

      if (searchResult.success && searchResult.priceData.averagePrice) {
        // Use the market price directly - internet search already accounts for condition
        const marketValue = Math.round(searchResult.priceData.averagePrice);
        
        console.log(`✅ Found ${itemInfo.type} price: ₦${marketValue.toLocaleString()}`);
        
        return {
          value: marketValue,
          confidence: Math.round(searchResult.priceData.confidence),
          source: 'internet_search'
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
    source: 'estimated'
  };
}

/**
 * Estimate market value for universal items
 */
function estimateUniversalMarketValue(itemInfo: UniversalItemInfo): number {
  // Base values by item type (in Naira) - Updated to reflect realistic Nigerian market prices
  const baseValues: Record<string, number> = {
    'vehicle': 8000000,      // 8M default for vehicles
    'electronics': 1200000,  // 1.2M default for electronics (increased from 500K)
    'appliance': 800000,     // 800K default for appliances (increased from 300K)
    'watch': 300000,         // 300K default for watches (increased from 150K)
    'artwork': 500000,       // 500K default for artwork (increased from 200K)
    'equipment': 1500000,    // 1.5M default for equipment (increased from 1M)
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

  // Apply condition adjustment
  baseValue *= getConditionAdjustment(itemInfo.condition);

  return Math.round(Math.max(50000, baseValue)); // Minimum 50K Naira
}

/**
 * Search for universal part prices
 */
async function searchUniversalPartPrices(
  itemInfo: UniversalItemInfo | undefined,
  damages: DamageInput[]
): Promise<Array<{
  component: string;
  searchedPrice?: number;
  confidence?: number;
  source: 'internet_search' | 'not_found';
}>> {
  if ((!itemInfo?.brand && !itemInfo?.make) || damages.length === 0) {
    return [];
  }

  // Build ItemIdentifier based on item type with all required fields
  let itemIdentifier: ItemIdentifier;
  
  if (itemInfo.type === 'vehicle') {
    itemIdentifier = {
      type: 'vehicle',
      make: itemInfo.make || '',
      model: itemInfo.model || '',
      year: itemInfo.year
    };
  } else if (itemInfo.type === 'electronics') {
    itemIdentifier = {
      type: 'electronics',
      brand: itemInfo.brand || itemInfo.make || '',
      model: itemInfo.model || ''
    };
  } else if (itemInfo.type === 'appliance') {
    itemIdentifier = {
      type: 'appliance',
      brand: itemInfo.brand || itemInfo.make || '',
      model: itemInfo.model || ''
    };
  } else {
    // For watch, artwork, equipment, other - use machinery as fallback
    itemIdentifier = {
      type: 'machinery',
      brand: itemInfo.brand || itemInfo.make || '',
      machineryType: itemInfo.type,
      model: itemInfo.model
    };
  }

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
        return {
          'structure': 'case',
          'mechanical': 'processor', // FIXED: Use 'mechanical' instead of 'engine' for electronics
          'electrical': 'battery',
          'body': 'screen',
          'interior': 'internal components'
        };
      case 'appliance':
        return {
          'structure': 'housing',
          'engine': 'motor', // Map mechanical/engine to motor for appliances
          'electrical': 'motor',
          'body': 'door',
          'interior': 'internal parts'
        };
      case 'watch':
        return {
          'structure': 'case',
          'engine': 'movement', // Map mechanical/engine to movement for watches
          'electrical': 'movement',
          'body': 'crystal',
          'interior': 'mechanism'
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

  const partSearchPromises = damages.map(async (damage) => {
    const partName = partMapping[damage.component] || damage.component;
    
    try {
      console.log(`🔍 Searching for ${itemInfo.type} part price: ${partName} for ${itemInfo.brand || itemInfo.make} ${itemInfo.model}`);
      
      const partResult = await internetSearchService.searchPartPrice({
        item: itemIdentifier,
        partName,
        damageType: damage.damageLevel,
        maxResults: 5,
        timeout: 2000
      });

      if (partResult.success && partResult.priceData.averagePrice) {
        console.log(`✅ Found ${itemInfo.type} part price for ${partName}: ₦${partResult.priceData.averagePrice.toLocaleString()}`);
        
        return {
          component: damage.component,
          searchedPrice: partResult.priceData.averagePrice,
          confidence: partResult.priceData.confidence,
          source: 'internet_search' as const
        };
      } else {
        console.log(`⚠️ No price found for ${itemInfo.type} part: ${partName}`);
        return {
          component: damage.component,
          source: 'not_found' as const
        };
      }
    } catch (error) {
      console.error(`❌ ${itemInfo.type} part search failed for ${partName}:`, error);
      return {
        component: damage.component,
        source: 'not_found' as const
      };
    }
  });

  try {
    return await Promise.all(partSearchPromises);
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
  marketDataConfidence?: number
): AssessmentConfidence {
  const confidence: AssessmentConfidence = {
    overall: 0,
    vehicleDetection: 0, // Renamed to itemDetection conceptually
    damageDetection: 0,
    valuationAccuracy: 0,
    photoQuality: 0,
    reasons: []
  };
  
  // Photo quality (need 3+ photos for good assessment)
  if (photos.length < 3) {
    confidence.photoQuality = 30;
    confidence.reasons.push('Very few photos - need at least 3 for accurate assessment');
  } else if (photos.length < 5) {
    confidence.photoQuality = 60;
    confidence.reasons.push('Limited photos - 5+ recommended for best accuracy');
  } else {
    confidence.photoQuality = Math.min(100, 60 + (photos.length * 8));
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
  const expectedReserve = params.salvageValue * 0.7;
  if (Math.abs(params.reservePrice - expectedReserve) > expectedReserve * 0.2) {
    warnings.push('⚠️ Reserve price calculation may need review');
  }
  
  // Severity vs percentage mismatch
  if (params.damageSeverity === 'minor' && params.damagePercentage > 60) {
    warnings.push('⚠️ Damage severity and percentage mismatch - review classification');
  }
  if (params.damageSeverity === 'severe' && params.damagePercentage < 70) {
    warnings.push('⚠️ Damage severity and percentage mismatch - review classification');
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
