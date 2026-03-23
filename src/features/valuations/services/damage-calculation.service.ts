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

    // Calculate total part replacement cost from real prices
    const partsWithPrices = partPrices.filter(p => p.partPrice && p.confidence);
    const totalPartsCost = partsWithPrices.reduce((sum, part) => sum + (part.partPrice || 0), 0);
    const averagePartConfidence = partsWithPrices.length > 0 
      ? partsWithPrices.reduce((sum, part) => sum + (part.confidence || 0), 0) / partsWithPrices.length
      : 0;

    // For components without real prices, use traditional deductions
    const componentsWithoutPrices = deduplicatedDamages.filter(damage => 
      !partPrices.some(p => p.component === damage.component && p.partPrice)
    );

    let traditionalDeductionAmount = 0;
    if (componentsWithoutPrices.length > 0) {
      const traditionalDeductions = await Promise.all(
        componentsWithoutPrices.map(damage =>
          this.getDeduction(damage.component, damage.damageLevel, make)
        )
      );
      traditionalDeductionAmount = traditionalDeductions.reduce(
        (sum, deduction) => sum + (basePrice * (deduction.deductionPercent ?? 0)), 0
      );
    }

    // Calculate total deduction: part costs + traditional deductions
    // Part costs are treated as direct replacement costs, not percentages
    const totalDeductionAmount = totalPartsCost + traditionalDeductionAmount;
    const totalDeductionPercent = Math.min(totalDeductionAmount / basePrice, MAX_DEDUCTION_PERCENT);

    let salvageValue = basePrice - totalDeductionAmount;

    // Ensure non-negative salvage value
    if (salvageValue < 0) {
      salvageValue = 0;
    }

    // Determine if total loss
    const isTotalLoss = totalDeductionPercent >= TOTAL_LOSS_THRESHOLD;

    // Enhanced confidence based on part price availability and confidence
    const partPriceCoverage = partsWithPrices.length / deduplicatedDamages.length;
    const confidence = 0.85 + (partPriceCoverage * averagePartConfidence * 0.15); // Boost confidence with real data

    // Create deductions array combining real prices and traditional deductions
    const processedDeductions: DamageDeduction[] = [];
    
    // Add real part price deductions
    partsWithPrices.forEach(part => {
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
    const traditionalDeductions = await Promise.all(
      componentsWithoutPrices.map(damage =>
        this.getDeduction(damage.component, damage.damageLevel, make)
      )
    );
    
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
      realPartsCost: totalPartsCost,
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

    // Fetch deductions for each damage, passing make if provided
    const deductionPromises = deduplicatedDamages.map(damage =>
      this.getDeduction(damage.component, damage.damageLevel, make)
    );
    const deductions = await Promise.all(deductionPromises);

    // Calculate deduction amounts
    let totalDeductionPercent = 0;
    const processedDeductions: DamageDeduction[] = deductions.map(deduction => {
      const deductionPercent = deduction.deductionPercent ?? 0;
      totalDeductionPercent += deductionPercent;
      return {
        ...deduction,
        deductionAmount: basePrice * deductionPercent,
      };
    });

    // Apply 90% cap on total deductions
    // Requirements: 4.2
    if (totalDeductionPercent > MAX_DEDUCTION_PERCENT) {
      totalDeductionPercent = MAX_DEDUCTION_PERCENT;
    }

    const totalDeductionAmount = basePrice * totalDeductionPercent;
    let salvageValue = basePrice - totalDeductionAmount;

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
