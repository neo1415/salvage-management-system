/**
 * Unit Tests for Valuation Query Service Helper Methods
 * Feature: vehicle-valuation-database
 * 
 * **Validates: Requirements 7.1, 7.2**
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { db } from '@/lib/db';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { users } from '@/lib/db/schema/users';
import { ValuationQueryService } from '@/features/valuations/services/valuation-query.service';
import { eq } from 'drizzle-orm';

describe.sequential('Valuation Query Service - Helper Methods', () => {
  let service: ValuationQueryService;
  let testUserId: string;

  // Clean up ALL data before starting this test suite
  beforeAll(async () => {
    await db.delete(vehicleValuations);
  }, 30000);

  beforeEach(async () => {
    service = new ValuationQueryService();
    testUserId = '00000000-0000-0000-0000-000000000001';
    
    // Clean up test data BEFORE each test to ensure isolation
    await db.delete(vehicleValuations);
    
    // Insert test user if not exists
    const existingUser = await db.select().from(users).where(eq(users.id, testUserId));
    if (existingUser.length === 0) {
      await db.insert(users).values({
        id: testUserId,
        email: 'test@example.com',
        phone: '+1234567890',
        passwordHash: 'test',
        role: 'system_admin',
        fullName: 'Test User',
        dateOfBirth: new Date('1990-01-01'),
      });
    }
  }, 30000);

  afterEach(async () => {
    // Clean up test data AFTER each test as well
    await db.delete(vehicleValuations);
  }, 30000);

  describe('getAvailableYears', () => {
    test('should return empty array when no valuations exist', async () => {
      const years = await service.getAvailableYears('Toyota', 'Camry');
      expect(years).toEqual([]);
    });

    test('should return all years for a make/model', async () => {
      // Insert test data
      await db.insert(vehicleValuations).values([
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: '2000000',
          highPrice: '3000000',
          averagePrice: '2500000',
          dataSource: 'test',
          createdBy: testUserId,
        },
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          conditionCategory: 'nig_used_low',
          lowPrice: '2200000',
          highPrice: '3200000',
          averagePrice: '2700000',
          dataSource: 'test',
          createdBy: testUserId,
        },
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2019,
          conditionCategory: 'tokunbo_low',
          lowPrice: '1800000',
          highPrice: '2800000',
          averagePrice: '2300000',
          dataSource: 'test',
          createdBy: testUserId,
        },
      ]);

      const years = await service.getAvailableYears('Toyota', 'Camry');
      expect(years).toEqual([2019, 2020, 2021]); // Should be sorted
    });

    test('should return distinct years only', async () => {
      // Insert test data with duplicate years (different conditions)
      await db.insert(vehicleValuations).values([
        {
          make: 'Honda',
          model: 'Accord',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: '2000000',
          highPrice: '3000000',
          averagePrice: '2500000',
          dataSource: 'test',
          createdBy: testUserId,
        },
        {
          make: 'Honda',
          model: 'Accord',
          year: 2020,
          conditionCategory: 'tokunbo_low',
          lowPrice: '2500000',
          highPrice: '3500000',
          averagePrice: '3000000',
          dataSource: 'test',
          createdBy: testUserId,
        },
      ]);

      const years = await service.getAvailableYears('Honda', 'Accord');
      expect(years).toEqual([2020]); // Should not have duplicates
    });

    test('should not return years for different make/model', async () => {
      // Insert test data
      await db.insert(vehicleValuations).values([
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: '2000000',
          highPrice: '3000000',
          averagePrice: '2500000',
          dataSource: 'test',
          createdBy: testUserId,
        },
        {
          make: 'Honda',
          model: 'Accord',
          year: 2021,
          conditionCategory: 'nig_used_low',
          lowPrice: '2200000',
          highPrice: '3200000',
          averagePrice: '2700000',
          dataSource: 'test',
          createdBy: testUserId,
        },
      ]);

      const years = await service.getAvailableYears('Toyota', 'Camry');
      expect(years).toEqual([2020]); // Should only return Toyota Camry years
    });
  });

  describe('getAllMakes', () => {
    test('should return empty array when database is empty', async () => {
      const makes = await service.getAllMakes();
      expect(makes).toEqual([]);
    });

    test('should return all distinct makes', async () => {
      // Insert test data
      await db.insert(vehicleValuations).values([
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: '2000000',
          highPrice: '3000000',
          averagePrice: '2500000',
          dataSource: 'test',
          createdBy: testUserId,
        },
        {
          make: 'Honda',
          model: 'Accord',
          year: 2021,
          conditionCategory: 'nig_used_low',
          lowPrice: '2200000',
          highPrice: '3200000',
          averagePrice: '2700000',
          dataSource: 'test',
          createdBy: testUserId,
        },
        {
          make: 'Ford',
          model: 'Focus',
          year: 2019,
          conditionCategory: 'tokunbo_low',
          lowPrice: '1800000',
          highPrice: '2800000',
          averagePrice: '2300000',
          dataSource: 'test',
          createdBy: testUserId,
        },
      ]);

      const makes = await service.getAllMakes();
      expect(makes).toEqual(['Ford', 'Honda', 'Toyota']); // Should be sorted alphabetically
    });

    test('should return distinct makes only', async () => {
      // Insert test data with duplicate makes
      await db.insert(vehicleValuations).values([
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: '2000000',
          highPrice: '3000000',
          averagePrice: '2500000',
          dataSource: 'test',
          createdBy: testUserId,
        },
        {
          make: 'Toyota',
          model: 'Corolla',
          year: 2021,
          conditionCategory: 'nig_used_low',
          lowPrice: '1800000',
          highPrice: '2800000',
          averagePrice: '2300000',
          dataSource: 'test',
          createdBy: testUserId,
        },
      ]);

      const makes = await service.getAllMakes();
      expect(makes).toEqual(['Toyota']); // Should not have duplicates
    });
  });

  describe('getModelsForMake', () => {
    test('should return empty array when no models exist for make', async () => {
      const models = await service.getModelsForMake('Toyota');
      expect(models).toEqual([]);
    });

    test('should return all models for a specific make', async () => {
      // Insert test data
      await db.insert(vehicleValuations).values([
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: '2000000',
          highPrice: '3000000',
          averagePrice: '2500000',
          dataSource: 'test',
          createdBy: testUserId,
        },
        {
          make: 'Toyota',
          model: 'Corolla',
          year: 2021,
          conditionCategory: 'nig_used_low',
          lowPrice: '1800000',
          highPrice: '2800000',
          averagePrice: '2300000',
          dataSource: 'test',
          createdBy: testUserId,
        },
        {
          make: 'Honda',
          model: 'Accord',
          year: 2019,
          conditionCategory: 'tokunbo_low',
          lowPrice: '2200000',
          highPrice: '3200000',
          averagePrice: '2700000',
          dataSource: 'test',
          createdBy: testUserId,
        },
      ]);

      const models = await service.getModelsForMake('Toyota');
      expect(models).toEqual(['Camry', 'Corolla']); // Should be sorted alphabetically
    });

    test('should return distinct models only', async () => {
      // Insert test data with duplicate models (different years/conditions)
      await db.insert(vehicleValuations).values([
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: '2000000',
          highPrice: '3000000',
          averagePrice: '2500000',
          dataSource: 'test',
          createdBy: testUserId,
        },
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          conditionCategory: 'tokunbo_low',
          lowPrice: '2500000',
          highPrice: '3500000',
          averagePrice: '3000000',
          dataSource: 'test',
          createdBy: testUserId,
        },
      ]);

      const models = await service.getModelsForMake('Toyota');
      expect(models).toEqual(['Camry']); // Should not have duplicates
    });

    test('should not return models for different makes', async () => {
      // Insert test data
      await db.insert(vehicleValuations).values([
        {
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          conditionCategory: 'nig_used_low',
          lowPrice: '2000000',
          highPrice: '3000000',
          averagePrice: '2500000',
          dataSource: 'test',
          createdBy: testUserId,
        },
        {
          make: 'Honda',
          model: 'Accord',
          year: 2021,
          conditionCategory: 'nig_used_low',
          lowPrice: '2200000',
          highPrice: '3200000',
          averagePrice: '2700000',
          dataSource: 'test',
          createdBy: testUserId,
        },
      ]);

      const models = await service.getModelsForMake('Toyota');
      expect(models).toEqual(['Camry']); // Should only return Toyota models
    });
  });
});
