/**
 * Feature: make-specific-damage-deductions
 * Property 5: Unique Constraint Prevents Duplicate Make-Component-Level Combinations
 * Property 6: Different Makes Allow Same Component-Level Combinations
 * 
 * Property 5: For any two damage deduction records with the same make, component,
 * and damageLevel values, attempting to insert the second record should fail with
 * a unique constraint violation.
 * 
 * Property 6: For any component and damageLevel combination, inserting records
 * with different make values should all succeed without constraint violations.
 * 
 * **Validates: Requirements 3.1, 3.2**
 */

import { describe, test, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { db } from '@/lib/db/drizzle';
import { damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { eq, and } from 'drizzle-orm';

describe('Property 5 & 6: Unique Constraint Behavior', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001';

  // Clean up test data after each test
  afterEach(async () => {
    await db.delete(damageDeductions).where(eq(damageDeductions.createdBy, testUserId));
  });

  /**
   * Generator for valid damage deduction records with new schema format
   */
  const damageDeductionArbitrary = fc.record({
    make: fc.constantFrom('Toyota', 'Audi', 'Honda', 'BMW', 'Mercedes', 'Ford', 'Nissan'),
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
      max: Math.fround(3000000), 
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
      min: Math.fround(5000),
      max: Math.fround(1000000),
      noNaN: true,
      noDefaultInfinity: true
    }),
    valuationDeductionHigh: fc.float({
      min: Math.fround(5000),
      max: Math.fround(2000000),
      noNaN: true,
      noDefaultInfinity: true
    }),
    notes: fc.option(
      fc.stringMatching(/^[A-Za-z0-9 .,\-]{1,200}$/),
      { nil: undefined }
    ),
  }).map(record => ({
    ...record,
    // Ensure low <= high for repair costs
    repairCostLow: Math.min(record.repairCostLow, record.repairCostHigh),
    repairCostHigh: Math.max(record.repairCostLow, record.repairCostHigh),
    // Ensure low <= high for valuation deductions
    valuationDeductionLow: Math.min(record.valuationDeductionLow, record.valuationDeductionHigh),
    valuationDeductionHigh: Math.max(record.valuationDeductionLow, record.valuationDeductionHigh),
  }));

  test('Property 5: Duplicate make-component-level combination fails with unique constraint violation', async () => {
    await fc.assert(
      fc.asyncProperty(
        damageDeductionArbitrary,
        async (record) => {
          // Insert the first record
          const [firstRecord] = await db.insert(damageDeductions).values({
            make: record.make,
            component: record.component,
            damageLevel: record.damageLevel,
            repairCostLow: record.repairCostLow.toString(),
            repairCostHigh: record.repairCostHigh.toString(),
            valuationDeductionLow: record.valuationDeductionLow.toString(),
            valuationDeductionHigh: record.valuationDeductionHigh.toString(),
            notes: record.notes,
            createdBy: testUserId,
          }).returning();

          expect(firstRecord).toBeDefined();
          expect(firstRecord.make).toBe(record.make);
          expect(firstRecord.component).toBe(record.component);
          expect(firstRecord.damageLevel).toBe(record.damageLevel);

          // Attempt to insert a duplicate record with the same make, component, and damageLevel
          // but different repair costs and notes
          let duplicateInsertFailed = false;
          let errorMessage = '';

          try {
            await db.insert(damageDeductions).values({
              make: record.make, // Same make
              component: record.component, // Same component
              damageLevel: record.damageLevel, // Same damage level
              repairCostLow: (record.repairCostLow * 1.5).toString(), // Different values
              repairCostHigh: (record.repairCostHigh * 1.5).toString(),
              valuationDeductionLow: (record.valuationDeductionLow * 1.2).toString(),
              valuationDeductionHigh: (record.valuationDeductionHigh * 1.2).toString(),
              notes: 'Different notes for duplicate test',
              createdBy: testUserId,
            });
          } catch (error: any) {
            duplicateInsertFailed = true;
            errorMessage = error.message || '';
          }

          // Verify that the duplicate insert failed
          expect(duplicateInsertFailed).toBe(true);
          
          // Verify the error is related to unique constraint
          expect(errorMessage.toLowerCase()).toMatch(/unique|duplicate|constraint/);

          // Verify only one record exists with this combination
          const existingRecords = await db
            .select()
            .from(damageDeductions)
            .where(
              and(
                eq(damageDeductions.make, record.make),
                eq(damageDeductions.component, record.component),
                eq(damageDeductions.damageLevel, record.damageLevel),
                eq(damageDeductions.createdBy, testUserId)
              )
            );

          expect(existingRecords).toHaveLength(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 6: Different makes allow same component-level combinations', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          component: fc.constantFrom(
            'Front Bumper',
            'Rear Bumper',
            'Hood',
            'Engine',
            'Transmission'
          ),
          damageLevel: fc.constantFrom('minor', 'moderate', 'severe') as fc.Arbitrary<'minor' | 'moderate' | 'severe'>,
          makes: fc.shuffledSubarray(
            ['Toyota', 'Audi', 'Honda', 'BMW', 'Mercedes'],
            { minLength: 2, maxLength: 5 }
          ),
          repairCostLow: fc.float({ 
            min: Math.fround(10000), 
            max: Math.fround(3000000), 
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
            min: Math.fround(5000),
            max: Math.fround(1000000),
            noNaN: true,
            noDefaultInfinity: true
          }),
          valuationDeductionHigh: fc.float({
            min: Math.fround(5000),
            max: Math.fround(2000000),
            noNaN: true,
            noDefaultInfinity: true
          }),
        }).map(record => ({
          ...record,
          repairCostLow: Math.min(record.repairCostLow, record.repairCostHigh),
          repairCostHigh: Math.max(record.repairCostLow, record.repairCostHigh),
          valuationDeductionLow: Math.min(record.valuationDeductionLow, record.valuationDeductionHigh),
          valuationDeductionHigh: Math.max(record.valuationDeductionLow, record.valuationDeductionHigh),
        })),
        async (record) => {
          const insertedRecords = [];

          // Insert records for each make with the same component and damage level
          for (const make of record.makes) {
            const [inserted] = await db.insert(damageDeductions).values({
              make: make,
              component: record.component,
              damageLevel: record.damageLevel,
              repairCostLow: record.repairCostLow.toString(),
              repairCostHigh: record.repairCostHigh.toString(),
              valuationDeductionLow: record.valuationDeductionLow.toString(),
              valuationDeductionHigh: record.valuationDeductionHigh.toString(),
              notes: `${make} specific deduction for ${record.component}`,
              createdBy: testUserId,
            }).returning();

            insertedRecords.push(inserted);
          }

          // Verify all inserts succeeded
          expect(insertedRecords).toHaveLength(record.makes.length);

          // Verify each record has the correct make
          for (let i = 0; i < record.makes.length; i++) {
            expect(insertedRecords[i].make).toBe(record.makes[i]);
            expect(insertedRecords[i].component).toBe(record.component);
            expect(insertedRecords[i].damageLevel).toBe(record.damageLevel);
          }

          // Verify all records exist in the database
          const allRecords = await db
            .select()
            .from(damageDeductions)
            .where(
              and(
                eq(damageDeductions.component, record.component),
                eq(damageDeductions.damageLevel, record.damageLevel),
                eq(damageDeductions.createdBy, testUserId)
              )
            );

          expect(allRecords).toHaveLength(record.makes.length);

          // Verify each make is represented exactly once
          const makeSet = new Set(allRecords.map(r => r.make));
          expect(makeSet.size).toBe(record.makes.length);
          
          for (const make of record.makes) {
            expect(makeSet.has(make)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 5: Constraint violation occurs regardless of other field differences', async () => {
    await fc.assert(
      fc.asyncProperty(
        damageDeductionArbitrary,
        fc.float({ min: Math.fround(1.1), max: Math.fround(3.0), noNaN: true, noDefaultInfinity: true }),
        async (record, multiplier) => {
          // Insert the first record
          await db.insert(damageDeductions).values({
            make: record.make,
            component: record.component,
            damageLevel: record.damageLevel,
            repairCostLow: record.repairCostLow.toString(),
            repairCostHigh: record.repairCostHigh.toString(),
            valuationDeductionLow: record.valuationDeductionLow.toString(),
            valuationDeductionHigh: record.valuationDeductionHigh.toString(),
            notes: record.notes,
            createdBy: testUserId,
          });

          // Try to insert with same make/component/level but ALL other fields different
          let constraintViolated = false;

          try {
            await db.insert(damageDeductions).values({
              make: record.make, // Same
              component: record.component, // Same
              damageLevel: record.damageLevel, // Same
              repairCostLow: (record.repairCostLow * multiplier).toString(), // Different
              repairCostHigh: (record.repairCostHigh * multiplier).toString(), // Different
              valuationDeductionLow: (record.valuationDeductionLow * multiplier).toString(), // Different
              valuationDeductionHigh: (record.valuationDeductionHigh * multiplier).toString(), // Different
              notes: `Completely different notes ${Math.random()}`, // Different
              createdBy: testUserId,
            });
          } catch (error) {
            constraintViolated = true;
          }

          // The unique constraint should prevent insertion even when other fields differ
          expect(constraintViolated).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 6: Same component-level across all makes succeeds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          component: fc.constantFrom('Front Bumper', 'Engine', 'Hood'),
          damageLevel: fc.constantFrom('minor', 'moderate', 'severe') as fc.Arbitrary<'minor' | 'moderate' | 'severe'>,
          repairCostLow: fc.float({ 
            min: Math.fround(10000), 
            max: Math.fround(3000000), 
            noNaN: true,
            noDefaultInfinity: true
          }),
          repairCostHigh: fc.float({ 
            min: Math.fround(10000), 
            max: Math.fround(5000000), 
            noNaN: true,
            noDefaultInfinity: true
          }),
        }).map(record => ({
          ...record,
          repairCostLow: Math.min(record.repairCostLow, record.repairCostHigh),
          repairCostHigh: Math.max(record.repairCostLow, record.repairCostHigh),
        })),
        async (record) => {
          const allMakes = ['Toyota', 'Audi', 'Honda', 'BMW', 'Mercedes', 'Ford', 'Nissan'];
          const insertedCount = [];

          // Insert the same component-level combination for all makes
          for (const make of allMakes) {
            const [inserted] = await db.insert(damageDeductions).values({
              make: make,
              component: record.component,
              damageLevel: record.damageLevel,
              repairCostLow: record.repairCostLow.toString(),
              repairCostHigh: record.repairCostHigh.toString(),
              valuationDeductionLow: '50000',
              valuationDeductionHigh: '100000',
              notes: `${make} specific`,
              createdBy: testUserId,
            }).returning();

            insertedCount.push(inserted);
          }

          // All inserts should succeed
          expect(insertedCount).toHaveLength(allMakes.length);

          // Verify all records are in the database
          const allRecords = await db
            .select()
            .from(damageDeductions)
            .where(
              and(
                eq(damageDeductions.component, record.component),
                eq(damageDeductions.damageLevel, record.damageLevel),
                eq(damageDeductions.createdBy, testUserId)
              )
            );

          expect(allRecords).toHaveLength(allMakes.length);

          // Verify each make appears exactly once
          const makeCounts = new Map<string, number>();
          for (const rec of allRecords) {
            makeCounts.set(rec.make!, (makeCounts.get(rec.make!) || 0) + 1);
          }

          for (const make of allMakes) {
            expect(makeCounts.get(make)).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 5 & 6: Unique constraint is specifically on (make, component, damageLevel)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make1: fc.constantFrom('Toyota', 'Audi', 'Honda'),
          make2: fc.constantFrom('BMW', 'Mercedes', 'Ford'),
          component: fc.constantFrom('Front Bumper', 'Engine', 'Hood'),
          damageLevel: fc.constantFrom('minor', 'moderate', 'severe') as fc.Arbitrary<'minor' | 'moderate' | 'severe'>,
          repairCostLow: fc.float({ 
            min: Math.fround(10000), 
            max: Math.fround(3000000), 
            noNaN: true,
            noDefaultInfinity: true
          }),
          repairCostHigh: fc.float({ 
            min: Math.fround(10000), 
            max: Math.fround(5000000), 
            noNaN: true,
            noDefaultInfinity: true
          }),
        }).map(record => ({
          ...record,
          repairCostLow: Math.min(record.repairCostLow, record.repairCostHigh),
          repairCostHigh: Math.max(record.repairCostLow, record.repairCostHigh),
        })),
        async (record) => {
          // Insert record for make1
          const [record1] = await db.insert(damageDeductions).values({
            make: record.make1,
            component: record.component,
            damageLevel: record.damageLevel,
            repairCostLow: record.repairCostLow.toString(),
            repairCostHigh: record.repairCostHigh.toString(),
            valuationDeductionLow: '50000',
            valuationDeductionHigh: '100000',
            notes: 'First make',
            createdBy: testUserId,
          }).returning();

          expect(record1).toBeDefined();

          // Insert same component-level for make2 should succeed (Property 6)
          const [record2] = await db.insert(damageDeductions).values({
            make: record.make2,
            component: record.component,
            damageLevel: record.damageLevel,
            repairCostLow: record.repairCostLow.toString(),
            repairCostHigh: record.repairCostHigh.toString(),
            valuationDeductionLow: '50000',
            valuationDeductionHigh: '100000',
            notes: 'Second make',
            createdBy: testUserId,
          }).returning();

          expect(record2).toBeDefined();
          expect(record2.make).toBe(record.make2);

          // Try to insert duplicate for make1 should fail (Property 5)
          let duplicateFailed = false;
          try {
            await db.insert(damageDeductions).values({
              make: record.make1,
              component: record.component,
              damageLevel: record.damageLevel,
              repairCostLow: (record.repairCostLow * 2).toString(),
              repairCostHigh: (record.repairCostHigh * 2).toString(),
              valuationDeductionLow: '75000',
              valuationDeductionHigh: '150000',
              notes: 'Duplicate attempt',
              createdBy: testUserId,
            });
          } catch (error) {
            duplicateFailed = true;
          }

          expect(duplicateFailed).toBe(true);

          // Verify exactly 2 records exist (one for each make)
          const allRecords = await db
            .select()
            .from(damageDeductions)
            .where(
              and(
                eq(damageDeductions.component, record.component),
                eq(damageDeductions.damageLevel, record.damageLevel),
                eq(damageDeductions.createdBy, testUserId)
              )
            );

          expect(allRecords).toHaveLength(2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
