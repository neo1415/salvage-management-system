/**
 * Property-Based Tests for Valuation Query Service
 * Feature: vehicle-valuation-database
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6**
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { db } from '@/lib/db';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { users } from '@/lib/db/schema/users';
import { ValuationQueryService } from '@/features/valuations/services/valuation-query.service';
import { eq, and } from 'drizzle-orm';

describe.sequential('Valuation Query Service - Property Tests', () => {
  let service: ValuationQueryService;
  let testUserId: string;

  // Clean up ALL data before starting this test suite
  beforeAll(async () => {
    await db.delete(vehicleValuations);
  }, 30000);

  beforeEach(async () => {
    service = new ValuationQueryService();
    // Create a test user for foreign key constraint
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
  }, 30000); // 30 second timeout for beforeEach hook

  afterEach(async () => {
    // Clean up test data AFTER each test as well
    await db.delete(vehicleValuations);
    // Don't delete the test user as it might be used by other tests
  }, 30000); // 30 second timeout for afterEach hook

  /**
   * Property 5: Query Filtering Completeness
   * For any set of stored valuations and any query parameters (make, model, year, condition),
   * the query results should include all and only those valuations that match the specified parameters.
   */
  test('Property 5: Query returns exact matches when they exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.constantFrom('Toyota', 'Honda', 'Ford', 'BMW', 'Audi', 'Mercedes'),
          model: fc.constantFrom('Camry', 'Accord', 'Focus', 'X5', 'A4', 'C-Class'),
          year: fc.integer({ min: 2010, max: 2024 }),
          conditionCategory: fc.constantFrom('nig_used_low', 'nig_used_high', 'tokunbo_low', 'tokunbo_high', 'average'),
          lowPrice: fc.float({ min: 1000000, max: 5000000, noNaN: true }),
          highPrice: fc.float({ min: 5000001, max: 10000000, noNaN: true }),
          averagePrice: fc.float({ min: 3000000, max: 7000000, noNaN: true }),
        }),
        async (valuation) => {
          // Delete any existing record with the same make/model/year/condition to avoid unique constraint violation
          await db.delete(vehicleValuations).where(
            and(
              eq(vehicleValuations.make, valuation.make),
              eq(vehicleValuations.model, valuation.model),
              eq(vehicleValuations.year, valuation.year),
              eq(vehicleValuations.conditionCategory, valuation.conditionCategory)
            )
          );
          
          // Store the valuation
          await db.insert(vehicleValuations).values({
            make: valuation.make,
            model: valuation.model,
            year: valuation.year,
            conditionCategory: valuation.conditionCategory,
            lowPrice: valuation.lowPrice.toFixed(2),
            highPrice: valuation.highPrice.toFixed(2),
            averagePrice: valuation.averagePrice.toFixed(2),
            dataSource: 'test',
            createdBy: testUserId,
          });

          // Query it back
          const result = await service.queryValuation({
            make: valuation.make,
            model: valuation.model,
            year: valuation.year,
            conditionCategory: valuation.conditionCategory,
          });

          // Should find it
          expect(result.found).toBe(true);
          expect(result.source).toBe('database');
          expect(result.valuation).toBeDefined();
          expect(result.valuation?.conditionCategory).toBe(valuation.conditionCategory);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000); // 60 second timeout for property tests

  /**
   * Property 6: Fuzzy Year Matching
   * For any make and model with stored valuations, when querying for a year that doesn't exist exactly,
   * the system should return the valuation for the closest year within ±2 years, or null if no year is within that range.
   */
  test('Property 6: Fuzzy year matching returns closest year within ±2 years', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.constantFrom('Nissan', 'Mazda', 'Volkswagen'),
          model: fc.constantFrom('Altima', 'CX-5', 'Jetta'),
          storedYear: fc.integer({ min: 2010, max: 2020 }),
          queryYearOffset: fc.integer({ min: -2, max: 2 }),
          conditionCategory: fc.constantFrom('nig_used_low', 'tokunbo_low'),
          lowPrice: fc.float({ min: 1000000, max: 5000000, noNaN: true }),
          highPrice: fc.float({ min: 5000001, max: 10000000, noNaN: true }),
          averagePrice: fc.float({ min: 3000000, max: 7000000, noNaN: true }),
        }),
        async (data) => {
          const { make, model, storedYear, queryYearOffset, conditionCategory } = data;
          const queryYear = storedYear + queryYearOffset;

          // Delete any existing record with the same make/model/year/condition to avoid unique constraint violation
          await db.delete(vehicleValuations).where(
            and(
              eq(vehicleValuations.make, make),
              eq(vehicleValuations.model, model),
              eq(vehicleValuations.year, storedYear),
              eq(vehicleValuations.conditionCategory, conditionCategory)
            )
          );

          // Store valuation for storedYear
          await db.insert(vehicleValuations).values({
            make,
            model,
            year: storedYear,
            conditionCategory,
            lowPrice: data.lowPrice.toFixed(2),
            highPrice: data.highPrice.toFixed(2),
            averagePrice: data.averagePrice.toFixed(2),
            dataSource: 'test',
            createdBy: testUserId,
          });

          // Query for a different year within ±2 range
          const result = await service.queryValuation({
            make,
            model,
            year: queryYear,
            conditionCategory,
          });

          // Should find it since it's within ±2 years
          expect(result.found).toBe(true);
          expect(result.source).toBe('database');
          expect(result.valuation).toBeDefined();
        }
      ),
      { numRuns: 20 }
    );
  }, 60000); // 60 second timeout for property tests

  /**
   * Property 6 (continued): Fuzzy year matching returns not_found when outside ±2 years
   */
  test('Property 6: Fuzzy year matching returns not_found when outside ±2 years', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.constantFrom('Hyundai', 'Kia', 'Subaru'),
          model: fc.constantFrom('Elantra', 'Sportage', 'Outback'),
          storedYear: fc.integer({ min: 2010, max: 2015 }),
          queryYearOffset: fc.integer({ min: 3, max: 10 }), // Outside ±2 range
          conditionCategory: fc.constantFrom('nig_used_low', 'tokunbo_low'),
          lowPrice: fc.float({ min: 1000000, max: 5000000, noNaN: true }),
          highPrice: fc.float({ min: 5000001, max: 10000000, noNaN: true }),
          averagePrice: fc.float({ min: 3000000, max: 7000000, noNaN: true }),
        }),
        async (data) => {
          const { make, model, storedYear, queryYearOffset, conditionCategory } = data;
          const queryYear = storedYear + queryYearOffset;

          // Delete ALL existing records with the same make/model to ensure clean state
          await db.delete(vehicleValuations).where(
            and(
              eq(vehicleValuations.make, make),
              eq(vehicleValuations.model, model)
            )
          );

          // Store valuation for storedYear only
          await db.insert(vehicleValuations).values({
            make,
            model,
            year: storedYear,
            conditionCategory,
            lowPrice: data.lowPrice.toFixed(2),
            highPrice: data.highPrice.toFixed(2),
            averagePrice: data.averagePrice.toFixed(2),
            dataSource: 'test',
            createdBy: testUserId,
          });

          // Query for a year outside ±2 range
          const result = await service.queryValuation({
            make,
            model,
            year: queryYear,
            conditionCategory,
          });

          // Should not find it since it's outside ±2 years
          expect(result.found).toBe(false);
          expect(result.source).toBe('not_found');
        }
      ),
      { numRuns: 20 }
    );
  }, 60000); // 60 second timeout for property tests

  /**
   * Property 5 (continued): Query filtering by condition category
   */
  test('Property 5: Query filters by condition category when specified', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.constantFrom('Lexus', 'Infiniti'),
          model: fc.constantFrom('RX', 'Q50'),
          year: fc.integer({ min: 2015, max: 2024 }),
          targetCondition: fc.constantFrom('nig_used_low', 'tokunbo_low'),
          otherCondition: fc.constantFrom('nig_used_high', 'tokunbo_high'),
          lowPrice: fc.float({ min: 1000000, max: 5000000, noNaN: true }),
          highPrice: fc.float({ min: 5000001, max: 10000000, noNaN: true }),
          averagePrice: fc.float({ min: 3000000, max: 7000000, noNaN: true }),
        }),
        async (data) => {
          const { make, model, year, targetCondition, otherCondition } = data;

          // Delete any existing records with the same make/model/year to avoid unique constraint violation
          await db.delete(vehicleValuations).where(
            and(
              eq(vehicleValuations.make, make),
              eq(vehicleValuations.model, model),
              eq(vehicleValuations.year, year)
            )
          );

          // Store two valuations with different conditions
          await db.insert(vehicleValuations).values([
            {
              make,
              model,
              year,
              conditionCategory: targetCondition,
              lowPrice: data.lowPrice.toFixed(2),
              highPrice: data.highPrice.toFixed(2),
              averagePrice: data.averagePrice.toFixed(2),
              dataSource: 'test',
              createdBy: testUserId,
            },
            {
              make,
              model,
              year,
              conditionCategory: otherCondition,
              lowPrice: (data.lowPrice * 1.2).toFixed(2),
              highPrice: (data.highPrice * 1.2).toFixed(2),
              averagePrice: (data.averagePrice * 1.2).toFixed(2),
              dataSource: 'test',
              createdBy: testUserId,
            },
          ]);

          // Query with condition filter
          const result = await service.queryValuation({
            make,
            model,
            year,
            conditionCategory: targetCondition,
          });

          // Should find only the target condition
          expect(result.found).toBe(true);
          expect(result.valuation?.conditionCategory).toBe(targetCondition);
        }
      ),
      { numRuns: 20 }
    );
  }, 60000); // 60 second timeout for property tests
});
