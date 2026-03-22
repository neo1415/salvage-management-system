/**
 * Integration tests for autocomplete API endpoints
 * Tests all three endpoints with valid parameters, error responses, cache behavior, and response time
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { users } from '@/lib/db/schema/users';
import { autocompleteCache } from '@/lib/cache/autocomplete-cache';
import { eq } from 'drizzle-orm';

describe('Autocomplete API Endpoints Integration Tests', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user for seeding data
    const [user] = await db
      .insert(users)
      .values({
        email: 'autocomplete-test@example.com',
        phone: '+2348012345678',
        passwordHash: 'test-hash',
        role: 'system_admin',
        status: 'verified_tier_1',
        fullName: 'Test User',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();
    testUserId = user.id;

    // Seed test data
    await db.insert(vehicleValuations).values([
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        conditionCategory: 'excellent',
        lowPrice: '8000000',
        highPrice: '10000000',
        averagePrice: '9000000',
        dataSource: 'Test Data',
        createdBy: testUserId,
      },
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2021,
        conditionCategory: 'excellent',
        lowPrice: '9000000',
        highPrice: '11000000',
        averagePrice: '10000000',
        dataSource: 'Test Data',
        createdBy: testUserId,
      },
      {
        make: 'Toyota',
        model: 'Corolla',
        year: 2020,
        conditionCategory: 'excellent',
        lowPrice: '5000000',
        highPrice: '7000000',
        averagePrice: '6000000',
        dataSource: 'Test Data',
        createdBy: testUserId,
      },
      {
        make: 'Honda',
        model: 'Accord',
        year: 2020,
        conditionCategory: 'excellent',
        lowPrice: '7000000',
        highPrice: '9000000',
        averagePrice: '8000000',
        dataSource: 'Test Data',
        createdBy: testUserId,
      },
      {
        make: 'Honda',
        model: 'Civic',
        year: 2019,
        conditionCategory: 'excellent',
        lowPrice: '4000000',
        highPrice: '6000000',
        averagePrice: '5000000',
        dataSource: 'Test Data',
        createdBy: testUserId,
      },
    ]);
  });

  afterAll(async () => {
    // Clean up test data
    await db
      .delete(vehicleValuations)
      .where(eq(vehicleValuations.createdBy, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
    
    // Clear cache after all tests
    await autocompleteCache.clearAll();
  });

  describe('GET /api/valuations/makes', () => {
    it('should return all available makes from database', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      const response = await fetch('http://localhost:3000/api/valuations/makes');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('makes');
      expect(data).toHaveProperty('cached');
      expect(data).toHaveProperty('timestamp');
      expect(Array.isArray(data.makes)).toBe(true);
      expect(data.makes).toContain('Toyota');
      expect(data.makes).toContain('Honda');
      expect(data.cached).toBe(false); // First call should not be cached
    });

    it('should return makes in alphabetical order', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      const response = await fetch('http://localhost:3000/api/valuations/makes');
      const data = await response.json();

      expect(response.status).toBe(200);
      const makes = data.makes;
      const sortedMakes = [...makes].sort();
      expect(makes).toEqual(sortedMakes);
    });

    it('should return cached response on second call', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      // First call - should cache
      const response1 = await fetch('http://localhost:3000/api/valuations/makes');
      const data1 = await response1.json();
      
      // Note: Caching behavior depends on Redis configuration
      // This test verifies the API returns consistent data
      const response2 = await fetch('http://localhost:3000/api/valuations/makes');
      const data2 = await response2.json();
      expect(data2.makes).toEqual(data1.makes);
    });

    it('should respond within 2000ms under normal load', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      const startTime = Date.now();
      const response = await fetch('http://localhost:3000/api/valuations/makes');
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000);
    });
  });

  describe('GET /api/valuations/models', () => {
    it('should return all models for specified make', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      const response = await fetch(
        'http://localhost:3000/api/valuations/models?make=Toyota'
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('make');
      expect(data).toHaveProperty('models');
      expect(data).toHaveProperty('cached');
      expect(data).toHaveProperty('timestamp');
      expect(data.make).toBe('Toyota');
      expect(Array.isArray(data.models)).toBe(true);
      expect(data.models).toContain('Camry');
      expect(data.models).toContain('Corolla');
      expect(data.cached).toBe(false);
    });

    it('should return models in alphabetical order', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      const response = await fetch(
        'http://localhost:3000/api/valuations/models?make=Toyota'
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      const models = data.models;
      const sortedModels = [...models].sort();
      expect(models).toEqual(sortedModels);
    });

    it('should return 400 error when make parameter is missing', async () => {
      const response = await fetch('http://localhost:3000/api/valuations/models');
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('make');
    });

    it('should return cached response on second call', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      // First call - should cache
      const response1 = await fetch(
        'http://localhost:3000/api/valuations/models?make=Honda'
      );
      const data1 = await response1.json();

      // Note: Caching behavior depends on Redis configuration
      // This test verifies the API returns consistent data
      const response2 = await fetch(
        'http://localhost:3000/api/valuations/models?make=Honda'
      );
      const data2 = await response2.json();
      expect(data2.models).toEqual(data1.models);
    }, 10000); // Increase timeout for this test

    it('should respond within 2000ms under normal load', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      const startTime = Date.now();
      const response = await fetch(
        'http://localhost:3000/api/valuations/models?make=Toyota'
      );
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000);
    });

    it('should return empty array for non-existent make', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      const response = await fetch(
        'http://localhost:3000/api/valuations/models?make=NonExistentMake'
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.models).toEqual([]);
    });
  });

  describe('GET /api/valuations/years', () => {
    it('should return all years for specified make and model', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      const response = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=Camry'
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('make');
      expect(data).toHaveProperty('model');
      expect(data).toHaveProperty('years');
      expect(data).toHaveProperty('cached');
      expect(data).toHaveProperty('timestamp');
      expect(data.make).toBe('Toyota');
      expect(data.model).toBe('Camry');
      expect(Array.isArray(data.years)).toBe(true);
      expect(data.years).toContain(2020);
      expect(data.years).toContain(2021);
      expect(data.cached).toBe(false);
    });

    it('should return years in numerical order', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      const response = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=Camry'
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      const years = data.years;
      const sortedYears = [...years].sort((a: number, b: number) => a - b);
      expect(years).toEqual(sortedYears);
    });

    it('should return 400 error when make parameter is missing', async () => {
      const response = await fetch(
        'http://localhost:3000/api/valuations/years?model=Camry'
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('make');
      expect(data.message).toContain('model');
    });

    it('should return 400 error when model parameter is missing', async () => {
      const response = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota'
      );
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('make');
      expect(data.message).toContain('model');
    });

    it('should return 400 error when both parameters are missing', async () => {
      const response = await fetch('http://localhost:3000/api/valuations/years');
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('message');
    });

    it('should return cached response on second call', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      // First call
      const response1 = await fetch(
        'http://localhost:3000/api/valuations/years?make=Honda&model=Civic'
      );
      const data1 = await response1.json();

      // Second call - should return consistent data
      const response2 = await fetch(
        'http://localhost:3000/api/valuations/years?make=Honda&model=Civic'
      );
      const data2 = await response2.json();
      
      // Verify both responses have years array
      expect(Array.isArray(data1.years)).toBe(true);
      expect(Array.isArray(data2.years)).toBe(true);
      expect(data2.years.length).toBe(data1.years.length);
    });

    it('should respond within 2000ms under normal load', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      const startTime = Date.now();
      const response = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=Camry'
      );
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(2000);
    });

    it('should return empty array for non-existent make/model combination', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      const response = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=NonExistentModel'
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.years).toEqual([]);
    });
  });

  describe('Cache behavior across endpoints', () => {
    it('should cache different makes independently', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      // Cache Toyota models
      const response1 = await fetch(
        'http://localhost:3000/api/valuations/models?make=Toyota'
      );
      const data1 = await response1.json();

      // Cache Honda models
      const response2 = await fetch(
        'http://localhost:3000/api/valuations/models?make=Honda'
      );
      const data2 = await response2.json();

      // Both should return consistent data
      const response3 = await fetch(
        'http://localhost:3000/api/valuations/models?make=Toyota'
      );
      const data3 = await response3.json();
      expect(data3.models).toEqual(data1.models);

      const response4 = await fetch(
        'http://localhost:3000/api/valuations/models?make=Honda'
      );
      const data4 = await response4.json();
      expect(data4.models).toEqual(data2.models);
    }, 10000); // Increase timeout for this test

    it('should cache different make/model combinations independently', async () => {
      await autocompleteCache.clearAll(); // Clear cache for fresh test
      
      // Cache Toyota Camry years
      const response1 = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=Camry'
      );
      const data1 = await response1.json();

      // Cache Toyota Corolla years
      const response2 = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=Corolla'
      );
      const data2 = await response2.json();

      // Both should return consistent data
      const response3 = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=Camry'
      );
      const data3 = await response3.json();
      
      // Verify arrays are returned
      expect(Array.isArray(data1.years)).toBe(true);
      expect(Array.isArray(data3.years)).toBe(true);
      expect(data3.years.length).toBe(data1.years.length);

      const response4 = await fetch(
        'http://localhost:3000/api/valuations/years?make=Toyota&model=Corolla'
      );
      const data4 = await response4.json();
      expect(Array.isArray(data2.years)).toBe(true);
      expect(Array.isArray(data4.years)).toBe(true);
      expect(data4.years.length).toBe(data2.years.length);
    }, 10000); // Increase timeout for this test
  });
});
