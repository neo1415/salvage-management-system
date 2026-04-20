/**
 * Damage Calculation Service
 * 
 * Calculates salvage values based on damage deductions from the damage_deductions table.
 * Handles damage deduplication, cumulative calculations, caps, and salvage guidelines.
 */

import { db } from '@/lib/db';
import { damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { eq, and, isNull } from 'drizzle-orm';
import type { DamageInput, DamageDeduction, SalvageCalculation } from '../types';

/**
 * Default deduction percentages when component not found in database
 * Requirements: 4.5
 */
const DEFAULT_DEDUCTIONS = {
  minor: 0.05,    // 5%
  moderate: 0.15, // 15%
  severe: 0.30,   // 30%
} as const;

/**
 * Severity multipliers for realistic damage assessment
 * Applied when damage severity is high to amplify deductions
 */
const SEVERITY_MULTIPLIERS = {
  minor: 1.0,     // No amplification for minor damage
  moderate: 1.2,  // 20% amplification for moderate damage
  severe: 1.5,    // 50% amplification for severe damage
} as const;

/**
 * Cumulative damage multipliers based on number of damaged parts
 * Reflects the reality that multiple damaged parts compound the overall damage
 */
const CUMULATIVE_DAMAGE_MULTIPLIERS = [
  { minParts: 1, maxParts: 3, multiplier: 1.0 },    // 1-3 parts: no amplification
  { minParts: 4, maxParts: 6, multiplier: 1.15 },   // 4-6 parts: 15% amplification
  { minParts: 7, maxParts: 9, multiplier: 1.25 },   // 7-9 parts: 25% amplification
  { minParts: 10, maxParts: 12, multiplier: 1.35 }, // 10-12 parts: 35% amplification
  { minParts: 13, maxParts: 999, multiplier: 1.5 }, // 13+ parts: 50% amplification
] as const;

/**
 * Minimum deductions for severe damage cases
 * Ensures severely damaged vehicles have realistic deductions
 */
const MINIMUM_SEVERE_DEDUCTIONS = {
  singleSevere: 0.40,      // Single severe damage: minimum 40% deduction
  multipleSevere: 0.60,    // Multiple severe damages: minimum 60% deduction
  massiveDamage: 0.75,     // 10+ damaged parts: minimum 75% deduction
} as const;

/**
 * Maximum total deduction cap
 * Requirements: 4.2
 */
const MAX_DEDUCTION_PERCENT = 0.90; // 90%

/**
 * Total loss threshold
 * Requirements: 10.1
 */
const TOTAL_LOSS_THRESHOLD = 0.70; // 70%

/**
 * Total loss salvage value cap
 * Requirements: 10.2
 */
const TOTAL_LOSS_CAP = 0.30; // 30%

/**
 * Minimum salvage value for structural damage
 * Requirements: 10.3
 */
const STRUCTURAL_DAMAGE_MIN = 0.10; // 10%

/**
 * Age threshold for additional depreciation
 * Requirements: 10.4
 */
const AGE_DEPRECIATION_THRESHOLD = 10; // years

/**
 * Structural components that trigger minimum value rule
 */
const STRUCTURAL_COMPONENTS = ['frame', 'chassis', 'body', 'structure'];

export class DamageCalculationService {
  /**
   * Get damage deduction for a specific component and level
   * Returns default deduction if not found in database
   * Requirements: 4.5, 6.1, 6.2
   * 
   * @param component - The vehicle component (e.g., "Front Bumper", "Engine")
   * @param damageLevel - The severity of damage (minor, moderate, severe)
   * @param make - Optional vehicle make for make-specific deductions
   * @returns DamageDeduction with range values and calculated midpoints
   */
  async getDeduction(
    component: string, 
    damageLevel: 'minor' | 'moderate' | 'severe',
    make?: string
  ): Promise<DamageDeduction> {
    try {
      const normalizedComponent = component.toLowerCase();
      let result: any[] = [];

      // Step 1: If make provided, query for make-specific deduction
      if (make) {
        result = await db
          .select()
          .from(damageDeductions)
          .where(
            and(
              eq(damageDeductions.make, make),
              eq(damageDeductions.component, normalizedComponent),
              eq(damageDeductions.damageLevel, damageLevel)
            )
          )
          .limit(1);
      }

      // Step 2: If no make-specific result, fallback to generic deduction (NULL make)
      if (result.length === 0) {
        result = await db
          .select()
          .from(damageDeductions)
          .where(
            and(
              isNull(damageDeductions.make),
              eq(damageDeductions.component, normalizedComponent),
              eq(damageDeductions.damageLevel, damageLevel)
            )
          )
          .limit(1);
      }

      // Step 3: If found in database, return with calculated midpoints
      if (result.length > 0) {
        const deduction = result[0];
        const repairCostLow = parseFloat(deduction.repairCostLow);
        const repairCostHigh = parseFloat(deduction.repairCostHigh);
        const valuationDeductionLow = parseFloat(deduction.valuationDeductionLow);
        const valuationDeductionHigh = parseFloat(deduction.valuationDeductionHigh);

        // Calculate midpoints for backward compatibility
        const repairCostMidpoint = (repairCostLow + repairCostHigh) / 2;
        const valuationDeductionMidpoint = (valuationDeductionLow + valuationDeductionHigh) / 2;

        return {
          component: deduction.component,
          damageLevel: deduction.damageLevel,
          make: deduction.make,
          repairCostLow,
          repairCostHigh,
          valuationDeductionLow,
          valuationDeductionHigh,
          notes: deduction.notes,
          // Computed fields for backward compatibility
          repairCost: repairCostMidpoint,
          deductionPercent: valuationDeductionMidpoint,
          deductionAmount: 0, // Will be calculated later based on base price
        };
      }

      // Step 4: Fallback to default deduction percentages
      return {
        component: normalizedComponent,
        damageLevel,
        repairCostLow: 0,
        repairCostHigh: 0,
        valuationDeductionLow: DEFAULT_DEDUCTIONS[damageLevel],
        valuationDeductionHigh: DEFAULT_DEDUCTIONS[damageLevel],
        // Computed fields for backward compatibility
        repairCost: 0,
        deductionPercent: DEFAULT_DEDUCTIONS[damageLevel],
        deductionAmount: 0, // Will be calculated later
      };
    } catch (error) {
      console.error('Error fetching damage deduction:', error);
      // Return default on error
      return {
        component: component.toLowerCase(),
        damageLevel,
        repairCostLow: 0,
        repairCostHigh: 0,
        valuationDeductionLow: DEFAULT_DEDUCTIONS[damageLevel],
        valuationDeductionHigh: DEFAULT_DEDUCTIONS[damageLevel],
        // Computed fields for backward compatibility
        repairCost: 0,
        deductionPercent: DEFAULT_DEDUCTIONS[damageLevel],
        deductionAmount: 0,
      };
    }
  }

  /**
   * Enhanced salvage calculation using real part prices from internet search
   * Requirements: Universal AI Internet Search System integration
   * 
   * PRIORITY: Real data over assumptions
   * - When we have real part prices, use them directly without multipliers
   * - Only apply multipliers to parts without real prices (fallback)
   */
  async calculateSalvageValueWithPartPrices(
    basePrice: number,
    damages: DamageInput[],
    partPrices?: Array<{
      component: string;
      partPrice?: number;
      confidence?: number;
      source: 'internet_search' | 'not_found';
    }>,
    make?: string
  ): Promise<SalvageCalculation & {
    partPricesUsed?: boolean;
    realPartsCost?: number;
    partPriceConfidence?: number;
  }> {
    // If we have real part prices, use them for more accurate calculations
    if (partPrices && partPrices.length > 0) {
      return this.calculateSalvageValueFromPartPrices(basePrice, damages, partPrices, make);
    }
    
    // Fallback to traditional deduction-based calculation
    const traditionalResult = await this.calculateSalvageValue(basePrice, damages, make);
    return {
      ...traditionalResult,
      partPricesUsed: false
    };
  }

  /**
   * Calculate salvage value using real part prices from internet search
   * PRIORITY: Real data over assumptions
   * - Parts with real prices: Use actual cost directly (NO multipliers)
   * - Parts without prices: Use traditional deductions WITH multipliers
   */
  private async calculateSalvageValueFromPartPrices(
    basePrice: number,
    damages: DamageInput[],
    partPrices: Array<{
      component: string;
      partPrice?: number;
      confidence?: number;
      source: 'internet_search' | 'not_found';
    }>,
    make?: string
  ): Promise<SalvageCalculation & {
    partPricesUsed: boolean;
    realPartsCost: number;
    partPriceConfidence: number;
  }> {
    // Deduplicate damages by component, keeping highest severity
    const deduplicatedDamages = this.deduplicateDamages(damages);

    // Separate parts with real prices from parts without
    const partsWithRealPrices = partPrices.filter(p => p.partPrice && p.confidence && p.source === 'internet_search');
    const componentsWithRealPrices = new Set(partsWithRealPrices.map(p => p.component));
    const componentsWithoutPrices = deduplicatedDamages.filter(damage => 
      !componentsWithRealPrices.has(damage.component)
    );

    console.log(`\n🔍 Salvage Calculation Strategy:`);
    console.log(`   ✅ Parts with REAL prices: ${partsWithRealPrices.length} (use actual cost, NO multipliers)`);
    console.log(`   ⚠️  Parts WITHOUT prices: ${componentsWithoutPrices.length} (use traditional deductions WITH multipliers)`);

    // ========================================
    // PART 1: Calculate deduction from REAL part prices (NO MULTIPLIERS)
    // ========================================
    const totalRealPartsCost = partsWithRealPrices.reduce((sum, part) => sum + (part.partPrice || 0), 0);
    const realPartsDeductionPercent = totalRealPartsCost / basePrice;
    const averagePartConfidence = partsWithRealPrices.length > 0 
      ? partsWithRealPrices.reduce((sum, part) => sum + (part.confidence || 0), 0) / partsWithRealPrices.length
      : 0;

    console.log(`\n💰 REAL Part Prices (NO multipliers applied):`);
    console.log(`   Total cost: ₦${totalRealPartsCost.toLocaleString()}`);
    console.log(`   Deduction: ${(realPartsDeductionPercent * 100).toFixed(1)}%`);
    console.log(`   Confidence: ${(averagePartConfidence * 100).toFixed(1)}%`);

    // ========================================
    // PART 2: Calculate deduction for parts WITHOUT prices (WITH MULTIPLIERS)
    // ========================================
    let traditionalDeductionPercent = 0;
    const traditionalDeductions: DamageDeduction[] = [];
    
    if (componentsWithoutPrices.length > 0) {
      console.log(`\n🔧 Traditional Deductions (WITH multipliers for missing prices):`);
      
      // Get base deductions from database
      const deductions = await Promise.all(
        componentsWithoutPrices.map(damage =>
          this.getDeduction(damage.component, damage.damageLevel, make)
        )
      );
      
      // Calculate base deduction
      const baseTraditionalDeduction = deductions.reduce(
        (sum, deduction) => sum + (deduction.deductionPercent ?? 0), 0
      );

      // Count severity for multiplier logic
      const severeCounts = componentsWithoutPrices.filter(d => d.damageLevel === 'severe').length;
      const moderateCounts = componentsWithoutPrices.filter(d => d.damageLevel === 'moderate').length;
      const totalDamagedPartsWithoutPrices = componentsWithoutPrices.length;

      console.log(`   Base deduction: ${(baseTraditionalDeduction * 100).toFixed(1)}%`);
      console.log(`   Severe: ${severeCounts}, Moderate: ${moderateCounts}, Minor: ${totalDamagedPartsWithoutPrices - severeCounts - moderateCounts}`);

      // Apply severity multiplier
      let severityMultiplier = 1.0;
      if (severeCounts >= 3) {
        severityMultiplier = SEVERITY_MULTIPLIERS.severe;
        console.log(`   ⚠️ Severity multiplier: ${severityMultiplier}x (${severeCounts} severe parts)`);
      } else if (severeCounts >= 1 || moderateCounts >= 5) {
        severityMultiplier = SEVERITY_MULTIPLIERS.moderate;
        console.log(`   ⚠️ Severity multiplier: ${severityMultiplier}x`);
      }

      // Apply cumulative damage multiplier
      let cumulativeMultiplier = 1.0;
      for (const range of CUMULATIVE_DAMAGE_MULTIPLIERS) {
        if (totalDamagedPartsWithoutPrices >= range.minParts && totalDamagedPartsWithoutPrices <= range.maxParts) {
          cumulativeMultiplier = range.multiplier;
          console.log(`   📈 Cumulative multiplier: ${cumulativeMultiplier}x (${totalDamagedPartsWithoutPrices} parts)`);
          break;
        }
      }

      // Apply multipliers
      const combinedMultiplier = severityMultiplier * cumulativeMultiplier;
      traditionalDeductionPercent = baseTraditionalDeduction * combinedMultiplier;

      console.log(`   Combined multiplier: ${combinedMultiplier.toFixed(2)}x`);
      console.log(`   Final deduction: ${(traditionalDeductionPercent * 100).toFixed(1)}%`);

      // Enforce minimum deductions for severe cases
      if (severeCounts >= 10 || totalDamagedPartsWithoutPrices >= 13) {
        if (traditionalDeductionPercent < MINIMUM_SEVERE_DEDUCTIONS.massiveDamage) {
          console.log(`   ⚠️ Enforcing minimum: ${MINIMUM_SEVERE_DEDUCTIONS.massiveDamage * 100}% (massive damage)`);
          traditionalDeductionPercent = MINIMUM_SEVERE_DEDUCTIONS.massiveDamage;
        }
      } else if (severeCounts >= 3) {
        if (traditionalDeductionPercent < MINIMUM_SEVERE_DEDUCTIONS.multipleSevere) {
          console.log(`   ⚠️ Enforcing minimum: ${MINIMUM_SEVERE_DEDUCTIONS.multipleSevere * 100}% (multiple severe)`);
          traditionalDeductionPercent = MINIMUM_SEVERE_DEDUCTIONS.multipleSevere;
        }
      } else if (severeCounts >= 1) {
        if (traditionalDeductionPercent < MINIMUM_SEVERE_DEDUCTIONS.singleSevere) {
          console.log(`   ⚠️ Enforcing minimum: ${MINIMUM_SEVERE_DEDUCTIONS.singleSevere * 100}% (single severe)`);
          traditionalDeductionPercent = MINIMUM_SEVERE_DEDUCTIONS.singleSevere;
        }
      }

      traditionalDeductions.push(...deductions);
    }

    // ========================================
    // PART 3: Combine both deductions
    // ========================================
    let totalDeductionPercent = realPartsDeductionPercent + traditionalDeductionPercent;

    console.log(`\n📊 Combined Deduction:`);
    console.log(`   From real prices: ${(realPartsDeductionPercent * 100).toFixed(1)}%`);
    console.log(`   From traditional: ${(traditionalDeductionPercent * 100).toFixed(1)}%`);
    console.log(`   Total: ${(totalDeductionPercent * 100).toFixed(1)}%`);

    // Apply 90% cap on total deductions
    if (totalDeductionPercent > MAX_DEDUCTION_PERCENT) {
      console.log(`   ⚠️ Capping at maximum: ${MAX_DEDUCTION_PERCENT * 100}%`);
      totalDeductionPercent = MAX_DEDUCTION_PERCENT;
    }

    const totalDeductionAmount = basePrice * totalDeductionPercent;
    let salvageValue = basePrice - totalDeductionAmount;

    console.log(`\n💰 Final Result:`);
    console.log(`   Deduction: ${(totalDeductionPercent * 100).toFixed(1)}% (₦${totalDeductionAmount.toLocaleString()})`);
    console.log(`   Salvage value: ₦${salvageValue.toLocaleString()}`);

    // Ensure non-negative salvage value
    if (salvageValue < 0) {
      salvageValue = 0;
    }

    // Determine if total loss
    const isTotalLoss = totalDeductionPercent >= TOTAL_LOSS_THRESHOLD;

    // Enhanced confidence based on part price availability and confidence
    const partPriceCoverage = partsWithRealPrices.length / deduplicatedDamages.length;
    const confidence = 0.85 + (partPriceCoverage * averagePartConfidence * 0.15);

    // Create deductions array combining real prices and traditional deductions
    const processedDeductions: DamageDeduction[] = [];
    
    // Add real part price deductions
    partsWithRealPrices.forEach(part => {
      const matchingDamage = deduplicatedDamages.find(d => d.component === part.component);
      if (matchingDamage && part.partPrice) {
        processedDeductions.push({
          component: part.component,
          damageLevel: matchingDamage.damageLevel,
          deductionPercent: part.partPrice / basePrice,
          deductionAmount: part.partPrice,
          make: make || null,
          source: 'internet_search'
        });
      }
    });

    // Add traditional deductions for components without real prices
    traditionalDeductions.forEach(deduction => {
      processedDeductions.push({
        ...deduction,
        deductionAmount: basePrice * (deduction.deductionPercent ?? 0),
        source: 'database'
      });
    });

    return {
      basePrice,
      totalDeductionPercent,
      totalDeductionAmount,
      salvageValue,
      deductions: processedDeductions,
      isTotalLoss,
      confidence,
      partPricesUsed: true,
      realPartsCost: totalRealPartsCost,
      partPriceConfidence: averagePartConfidence
    };
  }

  /**
   * Calculate salvage value with damage deductions
   * Applies cumulative deductions up to 90% max
   * Requirements: 4.1, 4.2, 4.3, 4.4, 6.1
   * 
   * @param basePrice - The base vehicle price
   * @param damages - Array of damage inputs
   * @param make - Optional vehicle make for make-specific deductions
   */
  async calculateSalvageValue(
    basePrice: number,
    damages: DamageInput[],
    make?: string
  ): Promise<SalvageCalculation> {
    // Deduplicate damages by component, keeping highest severity
    // Requirements: 4.3
    const deduplicatedDamages = this.deduplicateDamages(damages);

    // Count damage severity distribution
    const severeCounts = deduplicatedDamages.filter(d => d.damageLevel === 'severe').length;
    const moderateCounts = deduplicatedDamages.filter(d => d.damageLevel === 'moderate').length;
    const minorCounts = deduplicatedDamages.filter(d => d.damageLevel === 'minor').length;
    const totalDamagedParts = deduplicatedDamages.length;

    console.log(`🔍 Damage assessment - total score: ${totalDamagedParts * 30}`);
    console.log(`- Severe damage: ${severeCounts} parts`);
    console.log(`- Moderate damage: ${moderateCounts} parts`);
    console.log(`- Minor damage: ${minorCounts} parts`);

    // Fetch deductions for each damage, passing make if provided
    const deductionPromises = deduplicatedDamages.map(damage =>
      this.getDeduction(damage.component, damage.damageLevel, make)
    );
    const deductions = await Promise.all(deductionPromises);

    // Calculate base deduction amounts
    let totalDeductionPercent = 0;
    const processedDeductions: DamageDeduction[] = deductions.map(deduction => {
      const deductionPercent = deduction.deductionPercent ?? 0;
      totalDeductionPercent += deductionPercent;
      return {
        ...deduction,
        deductionAmount: basePrice * deductionPercent,
      };
    });

    console.log(`📊 Base deduction before multipliers: ${(totalDeductionPercent * 100).toFixed(1)}%`);

    // Apply severity multiplier based on overall damage severity
    let severityMultiplier = 1.0;
    if (severeCounts >= 3) {
      // Multiple severe damages
      severityMultiplier = SEVERITY_MULTIPLIERS.severe;
      console.log(`⚠️ Applying severe damage multiplier: ${severityMultiplier}x (${severeCounts} severe parts)`);
    } else if (severeCounts >= 1 || moderateCounts >= 5) {
      // Some severe or many moderate damages
      severityMultiplier = SEVERITY_MULTIPLIERS.moderate;
      console.log(`⚠️ Applying moderate damage multiplier: ${severityMultiplier}x`);
    }

    // Apply cumulative damage multiplier based on number of damaged parts
    let cumulativeMultiplier = 1.0;
    for (const range of CUMULATIVE_DAMAGE_MULTIPLIERS) {
      if (totalDamagedParts >= range.minParts && totalDamagedParts <= range.maxParts) {
        cumulativeMultiplier = range.multiplier;
        console.log(`📈 Applying cumulative damage multiplier: ${cumulativeMultiplier}x (${totalDamagedParts} damaged parts)`);
        break;
      }
    }

    // Apply both multipliers
    const combinedMultiplier = severityMultiplier * cumulativeMultiplier;
    totalDeductionPercent = totalDeductionPercent * combinedMultiplier;

    console.log(`🔧 Combined multiplier: ${combinedMultiplier.toFixed(2)}x`);
    console.log(`📊 Deduction after multipliers: ${(totalDeductionPercent * 100).toFixed(1)}%`);

    // Enforce minimum deductions for severe cases
    if (severeCounts >= 10 || totalDamagedParts >= 13) {
      // Massive damage: minimum 75% deduction
      if (totalDeductionPercent < MINIMUM_SEVERE_DEDUCTIONS.massiveDamage) {
        console.log(`⚠️ Enforcing minimum deduction for massive damage: ${MINIMUM_SEVERE_DEDUCTIONS.massiveDamage * 100}%`);
        totalDeductionPercent = MINIMUM_SEVERE_DEDUCTIONS.massiveDamage;
      }
    } else if (severeCounts >= 3) {
      // Multiple severe damages: minimum 60% deduction
      if (totalDeductionPercent < MINIMUM_SEVERE_DEDUCTIONS.multipleSevere) {
        console.log(`⚠️ Enforcing minimum deduction for multiple severe damages: ${MINIMUM_SEVERE_DEDUCTIONS.multipleSevere * 100}%`);
        totalDeductionPercent = MINIMUM_SEVERE_DEDUCTIONS.multipleSevere;
      }
    } else if (severeCounts >= 1) {
      // Single severe damage: minimum 40% deduction
      if (totalDeductionPercent < MINIMUM_SEVERE_DEDUCTIONS.singleSevere) {
        console.log(`⚠️ Enforcing minimum deduction for severe damage: ${MINIMUM_SEVERE_DEDUCTIONS.singleSevere * 100}%`);
        totalDeductionPercent = MINIMUM_SEVERE_DEDUCTIONS.singleSevere;
      }
    }

    // Apply 90% cap on total deductions
    // Requirements: 4.2
    if (totalDeductionPercent > MAX_DEDUCTION_PERCENT) {
      console.log(`⚠️ Capping deduction at maximum: ${MAX_DEDUCTION_PERCENT * 100}%`);
      totalDeductionPercent = MAX_DEDUCTION_PERCENT;
    }

    const totalDeductionAmount = basePrice * totalDeductionPercent;
    let salvageValue = basePrice - totalDeductionAmount;

    console.log(`💰 Final deduction: ${(totalDeductionPercent * 100).toFixed(1)}% (₦${totalDeductionAmount.toLocaleString()})`);
    console.log(`💰 Salvage value: ₦${salvageValue.toLocaleString()}`);

    // Ensure non-negative salvage value
    // Requirements: 4.6
    if (salvageValue < 0) {
      salvageValue = 0;
    }

    // Determine if total loss
    const isTotalLoss = totalDeductionPercent >= TOTAL_LOSS_THRESHOLD;

    // Calculate confidence score (placeholder for now)
    const confidence = 0.85;

    return {
      basePrice,
      totalDeductionPercent,
      totalDeductionAmount,
      salvageValue,
      deductions: processedDeductions,
      isTotalLoss,
      confidence,
    };
  }

  /**
   * Apply salvage value guidelines (total loss rules, minimum values)
   * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
   */
  applySalvageGuidelines(
    basePrice: number,
    totalDeductionPercent: number,
    vehicleAge: number,
    hasStructuralDamage: boolean = false
  ): number {
    let salvageValue = basePrice * (1 - totalDeductionPercent);

    // Total loss classification and cap
    // Requirements: 10.1, 10.2
    if (totalDeductionPercent >= TOTAL_LOSS_THRESHOLD) {
      salvageValue = Math.min(salvageValue, basePrice * TOTAL_LOSS_CAP);
    }

    // Structural damage minimum
    // Requirements: 10.3
    if (hasStructuralDamage) {
      const minValue = basePrice * STRUCTURAL_DAMAGE_MIN;
      salvageValue = Math.max(salvageValue, minValue);
    }

    // Age-based depreciation
    // Requirements: 10.4
    if (vehicleAge > AGE_DEPRECIATION_THRESHOLD) {
      const additionalDepreciation = 0.05 * (vehicleAge - AGE_DEPRECIATION_THRESHOLD);
      salvageValue *= (1 - Math.min(additionalDepreciation, 0.20)); // Max 20% additional depreciation
    }

    // Ensure non-negative
    return Math.max(salvageValue, 0);
  }

  /**
   * Deduplicate damages by component, keeping highest severity
   * Requirements: 4.3
   */
  private deduplicateDamages(damages: DamageInput[]): DamageInput[] {
    const severityOrder = { minor: 1, moderate: 2, severe: 3 };
    const componentMap = new Map<string, DamageInput>();

    for (const damage of damages) {
      const key = damage.component.toLowerCase();
      const existing = componentMap.get(key);

      if (!existing || severityOrder[damage.damageLevel] > severityOrder[existing.damageLevel]) {
        componentMap.set(key, {
          component: key,
          damageLevel: damage.damageLevel,
        });
      }
    }

    return Array.from(componentMap.values());
  }

  /**
   * Check if damages include structural components
   */
  hasStructuralDamage(damages: DamageInput[]): boolean {
    return damages.some(damage =>
      STRUCTURAL_COMPONENTS.includes(damage.component.toLowerCase())
    );
  }
}

// Export singleton instance
export const damageCalculationService = new DamageCalculationService();
