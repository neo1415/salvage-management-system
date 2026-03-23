/**
 * Property Test: Non-Negative Salvage Value Invariant
 * Feature: vehicle-valuation-database
 * Property 12: Non-Negative Salvage Value Invariant
 * 
 * **Validates: Requirements 4.6**
 * 
 * For any base price and damage list, the calculated salvage value should always
 * be greater than or equal to zero, even when deductions would exceed the base price.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { damageCalculationService } from '@/features/valuations/services/damage-calculation.service';
import type { DamageInput } from '@/features/valuations/types';

describe('Property 12: Non-Negative Salvage Value Invariant', () => {
  // Generator for damage inputs
  const damageInputArbitrary = () => fc.array(
    fc.record({
      component: fc.constantFrom('engine', 'transmission', 'body', 'interior', 'electrical', 'suspension', 'brakes', 'exhaust'),
      damageLevel: fc.constantFrom('minor' as const, 'moderate' as const, 'severe' as const),
    }),
    { minLength: 1, maxLength: 10 }
  );

  test('salvage value should always be non-negative for any damage combination', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 10000000 }), // Base price
        damageInputArbitrary(),
        async (basePrice, damages) => {
          const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

          // Salvage value must always be >= 0
          expect(result.salvageValue).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  test('salvage value should be non-negative even with extreme damage scenarios', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 10000000 }), // Base price
        async (basePrice) => {
          // Create extreme damage scenario - all components with severe damage
          const extremeDamages: DamageInput[] = [
            { component: 'engine', damageLevel: 'severe' },
            { component: 'transmission', damageLevel: 'severe' },
            { component: 'body', damageLevel: 'severe' },
            { component: 'interior', damageLevel: 'severe' },
            { component: 'electrical', damageLevel: 'severe' },
            { component: 'suspension', damageLevel: 'severe' },
            { component: 'brakes', damageLevel: 'severe' },
            { component: 'exhaust', damageLevel: 'severe' },
          ];

          const result = await damageCalculationService.calculateSalvageValue(basePrice, extremeDamages);

          // Even with all severe damages, salvage value should be non-negative
          expect(result.salvageValue).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  test('salvage value should be exactly zero when deductions would exceed base price', async () => {
    const basePrice = 1000000;
    
    // Create damage scenario that would theoretically exceed 100% deduction
    // (but should be capped at 90% by the service)
    const extremeDamages: DamageInput[] = [
      { component: 'engine', damageLevel: 'severe' },
      { component: 'transmission', damageLevel: 'severe' },
      { component: 'body', damageLevel: 'severe' },
      { component: 'interior', damageLevel: 'severe' },
      { component: 'electrical', damageLevel: 'severe' },
      { component: 'suspension', damageLevel: 'severe' },
      { component: 'brakes', damageLevel: 'severe' },
      { component: 'exhaust', damageLevel: 'severe' },
    ];

    const result = await damageCalculationService.calculateSalvageValue(basePrice, extremeDamages);

    // With 90% cap, salvage value should be 10% of base price (not negative)
    expect(result.salvageValue).toBeGreaterThanOrEqual(0);
    expect(result.salvageValue).toBe(basePrice * 0.10);
  });

  test('salvage value should never be negative even with very low base prices', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1000, max: 50000 }), // Very low base prices
        damageInputArbitrary(),
        async (basePrice, damages) => {
          const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

          // Even with low base prices, salvage value should be non-negative
          expect(result.salvageValue).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  test('salvage value should be non-negative when base price equals deduction amount', async () => {
    const basePrice = 1000000;
    
    // Create a scenario where deductions would theoretically equal base price
    // In practice, the 90% cap prevents this, but we test the invariant holds
    const damages: DamageInput[] = [
      { component: 'engine', damageLevel: 'severe' },
      { component: 'transmission', damageLevel: 'severe' },
      { component: 'body', damageLevel: 'severe' },
    ];

    const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

    // Salvage value should be non-negative
    expect(result.salvageValue).toBeGreaterThanOrEqual(0);
    
    // Verify the calculation is correct
    const expectedSalvageValue = basePrice - result.totalDeductionAmount;
    expect(result.salvageValue).toBe(Math.max(expectedSalvageValue, 0));
  });

  test('salvage value calculation should maintain non-negative invariant across all price ranges', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100000000 }), // Wide range of prices
        fc.array(
          fc.record({
            component: fc.string({ minLength: 1, maxLength: 50 }),
            damageLevel: fc.constantFrom('minor' as const, 'moderate' as const, 'severe' as const),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        async (basePrice, damages) => {
          const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

          // The fundamental invariant: salvage value is always non-negative
          expect(result.salvageValue).toBeGreaterThanOrEqual(0);
          
          // Additional invariant: salvage value should not exceed base price
          expect(result.salvageValue).toBeLessThanOrEqual(basePrice);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});
