/**
 * Unit Tests for Price Aggregation Edge Cases
 * 
 * Tests specific edge cases for price aggregation.
 * Focuses on single price, two prices, all invalid, and mixed scenarios.
 * 
 * Requirements: 3.1-3.5
 */

import { describe, it, expect } from 'vitest';
import type { SourcePrice } from '../../../src/features/market-data/types';
import { aggregatePrices } from '../../../src/features/market-data/services/aggregation.service';

describe('Price Aggregation - Edge Cases', () => {
  describe('Single Price', () => {
    it('should handle single valid price', () => {
      const sourcePrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
      ];

      const result = aggregatePrices(sourcePrices);

      expect(result.median).toBe(5000000);
      expect(result.min).toBe(5000000);
      expect(result.max).toBe(5000000);
      expect(result.count).toBe(1);
      expect(result.validPrices).toEqual([5000000]);
    });
  });

  describe('Two Prices', () => {
    it('should calculate median as average of two prices', () => {
      const sourcePrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 4000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'jumia',
          price: 6000000,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
      ];

      const result = aggregatePrices(sourcePrices);

      expect(result.median).toBe(5000000); // (4000000 + 6000000) / 2
      expect(result.min).toBe(4000000);
      expect(result.max).toBe(6000000);
      expect(result.count).toBe(2);
      expect(result.validPrices).toEqual([4000000, 6000000]);
    });

    it('should handle two identical prices', () => {
      const sourcePrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'jumia',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
      ];

      const result = aggregatePrices(sourcePrices);

      expect(result.median).toBe(5000000);
      expect(result.min).toBe(5000000);
      expect(result.max).toBe(5000000);
      expect(result.count).toBe(2);
    });
  });

  describe('All Invalid Prices', () => {
    it('should throw error for all negative prices', () => {
      const sourcePrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: -5000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'jumia',
          price: -3000000,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
      ];

      expect(() => aggregatePrices(sourcePrices)).toThrow('No valid prices to aggregate');
    });

    it('should throw error for all zero prices', () => {
      const sourcePrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 0,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'jumia',
          price: 0,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
      ];

      expect(() => aggregatePrices(sourcePrices)).toThrow('No valid prices to aggregate');
    });

    it('should throw error for all prices above 10 billion', () => {
      const sourcePrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 10000000001,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'jumia',
          price: 15000000000,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
      ];

      expect(() => aggregatePrices(sourcePrices)).toThrow('No valid prices to aggregate');
    });

    it('should throw error for all NaN prices', () => {
      const sourcePrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: NaN,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'jumia',
          price: NaN,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
      ];

      expect(() => aggregatePrices(sourcePrices)).toThrow('No valid prices to aggregate');
    });
  });

  describe('Mixed Valid and Invalid Prices', () => {
    it('should filter out negative prices and keep valid ones', () => {
      const sourcePrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'jumia',
          price: -3000000,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'cars45',
          price: 6000000,
          currency: 'NGN',
          listingUrl: 'https://cars45.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
      ];

      const result = aggregatePrices(sourcePrices);

      expect(result.count).toBe(2);
      expect(result.validPrices).toEqual([5000000, 6000000]);
      expect(result.median).toBe(5500000);
    });

    it('should filter out zero prices and keep valid ones', () => {
      const sourcePrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'jumia',
          price: 0,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'cars45',
          price: 6000000,
          currency: 'NGN',
          listingUrl: 'https://cars45.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
      ];

      const result = aggregatePrices(sourcePrices);

      expect(result.count).toBe(2);
      expect(result.validPrices).toEqual([5000000, 6000000]);
    });

    it('should filter out prices above 10 billion and keep valid ones', () => {
      const sourcePrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'jumia',
          price: 10000000001,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'cars45',
          price: 6000000,
          currency: 'NGN',
          listingUrl: 'https://cars45.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
      ];

      const result = aggregatePrices(sourcePrices);

      expect(result.count).toBe(2);
      expect(result.validPrices).toEqual([5000000, 6000000]);
    });

    it('should filter out NaN prices and keep valid ones', () => {
      const sourcePrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'jumia',
          price: NaN,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'cars45',
          price: 6000000,
          currency: 'NGN',
          listingUrl: 'https://cars45.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
      ];

      const result = aggregatePrices(sourcePrices);

      expect(result.count).toBe(2);
      expect(result.validPrices).toEqual([5000000, 6000000]);
    });

    it('should handle mix of all invalid types with valid prices', () => {
      const sourcePrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'jumia',
          price: -1000,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'cars45',
          price: 0,
          currency: 'NGN',
          listingUrl: 'https://cars45.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'cheki',
          price: NaN,
          currency: 'NGN',
          listingUrl: 'https://cheki.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'other',
          price: 10000000001,
          currency: 'NGN',
          listingUrl: 'https://other.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
      ];

      const result = aggregatePrices(sourcePrices);

      expect(result.count).toBe(1);
      expect(result.validPrices).toEqual([5000000]);
      expect(result.median).toBe(5000000);
    });
  });

  describe('Three or More Prices', () => {
    it('should calculate median correctly for odd number of prices', () => {
      const sourcePrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 4000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'jumia',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'cars45',
          price: 6000000,
          currency: 'NGN',
          listingUrl: 'https://cars45.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
      ];

      const result = aggregatePrices(sourcePrices);

      expect(result.median).toBe(5000000); // Middle value
      expect(result.min).toBe(4000000);
      expect(result.max).toBe(6000000);
      expect(result.count).toBe(3);
    });

    it('should calculate median correctly for even number of prices', () => {
      const sourcePrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 4000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'jumia',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'cars45',
          price: 6000000,
          currency: 'NGN',
          listingUrl: 'https://cars45.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
        {
          source: 'cheki',
          price: 7000000,
          currency: 'NGN',
          listingUrl: 'https://cheki.com/listing/1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt: new Date(),
        },
      ];

      const result = aggregatePrices(sourcePrices);

      expect(result.median).toBe(5500000); // (5000000 + 6000000) / 2
      expect(result.min).toBe(4000000);
      expect(result.max).toBe(7000000);
      expect(result.count).toBe(4);
    });
  });
});
