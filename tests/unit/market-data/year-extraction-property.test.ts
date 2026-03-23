/**
 * Property-Based Tests for Year Extraction Service
 * 
 * Property 2: Year Extraction Robustness
 * Validates: Requirements 2.1, 2.5, 7.1, 7.2, 7.3, 7.4
 * 
 * Tests that year extraction works correctly across all valid year formats
 * and positions within listing titles.
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { extractYear, isValidYear } from '@/features/market-data/services/year-extraction.service';

describe('Property 2: Year Extraction Robustness', () => {
  const currentYear = new Date().getFullYear();
  const minYear = 1980;
  const maxYear = currentYear + 1;

  test('should extract valid years regardless of position in title', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: minYear, max: maxYear }),
        fc.string({ minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 0, maxLength: 20 }),
        fc.constantFrom(' ', '-', '/', ' - ', ' / '), // Always use separators for word boundaries
        (year, prefix, suffix, separator) => {
          // Generate title with year at different positions
          const titles = [
            `${year}${separator}${suffix}`, // Year at beginning
            `${prefix}${separator}${year}${separator}${suffix}`, // Year in middle
            `${prefix}${separator}${year}`, // Year at end
          ].filter(t => t.trim().length > 0); // Filter out empty titles

          for (const title of titles) {
            const extracted = extractYear(title);
            expect(extracted).toBe(year);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should return null for titles without years', () => {
    fc.assert(
      fc.property(
        fc.string().filter(s => !/\b(19[89]\d|20[0-9]\d)\b/.test(s)),
        (title) => {
          const extracted = extractYear(title);
          expect(extracted).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should return null for invalid years outside range', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: 1900, max: 1979 }),
          fc.integer({ min: maxYear + 2, max: 2099 })
        ),
        (invalidYear) => {
          const title = `Vehicle ${invalidYear}`;
          const extracted = extractYear(title);
          expect(extracted).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should extract first year when multiple years present', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: minYear, max: maxYear }),
        fc.integer({ min: minYear, max: maxYear }),
        (year1, year2) => {
          const title = `Vehicle ${year1} or ${year2}`;
          const extracted = extractYear(title);
          expect(extracted).toBe(year1);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should validate years correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1900, max: 2099 }),
        (year) => {
          const valid = isValidYear(year);
          const expected = year >= minYear && year <= maxYear;
          expect(valid).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});
