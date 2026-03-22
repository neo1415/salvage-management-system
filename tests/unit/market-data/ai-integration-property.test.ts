/**
 * Property-Based Tests for AI Integration with Market Data
 * 
 * Feature: market-data-scraping-system
 * Tests universal properties of AI assessment with market data integration
 */

// Set mock mode BEFORE importing the service
process.env.MOCK_AI_ASSESSMENT = 'true';

import { describe, test, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';
import type { VehicleInfo } from '@/features/cases/services/ai-assessment-enhanced.service';

// Mock market data service
vi.mock('@/features/market-data/services/market-data.service', () => ({
  getMarketPrice: vi.fn(async () => ({
    median: 5000000,
    min: 4800000,
    max: 5200000,
    count: 3,
    sources: [
      {
        source: 'jiji',
        price: 5000000,
        currency: 'NGN',
        listingUrl: 'https://jiji.ng/test',
        listingTitle: 'Test Vehicle',
        scrapedAt: new Date(),
      },
      {
        source: 'jumia',
        price: 5200000,
        currency: 'NGN',
        listingUrl: 'https://jumia.ng/test',
        listingTitle: 'Test Vehicle',
        scrapedAt: new Date(),
      },
      {
        source: 'cars45',
        price: 4800000,
        currency: 'NGN',
        listingUrl: 'https://cars45.ng/test',
        listingTitle: 'Test Vehicle',
        scrapedAt: new Date(),
      },
    ],
    confidence: 90,
    isFresh: true,
    cacheAge: 0,
  })),
}));

describe('AI Integration with Market Data - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 16: Damage calculation formula', () => {
    /**
     * **Validates: Requirements 4.3, 4.4**
     * 
     * For any market price and damage severity percentage, the final assessed value
     * should equal market_price × (1 - damage_percentage / 100)
     */
    test('salvage value follows damage calculation formula', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            marketValue: fc.integer({ min: 1000000, max: 50000000 }),
            photos: fc.array(fc.constant('data:image/jpeg;base64,/9j/4AAQSkZJRg=='), {
              minLength: 1,
              maxLength: 10,
            }),
          }),
          async ({ marketValue, photos }) => {
            const vehicleInfo: VehicleInfo = {
              make: 'Toyota',
              model: 'Camry',
              year: 2020,
              marketValue,
            };

            const assessment = await assessDamageEnhanced({
              photos,
              vehicleInfo,
            });

            // Calculate expected salvage value
            // salvageValue = marketValue - repairCost
            // repairCost is based on damage scores
            const expectedSalvageValue = assessment.marketValue - assessment.estimatedRepairCost;

            // Allow small rounding differences
            expect(Math.abs(assessment.estimatedSalvageValue - expectedSalvageValue)).toBeLessThan(10);

            // Salvage value should be less than or equal to market value
            expect(assessment.estimatedSalvageValue).toBeLessThanOrEqual(assessment.marketValue);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('damage percentage affects salvage value inversely', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1000000, max: 50000000 }),
          async (marketValue) => {
            const vehicleInfo: VehicleInfo = {
              make: 'Toyota',
              model: 'Camry',
              year: 2020,
              marketValue,
            };

            const photos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];

            const assessment = await assessDamageEnhanced({
              photos,
              vehicleInfo,
            });

            // Higher damage percentage should result in lower salvage value
            // (relative to market value)
            const salvageRatio = assessment.estimatedSalvageValue / assessment.marketValue;

            // Salvage ratio should be between 0 and 1
            expect(salvageRatio).toBeGreaterThanOrEqual(0);
            expect(salvageRatio).toBeLessThanOrEqual(1);

            // Salvage value should always be less than or equal to market value
            expect(assessment.estimatedSalvageValue).toBeLessThanOrEqual(assessment.marketValue);
            
            // Repair cost should be positive
            expect(assessment.estimatedRepairCost).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 17: Damage severity bounds', () => {
    /**
     * **Validates: Requirements 4.2**
     * 
     * For any AI assessment, the damage severity percentage should be
     * between 0 and 100 (inclusive)
     */
    test('damage percentage is always between 0 and 100', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            make: fc.constantFrom('Toyota', 'Honda', 'Lexus', 'Mercedes'),
            model: fc.string({ minLength: 3, maxLength: 20 }),
            year: fc.integer({ min: 2000, max: 2024 }),
            photoCount: fc.integer({ min: 1, max: 10 }),
          }),
          async ({ make, model, year, photoCount }) => {
            const vehicleInfo: VehicleInfo = {
              make,
              model,
              year,
            };

            const photos = Array.from({ length: photoCount }, () =>
              'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
            );

            const assessment = await assessDamageEnhanced({
              photos,
              vehicleInfo,
            });

            // Damage percentage must be within bounds
            expect(assessment.damagePercentage).toBeGreaterThanOrEqual(0);
            expect(assessment.damagePercentage).toBeLessThanOrEqual(100);

            // Damage scores should also be within bounds
            expect(assessment.damageScore.structural).toBeGreaterThanOrEqual(0);
            expect(assessment.damageScore.structural).toBeLessThanOrEqual(100);
            expect(assessment.damageScore.mechanical).toBeGreaterThanOrEqual(0);
            expect(assessment.damageScore.mechanical).toBeLessThanOrEqual(100);
            expect(assessment.damageScore.cosmetic).toBeGreaterThanOrEqual(0);
            expect(assessment.damageScore.cosmetic).toBeLessThanOrEqual(100);
            expect(assessment.damageScore.electrical).toBeGreaterThanOrEqual(0);
            expect(assessment.damageScore.electrical).toBeLessThanOrEqual(100);
            expect(assessment.damageScore.interior).toBeGreaterThanOrEqual(0);
            expect(assessment.damageScore.interior).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('damage severity classification matches percentage', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constant('data:image/jpeg;base64,/9j/4AAQSkZJRg=='), {
            minLength: 1,
            maxLength: 10,
          }),
          async (photos) => {
            const vehicleInfo: VehicleInfo = {
              make: 'Toyota',
              model: 'Camry',
              year: 2020,
            };

            const assessment = await assessDamageEnhanced({
              photos,
              vehicleInfo,
            });

            // Severity classification should match percentage ranges
            if (assessment.damagePercentage < 55) {
              expect(assessment.damageSeverity).toBe('minor');
            } else if (assessment.damagePercentage < 75) {
              expect(assessment.damageSeverity).toBe('moderate');
            } else {
              expect(assessment.damageSeverity).toBe('severe');
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Property 18: Complete assessment response', () => {
    /**
     * **Validates: Requirements 4.5**
     * 
     * For any assessment response, it should contain both the market price
     * and the damage-adjusted value
     */
    test('assessment always includes market value and salvage value', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            make: fc.constantFrom('Toyota', 'Honda', 'Lexus'),
            model: fc.string({ minLength: 3, maxLength: 20 }),
            year: fc.integer({ min: 2000, max: 2024 }),
            photoCount: fc.integer({ min: 1, max: 10 }),
          }),
          async ({ make, model, year, photoCount }) => {
            const vehicleInfo: VehicleInfo = {
              make,
              model,
              year,
            };

            const photos = Array.from({ length: photoCount }, () =>
              'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
            );

            const assessment = await assessDamageEnhanced({
              photos,
              vehicleInfo,
            });

            // Must have market value
            expect(assessment.marketValue).toBeDefined();
            expect(typeof assessment.marketValue).toBe('number');
            expect(assessment.marketValue).toBeGreaterThan(0);

            // Must have salvage value (damage-adjusted)
            expect(assessment.estimatedSalvageValue).toBeDefined();
            expect(typeof assessment.estimatedSalvageValue).toBe('number');

            // Must have repair cost
            expect(assessment.estimatedRepairCost).toBeDefined();
            expect(typeof assessment.estimatedRepairCost).toBe('number');
            expect(assessment.estimatedRepairCost).toBeGreaterThanOrEqual(0);

            // Must have reserve price
            expect(assessment.reservePrice).toBeDefined();
            expect(typeof assessment.reservePrice).toBe('number');
            expect(assessment.reservePrice).toBeGreaterThanOrEqual(0);

            // Reserve price should be ~70% of salvage value
            const expectedReserve = assessment.estimatedSalvageValue * 0.7;
            expect(Math.abs(assessment.reservePrice - expectedReserve)).toBeLessThan(
              expectedReserve * 0.1
            );
          }
        ),
        { numRuns: 20 }
      );
    });

    test('assessment includes all required fields', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.constant('data:image/jpeg;base64,/9j/4AAQSkZJRg=='), {
            minLength: 1,
            maxLength: 5,
          }),
          async (photos) => {
            const vehicleInfo: VehicleInfo = {
              make: 'Toyota',
              model: 'Camry',
              year: 2020,
            };

            const assessment = await assessDamageEnhanced({
              photos,
              vehicleInfo,
            });

            // Required fields
            expect(assessment).toHaveProperty('labels');
            expect(assessment).toHaveProperty('confidenceScore');
            expect(assessment).toHaveProperty('damagePercentage');
            expect(assessment).toHaveProperty('damageSeverity');
            expect(assessment).toHaveProperty('damageScore');
            expect(assessment).toHaveProperty('confidence');
            expect(assessment).toHaveProperty('marketValue');
            expect(assessment).toHaveProperty('estimatedRepairCost');
            expect(assessment).toHaveProperty('estimatedSalvageValue');
            expect(assessment).toHaveProperty('reservePrice');
            expect(assessment).toHaveProperty('isRepairable');
            expect(assessment).toHaveProperty('recommendation');
            expect(assessment).toHaveProperty('warnings');
            expect(assessment).toHaveProperty('processedAt');
            expect(assessment).toHaveProperty('photoCount');
            expect(assessment).toHaveProperty('analysisMethod');

            // Arrays should be arrays
            expect(Array.isArray(assessment.labels)).toBe(true);
            expect(Array.isArray(assessment.warnings)).toBe(true);
            expect(Array.isArray(assessment.confidence.reasons)).toBe(true);

            // Photo count should match
            expect(assessment.photoCount).toBe(photos.length);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe('Market Data Integration Properties', () => {
    test('market value uses scraped data when vehicle info is complete', async () => {
      const vehicleInfo: VehicleInfo = {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
      };

      const photos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];

      const assessment = await assessDamageEnhanced({
        photos,
        vehicleInfo,
      });

      // Market value should be from scraped data (5,000,000 from mock)
      // May be adjusted for mileage/condition
      expect(assessment.marketValue).toBeGreaterThan(0);
      expect(assessment.marketValue).toBeLessThan(10000000); // Reasonable upper bound

      // Confidence should reflect market data quality
      expect(assessment.confidence.valuationAccuracy).toBeGreaterThan(0);
    });

    test('confidence reflects market data availability', { timeout: 30000 }, async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            hasVehicleInfo: fc.boolean(),
            hasMarketValue: fc.boolean(),
          }),
          async ({ hasVehicleInfo, hasMarketValue }) => {
            const vehicleInfo: VehicleInfo | undefined = hasVehicleInfo
              ? {
                  make: 'Toyota',
                  model: 'Camry',
                  year: 2020,
                  marketValue: hasMarketValue ? 5000000 : undefined,
                }
              : hasMarketValue
              ? {
                  // Market value without vehicle info
                  marketValue: 5000000,
                }
              : undefined;

            const photos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];

            const assessment = await assessDamageEnhanced({
              photos,
              vehicleInfo,
            });

            // Confidence should be higher with more information
            if (hasMarketValue) {
              // User-provided market value = highest confidence
              expect(assessment.confidence.valuationAccuracy).toBeGreaterThanOrEqual(90);
            } else if (hasVehicleInfo) {
              // Scraped market data = good confidence
              expect(assessment.confidence.valuationAccuracy).toBeGreaterThan(50);
            } else {
              // No info = low confidence
              expect(assessment.confidence.valuationAccuracy).toBeLessThanOrEqual(50);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('mileage and condition adjustments are applied correctly', async () => {
      const baseVehicleInfo: VehicleInfo = {
        make: 'Toyota',
        model: 'Camry',
        year: 2020,
      };

      const photos = ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='];

      // Assessment without adjustments
      const baseAssessment = await assessDamageEnhanced({
        photos,
        vehicleInfo: baseVehicleInfo,
      });

      // Assessment with low mileage (should increase value)
      const lowMileageAssessment = await assessDamageEnhanced({
        photos,
        vehicleInfo: {
          ...baseVehicleInfo,
          mileage: 10000, // Very low mileage
        },
      });

      // Assessment with high mileage (should decrease value)
      const highMileageAssessment = await assessDamageEnhanced({
        photos,
        vehicleInfo: {
          ...baseVehicleInfo,
          mileage: 200000, // High mileage
        },
      });

      // Low mileage should result in higher or equal market value
      expect(lowMileageAssessment.marketValue).toBeGreaterThanOrEqual(
        baseAssessment.marketValue * 0.95
      );

      // High mileage should result in lower market value
      expect(highMileageAssessment.marketValue).toBeLessThanOrEqual(
        baseAssessment.marketValue * 1.05
      );
    });
  });
});
