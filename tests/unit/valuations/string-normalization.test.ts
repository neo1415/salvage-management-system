/**
 * Unit tests for string normalization in ValuationQueryService
 * Tests edge cases: empty strings, special characters, multiple spaces
 */

import { describe, it, expect } from 'vitest';

// Helper function to test normalization (mirrors private method)
function normalizeString(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[-_]/g, ' ') // Replace hyphens and underscores with spaces
    .replace(/[^\w\s]/g, '') // Remove special characters except word chars and spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces to single space
    .trim(); // Final trim to remove any leading/trailing spaces
}

describe('String Normalization', () => {
  describe('Basic normalization', () => {
    it('should convert to lowercase', () => {
      expect(normalizeString('TOYOTA')).toBe('toyota');
      expect(normalizeString('Mercedes-Benz')).toBe('mercedes benz');
    });

    it('should trim whitespace', () => {
      expect(normalizeString('  Toyota  ')).toBe('toyota');
      expect(normalizeString('\tCamry\n')).toBe('camry');
    });

    it('should remove hyphens', () => {
      expect(normalizeString('GLE-Class')).toBe('gle class');
      expect(normalizeString('E-Class')).toBe('e class');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeString('Toyota    Camry')).toBe('toyota camry');
      expect(normalizeString('GLE  350')).toBe('gle 350');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty strings', () => {
      expect(normalizeString('')).toBe('');
      expect(normalizeString('   ')).toBe('');
    });

    it('should handle special characters', () => {
      expect(normalizeString('Toyota@Camry')).toBe('toyotacamry');
      expect(normalizeString('Model#123')).toBe('model123');
      expect(normalizeString('GLE-350!')).toBe('gle 350');
    });

    it('should handle underscores', () => {
      expect(normalizeString('Land_Cruiser')).toBe('land cruiser');
      expect(normalizeString('RAV_4')).toBe('rav 4');
    });

    it('should handle mixed case with special characters', () => {
      expect(normalizeString('Mercedes-Benz GLE-Class GLE 350')).toBe('mercedes benz gle class gle 350');
      expect(normalizeString('TOYOTA LAND-CRUISER')).toBe('toyota land cruiser');
    });

    it('should handle numbers', () => {
      expect(normalizeString('RAV4')).toBe('rav4');
      expect(normalizeString('GLE 350')).toBe('gle 350');
      expect(normalizeString('4Runner')).toBe('4runner');
    });

    it('should handle single characters', () => {
      expect(normalizeString('X')).toBe('x');
      expect(normalizeString('-')).toBe('');
    });

    it('should handle strings with only special characters', () => {
      expect(normalizeString('---')).toBe('');
      expect(normalizeString('!!!')).toBe('');
      expect(normalizeString('@#$')).toBe('');
    });
  });

  describe('Real-world examples', () => {
    it('should normalize Mercedes-Benz models', () => {
      expect(normalizeString('Mercedes-Benz GLE-Class GLE 350')).toBe('mercedes benz gle class gle 350');
      expect(normalizeString('Mercedes-Benz E-Class')).toBe('mercedes benz e class');
    });

    it('should normalize Toyota models', () => {
      expect(normalizeString('Toyota Camry')).toBe('toyota camry');
      expect(normalizeString('TOYOTA LAND-CRUISER')).toBe('toyota land cruiser');
      expect(normalizeString('Toyota RAV-4')).toBe('toyota rav 4');
    });

    it('should normalize Hyundai models', () => {
      expect(normalizeString('Hyundai i10')).toBe('hyundai i10');
      expect(normalizeString('Hyundai Elantra')).toBe('hyundai elantra');
    });
  });
});
