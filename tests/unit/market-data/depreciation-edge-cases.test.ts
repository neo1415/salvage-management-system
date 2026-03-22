/**
 * Unit Tests for Depreciation Edge Cases
 * 
 * Tests specific edge cases for depreciation calculation logic.
 * Requirements: 5.2, 5.3, 5.4, 5.5, 5.6
 */

import { describe, test, expect } from 'vitest';
import { applyDepreciation, getDepreciationRate } from '@/features/market-data/services/depreciation.service';
import type { SourcePrice } from '@/features/market-data/types';

describe('Depreciation Edge Cases', () => {
  const currentYear = new Date().getFullYear();

  const mockListing = (year: number, price: number): SourcePrice => ({
    source: 'jiji',
    price,
    currency: 'NGN',
    listingUrl: 'https://example.com',
    listingTitle: `Vehicle ${year}`,
    scrapedAt: new Date(),
  });

  describe('Vehicle older than target', () => {
    test('should not adjust price for older vehicles', () => {
      const targetYear = 2010;
      const listings = [mockListing(2008, 2000000)];

      const result = applyDepreciation(listings, { targetYear, currentYear });

      expect(result.adjustedPrices[0].price).toBe(2000000);
      expect(result.appliedCount).toBe(0);
      expect(result.confidencePenalty).toBe(0);
    });
  });

  describe('Vehicle same year as target', () => {
    test('should not adjust price for same-year vehicles', () => {
      const targetYear = 2010;
      const listings = [mockListing(2010, 2000000)];

      const result = applyDepreciation(listings, { targetYear, currentYear });

      expect(result.adjustedPrices[0].price).toBe(2000000);
      expect(result.appliedCount).toBe(0);
      expect(result.confidencePenalty).toBe(0);
    });
  });

  describe('Extreme depreciation resulting in <₦100k', () => {
    test('should floor at ₦100,000', () => {
      const targetYear = 2000;
      const listings = [mockListing(2020, 500000)]; // 20 years newer

      const result = applyDepreciation(listings, { targetYear, currentYear });

      expect(result.adjustedPrices[0].price).toBe(100000);
      expect(result.appliedCount).toBe(1);
    });
  });

  describe('1-year difference (15% rate)', () => {
    test('should apply 15% depreciation for 1 year', () => {
      const targetYear = 2010;
      const originalPrice = 2000000;
      const listings = [mockListing(2011, originalPrice)];

      const result = applyDepreciation(listings, { targetYear, currentYear });

      const expectedPrice = Math.round(originalPrice * 0.85); // 15% depreciation
      expect(result.adjustedPrices[0].price).toBe(expectedPrice);
      expect(result.appliedCount).toBe(1);
      expect(result.confidencePenalty).toBe(10); // 1 year * 10 points
    });
  });

  describe('5-year difference (15% compounded 5 times)', () => {
    test('should apply 15% depreciation compounded for 5 years', () => {
      const targetYear = 2010;
      const originalPrice = 5000000;
      const listings = [mockListing(2015, originalPrice)];

      const result = applyDepreciation(listings, { targetYear, currentYear });

      // Calculate: 5M * (0.85)^5
      let expectedPrice = originalPrice;
      for (let i = 0; i < 5; i++) {
        expectedPrice = expectedPrice * 0.85;
      }
      expectedPrice = Math.round(expectedPrice);

      expect(result.adjustedPrices[0].price).toBe(expectedPrice);
      expect(result.appliedCount).toBe(1);
      expect(result.confidencePenalty).toBe(50); // 5 years * 10 points = 50 (max)
    });
  });

  describe('10-year difference (15% for 5 years, 10% for 5 years)', () => {
    test('should apply tiered depreciation for 10 years', () => {
      const targetYear = 2010;
      const originalPrice = 10000000;
      const listings = [mockListing(2020, originalPrice)];

      const result = applyDepreciation(listings, { targetYear, currentYear });

      // Calculate: 10M * (0.85)^5 * (0.90)^5
      let expectedPrice = originalPrice;
      // First 5 years at 15%
      for (let i = 0; i < 5; i++) {
        expectedPrice = expectedPrice * 0.85;
      }
      // Next 5 years at 10%
      for (let i = 0; i < 5; i++) {
        expectedPrice = expectedPrice * 0.90;
      }
      expectedPrice = Math.round(expectedPrice);

      expect(result.adjustedPrices[0].price).toBe(expectedPrice);
      expect(result.appliedCount).toBe(1);
      expect(result.confidencePenalty).toBe(50); // Max 50 points
    });
  });

  describe('15-year difference (all three rate tiers)', () => {
    test('should apply all three depreciation tiers for 15 years', () => {
      const targetYear = 2005;
      const originalPrice = 15000000;
      const listings = [mockListing(2020, originalPrice)];

      const result = applyDepreciation(listings, { targetYear, currentYear });

      // Calculate: 15M * (0.85)^5 * (0.90)^5 * (0.95)^5
      let expectedPrice = originalPrice;
      // First 5 years at 15%
      for (let i = 0; i < 5; i++) {
        expectedPrice = expectedPrice * 0.85;
      }
      // Next 5 years at 10%
      for (let i = 0; i < 5; i++) {
        expectedPrice = expectedPrice * 0.90;
      }
      // Next 5 years at 5%
      for (let i = 0; i < 5; i++) {
        expectedPrice = expectedPrice * 0.95;
      }
      expectedPrice = Math.round(expectedPrice);

      expect(result.adjustedPrices[0].price).toBe(expectedPrice);
      expect(result.appliedCount).toBe(1);
      expect(result.confidencePenalty).toBe(50); // Max 50 points
    });
  });

  describe('Depreciation rate function', () => {
    test('should return 15% for years 1-5', () => {
      expect(getDepreciationRate(1)).toBe(0.15);
      expect(getDepreciationRate(3)).toBe(0.15);
      expect(getDepreciationRate(5)).toBe(0.15);
    });

    test('should return 10% for years 6-10', () => {
      expect(getDepreciationRate(6)).toBe(0.10);
      expect(getDepreciationRate(8)).toBe(0.10);
      expect(getDepreciationRate(10)).toBe(0.10);
    });

    test('should return 5% for years 11+', () => {
      expect(getDepreciationRate(11)).toBe(0.05);
      expect(getDepreciationRate(15)).toBe(0.05);
      expect(getDepreciationRate(20)).toBe(0.05);
    });

    test('should return 0% for non-positive differences', () => {
      expect(getDepreciationRate(0)).toBe(0);
      expect(getDepreciationRate(-1)).toBe(0);
      expect(getDepreciationRate(-5)).toBe(0);
    });
  });

  describe('Multiple listings with mixed years', () => {
    test('should handle mix of older, same, and newer vehicles', () => {
      const targetYear = 2010;
      const listings = [
        mockListing(2008, 1500000), // Older - no adjustment
        mockListing(2010, 2000000), // Same - no adjustment
        mockListing(2012, 2500000), // Newer - adjust
        mockListing(2015, 3000000), // Much newer - adjust more
      ];

      const result = applyDepreciation(listings, { targetYear, currentYear });

      expect(result.adjustedPrices.length).toBe(4);
      expect(result.appliedCount).toBe(2); // Only 2012 and 2015

      // First two should be unchanged
      expect(result.adjustedPrices[0].price).toBe(1500000);
      expect(result.adjustedPrices[1].price).toBe(2000000);

      // Last two should be depreciated
      expect(result.adjustedPrices[2].price).toBeLessThan(2500000);
      expect(result.adjustedPrices[3].price).toBeLessThan(3000000);

      // Confidence penalty should be based on max year difference (5 years)
      expect(result.confidencePenalty).toBe(50);
    });
  });

  describe('Empty listings', () => {
    test('should handle empty listings array', () => {
      const result = applyDepreciation([], { targetYear: 2010, currentYear });

      expect(result.adjustedPrices.length).toBe(0);
      expect(result.appliedCount).toBe(0);
      expect(result.confidencePenalty).toBe(0);
    });
  });

  describe('Listings without extractable year', () => {
    test('should not adjust listings without year in title', () => {
      const listings: SourcePrice[] = [{
        source: 'jiji',
        price: 2000000,
        currency: 'NGN',
        listingUrl: 'https://example.com',
        listingTitle: 'Honda Accord',
        scrapedAt: new Date(),
      }];

      const result = applyDepreciation(listings, { targetYear: 2010, currentYear });

      expect(result.adjustedPrices[0].price).toBe(2000000);
      expect(result.appliedCount).toBe(0);
    });
  });

  describe('Confidence penalty calculation', () => {
    test('should cap confidence penalty at 50 points', () => {
      const targetYear = 2000;
      const listings = [mockListing(2020, 5000000)]; // 20 years difference

      const result = applyDepreciation(listings, { targetYear, currentYear });

      expect(result.confidencePenalty).toBe(50); // Capped at 50
    });

    test('should calculate penalty based on maximum year difference', () => {
      const targetYear = 2010;
      const listings = [
        mockListing(2011, 2000000), // 1 year
        mockListing(2013, 2500000), // 3 years
        mockListing(2012, 2200000), // 2 years
      ];

      const result = applyDepreciation(listings, { targetYear, currentYear });

      // Max difference is 3 years
      expect(result.confidencePenalty).toBe(30); // 3 * 10
    });
  });

  describe('Rounding behavior', () => {
    test('should round adjusted prices to nearest integer', () => {
      const targetYear = 2010;
      const listings = [mockListing(2011, 1000001)]; // Odd number

      const result = applyDepreciation(listings, { targetYear, currentYear });

      // Result should be an integer
      expect(Number.isInteger(result.adjustedPrices[0].price)).toBe(true);
    });
  });
});
