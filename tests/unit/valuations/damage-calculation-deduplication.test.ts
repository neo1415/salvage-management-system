/**
 * Property Test: Highest Severity Deduplication
 * Feature: vehicle-valuation-database
 * Property 9: Highest Severity Deduplication
 * 
 * **Validates: Requirements 4.3**
 * 
 * For any damage calculation where the same component appears multiple times with
 * different damage levels, only the highest severity level should be used in the
 * final calculation.
 */

import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { damageCalculationService } from '@/features/valuations/services/damage-calculation.service';
import type { DamageInput } from '@/features/valuations/types';

describe('Property 9: Highest Severity Deduplication', () => {
  // Generator for component names
  const componentArbitrary = () => fc.constantFrom(
    'engine', 'transmission', 'body', 'interior', 'electrical', 'suspension', 'brakes', 'exhaust'
  );

  // Generator for damage levels
  const damageLevelArbitrary = () => fc.constantFrom(
    'minor' as const, 'moderate' as const, 'severe' as const
  );

  test('duplicate components should be deduplicated', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 10000000 }), // Base price
        componentArbitrary(),
        damageLevelArbitrary(),
        damageLevelArbitrary(),
        async (basePrice, component, level1, level2) => {
          // Create damages with same component but different levels
          const damages: DamageInput[] = [
            { component, damageLevel: level1 },
            { component, damageLevel: level2 },
          ];

          const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

          // Should only have one deduction for this component
          const componentDeductions = result.deductions.filter(
            d => d.component.toLowerCase() === component.toLowerCase()
          );
          expect(componentDeductions.length).toBe(1);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  test('highest severity should be kept when duplicates exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 10000000 }), // Base price
        componentArbitrary(),
        async (basePrice, component) => {
          // Create damages with same component at all three severity levels
          const damages: DamageInput[] = [
            { component, damageLevel: 'minor' },
            { component, damageLevel: 'moderate' },
            { component, damageLevel: 'severe' },
          ];

          const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

          // Should only have one deduction for this component
          const componentDeductions = result.deductions.filter(
            d => d.component.toLowerCase() === component.toLowerCase()
          );
          expect(componentDeductions.length).toBe(1);

          // The kept deduction should be 'severe' (highest severity)
          expect(componentDeductions[0].damageLevel).toBe('severe');
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  test('deduplication should work case-insensitively', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 10000000 }), // Base price
        componentArbitrary(),
        damageLevelArbitrary(),
        damageLevelArbitrary(),
        async (basePrice, component, level1, level2) => {
          // Create damages with same component but different casing
          const damages: DamageInput[] = [
            { component: component.toLowerCase(), damageLevel: level1 },
            { component: component.toUpperCase(), damageLevel: level2 },
          ];

          const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

          // Should only have one deduction for this component (case-insensitive)
          const componentDeductions = result.deductions.filter(
            d => d.component.toLowerCase() === component.toLowerCase()
          );
          expect(componentDeductions.length).toBe(1);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  test('severity order: severe > moderate > minor', async () => {
    const basePrice = 5000000;
    const component = 'engine';

    // Test severe beats moderate
    const damages1: DamageInput[] = [
      { component, damageLevel: 'moderate' },
      { component, damageLevel: 'severe' },
    ];
    const result1 = await damageCalculationService.calculateSalvageValue(basePrice, damages1);
    const deduction1 = result1.deductions.find(d => d.component === component);
    expect(deduction1?.damageLevel).toBe('severe');

    // Test moderate beats minor
    const damages2: DamageInput[] = [
      { component, damageLevel: 'minor' },
      { component, damageLevel: 'moderate' },
    ];
    const result2 = await damageCalculationService.calculateSalvageValue(basePrice, damages2);
    const deduction2 = result2.deductions.find(d => d.component === component);
    expect(deduction2?.damageLevel).toBe('moderate');

    // Test severe beats minor
    const damages3: DamageInput[] = [
      { component, damageLevel: 'minor' },
      { component, damageLevel: 'severe' },
    ];
    const result3 = await damageCalculationService.calculateSalvageValue(basePrice, damages3);
    const deduction3 = result3.deductions.find(d => d.component === component);
    expect(deduction3?.damageLevel).toBe('severe');
  });

  test('multiple duplicates with different components should each be deduplicated independently', async () => {
    const basePrice = 5000000;
    const damages: DamageInput[] = [
      { component: 'engine', damageLevel: 'minor' },
      { component: 'engine', damageLevel: 'severe' },
      { component: 'transmission', damageLevel: 'moderate' },
      { component: 'transmission', damageLevel: 'minor' },
      { component: 'body', damageLevel: 'severe' },
    ];

    const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

    // Should have exactly 3 deductions (one per unique component)
    expect(result.deductions.length).toBe(3);

    // Engine should be severe
    const engineDeduction = result.deductions.find(d => d.component === 'engine');
    expect(engineDeduction?.damageLevel).toBe('severe');

    // Transmission should be moderate
    const transmissionDeduction = result.deductions.find(d => d.component === 'transmission');
    expect(transmissionDeduction?.damageLevel).toBe('moderate');

    // Body should be severe
    const bodyDeduction = result.deductions.find(d => d.component === 'body');
    expect(bodyDeduction?.damageLevel).toBe('severe');
  });

  test('deduplication should not affect components that appear only once', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 100000, max: 10000000 }), // Base price
        fc.array(
          fc.record({
            component: componentArbitrary(),
            damageLevel: damageLevelArbitrary(),
          }),
          { minLength: 1, maxLength: 8 }
        ),
        async (basePrice, damages) => {
          const result = await damageCalculationService.calculateSalvageValue(basePrice, damages);

          // Count unique components in input
          const uniqueComponents = new Set(damages.map(d => d.component.toLowerCase()));

          // Result should have at most as many deductions as unique components
          expect(result.deductions.length).toBeLessThanOrEqual(uniqueComponents.size);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});
