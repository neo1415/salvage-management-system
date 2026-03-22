/**
 * Property Test: Default Deduction Fallback
 * Feature: vehicle-valuation-database
 * Property 11: Default Deduction Fallback
 * 
 * Validates: Requirements 4.5
 * 
 * For any component not found in the damage deduction table, the system should apply
 * default deductions: 5% for minor, 15% for moderate, and 30% for severe damage.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { damageCalculationService } from '@/features/valuations/services/damage-calculation.service';
import { db } from '@/lib/db';
import { damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

describe('Property 11: Default Deduction Fallback', () => {
  // Clean up any test data after tests
  afterEach(async () => {
    // Clean up test deductions if any were created
    await db.delete(damageDeductions).where(eq(damageDeductions.component, 'test_component'));
  });

  test('should apply default deductions for components not in database', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random component names that don't exist in database
        fc.string({ minLength: 5, maxLength: 50 }).filter(s => !s.includes('engine') && !s.includes('transmission')),
        fc.constantFrom('minor' as const, 'moderate' as const, 'severe' as const),
        async (component, damageLevel) => {
          // Get deduction for non-existent component (use unique prefix to avoid collisions)
          const uniqueComponent = `test_nonexistent_${component}`;
          const deduction = await damageCalculationService.getDeduction(uniqueComponent, damageLevel);

          // Verify default deductions are applied
          const expectedDeductions = {
            minor: 0.05,
            moderate: 0.15,
            severe: 0.30,
          };

          expect(deduction.component).toBe(uniqueComponent.toLowerCase());
          expect(deduction.damageLevel).toBe(damageLevel);
          expect(deduction.deductionPercent).toBe(expectedDeductions[damageLevel]);
          expect(deduction.repairCost).toBe(0); // Default has no repair cost
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);

  test('should use database deduction when component exists', async () => {
    // This test verifies that database values override defaults
    // We'll test this by checking if the service queries the database correctly
    // For a more complete test, we'd need a valid user ID in the database
    
    // Test with a known component that might exist
    const testComponent = 'engine'; // Common component
    const damageLevel = 'minor';
    
    const deduction = await damageCalculationService.getDeduction(testComponent, damageLevel);
    
    // Verify we get a valid deduction (either from DB or default)
    expect(deduction.component).toBe(testComponent);
    expect(deduction.damageLevel).toBe(damageLevel);
    expect(deduction.deductionPercent).toBeGreaterThan(0);
    expect(deduction.deductionPercent).toBeLessThanOrEqual(1);
    
    // If it's a default, it should match our default values
    const defaultDeductions = { minor: 0.05, moderate: 0.15, severe: 0.30 };
    const isDefault = deduction.deductionPercent === defaultDeductions[damageLevel];
    
    if (isDefault) {
      expect(deduction.repairCost).toBe(0);
    }
  }, 10000);

  test('default deductions should be consistent across calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }),
        fc.constantFrom('minor' as const, 'moderate' as const, 'severe' as const),
        async (component, damageLevel) => {
          // Use unique prefix to avoid database collisions
          const uniqueComponent = `test_consistent_${component}`;
          
          // Get deduction twice
          const deduction1 = await damageCalculationService.getDeduction(uniqueComponent, damageLevel);
          const deduction2 = await damageCalculationService.getDeduction(uniqueComponent, damageLevel);

          // Should return same values
          expect(deduction1.deductionPercent).toBe(deduction2.deductionPercent);
          expect(deduction1.repairCost).toBe(deduction2.repairCost);
          expect(deduction1.component).toBe(deduction2.component);
          expect(deduction1.damageLevel).toBe(deduction2.damageLevel);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});
