/**
 * Property-Based Tests for Year Filter Service
 * 
 * Property 3: Year Tolerance Validation
 * Validates: Requirements 2.2, 2.3
 * 
 * Tests that year filtering correctly applies tolerance rules
 * and calculates year match rates accurately.
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { filterByYear } from '@/features/market-data/services/year-filter.service';
import type { SourcePrice } from '@/features/market-data/types';

describe('Property 3: Year Tolerance Validation', () => {
  const currentYear = new Date().getFullYear();

  // Generator for valid years
  const yearGen = fc.integer({ min: 1980, max: currentYear + 1 });

  // Generator for source prices with years in titles
  const sourcePriceGen = (year: number) => fc.record({
    source: fc.constant('jiji'),
    price: fc.integer({ min: 100000, max: 100000000 }),
    currency: fc.constant('NGN'),
    listingUrl: fc.constant('https://example.com'),
    listingTitle: fc.constant(`Vehicle ${year}`),
    scrapedAt: fc.constant(new Date()),
  });

  test('should mark listings within ±1 year as valid', () => {
    fc.assert(
      fc.property(
        yearGen,
        fc.array(fc.integer({ min: -1, max: 1 }), { minLength: 1, maxLength: 10 }),
        (targetYear, offsets) => {
          const listings: SourcePrice[] = [];
          
          for (const offset of offsets) {
            const listingYear = targetYear + offset;
            if (listingYear >= 1980 && listingYear <= currentYear + 1) {
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

          const result = filterByYear(listings, { targetYear, tolerance: 1 });
          
          // All listings should be valid (within ±1 year)
          expect(result.valid.length).toBe(listings.length);
          expect(result.rejected.length).toBe(0);
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should reject listings outside tolerance', () => {
    fc.assert(
      fc.property(
        yearGen,
        fc.integer({ min: 2, max: 10 }),
        (targetYear, offset) => {
          const listingYear = targetYear + offset;
          if (listingYear > currentYear + 1) return true;

          const listings: SourcePrice[] = [{
            source: 'jiji',
            price: 2000000,
            currency: 'NGN',
            listingUrl: 'https://example.com',
            listingTitle: `Vehicle ${listingYear}`,
            scrapedAt: new Date(),
          }];

          const result = filterByYear(listings, { targetYear, tolerance: 1 });
          
          // Listing should be rejected (outside ±1 year)
          expect(result.valid.length).toBe(0);
          expect(result.rejected.length).toBe(1);
          expect(result.rejected[0].extractedYear).toBe(listingYear);
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should calculate year match rate accurately', () => {
    fc.assert(
      fc.property(
        yearGen,
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 0, max: 10 }),
        (targetYear, validCount, invalidCount) => {
          const listings: SourcePrice[] = [];

          // Add valid listings (within ±1 year)
          for (let i = 0; i < validCount; i++) {
            const offset = i % 3 - 1; // -1, 0, or 1
            const listingYear = targetYear + offset;
            if (listingYear >= 1980 && listingYear <= currentYear + 1) {
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

          // Add invalid listings (outside ±1 year)
          for (let i = 0; i < invalidCount; i++) {
            const offset = i + 5; // 5+ years away
            const listingYear = targetYear + offset;
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

          const result = filterByYear(listings, { targetYear, tolerance: 1 });
          
          const expectedRate = (result.valid.length / listings.length) * 100;
          expect(result.yearMatchRate).toBeCloseTo(expectedRate, 2);
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should handle empty listing array', () => {
    fc.assert(
      fc.property(
        yearGen,
        (targetYear) => {
          const result = filterByYear([], { targetYear, tolerance: 1 });
          
          expect(result.valid.length).toBe(0);
          expect(result.rejected.length).toBe(0);
          expect(result.yearMatchRate).toBe(0);
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  test('should reject listings without extractable years', () => {
    fc.assert(
      fc.property(
        yearGen,
        fc.string().filter(s => !/\b(19[89]\d|20[0-9]\d)\b/.test(s)),
        (targetYear, titleWithoutYear) => {
          const listings: SourcePrice[] = [{
            source: 'jiji',
            price: 2000000,
            currency: 'NGN',
            listingUrl: 'https://example.com',
            listingTitle: titleWithoutYear,
            scrapedAt: new Date(),
          }];

          const result = filterByYear(listings, { targetYear, tolerance: 1 });
          
          expect(result.valid.length).toBe(0);
          expect(result.rejected.length).toBe(1);
          expect(result.rejected[0].extractedYear).toBeNull();
          expect(result.rejected[0].reason).toContain('No year found');
          return true;
        }
      ),
      { numRuns: 30 }
    );
  });
});
