import { describe, test, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { bulkImportService } from '@/features/valuations/services/bulk-import.service';
import { db } from '@/lib/db';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq } from 'drizzle-orm';

/**
 * Feature: vehicle-valuation-database
 * Property 17: Bulk Import Upsert Behavior
 * 
 * For any import operation containing a record that matches an existing valuation
 * (same make, model, year, condition), the existing record should be updated
 * rather than creating a duplicate.
 * 
 * Validates: Requirements 8.4
 */

describe('Bulk Import Upsert Behavior', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const currentYear = new Date().getFullYear();

  afterEach(async () => {
    await db.delete(vehicleValuations).where(eq(vehicleValuations.createdBy, testUserId));
  });

  const validImportRecordArbitrary = () => fc.record({
    make: fc.stringMatching(/^[A-Za-z0-9 ]{1,50}$/),
    model: fc.stringMatching(/^[A-Za-z0-9 ]{1,50}$/),
    year: fc.integer({ min: 1990, max: currentYear + 1 }),
    conditionCategory: fc.constantFrom('nig_used_low', 'nig_used_high', 'tokunbo_low', 'tokunbo_high', 'average') as fc.Arbitrary<'nig_used_low' | 'nig_used_high' | 'tokunbo_low' | 'tokunbo_high' | 'average'>,
    lowPrice: fc.float({ min: Math.fround(100000), max: Math.fround(50000000), noNaN: true }),
    highPrice: fc.float({ min: Math.fround(100000), max: Math.fround(50000000), noNaN: true }),
    averagePrice: fc.float({ min: Math.fround(100000), max: Math.fround(50000000), noNaN: true }),
    mileageLow: fc.option(fc.integer({ min: 0, max: 999999 }), { nil: undefined }),
    mileageHigh: fc.option(fc.integer({ min: 0, max: 999999 }), { nil: undefined }),
    marketNotes: fc.option(fc.stringMatching(/^[A-Za-z0-9 .,\-]{0,500}$/), { nil: undefined }),
    dataSource: fc.stringMatching(/^[A-Za-z0-9 ]{1,50}$/),
  }).filter((v) => {
    if (v.lowPrice > v.highPrice) return false;
    if (v.mileageLow !== undefined && v.mileageHigh !== undefined && v.mileageLow > v.mileageHigh) return false;
    return true;
  });

  test('Property 17: Importing duplicate record updates instead of creating new', async () => {
    await fc.assert(
      fc.asyncProperty(
        validImportRecordArbitrary(),
        fc.float({ min: Math.fround(100000), max: Math.fround(50000000), noNaN: true }),
        async (record, newPrice) => {
          // First import
          const result1 = await bulkImportService.importValuationsFromJSON([record], testUserId);
          expect(result1.successCount).toBe(1);
          expect(result1.insertCount).toBe(1);
          expect(result1.updateCount).toBe(0);

          // Count records
          const count1 = await db.query.vehicleValuations.findMany({
            where: eq(vehicleValuations.createdBy, testUserId),
          });
          expect(count1.length).toBe(1);

          // Second import with updated price
          const updatedRecord = { ...record, averagePrice: newPrice };
          const result2 = await bulkImportService.importValuationsFromJSON([updatedRecord], testUserId);
          
          expect(result2.successCount).toBe(1);
          expect(result2.insertCount).toBe(0);
          expect(result2.updateCount).toBe(1);

          // Count should still be 1 (no duplicate)
          const count2 = await db.query.vehicleValuations.findMany({
            where: eq(vehicleValuations.createdBy, testUserId),
          });
          expect(count2.length).toBe(1);

          // Price should be updated
          expect(parseFloat(count2[0].averagePrice)).toBeCloseTo(newPrice, 2);

          // Clean up
          await db.delete(vehicleValuations).where(eq(vehicleValuations.createdBy, testUserId));
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 17: Multiple imports of same record never create duplicates', async () => {
    await fc.assert(
      fc.asyncProperty(
        validImportRecordArbitrary(),
        fc.integer({ min: 2, max: 5 }),
        async (record, importCount) => {
          // Import same record multiple times
          for (let i = 0; i < importCount; i++) {
            await bulkImportService.importValuationsFromJSON([record], testUserId);
          }

          // Should only have 1 record
          const records = await db.query.vehicleValuations.findMany({
            where: eq(vehicleValuations.createdBy, testUserId),
          });
          expect(records.length).toBe(1);

          // Clean up
          await db.delete(vehicleValuations).where(eq(vehicleValuations.createdBy, testUserId));
        }
      ),
      { numRuns: 20 }
    );
  });
});
