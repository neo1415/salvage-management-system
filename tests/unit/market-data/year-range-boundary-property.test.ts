/**
 * Property Test: Year Range Boundary Validation
 * 
 * **Property 8: Year Range Boundary Validation**
 * **Validates: Requirements 7.5**
 * 
 * For any extracted year value, if the year is less than 1980 or greater than
 * (current year + 1), the year filter SHALL reject it as invalid.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractYear, isValidYear } from '@/features/market-data/services/year-extraction.service';

describe('Property 8: Year Range Boundary Validation', () => {
  const currentYear = new Date().getFullYear();
  const MIN_VALID_YEAR = 1980;
  const MAX_VALID_YEAR = currentYear + 1;
  
  it('should reject years below 1980 as invalid', () => {
    // Generator for years below minimum (1900-1979)
    const belowMinGen = fc.integer({ min: 1900, max: 1979 });
    
    fc.assert(
      fc.property(belowMinGen, (year) => {
        // Property: Years < 1980 should be invalid
        const result = isValidYear(year);
        
        expect(result).toBe(false);
        expect(year).toBeLessThan(MIN_VALID_YEAR);
      }),
      { numRuns: 100 }
    );
  });
  
  it('should reject years above current year + 1 as invalid', () => {
    // Generator for years above maximum (current+2 to current+100)
    const aboveMaxGen = fc.integer({ min: currentYear + 2, max: currentYear + 100 });
    
    fc.assert(
      fc.property(aboveMaxGen, (year) => {
        // Property: Years > (current year + 1) should be invalid
        const result = isValidYear(year);
        
        expect(result).toBe(false);
        expect(year).toBeGreaterThan(MAX_VALID_YEAR);
      }),
      { numRuns: 100 }
    );
  });
  
  it('should accept boundary year 1980 as valid', () => {
    // Test lower boundary
    const result = isValidYear(1980);
    
    expect(result).toBe(true);
  });
  
  it('should accept boundary year current + 1 as valid', () => {
    // Test upper boundary
    const result = isValidYear(currentYear + 1);
    
    expect(result).toBe(true);
  });
  
  it('should accept all years within valid range', () => {
    // Generator for years within valid range (1980 to current+1)
    const validYearGen = fc.integer({ min: MIN_VALID_YEAR, max: MAX_VALID_YEAR });
    
    fc.assert(
      fc.property(validYearGen, (year) => {
        // Property: All years in [1980, current+1] should be valid
        const result = isValidYear(year);
        
        expect(result).toBe(true);
        expect(year).toBeGreaterThanOrEqual(MIN_VALID_YEAR);
        expect(year).toBeLessThanOrEqual(MAX_VALID_YEAR);
      }),
      { numRuns: 200 }
    );
  });
  
  it('should reject years outside valid range in listing titles', () => {
    // Generator for invalid years in titles
    const invalidYearTitleGen = fc.oneof(
      fc.integer({ min: 1900, max: 1979 }).map(year => `Toyota Camry ${year}`),
      fc.integer({ min: currentYear + 2, max: 2099 }).map(year => `Honda Accord ${year}`)
    );
    
    fc.assert(
      fc.property(invalidYearTitleGen, (title) => {
        // Property: Extracting year from title with invalid year should return null
        // or the extracted year should fail validation
        const extractedYear = extractYear(title);
        
        if (extractedYear !== null) {
          const isValid = isValidYear(extractedYear);
          expect(isValid).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
  
  it('should verify boundary years are exactly at limits', () => {
    // Test that boundary years are precisely at the defined limits
    expect(isValidYear(MIN_VALID_YEAR - 1)).toBe(false);
    expect(isValidYear(MIN_VALID_YEAR)).toBe(true);
    expect(isValidYear(MAX_VALID_YEAR)).toBe(true);
    expect(isValidYear(MAX_VALID_YEAR + 1)).toBe(false);
  });
  
  it('should handle edge cases near boundaries', () => {
    // Generator for years near boundaries
    const nearBoundaryGen = fc.oneof(
      fc.integer({ min: 1978, max: 1982 }), // Near lower boundary
      fc.integer({ min: currentYear - 1, max: currentYear + 3 }) // Near upper boundary
    );
    
    fc.assert(
      fc.property(nearBoundaryGen, (year) => {
        // Property: Validation should be consistent near boundaries
        const result = isValidYear(year);
        const expected = year >= MIN_VALID_YEAR && year <= MAX_VALID_YEAR;
        
        expect(result).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });
  
  it('should reject extreme years far outside range', () => {
    // Test extreme cases
    const extremeYears = [
      1000, 1500, 1800, 1900, // Very old
      2100, 2200, 2500, 3000  // Far future
    ];
    
    extremeYears.forEach(year => {
      const result = isValidYear(year);
      expect(result).toBe(false);
    });
  });
  
  it('should maintain consistency across multiple validations', () => {
    // Generator for random years
    const anyYearGen = fc.integer({ min: 1900, max: 2099 });
    
    fc.assert(
      fc.property(anyYearGen, (year) => {
        // Property: Multiple calls with same year should return same result
        const result1 = isValidYear(year);
        const result2 = isValidYear(year);
        const result3 = isValidYear(year);
        
        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
      }),
      { numRuns: 100 }
    );
  });
});
