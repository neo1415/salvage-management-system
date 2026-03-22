import { describe, test, expect } from 'vitest';
import * as fc from 'fast-check';
import { valuationSchema, type ValuationInput } from '@/features/valuations/validation/schemas';

/**
 * Feature: vehicle-valuation-database
 * Property 3: Valuation Input Validation Correctness
 * 
 * For any valuation input, the validation should accept it if and only if:
 * (1) low price ≤ high price
 * (2) year is between 1990 and current year + 1
 * (3) mileage values are non-negative and < 1,000,000
 * (4) no duplicate exists for the same make/model/year/condition combination (handled at DB level)
 * 
 * Validates: Requirements 1.2, 9.1, 9.2, 9.3, 9.5, 9.6
 */

describe('Valuation Input Validation', () => {
  const currentYear = new Date().getFullYear();

  // Arbitrary for valid valuation inputs
  const validValuationArbitrary = () => fc.record({
    make: fc.stringMatching(/^[A-Za-z0-9 ]{1,100}$/),
    model: fc.stringMatching(/^[A-Za-z0-9 ]{1,100}$/),
    year: fc.integer({ min: 1990, max: currentYear + 1 }),
    conditionCategory: fc.constantFrom('nig_used_low', 'nig_used_high', 'tokunbo_low', 'tokunbo_high', 'average') as fc.Arbitrary<'nig_used_low' | 'nig_used_high' | 'tokunbo_low' | 'tokunbo_high' | 'average'>,
    lowPrice: fc.float({ min: Math.fround(100000), max: Math.fround(50000000), noNaN: true }),
    highPrice: fc.float({ min: Math.fround(100000), max: Math.fround(50000000), noNaN: true }),
    averagePrice: fc.float({ min: Math.fround(100000), max: Math.fround(50000000), noNaN: true }),
    mileageLow: fc.option(fc.integer({ min: 0, max: 999999 }), { nil: undefined }),
    mileageHigh: fc.option(fc.integer({ min: 0, max: 999999 }), { nil: undefined }),
    marketNotes: fc.option(fc.stringMatching(/^[A-Za-z0-9 .,\-]{0,5000}$/), { nil: undefined }),
    dataSource: fc.stringMatching(/^[A-Za-z0-9 ]{1,100}$/),
  }).filter((v) => {
    // Ensure lowPrice <= highPrice
    if (v.lowPrice > v.highPrice) {
      return false;
    }
    // Ensure mileageLow <= mileageHigh if both present
    if (v.mileageLow !== undefined && v.mileageHigh !== undefined && v.mileageLow > v.mileageHigh) {
      return false;
    }
    return true;
  });

  test('Property 3: Valid inputs should pass validation', () => {
    fc.assert(
      fc.property(
        validValuationArbitrary(),
        (valuation) => {
          const result = valuationSchema.safeParse(valuation);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 3: Invalid year (< 1990) should fail validation', () => {
    fc.assert(
      fc.property(
        validValuationArbitrary(),
        fc.integer({ min: 1900, max: 1989 }),
        (valuation, invalidYear) => {
          const invalidValuation = { ...valuation, year: invalidYear };
          const result = valuationSchema.safeParse(invalidValuation);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => issue.path.includes('year'))).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 3: Invalid year (> current year + 1) should fail validation', () => {
    fc.assert(
      fc.property(
        validValuationArbitrary(),
        fc.integer({ min: currentYear + 2, max: currentYear + 100 }),
        (valuation, invalidYear) => {
          const invalidValuation = { ...valuation, year: invalidYear };
          const result = valuationSchema.safeParse(invalidValuation);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => issue.path.includes('year'))).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 3: Low price > high price should fail validation', () => {
    fc.assert(
      fc.property(
        validValuationArbitrary(),
        (valuation) => {
          // Swap low and high prices to violate constraint
          const invalidValuation = {
            ...valuation,
            lowPrice: valuation.highPrice + 1000,
            highPrice: valuation.lowPrice,
          };
          const result = valuationSchema.safeParse(invalidValuation);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => 
              issue.message.includes('Low price must be less than or equal to high price')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 3: Mileage low > mileage high should fail validation', () => {
    fc.assert(
      fc.property(
        validValuationArbitrary(),
        fc.integer({ min: 100000, max: 999999 }),
        fc.integer({ min: 0, max: 99999 }),
        (valuation, mileageLow, mileageHigh) => {
          const invalidValuation = {
            ...valuation,
            mileageLow,
            mileageHigh,
          };
          const result = valuationSchema.safeParse(invalidValuation);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => 
              issue.message.includes('Mileage low must be less than or equal to mileage high')
            )).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 3: Mileage >= 1,000,000 should fail validation', () => {
    fc.assert(
      fc.property(
        validValuationArbitrary(),
        fc.integer({ min: 1000000, max: 10000000 }),
        (valuation, invalidMileage) => {
          const invalidValuation = {
            ...valuation,
            mileageLow: invalidMileage,
          };
          const result = valuationSchema.safeParse(invalidValuation);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => issue.path.includes('mileageLow'))).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 3: Negative mileage should fail validation', () => {
    fc.assert(
      fc.property(
        validValuationArbitrary(),
        fc.integer({ min: -1000000, max: -1 }),
        (valuation, negativeMileage) => {
          const invalidValuation = {
            ...valuation,
            mileageLow: negativeMileage,
          };
          const result = valuationSchema.safeParse(invalidValuation);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => issue.path.includes('mileageLow'))).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 3: Invalid condition category should fail validation', () => {
    fc.assert(
      fc.property(
        validValuationArbitrary(),
        fc.constantFrom('invalid', 'unknown', 'bad_condition', ''),
        (valuation, invalidCategory) => {
          const invalidValuation = {
            ...valuation,
            conditionCategory: invalidCategory as any,
          };
          const result = valuationSchema.safeParse(invalidValuation);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => issue.path.includes('conditionCategory'))).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 3: Non-positive prices should fail validation', () => {
    fc.assert(
      fc.property(
        validValuationArbitrary(),
        fc.constantFrom('lowPrice', 'highPrice', 'averagePrice'),
        fc.float({ min: -1000000, max: 0, noNaN: true }),
        (valuation, priceField, invalidPrice) => {
          const invalidValuation = {
            ...valuation,
            [priceField]: invalidPrice,
          };
          const result = valuationSchema.safeParse(invalidValuation);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error.issues.some(issue => issue.path.includes(priceField))).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
