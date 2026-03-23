/**
 * Unit Tests for Year Extraction Edge Cases
 * 
 * Tests specific edge cases and boundary conditions for year extraction.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { describe, test, expect } from 'vitest';
import { extractYear, isValidYear } from '@/features/market-data/services/year-extraction.service';

describe('Year Extraction Edge Cases', () => {
  const currentYear = new Date().getFullYear();

  describe('Multiple years in title', () => {
    test('should extract first year when multiple years present', () => {
      expect(extractYear('Honda Accord 2004/2005')).toBe(2004);
      expect(extractYear('Mercedes 2020 or 2021 model')).toBe(2020);
      expect(extractYear('2015-2016 Toyota Camry')).toBe(2015);
    });
  });

  describe('Year position in title', () => {
    test('should extract year at beginning of title', () => {
      expect(extractYear('2004 Honda Accord')).toBe(2004);
      expect(extractYear('2015 Toyota Camry EX-L')).toBe(2015);
    });

    test('should extract year in middle of title', () => {
      expect(extractYear('Honda Accord 2004 - Clean')).toBe(2004);
      expect(extractYear('Toyota 2015 Camry')).toBe(2015);
    });

    test('should extract year at end of title', () => {
      expect(extractYear('Honda Accord 2004')).toBe(2004);
      expect(extractYear('Clean Toyota Camry 2015')).toBe(2015);
    });
  });

  describe('Various separators', () => {
    test('should handle spaces', () => {
      expect(extractYear('Honda Accord 2004')).toBe(2004);
    });

    test('should handle dashes', () => {
      expect(extractYear('Honda-Accord-2004')).toBe(2004);
      expect(extractYear('Honda Accord - 2004')).toBe(2004);
    });

    test('should handle slashes', () => {
      expect(extractYear('Honda/Accord/2004')).toBe(2004);
      expect(extractYear('Honda Accord / 2004')).toBe(2004);
    });

    test('should handle no separators', () => {
      // Note: Regex requires word boundaries, so concatenated text won't match
      // This is expected behavior to avoid false positives
      expect(extractYear('HondaAccord2004')).toBeNull();
    });
  });

  describe('Boundary years', () => {
    test('should accept year 1980 (minimum valid year)', () => {
      expect(extractYear('Honda Accord 1980')).toBe(1980);
      expect(isValidYear(1980)).toBe(true);
    });

    test('should reject year 1979 (below minimum)', () => {
      expect(extractYear('Honda Accord 1979')).toBeNull();
      expect(isValidYear(1979)).toBe(false);
    });

    test('should accept current year', () => {
      expect(extractYear(`Honda Accord ${currentYear}`)).toBe(currentYear);
      expect(isValidYear(currentYear)).toBe(true);
    });

    test('should accept current year + 1', () => {
      const nextYear = currentYear + 1;
      expect(extractYear(`Honda Accord ${nextYear}`)).toBe(nextYear);
      expect(isValidYear(nextYear)).toBe(true);
    });

    test('should reject current year + 2', () => {
      const futureYear = currentYear + 2;
      expect(extractYear(`Honda Accord ${futureYear}`)).toBeNull();
      expect(isValidYear(futureYear)).toBe(false);
    });
  });

  describe('Non-year 4-digit numbers', () => {
    test('should not extract engine displacement as year', () => {
      expect(extractYear('Honda Accord 2500cc engine')).toBeNull();
      expect(extractYear('Toyota 3000cc V6')).toBeNull();
    });

    test('should not extract price as year', () => {
      expect(extractYear('Honda Accord ₦1500 daily')).toBeNull();
    });

    test('should extract year even with other numbers present', () => {
      expect(extractYear('Honda Accord 2004 2500cc')).toBe(2004);
      expect(extractYear('2015 Toyota Camry 3000cc')).toBe(2015);
    });
  });

  describe('Invalid inputs', () => {
    test('should return null for empty string', () => {
      expect(extractYear('')).toBeNull();
    });

    test('should return null for null input', () => {
      expect(extractYear(null as any)).toBeNull();
    });

    test('should return null for undefined input', () => {
      expect(extractYear(undefined as any)).toBeNull();
    });

    test('should return null for non-string input', () => {
      expect(extractYear(2004 as any)).toBeNull();
      expect(extractYear({} as any)).toBeNull();
    });
  });

  describe('isValidYear edge cases', () => {
    test('should return false for null', () => {
      expect(isValidYear(null as any)).toBe(false);
    });

    test('should return false for undefined', () => {
      expect(isValidYear(undefined as any)).toBe(false);
    });

    test('should return false for NaN', () => {
      expect(isValidYear(NaN)).toBe(false);
    });

    test('should return false for non-number', () => {
      expect(isValidYear('2004' as any)).toBe(false);
    });
  });
});
