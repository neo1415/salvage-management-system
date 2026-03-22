/**
 * Property-Based Tests for Depreciation Service
 * 
 * Property 5: Depreciation Calculation Accuracy
 * Validates: Requirements 5.2, 5.3, 5.4, 5.5
 * 
 * Tests that depreciation calculations correctly apply tiered rates
 * and compound depreciation formulas.
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { applyDepreciation, getDepreciationRate } from '@/features/market-data/services/depreciation.service';
import { extractYear } from '@/features/market-data/services/year-extraction.service';
import type { SourcePrice } from '@/features/market-data/types';

describe('Property 5: Depreciation Calculation Accuracy', () => {
  const currentYear = new Date().getFullYear();

  test('should apply correct depreciation rates for each age range', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        (yearsDifference) => {
          const rate = getDepreciationRate(yearsDifference);

          if (yearsDifference <= 5) {
            expect(rate).toBe(0.15);
          } else if (yearsDifference <= 10) {
            expect(rate).toBe(0.10);
          } else {
            expect(rate).toBe(0.05);
          }
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should apply compound depreciation correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: currentYear - 5 }),
        fc.integer({ min: 1000000, max: 10000000 }),
        fc.integer({ min: 1, max: 10 }),
        (targetYear, originalPrice, yearsDifference) => {
          const listingYear = targetYear + yearsDifference;
          if (listingYear > currentYear + 1) return true;

          const listings: SourcePrice[] = [{
            source: 'jiji',
            price: originalPrice,
            currency: 'NGN',
            listingUrl: 'https://example.com',
            listingTitle: `Vehicle ${listingYear}`,
            scrapedAt: new Date(),
          }];

          const result = applyDepreciation(listings, {
            targetYear,
            currentYear,
          });

          // Calculate expected price manually
          let expectedPrice = originalPrice;
          for (let i = 0; i < yearsDifference; i++) {
            const currentAge = i + 1;
            const rate = getDepreciationRate(currentAge);
            expectedPrice = expectedPrice * (1 - rate);
          }
          expectedPrice = Math.max(expectedPrice, 100000); // Floor price
          expectedPrice = Math.round(expectedPrice);

          expect(result.adjustedPrices[0].price).toBe(expectedPrice);
          expect(result.appliedCount).toBe(1);
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should only adjust newer vehicles', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: currentYear }),
        fc.integer({ min: 1000000, max: 10000000 }),
        fc.integer({ min: -5, max: 5 }),
        (targetYear, originalPrice, yearOffset) => {
          const listingYear = targetYear + yearOffset;
          if (listingYear < 1980 || listingYear > currentYear + 1) return true;

          const listings: SourcePrice[] = [{
            source: 'jiji',
            price: originalPrice,
            currency: 'NGN',
            listingUrl: 'https://example.com',
            listingTitle: `Vehicle ${listingYear}`,
            scrapedAt: new Date(),
          }];

          const result = applyDepreciation(listings, {
            targetYear,
            currentYear,
          });

          if (listingYear <= targetYear) {
            // Should not adjust older or same-year vehicles
            expect(result.adjustedPrices[0].price).toBe(originalPrice);
            expect(result.appliedCount).toBe(0);
          } else {
            // Should adjust newer vehicles
            expect(result.adjustedPrices[0].price).toBeLessThanOrEqual(originalPrice);
            expect(result.appliedCount).toBe(1);
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should enforce minimum floor price', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1990, max: 2010 }),
        fc.integer({ min: 100000, max: 500000 }),
        (targetYear, originalPrice) => {
          // Create a listing that's much newer (will depreciate heavily)
          const listingYear = targetYear + 15;
          if (listingYear > currentYear + 1) return true;

          const listings: SourcePrice[] = [{
            source: 'jiji',
            price: originalPrice,
            currency: 'NGN',
            listingUrl: 'https://example.com',
            listingTitle: `Vehicle ${listingYear}`,
            scrapedAt: new Date(),
          }];

          const result = applyDepreciation(listings, {
            targetYear,
            currentYear,
          });

          // Price should never go below ₦100,000
          expect(result.adjustedPrices[0].price).toBeGreaterThanOrEqual(100000);
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should calculate confidence penalty correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: currentYear - 10 }),
        fc.integer({ min: 1, max: 10 }),
        (targetYear, maxYearDiff) => {
          const listings: SourcePrice[] = [];
          
          // Create listings with various year differences
          for (let i = 1; i <= maxYearDiff; i++) {
            const listingYear = targetYear + i;
            if (listingYear <= currentYear + 1) {
              listings.push({
                source: 'jiji',
                price: 2000000,
                currency: 'NGN',
                listingUrl: 'https://example.com',
                listingTitle: `Vehicle ${listingYear}`,
                scrapedAt: new Date(),
              });
            }
          }

          if (listings.length === 0) return true;

          const result = applyDepreciation(listings, {
            targetYear,
            currentYear,
          });

          // Confidence penalty should be 10 points per year, max 50
          const expectedPenalty = Math.min(maxYearDiff * 10, 50);
          expect(result.confidencePenalty).toBe(expectedPenalty);
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should handle mixed year listings correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: currentYear - 5 }),
        fc.array(fc.integer({ min: -3, max: 5 }), { minLength: 3, maxLength: 10 }),
        (targetYear, yearOffsets) => {
          const listings: SourcePrice[] = yearOffsets.map((offset, i) => {
            const listingYear = targetYear + offset;
            if (listingYear < 1980 || listingYear > currentYear + 1) {
              return null;
            }
            return {
              source: 'jiji',
              price: 2000000 + (i * 100000),
              currency: 'NGN',
              listingUrl: 'https://example.com',
              listingTitle: `Vehicle ${listingYear}`,
              scrapedAt: new Date(),
            };
          }).filter(Boolean) as SourcePrice[];

          if (listings.length === 0) return true;

          const result = applyDepreciation(listings, {
            targetYear,
            currentYear,
          });

          // Should have same number of listings
          expect(result.adjustedPrices.length).toBe(listings.length);

          // Count how many should be adjusted (newer vehicles)
          const newerCount = listings.filter(l => {
            const year = extractYear(l.listingTitle);
            return year !== null && year > targetYear;
          }).length;

          expect(result.appliedCount).toBe(newerCount);
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should return zero rate for non-positive year differences', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10, max: 0 }),
        (yearsDifference) => {
          const rate = getDepreciationRate(yearsDifference);
          expect(rate).toBe(0);
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});
