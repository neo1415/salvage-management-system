/**
 * Integration Test: Bulk Import API Endpoints
 * 
 * Tests the bulk import API endpoints for valuations and deductions
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { vehicleValuations, damageDeductions } from '@/lib/db/schema/vehicle-valuations';
import { eq } from 'drizzle-orm';

describe('Bulk Import API Integration Tests', () => {
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const createdValuationIds: string[] = [];
  const createdDeductionIds: string[] = [];

  afterAll(async () => {
    // Clean up test data
    for (const id of createdValuationIds) {
      await db.delete(vehicleValuations).where(eq(vehicleValuations.id, id)).catch(() => {});
    }
    for (const id of createdDeductionIds) {
      await db.delete(damageDeductions).where(eq(damageDeductions.id, id)).catch(() => {});
    }
  });

  describe('Valuation Import', () => {
    it('should import valuations from CSV format', async () => {
      const csvData = `make,model,year,conditionCategory,lowPrice,highPrice,averagePrice,dataSource
Toyota,Camry,2020,average,8000000,9000000,8500000,test
Honda,Accord,2019,average,7500000,8500000,8000000,test`;

      // Simulate bulk import service call
      const { bulkImportService } = await import('@/features/valuations/services/bulk-import.service');
      const result = await bulkImportService.importValuationsFromCSV(csvData, testUserId);

      expect(result.successCount).toBeGreaterThanOrEqual(2);
      expect(result.failureCount).toBe(0);

      // Verify data was inserted
      const inserted = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.dataSource, 'test'));

      expect(inserted.length).toBeGreaterThanOrEqual(2);
      
      // Track for cleanup
      inserted.forEach(v => createdValuationIds.push(v.id));
    });

    it('should import valuations from JSON format', async () => {
      const jsonData = [
        {
          make: 'Nissan',
          model: 'Altima',
          year: 2021,
          conditionCategory: 'average' as const,
          lowPrice: 7000000,
          highPrice: 8000000,
          averagePrice: 7500000,
          dataSource: 'test-json',
        },
      ];

      const { bulkImportService } = await import('@/features/valuations/services/bulk-import.service');
      const result = await bulkImportService.importValuationsFromJSON(jsonData, testUserId);

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);

      // Verify data was inserted
      const inserted = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.dataSource, 'test-json'));

      expect(inserted.length).toBe(1);
      expect(inserted[0].make).toBe('Nissan');
      
      createdValuationIds.push(inserted[0].id);
    });

    it('should handle mixed valid/invalid data gracefully', async () => {
      const csvData = `make,model,year,conditionCategory,lowPrice,highPrice,averagePrice,dataSource
Ford,Focus,2020,average,6000000,7000000,6500000,test-mixed
InvalidMake,Model,1899,average,1000000,2000000,1500000,test-mixed
Mazda,CX5,2022,average,9000000,10000000,9500000,test-mixed`;

      const { bulkImportService } = await import('@/features/valuations/services/bulk-import.service');
      const result = await bulkImportService.importValuationsFromCSV(csvData, testUserId);

      // Should have some successes and some failures
      expect(result.successCount).toBeGreaterThan(0);
      expect(result.failureCount).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);

      // Verify valid data was inserted
      const inserted = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.dataSource, 'test-mixed'));

      expect(inserted.length).toBe(result.successCount);
      
      inserted.forEach(v => createdValuationIds.push(v.id));
    });

    it('should upsert existing valuations', async () => {
      // First import
      const csvData1 = `make,model,year,conditionCategory,lowPrice,highPrice,averagePrice,dataSource
Subaru,Outback,2020,average,8000000,9000000,8500000,test-upsert`;

      const { bulkImportService } = await import('@/features/valuations/services/bulk-import.service');
      const result1 = await bulkImportService.importValuationsFromCSV(csvData1, testUserId);

      expect(result1.successCount).toBe(1);

      const inserted = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.dataSource, 'test-upsert'));

      createdValuationIds.push(inserted[0].id);
      const originalPrice = inserted[0].averagePrice;

      // Second import with updated price
      const csvData2 = `make,model,year,conditionCategory,lowPrice,highPrice,averagePrice,dataSource
Subaru,Outback,2020,average,8500000,9500000,9000000,test-upsert`;

      const result2 = await bulkImportService.importValuationsFromCSV(csvData2, testUserId);

      expect(result2.successCount).toBe(1);

      // Verify data was updated, not duplicated
      const updated = await db
        .select()
        .from(vehicleValuations)
        .where(eq(vehicleValuations.dataSource, 'test-upsert'));

      expect(updated.length).toBe(1);
      expect(updated[0].averagePrice).not.toBe(originalPrice);
      expect(updated[0].averagePrice).toBe('9000000');
    });
  });

  describe('Deduction Import', () => {
    it('should import deductions from CSV format', async () => {
      const csvData = `component,damageLevel,repairCostEstimate,valuationDeductionPercent,description
engine,minor,500000,0.05,Minor engine issue
transmission,moderate,1000000,0.15,Moderate transmission damage`;

      const { bulkImportService } = await import('@/features/valuations/services/bulk-import.service');
      const result = await bulkImportService.importDeductionsFromCSV(csvData, testUserId);

      expect(result.successCount).toBeGreaterThanOrEqual(2);
      expect(result.failureCount).toBe(0);

      // Verify data was inserted
      const inserted = await db
        .select()
        .from(damageDeductions)
        .where(eq(damageDeductions.description, 'Minor engine issue'));

      expect(inserted.length).toBeGreaterThanOrEqual(1);
      
      // Track for cleanup
      const allInserted = await db
        .select()
        .from(damageDeductions)
        .where(eq(damageDeductions.createdBy, testUserId));
      
      allInserted.forEach(d => createdDeductionIds.push(d.id));
    });

    it('should import deductions from JSON format', async () => {
      const jsonData = [
        {
          component: 'body',
          damageLevel: 'severe' as const,
          repairCostEstimate: 2000000,
          valuationDeductionPercent: 0.30,
          description: 'Severe body damage',
        },
      ];

      const { bulkImportService } = await import('@/features/valuations/services/bulk-import.service');
      const result = await bulkImportService.importDeductionsFromJSON(jsonData, testUserId);

      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);

      // Verify data was inserted
      const inserted = await db
        .select()
        .from(damageDeductions)
        .where(eq(damageDeductions.description, 'Severe body damage'));

      expect(inserted.length).toBe(1);
      expect(inserted[0].component).toBe('body');
      
      createdDeductionIds.push(inserted[0].id);
    });
  });
});
