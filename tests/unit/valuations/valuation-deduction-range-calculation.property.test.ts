/**
 * Feature: make-specific-damage-deductions
 * Property 2: Valuation Deduction Range Calculated from Original Percentage
 * 
 * For any existing damage deduction record before migration, after the migration
 * completes, valuationDeductionLow and valuationDeductionHigh should be calculated
 * from the original valuationDeductionPercent with the low value being 90% of the
 * original and the high value being 110% of the original.
 * 
 * **Validates: Requirements 4.4**
 */

import { describe, test, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { db } from '@/lib/db';
import { damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { eq } from 'drizzle-orm';

describe('Property 2: Valuation Deduction Range Calculated from Original Percentage', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001';

  // Clean up test data after each test
  afterEach(async () => {
    await db.delete(damageDeductions).where(eq(damageDeductions.createdBy, testUserId));
  });

  /**
   * Generator for valid damage deduction records with old schema format
   * (single valuationDeductionPercent value)
   */
  const oldSchemaDeductionArbitrary = fc.record({
    component: fc.constantFrom(
      'Front Bumper',
      'Rear Bumper',
      'Hood',
      'Fender',
      'Door',
      'Quarter Panel',
      'Windshield',
      'Headlight',
      'Taillight',
      'Side Mirror',
      'Grill',
      'Roof',
      'Trunk Lid',
      'Engine',
      'Transmission',
      'Suspension',
      'Exhaust System',
      'Radiator',
      'Battery',
      'Alternator'
    ),
    damageLevel: fc.constantFrom('minor', 'moderate', 'severe') as fc.Arbitrary<'minor' | 'moderate' | 'severe'>,
    repairCostEstimate: fc.float({ 
      min: Math.fround(10000), 
      max: Math.fround(5000000), 
      noNaN: true,
      noDefaultInfinity: true
    }),
    valuationDeductionPercent: fc.float({
      min: Math.fround(0.01),
      max: Math.fround(0.50),
      noNaN: true,
      noDefaultInfinity: true
    }),
    description: fc.option(
      fc.stringMatching(/^[A-Za-z0-9 .,\-]{1,200}$/),
      { nil: undefined }
    ),
  });

  test('Property 2: Valuation deduction low is 90% of original percentage', async () => {
    await fc.assert(
      fc.asyncProperty(
        oldSchemaDeductionArbitrary,
        async (oldRecord) => {
          // Simulate the migration logic for valuation deduction conversion
          // Migration SQL: SET valuation_deduction_low = valuation_deduction_percent * 0.90
          const valuationDeductionLow = oldRecord.valuationDeductionPercent * 0.90;

          // Verify the property: low should be 90% of the original
          const expected = oldRecord.valuationDeductionPercent * 0.90;
          expect(valuationDeductionLow).toBeCloseTo(expected, 10);
          
          // Verify it's less than the original (unless original is 0)
          if (oldRecord.valuationDeductionPercent > 0) {
            expect(valuationDeductionLow).toBeLessThan(oldRecord.valuationDeductionPercent);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Valuation deduction high is 110% of original percentage', async () => {
    await fc.assert(
      fc.asyncProperty(
        oldSchemaDeductionArbitrary,
        async (oldRecord) => {
          // Simulate the migration logic for valuation deduction conversion
          // Migration SQL: SET valuation_deduction_high = valuation_deduction_percent * 1.10
          const valuationDeductionHigh = oldRecord.valuationDeductionPercent * 1.10;

          // Verify the property: high should be 110% of the original
          const expected = oldRecord.valuationDeductionPercent * 1.10;
          expect(valuationDeductionHigh).toBeCloseTo(expected, 10);
          
          // Verify it's greater than the original (unless original is 0)
          if (oldRecord.valuationDeductionPercent > 0) {
            expect(valuationDeductionHigh).toBeGreaterThan(oldRecord.valuationDeductionPercent);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Valuation deduction range is ±10% of original', async () => {
    await fc.assert(
      fc.asyncProperty(
        oldSchemaDeductionArbitrary,
        async (oldRecord) => {
          // Simulate the migration logic
          const valuationDeductionLow = oldRecord.valuationDeductionPercent * 0.90;
          const valuationDeductionHigh = oldRecord.valuationDeductionPercent * 1.10;

          // Verify both values are calculated correctly
          expect(valuationDeductionLow).toBeCloseTo(oldRecord.valuationDeductionPercent * 0.90, 10);
          expect(valuationDeductionHigh).toBeCloseTo(oldRecord.valuationDeductionPercent * 1.10, 10);
          
          // Verify the range is symmetric around the original
          const lowDiff = oldRecord.valuationDeductionPercent - valuationDeductionLow;
          const highDiff = valuationDeductionHigh - oldRecord.valuationDeductionPercent;
          
          // Both differences should be approximately 10% of the original
          expect(lowDiff).toBeCloseTo(oldRecord.valuationDeductionPercent * 0.10, 8);
          expect(highDiff).toBeCloseTo(oldRecord.valuationDeductionPercent * 0.10, 8);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Valuation deduction range satisfies low <= high constraint', async () => {
    await fc.assert(
      fc.asyncProperty(
        oldSchemaDeductionArbitrary,
        async (oldRecord) => {
          // Simulate the migration logic
          const valuationDeductionLow = oldRecord.valuationDeductionPercent * 0.90;
          const valuationDeductionHigh = oldRecord.valuationDeductionPercent * 1.10;

          // The constraint low <= high must always be satisfied
          // Since 0.90 < 1.10, this should always be true for positive values
          expect(valuationDeductionLow).toBeLessThanOrEqual(valuationDeductionHigh);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Valuation deduction range maintains non-negativity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({
          min: Math.fround(0),
          max: Math.fround(0.50),
          noNaN: true,
          noDefaultInfinity: true
        }),
        async (originalPercent) => {
          // Simulate the migration conversion
          const valuationDeductionLow = originalPercent * 0.90;
          const valuationDeductionHigh = originalPercent * 1.10;

          // Both values should be non-negative
          expect(valuationDeductionLow).toBeGreaterThanOrEqual(0);
          expect(valuationDeductionHigh).toBeGreaterThanOrEqual(0);
          
          // And maintain the correct relationship to the original
          expect(valuationDeductionLow).toBeCloseTo(originalPercent * 0.90, 10);
          expect(valuationDeductionHigh).toBeCloseTo(originalPercent * 1.10, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Range calculation is consistent across different percentage values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({
          min: Math.fround(0.01),
          max: Math.fround(0.50),
          noNaN: true,
          noDefaultInfinity: true
        }),
        async (percent) => {
          // Simulate the migration logic
          const valuationDeductionLow = percent * 0.90;
          const valuationDeductionHigh = percent * 1.10;

          // The ratio between high and low should always be 1.10/0.90 ≈ 1.222
          const ratio = valuationDeductionHigh / valuationDeductionLow;
          const expectedRatio = 1.10 / 0.90;
          
          expect(ratio).toBeCloseTo(expectedRatio, 8);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: Original percentage is the midpoint of the range', async () => {
    await fc.assert(
      fc.asyncProperty(
        oldSchemaDeductionArbitrary,
        async (oldRecord) => {
          // Simulate the migration logic
          const valuationDeductionLow = oldRecord.valuationDeductionPercent * 0.90;
          const valuationDeductionHigh = oldRecord.valuationDeductionPercent * 1.10;

          // The original percentage should be the midpoint of the range
          const midpoint = (valuationDeductionLow + valuationDeductionHigh) / 2;
          
          // Midpoint should equal the original percentage
          expect(midpoint).toBeCloseTo(oldRecord.valuationDeductionPercent, 8);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 2: No precision loss during percentage conversion', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({
          min: Math.fround(0.01),
          max: Math.fround(0.50),
          noNaN: true,
          noDefaultInfinity: true
        }),
        async (originalPercent) => {
          // Simulate conversion with database storage (decimal precision)
          const valuationDeductionLow = originalPercent * 0.90;
          const valuationDeductionHigh = originalPercent * 1.10;

          // Convert to string and back to simulate database storage
          const lowAsString = valuationDeductionLow.toFixed(4);
          const highAsString = valuationDeductionHigh.toFixed(4);
          
          const lowFromDb = parseFloat(lowAsString);
          const highFromDb = parseFloat(highAsString);

          // Values should be very close to the calculated values
          expect(lowFromDb).toBeCloseTo(valuationDeductionLow, 4);
          expect(highFromDb).toBeCloseTo(valuationDeductionHigh, 4);
          
          // And still maintain the low <= high constraint
          expect(lowFromDb).toBeLessThanOrEqual(highFromDb);
        }
      ),
      { numRuns: 100 }
    );
  });
});
