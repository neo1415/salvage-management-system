import { describe, test, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { bulkImportService } from '@/features/valuations/services/bulk-import.service';
import { db } from '@/lib/db';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq } from 'drizzle-orm';

/**
 * Feature: vehicle-valuation-database
 * Property 18: Bulk Import Error Resilience
 * 
 * For any bulk import containing both valid and invalid records, the import should
 * process all valid records successfully and report errors for invalid records
 * without stopping the entire operation.
 * 
 * Validates: Requirements 8.3, 8.5
 */

describe('Bulk Import Error Resilience', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const currentYear = new Date().getFullYear();

  afterEach(async () => {
    await db.delete(vehicleValuations).where(eq(vehicleValuations.createdBy, testUserId));
  });

  const validRecordArbitrary = () => fc.record({
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

  test('Property 18: Valid records succeed even when invalid records fail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validRecordArbitrary(), { minLength: 2, maxLength: 5 }),
        async (validRecords) => {
          // Create invalid record (year out of range)
          const invalidRecord = {
            ...validRecords[0],
            year: 1800, // Invalid year
          };

          // Mix valid and invalid records
          const mixedRecords = [...validRecords, invalidRecord];

          // Import
          const result = await bulkImportService.importValuationsFromJSON(mixedRecords, testUserId);

          // Valid records should succeed
          expect(result.successCount).toBe(validRecords.length);
          expect(result.failureCount).toBe(1);
          expect(result.totalRecords).toBe(mixedRecords.length);

          // Errors should be reported
          expect(result.errors.length).toBe(1);
          expect(result.errors[0].error).toContain('year');

          // Valid records should be in database
          const stored = await db.query.vehicleValuations.findMany({
            where: eq(vehicleValuations.createdBy, testUserId),
          });
          expect(stored.length).toBe(validRecords.length);

          // Clean up
          await db.delete(vehicleValuations).where(eq(vehicleValuations.createdBy, testUserId));
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 18: Import continues after encountering errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        validRecordArbitrary(),
        validRecordArbitrary(),
        async (validRecord1, validRecord2) => {
          // Create records: valid, invalid, valid
          const invalidRecord = {
            ...validRecord1,
            lowPrice: -1000, // Invalid negative price
          };

          const records = [validRecord1, invalidRecord, validRecord2];

          // Import
          const result = await bulkImportService.importValuationsFromJSON(records, testUserId);

          // Both valid records should succeed
          expect(result.successCount).toBe(2);
          expect(result.failureCount).toBe(1);

          // Clean up
          await db.delete(vehicleValuations).where(eq(vehicleValuations.createdBy, testUserId));
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 18: Error details include row number and error message', async () => {
    await fc.assert(
      fc.asyncProperty(
        validRecordArbitrary(),
        async (validRecord) => {
          // Create invalid record
          const invalidRecord = {
            ...validRecord,
            conditionCategory: 'invalid_category' as any,
          };

          const records = [validRecord, invalidRecord];

          // Import
          const result = await bulkImportService.importValuationsFromJSON(records, testUserId);

          // Check error details
          expect(result.errors.length).toBe(1);
          expect(result.errors[0].row).toBe(2); // Second record (1-indexed)
          expect(result.errors[0].error).toBeTruthy();
          expect(result.errors[0].record).toBeDefined();

          // Clean up
          await db.delete(vehicleValuations).where(eq(vehicleValuations.createdBy, testUserId));
        }
      ),
      { numRuns: 20 }
    );
  });
});
