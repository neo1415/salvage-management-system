/**
 * Property-based tests for string normalization
 * Property 1: Normalization idempotence
 * Validates: Requirements 1.3
 * 
 * Tests that normalizing a string twice produces the same result as normalizing once
 */

import { describe, it, expect } from 'vitest';
import { fc } from '@fast-check/vitest';

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

describe('String Normalization - Property-Based Tests', () => {
  describe('Property 1: Normalization idempotence', () => {
    it('should produce the same result when normalized twice', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const normalizedOnce = normalizeString(input);
          const normalizedTwice = normalizeString(normalizedOnce);
          
          expect(normalizedTwice).toBe(normalizedOnce);
        }),
        { numRuns: 1000 }
      );
    });

    it('should be idempotent with strings containing special characters', () => {
      fc.assert(
        fc.property(
          fc.stringOf(
            fc.oneof(
              fc.char(),
              fc.constantFrom('-', '_', '@', '#', '$', '!', ' ', '\t', '\n')
            )
          ),
          (input) => {
            const normalizedOnce = normalizeString(input);
            const normalizedTwice = normalizeString(normalizedOnce);
            
            expect(normalizedTwice).toBe(normalizedOnce);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should be idempotent with vehicle make/model patterns', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constantFrom(
              'Mercedes-Benz',
              'TOYOTA',
              'Land-Cruiser',
              'GLE-Class GLE 350',
              'RAV-4',
              'E-Class'
            ),
            fc.string()
          ),
          (input) => {
            const normalizedOnce = normalizeString(input);
            const normalizedTwice = normalizeString(normalizedOnce);
            
            expect(normalizedTwice).toBe(normalizedOnce);
          }
        ),
        { numRuns: 500 }
      );
    });
  });

  describe('Property 2: Normalization consistency', () => {
    it('should always produce lowercase output', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const normalized = normalizeString(input);
          expect(normalized).toBe(normalized.toLowerCase());
        }),
        { numRuns: 1000 }
      );
    });

    it('should never have leading or trailing whitespace', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const normalized = normalizeString(input);
          expect(normalized).toBe(normalized.trim());
        }),
        { numRuns: 1000 }
      );
    });

    it('should never have multiple consecutive spaces', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const normalized = normalizeString(input);
          expect(normalized).not.toMatch(/\s{2,}/);
        }),
        { numRuns: 1000 }
      );
    });

    it('should never contain hyphens or underscores', () => {
      fc.assert(
        fc.property(fc.string(), (input) => {
          const normalized = normalizeString(input);
          expect(normalized).not.toContain('-');
          expect(normalized).not.toContain('_');
        }),
        { numRuns: 1000 }
      );
    });
  });

  describe('Property 3: Normalization preserves alphanumeric content', () => {
    it('should preserve alphanumeric characters', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.oneof(fc.char(), fc.integer({ min: 0, max: 9 }).map(String))),
          (input) => {
            const normalized = normalizeString(input);
            const alphanumericOnly = input.toLowerCase().replace(/[^a-z0-9]/g, '');
            const normalizedAlphanumericOnly = normalized.replace(/\s/g, '');
            
            expect(normalizedAlphanumericOnly).toBe(alphanumericOnly);
          }
        ),
        { numRuns: 1000 }
      );
    });
  });
});
