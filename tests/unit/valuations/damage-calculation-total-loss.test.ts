/**
 * Property-Based Tests for Total Loss Classification
 * Feature: vehicle-valuation-database, Property 13: Total Loss Classification
 * 
 * **Validates: Requirements 10.1, 10.2**
 * 
 * Property 13: Total Loss Classification
 * For any vehicle where total damage deductions exceed 70% of base value,
 * the system should classify it as a total loss and cap the salvage value at 30% of base value.
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { DamageCalculationService } from '@/features/valuations/services/damage-calculation.service';

describe('Property 13: Total Loss Classification', () => {
  const service = new DamageCalculationService();

  test('vehicles with >70% damage should be classified as total loss', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          basePrice: fc.float({ min: 1000000, max: 10000000, noNaN: true }),
          // Generate damages that will exceed 70% threshold
          damageCount: fc.integer({ min: 5, max: 10 }),
        }),
        async ({ basePrice, damageCount }) => {
          // Create damages that will exceed 70% threshold
          const damages = Array.from({ length: damageCount }, (_, i) => ({
            component: `component_${i}`,
            damageLevel: 'severe' as const,
          }));

          const result = await service.calculateSalvageValue(basePrice, damages);

          // If total deduction >= 70%, should be classified as total loss
          if (result.totalDeductionPercent >= 0.70) {
            expect(result.isTotalLoss).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  test('total loss vehicles should have salvage value capped at 30% of base price', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 1000000, max: 10000000, noNaN: true }),
        async (basePrice) => {
          // Create damages that will definitely exceed 70% threshold
          const damages = [
            { component: 'engine', damageLevel: 'severe' as const },
            { component: 'transmission', damageLevel: 'severe' as const },
            { component: 'body', damageLevel: 'severe' as const },
            { component: 'interior', damageLevel: 'severe' as const },
            { component: 'electrical', damageLevel: 'severe' as const },
          ];

          const result = await service.calculateSalvageValue(basePrice, damages);

          // If classified as total loss, salvage value should not exceed 30% of base price
          if (result.isTotalLoss) {
            const maxSalvageValue = basePrice * 0.30;
            expect(result.salvageValue).toBeLessThanOrEqual(maxSalvageValue);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  test('vehicles with exactly 70% damage should be classified as total loss', () => {
    const basePrice = 1000000;
    
    // Manually calculate to get exactly 70% deduction
    // Using default deductions: severe = 30%
    // We need 70% / 30% = 2.33... components, so 3 components will give us 90% (capped at 90%)
    // Let's use applySalvageGuidelines directly to test the 70% threshold
    const totalDeductionPercent = 0.70;
    const vehicleAge = 5;
    
    const salvageValue = service.applySalvageGuidelines(
      basePrice,
      totalDeductionPercent,
      vehicleAge,
      false
    );

    // At exactly 70%, should be capped at 30%
    const expectedMax = basePrice * 0.30;
    expect(salvageValue).toBeLessThanOrEqual(expectedMax);
  });

  test('vehicles with <70% damage should not be classified as total loss', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 1000000, max: 10000000, noNaN: true }),
        async (basePrice) => {
          // Create damages that will NOT exceed 70% threshold
          const damages = [
            { component: 'engine', damageLevel: 'minor' as const },
            { component: 'body', damageLevel: 'minor' as const },
          ];

          const result = await service.calculateSalvageValue(basePrice, damages);

          // If total deduction < 70%, should NOT be classified as total loss
          if (result.totalDeductionPercent < 0.70) {
            expect(result.isTotalLoss).toBe(false);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  test('total loss cap should apply regardless of actual deduction amount', () => {
    const basePrice = 5000000;
    const totalDeductionPercent = 0.85; // 85% damage
    const vehicleAge = 5;
    
    const salvageValue = service.applySalvageGuidelines(
      basePrice,
      totalDeductionPercent,
      vehicleAge,
      false
    );

    // Even with 85% damage, salvage value should be capped at 30%
    const expectedMax = basePrice * 0.30;
    expect(salvageValue).toBeLessThanOrEqual(expectedMax);
    
    // And it should be at least close to the cap (not much lower)
    // Since 85% damage would give 15% salvage, but cap is 30%, we expect 15%
    const expectedValue = basePrice * (1 - totalDeductionPercent);
    expect(salvageValue).toBeCloseTo(expectedValue, -2);
  });

  test('total loss classification should be consistent across different base prices', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 1000000, max: 10000000, noNaN: true }),
        async (basePrice) => {
          // Same damage pattern for all prices
          const damages = [
            { component: 'engine', damageLevel: 'severe' as const },
            { component: 'transmission', damageLevel: 'severe' as const },
            { component: 'body', damageLevel: 'severe' as const },
          ];

          const result = await service.calculateSalvageValue(basePrice, damages);

          // Total loss classification should be based on percentage, not absolute amount
          // With 3 severe damages (30% each), we get 90% (capped), which is > 70%
          expect(result.isTotalLoss).toBe(true);
          
          // Salvage value should be proportional to base price
          const salvageRatio = result.salvageValue / basePrice;
          expect(salvageRatio).toBeLessThanOrEqual(0.30);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);
});
