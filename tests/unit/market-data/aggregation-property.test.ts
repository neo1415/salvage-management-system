/**
 * Property-Based Tests for Price Aggregation Service
 * 
 * Tests universal properties for price aggregation.
 * Uses fast-check for property-based testing with 100 iterations per property.
 * 
 * Properties tested:
 * - Property 12: Median calculation correctness
 * - Property 13: Invalid price filtering
 * - Property 14: Empty price set error handling
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { SourcePrice } from '../../../src/features/market-data/types';
import { aggregatePrices } from '../../../src/features/market-data/services/aggregation.service';

describe('Price Aggregation - Property-Based Tests', () => {
  /**
   * Property 12: Median calculation correctness
   * **Validates: Requirements 3.1, 3.2**
   * 
   * For any set of valid prices, the median should be:
   * - Between min and max (inclusive)
   * - Equal to the middle value for odd-length arrays
   * - Equal to the average of two middle values for even-length arrays
   */
  it('Property 12: Median calculation correctness', () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: 1, max: 10000000000, noNaN: true }), { minLength: 1, maxLength: 100 }),
        (prices) => {
          // Create source prices
          const sourcePrices: SourcePrice[] = prices.map((price, index) => ({
            source: `source-${index}`,
            price,
            currency: 'NGN',
            listingUrl: `https://example.com/${index}`,
            listingTitle: `Listing ${index}`,
            scrapedAt: new Date(),
          }));

          const result = aggregatePrices(sourcePrices);

          // Median should be between min and max
          expect(result.median).toBeGreaterThanOrEqual(result.min);
          expect(result.median).toBeLessThanOrEqual(result.max);

          // Verify median calculation
          const sorted = [...result.validPrices].sort((a, b) => a - b);
          const midIndex = Math.floor(sorted.length / 2);
          
          if (sorted.length % 2 === 0) {
            // Even: average of two middle values
            const expectedMedian = (sorted[midIndex - 1] + sorted[midIndex]) / 2;
            expect(result.median).toBeCloseTo(expectedMedian, 10);
          } else {
            // Odd: middle value
            expect(result.median).toBe(sorted[midIndex]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 13: Invalid price filtering
   * **Validates: Requirements 3.4, 3.5**
   * 
   * For any set of prices including invalid ones, the aggregation should:
   * - Filter out negative prices
   * - Filter out zero prices
   * - Filter out prices > 10 billion
   * - Only include valid prices in the result
   */
  it('Property 13: Invalid price filtering', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.float({ min: 1, max: 10000000000, noNaN: true }), // Valid
            fc.float({ min: -1000000, max: 0 }), // Invalid: negative or zero
            fc.constant(10000000001), // Invalid: too high
            fc.constant(NaN), // Invalid: NaN
          ),
          { minLength: 1, maxLength: 50 }
        ),
        (prices) => {
          // Filter to ensure at least one valid price
          const hasValidPrice = prices.some(p => !isNaN(p) && p > 0 && p <= 10000000000);
          if (!hasValidPrice) {
            prices.push(5000000); // Add a valid price
          }

          // Create source prices
          const sourcePrices: SourcePrice[] = prices.map((price, index) => ({
            source: `source-${index}`,
            price,
            currency: 'NGN',
            listingUrl: `https://example.com/${index}`,
            listingTitle: `Listing ${index}`,
            scrapedAt: new Date(),
          }));

          const result = aggregatePrices(sourcePrices);

          // All prices in result should be valid
          result.validPrices.forEach(price => {
            expect(price).toBeGreaterThan(0);
            expect(price).toBeLessThanOrEqual(10000000000);
            expect(isNaN(price)).toBe(false);
          });

          // Count should match valid prices
          expect(result.count).toBe(result.validPrices.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 14: Empty price set error handling
   * **Validates: Requirements 3.1, 3.5**
   * 
   * For any set containing only invalid prices, aggregation should throw an error.
   */
  it('Property 14: Empty price set error handling', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.float({ min: -1000000, max: 0 }), // Invalid: negative or zero
            fc.constant(10000000001), // Invalid: too high
            fc.constant(NaN), // Invalid: NaN
            fc.constant(-1), // Invalid: negative
          ),
          { minLength: 1, maxLength: 20 }
        ),
        (prices) => {
          // Create source prices with only invalid prices
          const sourcePrices: SourcePrice[] = prices.map((price, index) => ({
            source: `source-${index}`,
            price,
            currency: 'NGN',
            listingUrl: `https://example.com/${index}`,
            listingTitle: `Listing ${index}`,
            scrapedAt: new Date(),
          }));

          // Should throw error for no valid prices
          expect(() => aggregatePrices(sourcePrices)).toThrow('No valid prices to aggregate');
        }
      ),
      { numRuns: 100 }
    );
  });
});
