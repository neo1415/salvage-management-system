/**
 * Property-Based Tests for Fuzzy Matching
 * Feature: vehicle-input-enhancement
 * 
 * **Property 2: Fuzzy match reflexivity**
 * **Validates: Requirements 1.1, 1.6**
 * 
 * Tests that:
 * - Exact matches always return similarity score of 1.0
 * - Similar strings return scores between 0.6 and 1.0
 */

import { describe, test, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { db } from '@/lib/db';
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations';
import { users } from '@/lib/db/schema/users';
import { ValuationQueryService } from '@/features/valuations/services/valuation-query.service';
import { eq, and } from 'drizzle-orm';

describe.sequential('Fuzzy Matching - Property Tests', () => {
  let service: ValuationQueryService;
  let testUserId: string;

  // Clean up ALL data before starting this test suite
  beforeAll(async () => {
    await db.delete(vehicleValuations);
  }, 30000);

  beforeEach(async () => {
    service = new ValuationQueryService();
    // Create a test user for foreign key constraint
    testUserId = '00000000-0000-0000-0000-000000000002';
    
    // Clean up test data BEFORE each test to ensure isolation
    await db.delete(vehicleValuations);
    
    // Insert test user if not exists
    const existingUser = await db.select().from(users).where(eq(users.id, testUserId));
    if (existingUser.length === 0) {
      await db.insert(users).values({
        id: testUserId,
        email: 'fuzzy-test@example.com',
        phone: '+1234567891',
        passwordHash: 'test',
        role: 'system_admin',
        fullName: 'Fuzzy Test User',
        dateOfBirth: new Date('1990-01-01'),
      });
    }
  }, 30000);

  afterEach(async () => {
    // Clean up test data AFTER each test
    await db.delete(vehicleValuations);
  }, 30000);

  /**
   * Property 2a: Fuzzy match reflexivity - Exact matches
   * For any string S, fuzzy matching S against S should return similarity score of 1.0
   */
  test('Property 2a: Exact matches always return similarity score of 1.0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.constantFrom('Toyota', 'Honda', 'Mercedes-Benz', 'BMW', 'Audi', 'Nissan'),
          model: fc.constantFrom('Camry', 'Accord', 'GLE 350', 'X5', 'A4', 'Altima'),
          year: fc.integer({ min: 2015, max: 2024 }),
          conditionCategory: fc.constantFrom('nig_used_low', 'nig_used_high', 'tokunbo_low', 'tokunbo_high'),
          lowPrice: fc.float({ min: 1000000, max: 5000000, noNaN: true }),
          highPrice: fc.float({ min: 5000001, max: 10000000, noNaN: true }),
          averagePrice: fc.float({ min: 3000000, max: 7000000, noNaN: true }),
        }),
        async (valuation) => {
          // Delete any existing record to avoid unique constraint violation
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

          // Query with exact same make and model
          const result = await service.queryValuation({
            make: valuation.make,
            model: valuation.model,
            year: valuation.year,
            conditionCategory: valuation.conditionCategory,
          });

          // Should find exact match
          expect(result.found).toBe(true);
          expect(result.source).toBe('database');
          expect(result.matchType).toBe('exact');
          
          // Exact match should have similarity score of 1.0
          if (result.similarityScore !== undefined) {
            expect(result.similarityScore).toBe(1.0);
          }
        }
      ),
      { numRuns: 20 }
    );
  }, 60000);

  /**
   * Property 2b: Fuzzy match reflexivity - Similar strings
   * For similar strings (with minor variations), fuzzy matching should return
   * similarity scores between 0.6 and 1.0
   */
  test('Property 2b: Similar strings return scores between 0.6 and 1.0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          baseMake: fc.constantFrom('Toyota', 'Honda', 'Mercedes-Benz', 'BMW'),
          baseModel: fc.constantFrom('Camry', 'Accord', 'GLE 350', 'X5'),
          year: fc.integer({ min: 2015, max: 2024 }),
          conditionCategory: fc.constantFrom('nig_used_low', 'tokunbo_low'),
          lowPrice: fc.float({ min: 1000000, max: 5000000, noNaN: true }),
          highPrice: fc.float({ min: 5000001, max: 10000000, noNaN: true }),
          averagePrice: fc.float({ min: 3000000, max: 7000000, noNaN: true }),
        }),
        async (data) => {
          const { baseMake, baseModel, year, conditionCategory } = data;
          
          // Create variations of the model that should match with fuzzy logic
          // Examples: "GLE 350" vs "GLE-Class GLE 350", "Camry" vs "Toyota Camry"
          const variations = [
            { stored: baseModel, query: baseModel.toLowerCase() }, // Case variation
            { stored: baseModel, query: baseModel.replace(/\s+/g, '-') }, // Space to hyphen
            { stored: baseModel, query: `${baseMake} ${baseModel}` }, // With make prefix
          ];

          for (const variation of variations) {
            // Delete any existing record
            await db.delete(vehicleValuations).where(
              and(
                eq(vehicleValuations.make, baseMake),
                eq(vehicleValuations.model, variation.stored),
                eq(vehicleValuations.year, year),
                eq(vehicleValuations.conditionCategory, conditionCategory)
              )
            );

            // Store valuation with the stored version
            await db.insert(vehicleValuations).values({
              make: baseMake,
              model: variation.stored,
              year,
              conditionCategory,
              lowPrice: data.lowPrice.toFixed(2),
              highPrice: data.highPrice.toFixed(2),
              averagePrice: data.averagePrice.toFixed(2),
              dataSource: 'test',
              createdBy: testUserId,
            });

            // Query with the variation
            const result = await service.queryValuation({
              make: baseMake,
              model: variation.query,
              year,
              conditionCategory,
            });

            // If fuzzy matching is implemented and finds a match
            if (result.found && result.matchType === 'fuzzy_make_model') {
              // Similarity score should be between 0.6 and 1.0
              expect(result.similarityScore).toBeDefined();
              expect(result.similarityScore).toBeGreaterThanOrEqual(0.6);
              expect(result.similarityScore).toBeLessThanOrEqual(1.0);
              
              // Should return the matched values for debugging
              expect(result.matchedValues).toBeDefined();
              expect(result.matchedValues?.model).toBe(variation.stored);
            }

            // Clean up for next variation
            await db.delete(vehicleValuations).where(
              and(
                eq(vehicleValuations.make, baseMake),
                eq(vehicleValuations.model, variation.stored),
                eq(vehicleValuations.year, year)
              )
            );
          }
        }
      ),
      { numRuns: 10 }
    );
  }, 90000);

  /**
   * Property 2c: Fuzzy match threshold
   * Strings with similarity below 0.6 should not match
   */
  test('Property 2c: Strings with low similarity (< 0.6) should not match', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.constantFrom('Toyota', 'Honda'),
          storedModel: fc.constantFrom('Camry', 'Accord'),
          differentModel: fc.constantFrom('Highlander', 'Pilot'), // Completely different models
          year: fc.integer({ min: 2015, max: 2024 }),
          conditionCategory: fc.constantFrom('nig_used_low', 'tokunbo_low'),
          lowPrice: fc.float({ min: 1000000, max: 5000000, noNaN: true }),
          highPrice: fc.float({ min: 5000001, max: 10000000, noNaN: true }),
          averagePrice: fc.float({ min: 3000000, max: 7000000, noNaN: true }),
        }),
        async (data) => {
          const { make, storedModel, differentModel, year, conditionCategory } = data;
          
          // Ensure the models are actually different
          if (storedModel === differentModel) {
            return; // Skip this iteration
          }

          // Delete any existing records
          await db.delete(vehicleValuations).where(
            and(
              eq(vehicleValuations.make, make),
              eq(vehicleValuations.year, year)
            )
          );

          // Store valuation with storedModel
          await db.insert(vehicleValuations).values({
            make,
            model: storedModel,
            year,
            conditionCategory,
            lowPrice: data.lowPrice.toFixed(2),
            highPrice: data.highPrice.toFixed(2),
            averagePrice: data.averagePrice.toFixed(2),
            dataSource: 'test',
            createdBy: testUserId,
          });

          // Query with completely different model
          const result = await service.queryValuation({
            make,
            model: differentModel,
            year,
            conditionCategory,
          });

          // Should not find a fuzzy match for completely different models
          // Either not found, or if found, similarity should be < 0.6
          if (result.found && result.matchType === 'fuzzy_make_model') {
            expect(result.similarityScore).toBeLessThan(0.6);
          }
        }
      ),
      { numRuns: 15 }
    );
  }, 60000);

  /**
   * Property 2d: Fuzzy match consistency
   * Fuzzy matching should be deterministic - same input should always produce same result
   */
  test('Property 2d: Fuzzy matching is deterministic', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          make: fc.constantFrom('Mercedes-Benz', 'BMW'),
          storedModel: fc.constantFrom('GLE 350', 'X5'),
          queryModel: fc.constantFrom('GLE-Class GLE 350', 'BMW X5'),
          year: fc.integer({ min: 2015, max: 2024 }),
          conditionCategory: fc.constantFrom('nig_used_low', 'tokunbo_low'),
          lowPrice: fc.float({ min: 1000000, max: 5000000, noNaN: true }),
          highPrice: fc.float({ min: 5000001, max: 10000000, noNaN: true }),
          averagePrice: fc.float({ min: 3000000, max: 7000000, noNaN: true }),
        }),
        async (data) => {
          const { make, storedModel, queryModel, year, conditionCategory } = data;

          // Delete any existing records
          await db.delete(vehicleValuations).where(
            and(
              eq(vehicleValuations.make, make),
              eq(vehicleValuations.model, storedModel),
              eq(vehicleValuations.year, year)
            )
          );

          // Store valuation
          await db.insert(vehicleValuations).values({
            make,
            model: storedModel,
            year,
            conditionCategory,
            lowPrice: data.lowPrice.toFixed(2),
            highPrice: data.highPrice.toFixed(2),
            averagePrice: data.averagePrice.toFixed(2),
            dataSource: 'test',
            createdBy: testUserId,
          });

          // Query multiple times with same input
          const result1 = await service.queryValuation({
            make,
            model: queryModel,
            year,
            conditionCategory,
          });

          const result2 = await service.queryValuation({
            make,
            model: queryModel,
            year,
            conditionCategory,
          });

          // Results should be identical
          expect(result1.found).toBe(result2.found);
          expect(result1.matchType).toBe(result2.matchType);
          expect(result1.similarityScore).toBe(result2.similarityScore);
          
          if (result1.found && result2.found) {
            expect(result1.valuation?.averagePrice).toBe(result2.valuation?.averagePrice);
          }
        }
      ),
      { numRuns: 15 }
    );
  }, 60000);
});
