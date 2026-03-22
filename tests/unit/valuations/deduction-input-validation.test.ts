import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { deductionSchema, type DeductionInput } from '@/features/valuations/validation/schemas';

/**
 * Feature: vehicle-valuation-database
 * Property 4: Damage Deduction Input Validation Correctness
 * 
 * For any damage deduction input, the validation should accept it if and only if:
 * (1) damage level is one of 'minor', 'moderate', or 'severe'
 * (2) deduction percentage is between 0 and 1
 * (3) no duplicate exists for the same component/damage level combination (handled at DB level)
 * 
 * Validates: Requirements 2.2, 2.5, 9.4, 9.5, 9.6
 */

describe('Damage Deduction Input Validation', () => {
  // Arbitrary for valid deduction inputs
  const validDeductionArbitrary = () => fc.record({
    component: fc.stringMatching(/^[A-Za-z0-9 ]{1,100}$/),
    damageLevel: fc.constantFrom('minor', 'moderate', 'severe') as fc.Arbitrary<'minor' | 'moderate' | 'severe'>,
    repairCostEstimate: fc.float({ min: Math.fround(0), max: Math.fround(10000000), noNaN: true }),
    valuationDeductionPercent: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }),
    description: fc.option(fc.stringMatching(/^[A-Za-z0-9 .,\-]{0,1000}$/), { nil: undefined }),
  });

  test('Property 4: Valid inputs should pass validation', () => {
    fc.assert(
      fc.property(
        validDeductionArbitrary(),
        (deduction) => {
          const result = deductionSchema.safeParse(deduction);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 4: Invalid damage level should fail validation', () => {
    fc.assert(
      fc.property(
        validDeductionArbitrary(),
        fc.constantFrom('invalid', 'unknown', 'critical', 'low', ''),
        (deduction, invalidLevel) => {
          const invalidDeduction = {
            ...deduction,
            damageLevel: invalidLevel as any,
          };
          const result = deductionSchema.safeParse(invalidDeduction);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => issue.path.includes('damageLevel'))).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 4: Deduction percent < 0 should fail validation', () => {
    fc.assert(
      fc.property(
        validDeductionArbitrary(),
        fc.float({ min: Math.fround(-1), max: Math.fround(-0.001), noNaN: true }),
        (deduction, invalidPercent) => {
          const invalidDeduction = {
            ...deduction,
            valuationDeductionPercent: invalidPercent,
          };
          const result = deductionSchema.safeParse(invalidDeduction);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => 
              issue.path.includes('valuationDeductionPercent') &&
              issue.message.includes('between 0 and 1')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 4: Deduction percent > 1 should fail validation', () => {
    fc.assert(
      fc.property(
        validDeductionArbitrary(),
        fc.float({ min: Math.fround(1.001), max: Math.fround(10), noNaN: true }),
        (deduction, invalidPercent) => {
          const invalidDeduction = {
            ...deduction,
            valuationDeductionPercent: invalidPercent,
          };
          const result = deductionSchema.safeParse(invalidDeduction);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => 
              issue.path.includes('valuationDeductionPercent') &&
              issue.message.includes('between 0 and 1')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 4: Negative repair cost should fail validation', () => {
    fc.assert(
      fc.property(
        validDeductionArbitrary(),
        fc.float({ min: Math.fround(-1000000), max: Math.fround(-0.01), noNaN: true }),
        (deduction, negativeCost) => {
          const invalidDeduction = {
            ...deduction,
            repairCostEstimate: negativeCost,
          };
          const result = deductionSchema.safeParse(invalidDeduction);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => 
              issue.path.includes('repairCostEstimate')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 4: Empty component should fail validation', () => {
    fc.assert(
      fc.property(
        validDeductionArbitrary(),
        (deduction) => {
          const invalidDeduction = {
            ...deduction,
            component: '',
          };
          const result = deductionSchema.safeParse(invalidDeduction);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => issue.path.includes('component'))).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 4: Component exceeding max length should fail validation', () => {
    fc.assert(
      fc.property(
        validDeductionArbitrary(),
        fc.string({ minLength: 101, maxLength: 200 }),
        (deduction, longComponent) => {
          const invalidDeduction = {
            ...deduction,
            component: longComponent,
          };
          const result = deductionSchema.safeParse(invalidDeduction);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => issue.path.includes('component'))).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 4: Description exceeding max length should fail validation', () => {
    fc.assert(
      fc.property(
        validDeductionArbitrary(),
        fc.string({ minLength: 1001, maxLength: 2000 }),
        (deduction, longDescription) => {
          const invalidDeduction = {
            ...deduction,
            description: longDescription,
          };
          const result = deductionSchema.safeParse(invalidDeduction);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => issue.path.includes('description'))).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 4: Boundary values (0 and 1) for deduction percent should pass', () => {
    fc.assert(
      fc.property(
        validDeductionArbitrary(),
        fc.constantFrom(0, 1),
        (deduction, boundaryPercent) => {
          const validDeduction = {
            ...deduction,
            valuationDeductionPercent: boundaryPercent,
          };
          const result = deductionSchema.safeParse(validDeduction);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 4: Zero repair cost should pass validation', () => {
    fc.assert(
      fc.property(
        validDeductionArbitrary(),
        (deduction) => {
          const validDeduction = {
            ...deduction,
            repairCostEstimate: 0,
          };
          const result = deductionSchema.safeParse(validDeduction);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });
});
