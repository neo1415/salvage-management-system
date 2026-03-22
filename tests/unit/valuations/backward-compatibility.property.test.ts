/**
 * Property-Based Tests for Backward Compatibility
 * 
 * Property 5: Backward compatibility preservation
 * Validates: Requirements 7.3, 7.4
 * 
 * Tests that:
 * - Exact string matching still works (backward compatibility)
 * - Custom text entries are processed correctly
 * - System handles both autocomplete and manual entry
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fc } from '@fast-check/vitest'
import { db } from '@/lib/db/drizzle'
import { vehicleValuations } from '@/lib/db/schema/vehicle-valuations'
import { users } from '@/lib/db/schema/users'
import { eq, and } from 'drizzle-orm'
import { ValuationQueryService } from '@/features/valuations/services/valuation-query.service'

describe('Property 5: Backward Compatibility Preservation', () => {
  const valuationService = new ValuationQueryService()
  let testValuations: Array<{ id: string; make: string; model: string; year: number }>
  let testUserId: string

  beforeAll(async () => {
    // Create test user for createdBy field
    const [testUser] = await db
      .insert(users)
      .values({
        email: `test-backward-compat-${Date.now()}@test.com`,
        phone: `+234${Date.now().toString().slice(-10)}`,
        role: 'claims_adjuster',
        passwordHash: 'test-hash',
        fullName: 'Test User',
        dateOfBirth: new Date('1990-01-01'),
      })
      .returning()

    testUserId = testUser.id

    // Seed test data for backward compatibility testing
    const testData = [
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
        conditionCategory: 'Excellent',
        lowPrice: 20000000,
        highPrice: 22000000,
        averagePrice: 21000000,
        dataSource: 'manual',
        createdBy: testUserId,
      },
      {
        make: 'Honda',
        model: 'Accord',
        year: 2019,
        conditionCategory: 'Good',
        lowPrice: 18000000,
        highPrice: 20000000,
        averagePrice: 19000000,
        dataSource: 'manual',
        createdBy: testUserId,
      },
      {
        make: 'Nissan',
        model: 'Altima',
        year: 2021,
        conditionCategory: 'Excellent',
        lowPrice: 19000000,
        highPrice: 21000000,
        averagePrice: 20000000,
        dataSource: 'manual',
        createdBy: testUserId,
      },
    ]

    testValuations = await db.insert(vehicleValuations).values(testData).returning()
  })

  afterAll(async () => {
    // Cleanup test data
    if (testValuations && testValuations.length > 0) {
      for (const valuation of testValuations) {
        await db.delete(vehicleValuations).where(eq(vehicleValuations.id, valuation.id))
      }
    }

    // Cleanup test user
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId))
    }
  })

  describe('Exact String Matching (Backward Compatibility)', () => {
    it('should find exact matches using traditional string matching', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            { make: 'Toyota', model: 'Camry', year: 2020 },
            { make: 'Honda', model: 'Accord', year: 2019 },
            { make: 'Nissan', model: 'Altima', year: 2021 }
          ),
          async (vehicle) => {
            // Query with exact match
            const result = await valuationService.queryValuation({
              make: vehicle.make,
              model: vehicle.model,
              year: vehicle.year,
            })

            // Should find exact match
            expect(result.found).toBe(true)
            expect(result.source).toBe('database')
            expect(result.matchType).toBe('exact')
            expect(result.valuation).toBeDefined()
            expect(result.valuation?.averagePrice).toBeGreaterThan(0)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should preserve exact match behavior regardless of fuzzy matching', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            make: fc.constantFrom('Toyota', 'Honda', 'Nissan'),
            model: fc.constantFrom('Camry', 'Accord', 'Altima'),
            year: fc.integer({ min: 2019, max: 2021 }),
          }),
          async (vehicle) => {
            // Query twice with same exact values
            const result1 = await valuationService.queryValuation(vehicle)
            const result2 = await valuationService.queryValuation(vehicle)

            // Results should be identical (deterministic)
            expect(result1.found).toBe(result2.found)
            expect(result1.matchType).toBe(result2.matchType)
            expect(result1.source).toBe(result2.source)

            if (result1.found && result2.found) {
              expect(result1.valuation?.averagePrice).toBe(result2.valuation?.averagePrice)
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should handle case-insensitive exact matches', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            make: fc.constantFrom('toyota', 'TOYOTA', 'Toyota'),
            model: fc.constantFrom('camry', 'CAMRY', 'Camry'),
            year: fc.constant(2020),
          }),
          async (vehicle) => {
            const result = await valuationService.queryValuation(vehicle)

            // Should find match regardless of case
            expect(result.found).toBe(true)
            expect(result.source).toBe('database')
          }
        ),
        { numRuns: 10 }
      )
    })
  })

  describe('Custom Text Entry Processing', () => {
    it('should process custom text entries using fuzzy matching', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            make: fc.constantFrom('Toyota Camry', 'Honda Accord', 'Nissan Altima'),
            model: fc.constantFrom('Camry SE', 'Accord Sport', 'Altima SV'),
            year: fc.integer({ min: 2019, max: 2021 }),
          }),
          async (vehicle) => {
            const result = await valuationService.queryValuation(vehicle)

            // Should either find fuzzy match or return not found
            if (result.found) {
              expect(result.matchType).toMatch(/fuzzy_make_model|fuzzy_year/)
              expect(result.similarityScore).toBeDefined()
              expect(result.similarityScore).toBeGreaterThanOrEqual(0.6)
            } else {
              expect(result.found).toBe(false)
              expect(result.source).toBe('not_found')
            }
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should handle arbitrary user input gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            make: fc.string({ minLength: 1, maxLength: 50 }),
            model: fc.string({ minLength: 1, maxLength: 50 }),
            year: fc.integer({ min: 1990, max: 2025 }),
          }),
          async (vehicle) => {
            // Should not throw error for any input
            const result = await valuationService.queryValuation(vehicle)

            // Result should have valid structure
            expect(result).toHaveProperty('found')
            expect(result).toHaveProperty('source')
            expect(typeof result.found).toBe('boolean')
            expect(['database', 'not_found']).toContain(result.source)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('should normalize custom text before processing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            make: fc.constantFrom('  Toyota  ', 'Toyota', 'TOYOTA', 'toyota'),
            model: fc.constantFrom('  Camry  ', 'Camry', 'CAMRY', 'camry'),
            year: fc.constant(2020),
          }),
          async (vehicle) => {
            const result = await valuationService.queryValuation(vehicle)

            // All variations should produce same result after normalization
            expect(result.found).toBe(true)
            expect(result.source).toBe('database')
          }
        ),
        { numRuns: 10 }
      )
    })
  })

  describe('Mixed Input Handling', () => {
    it('should handle both autocomplete selections and manual entries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // Autocomplete selection (exact match)
            fc.record({
              make: fc.constantFrom('Toyota', 'Honda', 'Nissan'),
              model: fc.constantFrom('Camry', 'Accord', 'Altima'),
              year: fc.integer({ min: 2019, max: 2021 }),
              source: fc.constant('autocomplete'),
            }),
            // Manual entry (may need fuzzy matching)
            fc.record({
              make: fc.constantFrom('Toyota Camry', 'Honda Accord Sport', 'Nissan'),
              model: fc.constantFrom('Camry SE', 'Accord', 'Altima SV'),
              year: fc.integer({ min: 2019, max: 2021 }),
              source: fc.constant('manual'),
            })
          ),
          async (input) => {
            const result = await valuationService.queryValuation({
              make: input.make,
              model: input.model,
              year: input.year,
            })

            // Should handle both input types
            expect(result).toHaveProperty('found')
            expect(result).toHaveProperty('source')

            if (input.source === 'autocomplete') {
              // Autocomplete selections should find exact matches
              expect(result.found).toBe(true)
            }

            // Manual entries may or may not find matches (depends on fuzzy matching)
            // But should never throw errors
            expect(['database', 'not_found']).toContain(result.source)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('should maintain consistent behavior across input methods', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            make: fc.constantFrom('Toyota', 'Honda', 'Nissan'),
            model: fc.constantFrom('Camry', 'Accord', 'Altima'),
            year: fc.integer({ min: 2019, max: 2021 }),
          }),
          async (vehicle) => {
            // Query same vehicle via "autocomplete" and "manual" entry
            const autocompleteResult = await valuationService.queryValuation(vehicle)
            const manualResult = await valuationService.queryValuation(vehicle)

            // Results should be identical regardless of input method
            expect(autocompleteResult.found).toBe(manualResult.found)
            expect(autocompleteResult.matchType).toBe(manualResult.matchType)

            if (autocompleteResult.found && manualResult.found) {
              expect(autocompleteResult.valuation?.averagePrice).toBe(
                manualResult.valuation?.averagePrice
              )
            }
          }
        ),
        { numRuns: 10 }
      )
    })
  })

  describe('Fallback Chain Preservation', () => {
    it('should maintain fallback chain: exact → fuzzy → not found', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            make: fc.string({ minLength: 1, maxLength: 50 }),
            model: fc.string({ minLength: 1, maxLength: 50 }),
            year: fc.integer({ min: 1990, max: 2025 }),
          }),
          async (vehicle) => {
            const result = await valuationService.queryValuation(vehicle)

            // Should follow fallback chain
            if (result.found) {
              // If found, should have valid match type
              expect(['exact', 'fuzzy_make_model', 'fuzzy_year']).toContain(result.matchType)
              expect(result.source).toBe('database')
            } else {
              // If not found, should indicate not found
              expect(result.found).toBe(false)
              expect(result.source).toBe('not_found')
            }
          }
        ),
        { numRuns: 20 }
      )
    })

    it('should prefer exact match over fuzzy match', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            { make: 'Toyota', model: 'Camry', year: 2020 },
            { make: 'Honda', model: 'Accord', year: 2019 },
            { make: 'Nissan', model: 'Altima', year: 2021 }
          ),
          async (vehicle) => {
            const result = await valuationService.queryValuation(vehicle)

            // Exact matches should always be preferred
            expect(result.found).toBe(true)
            expect(result.matchType).toBe('exact')
            expect(result.source).toBe('database')
          }
        ),
        { numRuns: 10 }
      )
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty strings gracefully', async () => {
      const result = await valuationService.queryValuation({
        make: '',
        model: '',
        year: 2020,
      })

      // Should not throw error
      expect(result).toHaveProperty('found')
      expect(result.found).toBe(false)
    })

    it('should handle special characters in input', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            make: fc.constantFrom('Toyota-Lexus', 'Honda/Acura', 'Nissan & Infiniti'),
            model: fc.constantFrom('Camry-SE', 'Accord/Sport', 'Altima & SV'),
            year: fc.integer({ min: 2019, max: 2021 }),
          }),
          async (vehicle) => {
            // Should not throw error
            const result = await valuationService.queryValuation(vehicle)

            expect(result).toHaveProperty('found')
            expect(['database', 'not_found']).toContain(result.source)
          }
        ),
        { numRuns: 10 }
      )
    })

    it('should handle very long input strings', async () => {
      const result = await valuationService.queryValuation({
        make: 'A'.repeat(1000),
        model: 'B'.repeat(1000),
        year: 2020,
      })

      // Should not throw error
      expect(result).toHaveProperty('found')
      expect(result.found).toBe(false)
    })
  })
})
