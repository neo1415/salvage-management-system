/**
 * Property Test: Confidence Score Monotonicity
 * 
 * **Property 6: Confidence Score Monotonicity**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 * 
 * Verifies that higher year match rates always produce higher or equal confidence scores
 * when all other factors are held constant.
 * 
 * This property ensures the confidence scoring system is monotonic with respect to
 * year match quality - better data quality should never result in lower confidence.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { calculateConfidence } from '../../../src/features/market-data/services/confidence.service';

describe('Property 6: Confidence Score Monotonicity', () => {
  it('should produce higher or equal confidence for higher year match rates', () => {
    fc.assert(
      fc.property(
        // Generate two year match rates where rate2 > rate1
        fc.integer({ min: 0, max: 99 }).chain(rate1 =>
          fc.integer({ min: rate1 + 1, max: 100 }).map(rate2 => ({ rate1, rate2 }))
        ),
        // Generate other factors (held constant)
        fc.integer({ min: 1, max: 10 }), // sourceCount
        fc.integer({ min: 0, max: 60 }), // dataAgeDays
        fc.integer({ min: 3, max: 20 }), // sampleSize
        fc.boolean(), // depreciationApplied
        ({ rate1, rate2 }, sourceCount, dataAgeDays, sampleSize, depreciationApplied) => {
          // Calculate confidence for both rates with same other factors
          const result1 = calculateConfidence({
            sourceCount,
            dataAgeDays,
            yearMatchRate: rate1,
            sampleSize,
            depreciationApplied,
          });

          const result2 = calculateConfidence({
            sourceCount,
            dataAgeDays,
            yearMatchRate: rate2,
            sampleSize,
            depreciationApplied,
          });

          // Higher year match rate should produce higher or equal confidence
          expect(result2.score).toBeGreaterThanOrEqual(result1.score);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should respect confidence score ranges based on year match rate', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }), // yearMatchRate
        fc.integer({ min: 3, max: 10 }), // sourceCount (3+ for high base score)
        fc.integer({ min: 6, max: 20 }), // sampleSize (6+ for no penalty)
        (yearMatchRate, sourceCount, sampleSize) => {
          // Use fresh data and no depreciation for clearest signal
          const result = calculateConfidence({
            sourceCount,
            dataAgeDays: 0,
            yearMatchRate,
            sampleSize,
            depreciationApplied: false,
          });

          // Verify score is in valid range
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(100);

          // Verify penalties are applied correctly based on year match rate
          if (yearMatchRate >= 70) {
            // No year match penalty
            expect(result.factors.yearMatchPenalty).toBe(0);
          } else if (yearMatchRate >= 40) {
            // Moderate penalty
            expect(result.factors.yearMatchPenalty).toBe(20);
          } else {
            // High penalty
            expect(result.factors.yearMatchPenalty).toBe(40);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply sample size penalties correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // sampleSize
        fc.integer({ min: 3, max: 10 }), // sourceCount
        (sampleSize, sourceCount) => {
          const result = calculateConfidence({
            sourceCount,
            dataAgeDays: 0,
            yearMatchRate: 100, // Perfect match
            sampleSize,
            depreciationApplied: false,
          });

          // Verify sample size penalties
          if (sampleSize < 3) {
            expect(result.factors.sampleSizePenalty).toBe(30);
            expect(result.warnings).toContain(`Very small sample size (${sampleSize} listings)`);
          } else if (sampleSize < 6) {
            expect(result.factors.sampleSizePenalty).toBe(15);
            expect(result.warnings).toContain(`Small sample size (${sampleSize} listings)`);
          } else {
            expect(result.factors.sampleSizePenalty).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply depreciation penalty when depreciation is used', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }), // sourceCount
        fc.integer({ min: 0, max: 60 }), // dataAgeDays
        fc.integer({ min: 70, max: 100 }), // yearMatchRate (high)
        fc.integer({ min: 6, max: 20 }), // sampleSize (good)
        (sourceCount, dataAgeDays, yearMatchRate, sampleSize) => {
          // Calculate with and without depreciation
          const withoutDepreciation = calculateConfidence({
            sourceCount,
            dataAgeDays,
            yearMatchRate,
            sampleSize,
            depreciationApplied: false,
          });

          const withDepreciation = calculateConfidence({
            sourceCount,
            dataAgeDays,
            yearMatchRate,
            sampleSize,
            depreciationApplied: true,
          });

          // Depreciation should reduce confidence by 50 points (or to 0)
          expect(withDepreciation.score).toBe(Math.max(0, withoutDepreciation.score - 50));
          expect(withDepreciation.factors.depreciationPenalty).toBe(50);
          expect(withDepreciation.warnings).toContain('Depreciation was applied to newer vehicles');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should never produce negative confidence scores', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // sourceCount
        fc.integer({ min: 0, max: 100 }), // dataAgeDays
        fc.integer({ min: 0, max: 100 }), // yearMatchRate
        fc.integer({ min: 1, max: 20 }), // sampleSize
        fc.boolean(), // depreciationApplied
        (sourceCount, dataAgeDays, yearMatchRate, sampleSize, depreciationApplied) => {
          const result = calculateConfidence({
            sourceCount,
            dataAgeDays,
            yearMatchRate,
            sampleSize,
            depreciationApplied,
          });

          // Score should never be negative
          expect(result.score).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});
