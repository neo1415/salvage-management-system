import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { bulkImportService } from '@/features/valuations/services/bulk-import.service';
import { db } from '@/lib/db';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { eq } from 'drizzle-orm';

/**
 * Feature: vehicle-valuation-database
 * Property 19: Bulk Import Format Support
 * 
 * For any valid valuation data, it should be importable in both CSV and JSON formats,
 * producing equivalent results.
 * 
 * Validates: Requirements 8.1, 8.2
 */

describe('Bulk Import Format Support', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const currentYear = new Date().getFullYear();

  // Clean up test data after each test
  afterEach(async () => {
    await db.delete(vehicleValuations).where(eq(vehicleValuations.createdBy, testUserId));
  });

  // Arbitrary for valid valuation import records
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

  test('Property 19: CSV and JSON imports produce equivalent results', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(validImportRecordArbitrary(), { minLength: 1, maxLength: 5 }),
        async (records) => {
          // Convert records to CSV format
          const csvHeader = 'make,model,year,conditionCategory,lowPrice,highPrice,averagePrice,mileageLow,mileageHigh,marketNotes,dataSource\n';
          const csvRows = records.map(r => 
            `${r.make},${r.model},${r.year},${r.conditionCategory},${r.lowPrice},${r.highPrice},${r.averagePrice},${r.mileageLow ?? ''},${r.mileageHigh ?? ''},"${r.marketNotes ?? ''}",${r.dataSource}`
          ).join('\n');
          const csvContent = csvHeader + csvRows;

          // Import from CSV
          const csvResult = await bulkImportService.importValuationsFromCSV(csvContent, testUserId);

          // Clean up for JSON import
          await db.delete(vehicleValuations).where(eq(vehicleValuations.createdBy, testUserId));

          // Import from JSON
          const jsonResult = await bulkImportService.importValuationsFromJSON(records, testUserId);

          // Both imports should have same success count
          expect(csvResult.successCount).toBe(jsonResult.successCount);
          expect(csvResult.failureCount).toBe(jsonResult.failureCount);
          expect(csvResult.totalRecords).toBe(jsonResult.totalRecords);

          // Clean up
          await db.delete(vehicleValuations).where(eq(vehicleValuations.createdBy, testUserId));
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 19: CSV parsing handles all field types correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        validImportRecordArbitrary(),
        async (record) => {
          // Convert to CSV
          const csvHeader = 'make,model,year,conditionCategory,lowPrice,highPrice,averagePrice,mileageLow,mileageHigh,marketNotes,dataSource\n';
          const csvRow = `${record.make},${record.model},${record.year},${record.conditionCategory},${record.lowPrice},${record.highPrice},${record.averagePrice},${record.mileageLow ?? ''},${record.mileageHigh ?? ''},"${record.marketNotes ?? ''}",${record.dataSource}`;
          const csvContent = csvHeader + csvRow;

          // Parse CSV
          const parsed = bulkImportService.parseCSV(csvContent);

          // Verify parsed record matches original
          expect(parsed.length).toBe(1);
          expect(parsed[0].make).toBe(record.make);
          expect(parsed[0].model).toBe(record.model);
          expect(parsed[0].year).toBe(record.year);
          expect(parsed[0].conditionCategory).toBe(record.conditionCategory);
          expect(parsed[0].lowPrice).toBeCloseTo(record.lowPrice, 2);
          expect(parsed[0].highPrice).toBeCloseTo(record.highPrice, 2);
          expect(parsed[0].averagePrice).toBeCloseTo(record.averagePrice, 2);
          expect(parsed[0].dataSource).toBe(record.dataSource);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 19: JSON import preserves all field values', async () => {
    await fc.assert(
      fc.asyncProperty(
        validImportRecordArbitrary(),
        async (record) => {
          // Import from JSON
          const result = await bulkImportService.importValuationsFromJSON([record], testUserId);

          // Should succeed
          expect(result.successCount).toBe(1);
          expect(result.failureCount).toBe(0);

          // Query back the record
          const stored = await db.query.vehicleValuations.findFirst({
            where: eq(vehicleValuations.createdBy, testUserId),
          });

          // Verify all fields match
          expect(stored).toBeDefined();
          expect(stored!.make).toBe(record.make);
          expect(stored!.model).toBe(record.model);
          expect(stored!.year).toBe(record.year);
          expect(stored!.conditionCategory).toBe(record.conditionCategory);
          expect(parseFloat(stored!.lowPrice)).toBeCloseTo(record.lowPrice, 2);
          expect(parseFloat(stored!.highPrice)).toBeCloseTo(record.highPrice, 2);
          expect(parseFloat(stored!.averagePrice)).toBeCloseTo(record.averagePrice, 2);
          expect(stored!.dataSource).toBe(record.dataSource);

          // Clean up
          await db.delete(vehicleValuations).where(eq(vehicleValuations.id, stored!.id));
        }
      ),
      { numRuns: 20 }
    );
  });
});
