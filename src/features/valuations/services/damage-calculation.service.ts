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
import { ValuationUnavailableError } from './valuation-unavailable';
import { getValuationPolicyConfig } from './valuation-policy.service';

/** Sum restoration work only; whole-asset recovery caps are not repair costs. */
export function sumRestorationCosts(deductions: Array<Pick<DamageDeduction, 'repairCost' | 'repairCostLow' | 'repairCostHigh'>>): number {
  return Math.round(deductions.reduce((sum, deduction) => sum + (deduction.repairCost ?? (deduction.repairCostLow + deduction.repairCostHigh) / 2), 0));
}

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
   * Requires review if no documented component pricing exists
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
      let result: Array<typeof damageDeductions.$inferSelect> = [];

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
          make: deduction.make ?? undefined,
          repairCostLow,
          repairCostHigh,
          valuationDeductionLow,
          valuationDeductionHigh,
          notes: deduction.notes ?? undefined,
          // Computed fields for backward compatibility
          repairCost: repairCostMidpoint,
          deductionPercent: valuationDeductionMidpoint,
          deductionAmount: 0, // Will be calculated later based on base price
        };
      }

      throw new ValuationUnavailableError(`Repair pricing is unavailable for ${component}. Obtain a documented repair estimate before saving a new salvage valuation.`);
    } catch (error) {
      if (error instanceof ValuationUnavailableError) throw error;
      throw new ValuationUnavailableError(`Repair pricing could not be verified for ${component}. No new valuation was saved.`);
    }
  }

  /**
   * Enhanced salvage calculation using real part prices from internet search
   * Requirements: Universal AI Internet Search System integration
   * 
   * PRIORITY: Real data over assumptions
   * - When we have real part prices, use them directly without multipliers
   * - Missing repair evidence requires review
   */
  async calculateSalvageValueWithPartPrices(
    basePrice: number,
    damages: DamageInput[],
    partPrices?: Array<{
      component: string;
      partPrice?: number;
      action?: DamageInput['recommendedAction'];
      confidence?: number;
      source: 'internet_search' | 'ai_estimate' | 'not_found';
      evidence?: { reason?: string };
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
   * - Parts without prices: require documented database repair costs
   */
  private async calculateSalvageValueFromPartPrices(
    basePrice: number,
    damages: DamageInput[],
    partPrices: Array<{
      component: string;
      partPrice?: number;
      action?: DamageInput['recommendedAction'];
      confidence?: number;
      source: 'internet_search' | 'ai_estimate' | 'not_found';
      evidence?: { reason?: string };
    }>,
    make?: string
  ): Promise<SalvageCalculation & {
    partPricesUsed: boolean;
    realPartsCost: number;
    partPriceConfidence: number;
  }> {
    if (!Number.isFinite(basePrice) || basePrice <= 0) {
      throw new ValuationUnavailableError('A positive, verified market value is required.');
    }
    const normalized = (value: string) => value.trim().toLowerCase();
    const uniqueDamages = this.deduplicateDamages(damages);
    const policy = await getValuationPolicyConfig();
    const load = 1 + Object.values(policy.repairCostMultipliers).reduce((sum, value) => sum + value, 0) / 100;
    const deductions: DamageDeduction[] = [];
    let realPartsCost = 0;
    let pricedCount = 0;
    let confidenceSum = 0;
    for (const damage of uniqueDamages) {
      const price = partPrices.find(part => normalized(part.component) === damage.component &&
        part.source !== 'not_found' && Number.isFinite(part.partPrice) && (part.partPrice ?? 0) > 0);
      if (price) {
        const amount = price.partPrice! * ((price.action ?? damage.recommendedAction) === 'replace' ? load : 1);
        realPartsCost += amount;
        pricedCount++;
        confidenceSum += Math.max(0, Math.min(100, price.confidence ?? 0)) / 100;
        deductions.push({ component: damage.component, damageLevel: damage.damageLevel,
          repairCostLow: amount, repairCostHigh: amount, repairCost: amount,
          valuationDeductionLow: amount / basePrice, valuationDeductionHigh: amount / basePrice,
          deductionPercent: amount / basePrice, deductionAmount: amount,
          source: price.source === 'ai_estimate' ? 'ai_estimate' : 'internet_search' });
      } else {
        const deduction = await this.getDeduction(damage.component, damage.damageLevel, make);
        const amount = (deduction.repairCostLow + deduction.repairCostHigh) / 2;
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new ValuationUnavailableError(`A documented repair cost is required for ${damage.component}. Component severity alone cannot determine whole-asset value loss.`);
        }
        deductions.push({ ...deduction, deductionPercent: amount / basePrice, deductionAmount: amount, source: 'database' });
      }
    }
    const totalDeductionAmount = Math.min(basePrice * MAX_DEDUCTION_PERCENT,
      deductions.reduce((sum, deduction) => sum + (deduction.deductionAmount ?? 0), 0));
    const totalDeductionPercent = totalDeductionAmount / basePrice;
    return { basePrice, totalDeductionAmount, totalDeductionPercent,
      salvageValue: basePrice - totalDeductionAmount, deductions,
      isTotalLoss: totalDeductionPercent >= TOTAL_LOSS_THRESHOLD,
      confidence: uniqueDamages.length ? confidenceSum / uniqueDamages.length : 0,
      partPricesUsed: pricedCount > 0, realPartsCost,
      partPriceConfidence: pricedCount ? confidenceSum / pricedCount * 100 : 0 };
  }

  /** Apply the same component-cost policy when internet prices are unavailable. */
  async calculateSalvageValue(basePrice: number, damages: DamageInput[], make?: string): Promise<SalvageCalculation> {
    return this.calculateSalvageValueFromPartPrices(basePrice, damages, [], make);
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
      const key = damage.component.trim().toLowerCase();
      const existing = componentMap.get(key);

      if (!existing || severityOrder[damage.damageLevel] > severityOrder[existing.damageLevel]) {
        componentMap.set(key, {
          ...damage,
          component: key,
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
