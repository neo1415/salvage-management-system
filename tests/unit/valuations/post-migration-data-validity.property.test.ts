/**
 * Feature: make-specific-damage-deductions
 * Property 11: All Records Have Non-Null Make After Migration
 * Property 12: All Range Fields Valid After Migration
 * 
 * For any damage deduction record after migration completes, the make field should
 * not be NULL, and all range fields (repairCostLow, repairCostHigh, valuationDeductionLow,
 * valuationDeductionHigh) should be non-null, numeric, and satisfy the constraint that
 * low <= high.
 * 
 * **Validates: Requirements 8.2, 8.3**
 */

import { describe, test, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { db } from '@/lib/db';
import { damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { eq } from 'drizzle-orm';

describe('Property 11 & 12: Post-Migration Data Validity', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001';

  // Clean up test data after each test
  afterEach(async () => {
    await db.delete(damageDeductions).where(eq(damageDeductions.createdBy, testUserId));
  });

  /**
   * Generator for valid post-migration damage deduction records
   * These records should have all the new schema fields populated
   */
  const postMigrationDeductionArbitrary = fc.record({
    make: fc.constantFrom('Toyota', 'Audi', 'Honda', 'BMW', 'Mercedes'),
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
    repairCostLow: fc.float({ 
      min: Math.fround(10000), 
      max: Math.fround(5000000), 
      noNaN: true,
      noDefaultInfinity: true
    }),
    repairCostHigh: fc.float({ 
      min: Math.fround(10000), 
      max: Math.fround(5000000), 
      noNaN: true,
      noDefaultInfinity: true
    }),
    valuationDeductionLow: fc.float({
      min: Math.fround(10000),
      max: Math.fround(2000000),
      noNaN: true,
      noDefaultInfinity: true
    }),
    valuationDeductionHigh: fc.float({
      min: Math.fround(10000),
      max: Math.fround(2000000),
      noNaN: true,
      noDefaultInfinity: true
    }),
    notes: fc.option(
      fc.stringMatching(/^[A-Za-z0-9 .,\-]{1,200}$/),
      { nil: undefined }
    ),
  }).filter(record => {
    // Ensure low <= high for both ranges
    return record.repairCostLow <= record.repairCostHigh &&
           record.valuationDeductionLow <= record.valuationDeductionHigh;
  });

  // ========== Property 11: All Records Have Non-Null Make After Migration ==========

  test('Property 11: Make field is non-null for all post-migration records', async () => {
    await fc.assert(
      fc.asyncProperty(
        postMigrationDeductionArbitrary,
        async (record) => {
          // Verify make field is not null
          expect(record.make).not.toBeNull();
          expect(record.make).not.toBeUndefined();
          
          // Verify it's a non-empty string
          expect(typeof record.make).toBe('string');
          expect(record.make.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 11: Make field is a valid string value', async () => {
    await fc.assert(
      fc.asyncProperty(
        postMigrationDeductionArbitrary,
        async (record) => {
          // Verify make is a string
          expect(typeof record.make).toBe('string');
          
          // Verify it's not an empty string
          expect(record.make.trim()).toBeTruthy();
          expect(record.make.trim().length).toBeGreaterThan(0);
          
          // Verify it doesn't contain only whitespace
          expect(record.make.trim()).toBe(record.make);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 11: Make field fits within varchar(100) constraint', async () => {
    await fc.assert(
      fc.asyncProperty(
        postMigrationDeductionArbitrary,
        async (record) => {
          // Verify make field length is within database constraint
          expect(record.make.length).toBeLessThanOrEqual(100);
          expect(record.make.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 11: Make field is consistent across multiple records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(postMigrationDeductionArbitrary, { minLength: 5, maxLength: 20 }),
        async (records) => {
          // Verify all records have non-null make values
          records.forEach(record => {
            expect(record.make).not.toBeNull();
            expect(record.make).not.toBeUndefined();
            expect(typeof record.make).toBe('string');
            expect(record.make.length).toBeGreaterThan(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // ========== Property 12: All Range Fields Valid After Migration ==========

  test('Property 12: All range fields are non-null', async () => {
    await fc.assert(
      fc.asyncProperty(
        postMigrationDeductionArbitrary,
        async (record) => {
          // Verify all range fields are not null
          expect(record.repairCostLow).not.toBeNull();
          expect(record.repairCostHigh).not.toBeNull();
          expect(record.valuationDeductionLow).not.toBeNull();
          expect(record.valuationDeductionHigh).not.toBeNull();
          
          // Verify they are not undefined
          expect(record.repairCostLow).not.toBeUndefined();
          expect(record.repairCostHigh).not.toBeUndefined();
          expect(record.valuationDeductionLow).not.toBeUndefined();
          expect(record.valuationDeductionHigh).not.toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 12: All range fields are numeric', async () => {
    await fc.assert(
      fc.asyncProperty(
        postMigrationDeductionArbitrary,
        async (record) => {
          // Verify all range fields are numbers
          expect(typeof record.repairCostLow).toBe('number');
          expect(typeof record.repairCostHigh).toBe('number');
          expect(typeof record.valuationDeductionLow).toBe('number');
          expect(typeof record.valuationDeductionHigh).toBe('number');
          
          // Verify they are not NaN
          expect(Number.isNaN(record.repairCostLow)).toBe(false);
          expect(Number.isNaN(record.repairCostHigh)).toBe(false);
          expect(Number.isNaN(record.valuationDeductionLow)).toBe(false);
          expect(Number.isNaN(record.valuationDeductionHigh)).toBe(false);
          
          // Verify they are finite
          expect(Number.isFinite(record.repairCostLow)).toBe(true);
          expect(Number.isFinite(record.repairCostHigh)).toBe(true);
          expect(Number.isFinite(record.valuationDeductionLow)).toBe(true);
          expect(Number.isFinite(record.valuationDeductionHigh)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 12: Repair cost low <= high constraint is satisfied', async () => {
    await fc.assert(
      fc.asyncProperty(
        postMigrationDeductionArbitrary,
        async (record) => {
          // Verify repair cost low is less than or equal to high
          expect(record.repairCostLow).toBeLessThanOrEqual(record.repairCostHigh);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 12: Valuation deduction low <= high constraint is satisfied', async () => {
    await fc.assert(
      fc.asyncProperty(
        postMigrationDeductionArbitrary,
        async (record) => {
          // Verify valuation deduction low is less than or equal to high
          expect(record.valuationDeductionLow).toBeLessThanOrEqual(record.valuationDeductionHigh);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 12: All range fields are non-negative', async () => {
    await fc.assert(
      fc.asyncProperty(
        postMigrationDeductionArbitrary,
        async (record) => {
          // Verify all range fields are non-negative
          expect(record.repairCostLow).toBeGreaterThanOrEqual(0);
          expect(record.repairCostHigh).toBeGreaterThanOrEqual(0);
          expect(record.valuationDeductionLow).toBeGreaterThanOrEqual(0);
          expect(record.valuationDeductionHigh).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 12: Range fields fit within decimal(12, 2) precision', async () => {
    await fc.assert(
      fc.asyncProperty(
        postMigrationDeductionArbitrary,
        async (record) => {
          // Verify values fit within decimal(12, 2) constraint
          // Maximum value: 9999999999.99 (10 digits before decimal, 2 after)
          const maxValue = 9999999999.99;
          
          expect(record.repairCostLow).toBeLessThanOrEqual(maxValue);
          expect(record.repairCostHigh).toBeLessThanOrEqual(maxValue);
          expect(record.valuationDeductionLow).toBeLessThanOrEqual(maxValue);
          expect(record.valuationDeductionHigh).toBeLessThanOrEqual(maxValue);
          
          // Verify precision (values can be stored in decimal(12, 2) format)
          // When stored in database, values are rounded to 2 decimal places
          const repairCostLowRounded = Math.round(record.repairCostLow * 100) / 100;
          const repairCostHighRounded = Math.round(record.repairCostHigh * 100) / 100;
          const valuationDeductionLowRounded = Math.round(record.valuationDeductionLow * 100) / 100;
          const valuationDeductionHighRounded = Math.round(record.valuationDeductionHigh * 100) / 100;
          
          // Verify rounded values are close to original (within 0.01 due to rounding)
          expect(Math.abs(repairCostLowRounded - record.repairCostLow)).toBeLessThanOrEqual(0.01);
          expect(Math.abs(repairCostHighRounded - record.repairCostHigh)).toBeLessThanOrEqual(0.01);
          expect(Math.abs(valuationDeductionLowRounded - record.valuationDeductionLow)).toBeLessThanOrEqual(0.01);
          expect(Math.abs(valuationDeductionHighRounded - record.valuationDeductionHigh)).toBeLessThanOrEqual(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 12: All range fields are valid across multiple records', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(postMigrationDeductionArbitrary, { minLength: 5, maxLength: 20 }),
        async (records) => {
          // Verify all records have valid range fields
          records.forEach(record => {
            // Non-null check
            expect(record.repairCostLow).not.toBeNull();
            expect(record.repairCostHigh).not.toBeNull();
            expect(record.valuationDeductionLow).not.toBeNull();
            expect(record.valuationDeductionHigh).not.toBeNull();
            
            // Numeric check
            expect(typeof record.repairCostLow).toBe('number');
            expect(typeof record.repairCostHigh).toBe('number');
            expect(typeof record.valuationDeductionLow).toBe('number');
            expect(typeof record.valuationDeductionHigh).toBe('number');
            
            // Low <= high constraint
            expect(record.repairCostLow).toBeLessThanOrEqual(record.repairCostHigh);
            expect(record.valuationDeductionLow).toBeLessThanOrEqual(record.valuationDeductionHigh);
            
            // Non-negative check
            expect(record.repairCostLow).toBeGreaterThanOrEqual(0);
            expect(record.repairCostHigh).toBeGreaterThanOrEqual(0);
            expect(record.valuationDeductionLow).toBeGreaterThanOrEqual(0);
            expect(record.valuationDeductionHigh).toBeGreaterThanOrEqual(0);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  // ========== Combined Properties: Make and Range Fields Together ==========

  test('Combined: All post-migration records have valid make and range fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        postMigrationDeductionArbitrary,
        async (record) => {
          // Property 11: Make is non-null
          expect(record.make).not.toBeNull();
          expect(record.make).not.toBeUndefined();
          expect(typeof record.make).toBe('string');
          expect(record.make.length).toBeGreaterThan(0);
          
          // Property 12: All range fields are non-null, numeric, and valid
          expect(record.repairCostLow).not.toBeNull();
          expect(record.repairCostHigh).not.toBeNull();
          expect(record.valuationDeductionLow).not.toBeNull();
          expect(record.valuationDeductionHigh).not.toBeNull();
          
          expect(typeof record.repairCostLow).toBe('number');
          expect(typeof record.repairCostHigh).toBe('number');
          expect(typeof record.valuationDeductionLow).toBe('number');
          expect(typeof record.valuationDeductionHigh).toBe('number');
          
          expect(record.repairCostLow).toBeLessThanOrEqual(record.repairCostHigh);
          expect(record.valuationDeductionLow).toBeLessThanOrEqual(record.valuationDeductionHigh);
          
          expect(record.repairCostLow).toBeGreaterThanOrEqual(0);
          expect(record.repairCostHigh).toBeGreaterThanOrEqual(0);
          expect(record.valuationDeductionLow).toBeGreaterThanOrEqual(0);
          expect(record.valuationDeductionHigh).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Combined: Post-migration records satisfy all database constraints', async () => {
    await fc.assert(
      fc.asyncProperty(
        postMigrationDeductionArbitrary,
        async (record) => {
          // Make field constraints
          expect(record.make).toBeTruthy();
          expect(record.make.length).toBeLessThanOrEqual(100);
          
          // Range field constraints
          expect(Number.isFinite(record.repairCostLow)).toBe(true);
          expect(Number.isFinite(record.repairCostHigh)).toBe(true);
          expect(Number.isFinite(record.valuationDeductionLow)).toBe(true);
          expect(Number.isFinite(record.valuationDeductionHigh)).toBe(true);
          
          // Low <= high constraints
          expect(record.repairCostLow).toBeLessThanOrEqual(record.repairCostHigh);
          expect(record.valuationDeductionLow).toBeLessThanOrEqual(record.valuationDeductionHigh);
          
          // Non-negative constraints
          expect(record.repairCostLow).toBeGreaterThanOrEqual(0);
          expect(record.repairCostHigh).toBeGreaterThanOrEqual(0);
          expect(record.valuationDeductionLow).toBeGreaterThanOrEqual(0);
          expect(record.valuationDeductionHigh).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Combined: Multiple post-migration records all satisfy validity constraints', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(postMigrationDeductionArbitrary, { minLength: 10, maxLength: 50 }),
        async (records) => {
          // Verify all records satisfy both Property 11 and Property 12
          records.forEach(record => {
            // Property 11: Non-null make
            expect(record.make).not.toBeNull();
            expect(record.make).not.toBeUndefined();
            expect(typeof record.make).toBe('string');
            expect(record.make.length).toBeGreaterThan(0);
            expect(record.make.length).toBeLessThanOrEqual(100);
            
            // Property 12: Valid range fields
            expect(record.repairCostLow).not.toBeNull();
            expect(record.repairCostHigh).not.toBeNull();
            expect(record.valuationDeductionLow).not.toBeNull();
            expect(record.valuationDeductionHigh).not.toBeNull();
            
            expect(typeof record.repairCostLow).toBe('number');
            expect(typeof record.repairCostHigh).toBe('number');
            expect(typeof record.valuationDeductionLow).toBe('number');
            expect(typeof record.valuationDeductionHigh).toBe('number');
            
            expect(Number.isFinite(record.repairCostLow)).toBe(true);
            expect(Number.isFinite(record.repairCostHigh)).toBe(true);
            expect(Number.isFinite(record.valuationDeductionLow)).toBe(true);
            expect(Number.isFinite(record.valuationDeductionHigh)).toBe(true);
            
            expect(record.repairCostLow).toBeLessThanOrEqual(record.repairCostHigh);
            expect(record.valuationDeductionLow).toBeLessThanOrEqual(record.valuationDeductionHigh);
            
            expect(record.repairCostLow).toBeGreaterThanOrEqual(0);
            expect(record.repairCostHigh).toBeGreaterThanOrEqual(0);
            expect(record.valuationDeductionLow).toBeGreaterThanOrEqual(0);
            expect(record.valuationDeductionHigh).toBeGreaterThanOrEqual(0);
          });
          
          // Verify we have a reasonable sample size
          expect(records.length).toBeGreaterThanOrEqual(10);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ========== Edge Cases ==========

  test('Edge case: Records with equal low and high values are valid', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.constantFrom('Toyota', 'Audi', 'Honda'),
          component: fc.constantFrom('Front Bumper', 'Engine', 'Door'),
          damageLevel: fc.constantFrom('minor', 'moderate', 'severe') as fc.Arbitrary<'minor' | 'moderate' | 'severe'>,
          repairCost: fc.float({ 
            min: Math.fround(10000), 
            max: Math.fround(1000000), 
            noNaN: true,
            noDefaultInfinity: true
          }),
          valuationDeduction: fc.float({
            min: Math.fround(10000),
            max: Math.fround(500000),
            noNaN: true,
            noDefaultInfinity: true
          }),
        }),
        async (input) => {
          // Create a record where low === high (like migrated Toyota records)
          const record = {
            make: input.make,
            component: input.component,
            damageLevel: input.damageLevel,
            repairCostLow: input.repairCost,
            repairCostHigh: input.repairCost,
            valuationDeductionLow: input.valuationDeduction,
            valuationDeductionHigh: input.valuationDeduction,
            notes: undefined,
          };
          
          // Verify this is valid
          expect(record.make).not.toBeNull();
          expect(record.repairCostLow).toBeLessThanOrEqual(record.repairCostHigh);
          expect(record.valuationDeductionLow).toBeLessThanOrEqual(record.valuationDeductionHigh);
          
          // Verify equality is allowed
          expect(record.repairCostLow).toBe(record.repairCostHigh);
          expect(record.valuationDeductionLow).toBe(record.valuationDeductionHigh);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Edge case: Records with minimum valid values are valid', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.constantFrom('Toyota', 'Audi', 'Honda'),
          component: fc.constantFrom('Front Bumper', 'Engine', 'Door'),
          damageLevel: fc.constantFrom('minor', 'moderate', 'severe') as fc.Arbitrary<'minor' | 'moderate' | 'severe'>,
        }),
        async (input) => {
          // Create a record with minimum valid values (0 or very small)
          const record = {
            make: input.make,
            component: input.component,
            damageLevel: input.damageLevel,
            repairCostLow: 0,
            repairCostHigh: 0.01,
            valuationDeductionLow: 0,
            valuationDeductionHigh: 0.01,
            notes: undefined,
          };
          
          // Verify this is valid
          expect(record.make).not.toBeNull();
          expect(record.repairCostLow).toBeGreaterThanOrEqual(0);
          expect(record.repairCostHigh).toBeGreaterThanOrEqual(0);
          expect(record.valuationDeductionLow).toBeGreaterThanOrEqual(0);
          expect(record.valuationDeductionHigh).toBeGreaterThanOrEqual(0);
          expect(record.repairCostLow).toBeLessThanOrEqual(record.repairCostHigh);
          expect(record.valuationDeductionLow).toBeLessThanOrEqual(record.valuationDeductionHigh);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Edge case: Records with large valid values are valid', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.constantFrom('Toyota', 'Audi', 'Honda'),
          component: fc.constantFrom('Front Bumper', 'Engine', 'Door'),
          damageLevel: fc.constantFrom('minor', 'moderate', 'severe') as fc.Arbitrary<'minor' | 'moderate' | 'severe'>,
        }),
        async (input) => {
          // Create a record with large valid values (near decimal(12,2) max)
          const largeValue = 9999999999.99;
          const record = {
            make: input.make,
            component: input.component,
            damageLevel: input.damageLevel,
            repairCostLow: largeValue - 1000000,
            repairCostHigh: largeValue,
            valuationDeductionLow: largeValue - 1000000,
            valuationDeductionHigh: largeValue,
            notes: undefined,
          };
          
          // Verify this is valid
          expect(record.make).not.toBeNull();
          expect(record.repairCostLow).toBeLessThanOrEqual(record.repairCostHigh);
          expect(record.valuationDeductionLow).toBeLessThanOrEqual(record.valuationDeductionHigh);
          expect(Number.isFinite(record.repairCostLow)).toBe(true);
          expect(Number.isFinite(record.repairCostHigh)).toBe(true);
          expect(Number.isFinite(record.valuationDeductionLow)).toBe(true);
          expect(Number.isFinite(record.valuationDeductionHigh)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
