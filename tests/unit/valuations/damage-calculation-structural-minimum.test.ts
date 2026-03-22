/**
 * Property-Based Tests for Structural Damage Minimum Value
 * Feature: vehicle-valuation-database, Property 14: Structural Damage Minimum Value
 * 
 * **Validates: Requirements 10.3**
 * 
 * Property 14: Structural Damage Minimum Value
 * For any vehicle with structural damage, the salvage value should be at least 10% of the base value,
 * regardless of other damage.
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { DamageCalculationService } from '@/features/valuations/services/damage-calculation.service';

describe('Property 14: Structural Damage Minimum Value', () => {
  const service = new DamageCalculationService();

  // Structural components as defined in the service
  const structuralComponents = ['frame', 'chassis', 'body', 'structure'];

  test('vehicles with structural damage should have minimum 10% salvage value', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          basePrice: fc.float({ min: 1000000, max: 10000000, noNaN: true }),
          structuralComponent: fc.constantFrom(...structuralComponents),
          damageLevel: fc.constantFrom('minor', 'moderate', 'severe'),
        }),
        async ({ basePrice, structuralComponent, damageLevel }) => {
          const damages = [
            { component: structuralComponent, damageLevel: damageLevel as 'minor' | 'moderate' | 'severe' },
          ];

          // Check if service detects structural damage
          const hasStructural = service.hasStructuralDamage(damages);
          expect(hasStructural).toBe(true);

          // Apply guidelines with structural damage flag
          const salvageValue = service.applySalvageGuidelines(
            basePrice,
            0.50, // 50% damage
            5, // 5 years old
            true // has structural damage
          );

          // Should be at least 10% of base price
          const minValue = basePrice * 0.10;
          expect(salvageValue).toBeGreaterThanOrEqual(minValue);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  test('structural damage minimum should apply even with high total deductions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 1000000, max: 10000000, noNaN: true }),
        async (basePrice) => {
          // High deduction that would normally result in very low salvage value
          const totalDeductionPercent = 0.95; // 95% damage
          const vehicleAge = 5;

          const salvageValue = service.applySalvageGuidelines(
            basePrice,
            totalDeductionPercent,
            vehicleAge,
            true // has structural damage
          );

          // Even with 95% damage, structural minimum should apply
          const minValue = basePrice * 0.10;
          expect(salvageValue).toBeGreaterThanOrEqual(minValue);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  test('non-structural damage should not trigger minimum value rule', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          basePrice: fc.float({ min: 1000000, max: 10000000, noNaN: true }),
          component: fc.constantFrom('engine', 'transmission', 'interior', 'electrical'),
        }),
        async ({ basePrice, component }) => {
          const damages = [
            { component, damageLevel: 'severe' as const },
          ];

          // Check that service does NOT detect structural damage
          const hasStructural = service.hasStructuralDamage(damages);
          expect(hasStructural).toBe(false);

          // Apply guidelines without structural damage
          const salvageValue = service.applySalvageGuidelines(
            basePrice,
            0.95, // 95% damage
            5, // 5 years old
            false // no structural damage
          );

          // Without structural damage, salvage can be less than 10%
          // With 95% damage, salvage would be 5% of base price
          const expectedValue = basePrice * 0.05;
          expect(salvageValue).toBeCloseTo(expectedValue, -2);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  test('structural minimum should override total loss cap when necessary', () => {
    const basePrice = 5000000;
    const totalDeductionPercent = 0.95; // 95% damage (would give 5% salvage)
    const vehicleAge = 5;

    const salvageValue = service.applySalvageGuidelines(
      basePrice,
      totalDeductionPercent,
      vehicleAge,
      true // has structural damage
    );

    // Structural minimum (10%) should override the calculated 5% salvage
    const minValue = basePrice * 0.10;
    expect(salvageValue).toBeGreaterThanOrEqual(minValue);
  });

  test('hasStructuralDamage should correctly identify structural components', () => {
    structuralComponents.forEach(component => {
      const damages = [{ component, damageLevel: 'minor' as const }];
      expect(service.hasStructuralDamage(damages)).toBe(true);
    });
  });

  test('hasStructuralDamage should be case-insensitive', () => {
    const damages = [
      { component: 'FRAME', damageLevel: 'minor' as const },
      { component: 'Body', damageLevel: 'moderate' as const },
      { component: 'CHASSIS', damageLevel: 'severe' as const },
    ];

    expect(service.hasStructuralDamage(damages)).toBe(true);
  });

  test('structural minimum should apply across all damage levels', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          basePrice: fc.float({ min: 1000000, max: 10000000, noNaN: true }),
          damageLevel: fc.constantFrom('minor', 'moderate', 'severe'),
        }),
        async ({ basePrice, damageLevel }) => {
          const damages = [
            { component: 'frame', damageLevel: damageLevel as 'minor' | 'moderate' | 'severe' },
          ];

          const hasStructural = service.hasStructuralDamage(damages);
          expect(hasStructural).toBe(true);

          // High deduction to test minimum
          const salvageValue = service.applySalvageGuidelines(
            basePrice,
            0.92, // 92% damage
            5,
            true
          );

          const minValue = basePrice * 0.10;
          expect(salvageValue).toBeGreaterThanOrEqual(minValue);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);
});
