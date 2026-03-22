/**
 * Property-Based Tests for Confidence Scoring Service
 * 
 * Feature: market-data-scraping-system
 * Tests universal properties of confidence score calculation
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import { calculateConfidence } from '@/features/market-data/services/confidence.service';

describe('Confidence Scoring - Property Tests', () => {
  describe('Property 25: Source-count-based confidence scoring', () => {
    /**
     * **Validates: Requirements 8.1, 8.2, 8.3**
     * 
     * For any market price calculation with fresh data (< 7 days):
     * - 3+ sources should yield 90-100% confidence
     * - 2 sources should yield 70-89% confidence
     * - 1 source should yield 50-69% confidence
     */
    test('confidence score ranges match source count for fresh data', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // sourceCount
          fc.integer({ min: 0, max: 6 }),  // dataAgeDays (fresh)
          (sourceCount, dataAgeDays) => {
            const result = calculateConfidence({ sourceCount, dataAgeDays });

            if (sourceCount >= 3) {
              expect(result.score).toBeGreaterThanOrEqual(90);
              expect(result.score).toBeLessThanOrEqual(100);
            } else if (sourceCount === 2) {
              expect(result.score).toBeGreaterThanOrEqual(70);
              expect(result.score).toBeLessThanOrEqual(89);
            } else if (sourceCount === 1) {
              expect(result.score).toBeGreaterThanOrEqual(50);
              expect(result.score).toBeLessThanOrEqual(69);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 26: Staleness confidence penalty', () => {
    /**
     * **Validates: Requirements 8.4, 8.5**
     * 
     * For any market price using stale data:
     * - 7-30 days old should reduce confidence by 20 points
     * - 30+ days old should reduce confidence by 40 points
     */
    test('stale data (7-30 days) reduces confidence by 20 points', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // sourceCount
          fc.integer({ min: 7, max: 29 }), // dataAgeDays (stale)
          (sourceCount, dataAgeDays) => {
            const freshResult = calculateConfidence({ sourceCount, dataAgeDays: 0 });
            const staleResult = calculateConfidence({ sourceCount, dataAgeDays });

            // Staleness penalty should be exactly 20 points
            expect(staleResult.factors.stalenessPenalty).toBe(20);
            expect(staleResult.score).toBe(Math.max(0, freshResult.score - 20));
          }
        ),
        { numRuns: 100 }
      );
    });

    test('very stale data (30+ days) reduces confidence by 40 points', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),  // sourceCount
          fc.integer({ min: 30, max: 365 }), // dataAgeDays (very stale)
          (sourceCount, dataAgeDays) => {
            const freshResult = calculateConfidence({ sourceCount, dataAgeDays: 0 });
            const veryStaleResult = calculateConfidence({ sourceCount, dataAgeDays });

            // Staleness penalty should be exactly 40 points
            expect(veryStaleResult.factors.stalenessPenalty).toBe(40);
            expect(veryStaleResult.score).toBe(Math.max(0, freshResult.score - 40));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 27: Confidence score presence', () => {
    /**
     * **Validates: Requirements 8.6, 7.6**
     * 
     * For any assessment, a confidence score should be present and valid
     */
    test('confidence score is always present and within valid range', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }),   // sourceCount
          fc.integer({ min: 0, max: 365 }),  // dataAgeDays
          (sourceCount, dataAgeDays) => {
            const result = calculateConfidence({ sourceCount, dataAgeDays });

            // Score should always be present
            expect(result.score).toBeDefined();
            expect(typeof result.score).toBe('number');

            // Score should be between 0 and 100
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(100);

            // Factors should be present
            expect(result.factors).toBeDefined();
            expect(result.factors.baseScore).toBeDefined();
            expect(result.factors.sourceCount).toBe(sourceCount);
            expect(result.factors.dataAgeDays).toBe(dataAgeDays);
            expect(result.factors.stalenessPenalty).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('confidence score never goes below 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),   // sourceCount
          fc.integer({ min: 0, max: 1000 }), // dataAgeDays (including extreme values)
          (sourceCount, dataAgeDays) => {
            const result = calculateConfidence({ sourceCount, dataAgeDays });

            // Score should never be negative
            expect(result.score).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Additional Confidence Properties', () => {
    test('zero sources always yields zero confidence', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 365 }), // dataAgeDays
          (dataAgeDays) => {
            const result = calculateConfidence({ sourceCount: 0, dataAgeDays });

            expect(result.score).toBe(0);
            expect(result.factors.baseScore).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('confidence decreases monotonically with data age', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // sourceCount
          fc.integer({ min: 0, max: 300 }), // dataAgeDays1
          fc.integer({ min: 0, max: 300 }), // dataAgeDays2
          (sourceCount, dataAgeDays1, dataAgeDays2) => {
            const result1 = calculateConfidence({ sourceCount, dataAgeDays: dataAgeDays1 });
            const result2 = calculateConfidence({ sourceCount, dataAgeDays: dataAgeDays2 });

            // Older data should have equal or lower confidence
            if (dataAgeDays1 < dataAgeDays2) {
              expect(result1.score).toBeGreaterThanOrEqual(result2.score);
            } else if (dataAgeDays1 > dataAgeDays2) {
              expect(result1.score).toBeLessThanOrEqual(result2.score);
            } else {
              expect(result1.score).toBe(result2.score);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('confidence increases monotonically with source count', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10 }), // sourceCount1
          fc.integer({ min: 0, max: 10 }), // sourceCount2
          fc.integer({ min: 0, max: 365 }), // dataAgeDays
          (sourceCount1, sourceCount2, dataAgeDays) => {
            const result1 = calculateConfidence({ sourceCount: sourceCount1, dataAgeDays });
            const result2 = calculateConfidence({ sourceCount: sourceCount2, dataAgeDays });

            // More sources should have equal or higher confidence
            if (sourceCount1 < sourceCount2) {
              expect(result1.score).toBeLessThanOrEqual(result2.score);
            } else if (sourceCount1 > sourceCount2) {
              expect(result1.score).toBeGreaterThanOrEqual(result2.score);
            } else {
              expect(result1.score).toBe(result2.score);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
