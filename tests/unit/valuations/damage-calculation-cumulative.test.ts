/**
 * Property Test: Cumulative Damage Deduction Calculation
 * Feature: vehicle-valuation-database
 * Property 8: Cumulative Damage Deduction Calculation
 * 
 * Validates: Requirements 4.1, 4.2
 * 
 * For any base price and list of component damages, the total deduction should equal
 * the sum of individual deductions, capped at 90% of the base price.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { damageCalculationService } from '@/features/valuations/services/damage-calculation.service';
import type { DamageInput } from '@/features/valuations/types';

describe('Property 8: Cumulative Damage Deduction Calculation', () => {
  // Generator for damage inputs
  const damageInputArbitrary = () => fc.array(
    fc.record({
      component: fc.constantFrom('engine', 'transmission', 'body', 'interior', 'electrical', 'suspension', 'brakes', 'exhaust'),
      damageLevel: fc.constantFrom('minor' as const, 'moderate' as const, 'severe' as const),
    }),
    { minLength: 1, maxLength: 8 }
  );

  test('total deduction should equal sum of individual deductions (before cap)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 10000000 }), // Base price
        damageInputArbitrary(),
        async (basePrice, damages) => {
          const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

          // Calculate expected total from individual deductions
          const sumOfDeductions = result.deductions.reduce((sum, d) => sum + d.deductionPercent, 0);

          // If sum is under 90%, total should equal sum
          if (sumOfDeductions <= 0.90) {
            expect(Math.abs(result.totalDeductionPercent - sumOfDeductions)).toBeLessThan(0.0001);
          } else {
            // If sum exceeds 90%, total should be capped at 90%
            expect(result.totalDeductionPercent).toBe(0.90);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  test('total deduction should never exceed 90% cap', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 10000000 }), // Base price
        damageInputArbitrary(),
        async (basePrice, damages) => {
          const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

          // Total deduction should never exceed 90%
          expect(result.totalDeductionPercent).toBeLessThanOrEqual(0.90);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  test('salvage value should equal base price minus total deduction amount', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 10000000 }), // Base price
        damageInputArbitrary(),
        async (basePrice, damages) => {
          const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

          const expectedSalvageValue = basePrice - result.totalDeductionAmount;
          
          // Salvage value should match calculation (allowing for floating point precision)
          expect(Math.abs(result.salvageValue - expectedSalvageValue)).toBeLessThan(1);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  test('total deduction amount should equal base price times total deduction percent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 10000000 }), // Base price
        damageInputArbitrary(),
        async (basePrice, damages) => {
          const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

          const expectedDeductionAmount = basePrice * result.totalDeductionPercent;
          
          // Deduction amount should match calculation (allowing for floating point precision)
          expect(Math.abs(result.totalDeductionAmount - expectedDeductionAmount)).toBeLessThan(1);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  test('with severe damage on all components, should hit 90% cap', async () => {
    const basePrice = 5000000;
    const damages: DamageInput[] = [
      { component: 'engine', damageLevel: 'severe' },
      { component: 'transmission', damageLevel: 'severe' },
      { component: 'body', damageLevel: 'severe' },
      { component: 'interior', damageLevel: 'severe' },
      { component: 'electrical', damageLevel: 'severe' },
    ];

    const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

    // With multiple severe damages, should hit the 90% cap
    expect(result.totalDeductionPercent).toBe(0.90);
    expect(result.salvageValue).toBe(basePrice * 0.10); // 10% remaining
  });

  test('with single minor damage, should not hit cap', async () => {
    const basePrice = 5000000;
    const damages: DamageInput[] = [
      { component: 'interior', damageLevel: 'minor' },
    ];

    const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

    // Single minor damage should be well below 90% cap
    expect(result.totalDeductionPercent).toBeLessThan(0.90);
    expect(result.totalDeductionPercent).toBeGreaterThan(0);
  });
});
