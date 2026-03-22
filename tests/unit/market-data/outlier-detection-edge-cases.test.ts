/**
 * Unit Tests for Outlier Detection Edge Cases
 * 
 * Tests specific edge cases for outlier detection logic.
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import { describe, test, expect } from 'vitest';
import { aggregatePrices } from '@/features/market-data/services/aggregation.service';
import type { SourcePrice } from '@/features/market-data/types';

describe('Outlier Detection Edge Cases', () => {
  const mockListing = (price: number): SourcePrice => ({
    source: 'jiji',
    price,
    currency: 'NGN',
    listingUrl: 'https://example.com',
    listingTitle: 'Vehicle 2004',
    scrapedAt: new Date(),
  });

  describe('>50% outliers scenario', () => {
    test('should maintain at least 3 prices even if >50% are outliers', () => {
      const listings = [
        mockListing(2000000),
        mockListing(2500000),
        mockListing(3000000),
        mockListing(100000000), // Outlier
        mockListing(150000000), // Outlier
        mockListing(200000000), // Outlier
      ];

      const result = aggregatePrices(listings, { removeOutliers: true });

      // Should keep at least 3 prices
      expect(result.count).toBeGreaterThanOrEqual(3);
      
      // Should have removed some outliers
      expect(result.outliersRemoved).toBeGreaterThan(0);
    });
  });

  describe('No outliers scenario', () => {
    test('should return original data when no outliers present', () => {
      const listings = [
        mockListing(2000000),
        mockListing(2200000),
        mockListing(2500000),
        mockListing(2800000),
        mockListing(3000000),
      ];

      const result = aggregatePrices(listings, { removeOutliers: true });

      // Should not remove any prices
      expect(result.count).toBe(5);
      expect(result.outliersRemoved).toBe(0);
    });
  });

  describe('All prices identical', () => {
    test('should handle all identical prices (no outliers)', () => {
      const listings = [
        mockListing(2500000),
        mockListing(2500000),
        mockListing(2500000),
        mockListing(2500000),
      ];

      const result = aggregatePrices(listings, { removeOutliers: true });

      expect(result.count).toBe(4);
      expect(result.median).toBe(2500000);
      expect(result.outliersRemoved).toBe(0);
    });
  });

  describe('Single price', () => {
    test('should handle single price (no outliers possible)', () => {
      const listings = [mockListing(2500000)];

      const result = aggregatePrices(listings, { removeOutliers: true });

      expect(result.count).toBe(1);
      expect(result.median).toBe(2500000);
      expect(result.outliersRemoved).toBe(0);
    });
  });

  describe('Two prices', () => {
    test('should handle two prices (edge case for median calculation)', () => {
      const listings = [
        mockListing(2000000),
        mockListing(3000000),
      ];

      const result = aggregatePrices(listings, { removeOutliers: true });

      expect(result.count).toBe(2);
      expect(result.median).toBe(2500000); // Average of two
      expect(result.outliersRemoved).toBe(0);
    });

    test('should not remove outliers with only 2 prices', () => {
      const listings = [
        mockListing(2000000),
        mockListing(100000000), // Would be outlier with more data
      ];

      const result = aggregatePrices(listings, { removeOutliers: true });

      // Should keep both (need at least 3 for outlier detection)
      expect(result.count).toBe(2);
      expect(result.outliersRemoved).toBe(0);
    });
  });

  describe('Extreme outliers', () => {
    test('should remove extreme outliers (>10x median)', () => {
      const listings = [
        mockListing(2000000),
        mockListing(2500000),
        mockListing(3000000),
        mockListing(300000000), // 100x median
      ];

      const result = aggregatePrices(listings, { removeOutliers: true });

      expect(result.outliersRemoved).toBe(1);
      expect(result.count).toBe(3);
      expect(result.median).toBeLessThan(10000000);
    });
  });

  describe('Outlier threshold customization', () => {
    test('should respect custom outlier threshold', () => {
      const listings = [
        mockListing(2000000),
        mockListing(2500000),
        mockListing(3000000),
        mockListing(8000000), // 2.67x median, but <3x
      ];

      // With 2x threshold, should remove the 8M listing
      const result2x = aggregatePrices(listings, { 
        removeOutliers: true, 
        outlierThreshold: 2.0 
      });
      expect(result2x.outliersRemoved).toBe(1);

      // With 3x threshold, should keep all listings
      const result3x = aggregatePrices(listings, { 
        removeOutliers: true, 
        outlierThreshold: 3.0 
      });
      expect(result3x.outliersRemoved).toBe(0);
    });
  });

  describe('Median calculation after outlier removal', () => {
    test('should recalculate median after removing outliers', () => {
      const listings = [
        mockListing(2000000),
        mockListing(2500000),
        mockListing(3000000),
        mockListing(100000000), // Outlier
      ];

      const withoutRemoval = aggregatePrices(listings, { removeOutliers: false });
      const withRemoval = aggregatePrices(listings, { removeOutliers: true });

      // Median should be lower after removing outlier
      expect(withRemoval.median).toBeLessThan(withoutRemoval.median);
      expect(withRemoval.median).toBe(2500000);
    });
  });

  describe('Min/Max after outlier removal', () => {
    test('should update min/max after removing outliers', () => {
      const listings = [
        mockListing(2000000),
        mockListing(2500000),
        mockListing(3000000),
        mockListing(100000000), // Outlier
      ];

      const result = aggregatePrices(listings, { removeOutliers: true });

      expect(result.min).toBe(2000000);
      expect(result.max).toBe(3000000);
      expect(result.max).toBeLessThan(100000000);
    });
  });

  describe('Multiple outliers', () => {
    test('should remove multiple outliers', () => {
      const listings = [
        mockListing(2000000),
        mockListing(2500000),
        mockListing(3000000),
        mockListing(50000000), // Outlier 1
        mockListing(100000000), // Outlier 2
        mockListing(150000000), // Outlier 3
      ];

      const result = aggregatePrices(listings, { removeOutliers: true });

      expect(result.outliersRemoved).toBeGreaterThan(0);
      // The service keeps at least 3 prices, so we expect 3 or 4 prices remaining
      expect(result.count).toBeGreaterThanOrEqual(3);
      expect(result.count).toBeLessThanOrEqual(4);
      expect(result.median).toBeLessThanOrEqual(3000000);
    });
  });
});
