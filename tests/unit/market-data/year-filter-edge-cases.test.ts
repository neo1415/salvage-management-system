/**
 * Unit Tests for Year Filter Edge Cases
 * 
 * Tests specific edge cases for year filtering logic.
 * Requirements: 2.2, 2.3, 2.4
 */

import { describe, test, expect } from 'vitest';
import { filterByYear } from '@/features/market-data/services/year-filter.service';
import type { SourcePrice } from '@/features/market-data/types';

describe('Year Filter Edge Cases', () => {
  const mockListing = (year: number | string): SourcePrice => ({
    source: 'jiji',
    price: 2000000,
    currency: 'NGN',
    listingUrl: 'https://example.com',
    listingTitle: typeof year === 'number' ? `Vehicle ${year}` : year,
    scrapedAt: new Date(),
  });

  describe('Exact year match', () => {
    test('should accept listing with exact year match', () => {
      const listings = [mockListing(2004)];
      const result = filterByYear(listings, { targetYear: 2004, tolerance: 1 });

      expect(result.valid.length).toBe(1);
      expect(result.rejected.length).toBe(0);
      expect(result.yearMatchRate).toBe(100);
    });
  });

  describe('±1 year tolerance', () => {
    test('should accept listing 1 year older', () => {
      const listings = [mockListing(2003)];
      const result = filterByYear(listings, { targetYear: 2004, tolerance: 1 });

      expect(result.valid.length).toBe(1);
      expect(result.rejected.length).toBe(0);
    });

    test('should accept listing 1 year newer', () => {
      const listings = [mockListing(2005)];
      const result = filterByYear(listings, { targetYear: 2004, tolerance: 1 });

      expect(result.valid.length).toBe(1);
      expect(result.rejected.length).toBe(0);
    });
  });

  describe('±2 years (outside tolerance)', () => {
    test('should reject listing 2 years older', () => {
      const listings = [mockListing(2002)];
      const result = filterByYear(listings, { targetYear: 2004, tolerance: 1 });

      expect(result.valid.length).toBe(0);
      expect(result.rejected.length).toBe(1);
      expect(result.rejected[0].extractedYear).toBe(2002);
      expect(result.rejected[0].reason).toContain('outside tolerance');
    });

    test('should reject listing 2 years newer', () => {
      const listings = [mockListing(2006)];
      const result = filterByYear(listings, { targetYear: 2004, tolerance: 1 });

      expect(result.valid.length).toBe(0);
      expect(result.rejected.length).toBe(1);
      expect(result.rejected[0].extractedYear).toBe(2006);
    });
  });

  describe('Missing year in listing', () => {
    test('should reject listing without year', () => {
      const listings = [mockListing('Honda Accord - Clean')];
      const result = filterByYear(listings, { targetYear: 2004, tolerance: 1 });

      expect(result.valid.length).toBe(0);
      expect(result.rejected.length).toBe(1);
      expect(result.rejected[0].extractedYear).toBeNull();
      expect(result.rejected[0].reason).toContain('No year found');
    });
  });

  describe('Empty listing array', () => {
    test('should handle empty array gracefully', () => {
      const result = filterByYear([], { targetYear: 2004, tolerance: 1 });

      expect(result.valid.length).toBe(0);
      expect(result.rejected.length).toBe(0);
      expect(result.yearMatchRate).toBe(0);
    });
  });

  describe('All listings rejected scenario', () => {
    test('should reject all listings when none match', () => {
      const listings = [
        mockListing(2010),
        mockListing(2015),
        mockListing('No year'),
      ];
      const result = filterByYear(listings, { targetYear: 2004, tolerance: 1 });

      expect(result.valid.length).toBe(0);
      expect(result.rejected.length).toBe(3);
      expect(result.yearMatchRate).toBe(0);
    });
  });

  describe('Mixed valid and invalid listings', () => {
    test('should correctly separate valid and invalid listings', () => {
      const listings = [
        mockListing(2004), // Valid: exact match
        mockListing(2003), // Valid: -1 year
        mockListing(2005), // Valid: +1 year
        mockListing(2010), // Invalid: +6 years
        mockListing('No year'), // Invalid: no year
      ];
      const result = filterByYear(listings, { targetYear: 2004, tolerance: 1 });

      expect(result.valid.length).toBe(3);
      expect(result.rejected.length).toBe(2);
      expect(result.yearMatchRate).toBe(60); // 3/5 * 100
    });
  });

  describe('Year match rate calculation', () => {
    test('should calculate 0% when no listings match', () => {
      const listings = [mockListing(2020), mockListing(2021)];
      const result = filterByYear(listings, { targetYear: 2004, tolerance: 1 });

      expect(result.yearMatchRate).toBe(0);
    });

    test('should calculate 100% when all listings match', () => {
      const listings = [mockListing(2004), mockListing(2003), mockListing(2005)];
      const result = filterByYear(listings, { targetYear: 2004, tolerance: 1 });

      expect(result.yearMatchRate).toBe(100);
    });

    test('should calculate 50% when half match', () => {
      const listings = [mockListing(2004), mockListing(2020)];
      const result = filterByYear(listings, { targetYear: 2004, tolerance: 1 });

      expect(result.yearMatchRate).toBe(50);
    });
  });

  describe('Custom tolerance values', () => {
    test('should respect tolerance of 0 (exact match only)', () => {
      const listings = [
        mockListing(2004), // Valid
        mockListing(2003), // Invalid
        mockListing(2005), // Invalid
      ];
      const result = filterByYear(listings, { targetYear: 2004, tolerance: 0 });

      expect(result.valid.length).toBe(1);
      expect(result.rejected.length).toBe(2);
    });

    test('should respect tolerance of 2', () => {
      const listings = [
        mockListing(2002), // Valid: -2 years
        mockListing(2006), // Valid: +2 years
        mockListing(2001), // Invalid: -3 years
      ];
      const result = filterByYear(listings, { targetYear: 2004, tolerance: 2 });

      expect(result.valid.length).toBe(2);
      expect(result.rejected.length).toBe(1);
    });
  });
});
