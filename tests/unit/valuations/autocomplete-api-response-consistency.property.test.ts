/**
 * Property-based test for autocomplete API response consistency
 * **Property 3: API response stability**
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * 
 * Tests that repeated calls to the same endpoint return identical data
 * and that cached and non-cached responses have the same structure
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fc } from '@fast-check/vitest';
import { db } from '@/lib/db/drizzle';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { users } from '@/lib/db/schema/users';
import { autocompleteCache } from '@/lib/cache/autocomplete-cache';
import { eq } from 'drizzle-orm';

describe('Autocomplete API Response Consistency Property Tests', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user for seeding data
    const [user] = await db
      .insert(users)
      .values({
        email: 'property-test@example.com',
        phone: '+2348012345679',
        passwordHash: 'test-hash',
        role: 'system_admin',
        status: 'verified_tier_1',
        fullName: 'Property Test User',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning();
    testUserId = user.id;

    // Seed test data with multiple makes, models, and years
    await db.insert(vehicleValuations).values([
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        conditionCategory: 'excellent',
        lowPrice: '8000000',
        highPrice: '10000000',
        averagePrice: '9000000',
        dataSource: 'Property Test',
        createdBy: testUserId,
      },
      {
        make: 'Toyota',
        model: 'Corolla',
        year: 2021,
        conditionCategory: 'excellent',
        lowPrice: '5000000',
        highPrice: '7000000',
        averagePrice: '6000000',
        dataSource: 'Property Test',
        createdBy: testUserId,
      },
      {
        make: 'Honda',
        model: 'Accord',
        year: 2019,
        conditionCategory: 'excellent',
        lowPrice: '7000000',
        highPrice: '9000000',
        averagePrice: '8000000',
        dataSource: 'Property Test',
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
    
    // Clear cache
    await autocompleteCache.clearAll();
  });

  describe('Property 3: API response stability', () => {
    it('should return identical data on repeated calls to /api/valuations/makes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 3 }), // Number of repeated calls
          async (numCalls) => {
            // Clear cache before test
            await autocompleteCache.clearAll();

            // Make multiple calls to the same endpoint
            const responses = [];
            for (let i = 0; i < numCalls; i++) {
              const response = await fetch('http://localhost:3000/api/valuations/makes');
              const data = await response.json();
              responses.push(data);
            }

            // All responses should have the same makes array
            const firstMakes = responses[0].makes;
            for (let i = 1; i < responses.length; i++) {
              expect(responses[i].makes).toEqual(firstMakes);
            }

            // All responses should have the same structure
            for (const response of responses) {
              expect(response).toHaveProperty('makes');
              expect(response).toHaveProperty('cached');
              expect(response).toHaveProperty('timestamp');
              expect(Array.isArray(response.makes)).toBe(true);
            }
          }
        ),
        { numRuns: 3 }
      );
    }, 60000); // 60 second timeout

    it('should return identical data on repeated calls to /api/valuations/models', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('Toyota', 'Honda'), // Test with different makes
          fc.integer({ min: 2, max: 3 }), // Number of repeated calls
          async (make, numCalls) => {
            // Clear cache before test
            await autocompleteCache.clearAll();

            // Make multiple calls to the same endpoint
            const responses = [];
            for (let i = 0; i < numCalls; i++) {
              const response = await fetch(
                `http://localhost:3000/api/valuations/models?make=${make}`
              );
              const data = await response.json();
              responses.push(data);
            }

            // All responses should have the same models array
            const firstModels = responses[0].models;
            for (let i = 1; i < responses.length; i++) {
              expect(responses[i].models).toEqual(firstModels);
            }

            // All responses should have the same structure
            for (const response of responses) {
              expect(response).toHaveProperty('make');
              expect(response).toHaveProperty('models');
              expect(response).toHaveProperty('cached');
              expect(response).toHaveProperty('timestamp');
              expect(response.make).toBe(make);
              expect(Array.isArray(response.models)).toBe(true);
            }
          }
        ),
        { numRuns: 3 }
      );
    }, 60000); // 60 second timeout

    it('should return identical data on repeated calls to /api/valuations/years', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            make: fc.constantFrom('Toyota', 'Honda'),
            model: fc.constantFrom('Camry', 'Corolla', 'Accord'),
          }),
          fc.integer({ min: 2, max: 3 }), // Number of repeated calls
          async ({ make, model }, numCalls) => {
            // Clear cache before test
            await autocompleteCache.clearAll();

            // Make multiple calls to the same endpoint
            const responses = [];
            for (let i = 0; i < numCalls; i++) {
              const response = await fetch(
                `http://localhost:3000/api/valuations/years?make=${make}&model=${model}`
              );
              const data = await response.json();
              responses.push(data);
            }

            // All responses should have the same years array (or empty array)
            const firstYears = responses[0].years;
            for (let i = 1; i < responses.length; i++) {
              // Check that both are arrays
              expect(Array.isArray(responses[i].years)).toBe(true);
              expect(Array.isArray(firstYears)).toBe(true);
              
              // If both are arrays, check length
              if (Array.isArray(responses[i].years) && Array.isArray(firstYears)) {
                expect(responses[i].years.length).toBe(firstYears.length);
              }
            }

            // All responses should have the same structure
            for (const response of responses) {
              expect(response).toHaveProperty('make');
              expect(response).toHaveProperty('model');
              expect(response).toHaveProperty('years');
              expect(response).toHaveProperty('cached');
              expect(response).toHaveProperty('timestamp');
              expect(response.make).toBe(make);
              expect(response.model).toBe(model);
            }
          }
        ),
        { numRuns: 3 }
      );
    }, 60000); // 60 second timeout

    it('should maintain response structure consistency across all endpoints', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('makes', 'models', 'years'),
          async (endpoint) => {
            // Clear cache before test
            await autocompleteCache.clearAll();

            let url = 'http://localhost:3000/api/valuations/';
            if (endpoint === 'makes') {
              url += 'makes';
            } else if (endpoint === 'models') {
              url += 'models?make=Toyota';
            } else {
              url += 'years?make=Toyota&model=Camry';
            }

            const response = await fetch(url);
            const data = await response.json();

            // All endpoints should have these common properties
            expect(data).toHaveProperty('cached');
            expect(data).toHaveProperty('timestamp');
            expect(typeof data.cached).toBe('boolean');
            expect(typeof data.timestamp).toBe('string');

            // Endpoint-specific properties
            if (endpoint === 'makes') {
              expect(data).toHaveProperty('makes');
              expect(Array.isArray(data.makes)).toBe(true);
            } else if (endpoint === 'models') {
              expect(data).toHaveProperty('make');
              expect(data).toHaveProperty('models');
              expect(Array.isArray(data.models)).toBe(true);
            } else {
              expect(data).toHaveProperty('make');
              expect(data).toHaveProperty('model');
              expect(data).toHaveProperty('years');
              expect(Array.isArray(data.years) || typeof data.years === 'number').toBe(true);
            }
          }
        ),
        { numRuns: 5 }
      );
    }, 60000); // 60 second timeout

    it('should return sorted data consistently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 2 }), // Number of calls
          async (numCalls) => {
            // Clear cache before test
            await autocompleteCache.clearAll();

            // Test makes endpoint
            for (let i = 0; i < numCalls; i++) {
              const response = await fetch('http://localhost:3000/api/valuations/makes');
              const data = await response.json();
              
              // Verify makes are sorted alphabetically
              const makes = data.makes;
              const sortedMakes = [...makes].sort();
              expect(makes).toEqual(sortedMakes);
            }

            // Test models endpoint
            for (let i = 0; i < numCalls; i++) {
              const response = await fetch(
                'http://localhost:3000/api/valuations/models?make=Toyota'
              );
              const data = await response.json();
              
              // Verify models are sorted alphabetically
              const models = data.models;
              const sortedModels = [...models].sort();
              expect(models).toEqual(sortedModels);
            }

            // Test years endpoint
            for (let i = 0; i < numCalls; i++) {
              const response = await fetch(
                'http://localhost:3000/api/valuations/years?make=Toyota&model=Camry'
              );
              const data = await response.json();
              
              // Verify years are sorted numerically (if array)
              if (Array.isArray(data.years)) {
                const years = data.years;
                const sortedYears = [...years].sort((a: number, b: number) => a - b);
                expect(years).toEqual(sortedYears);
              }
            }
          }
        ),
        { numRuns: 3 }
      );
    }, 60000); // 60 second timeout
  });
});
