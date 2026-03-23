/**
 * Unit Test: Confidence Calculation Edge Cases
 * 
 * Tests specific edge cases and boundary conditions for confidence scoring.
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5, 5.6
 */

import { describe, it, expect } from 'vitest';
import { calculateConfidence } from '../../../src/features/market-data/services/confidence.service';

describe('Confidence Calculation Edge Cases', () => {
  describe('Year Match Rate Thresholds', () => {
    it('should apply no penalty for 70% year match rate', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        yearMatchRate: 70,
        sampleSize: 10,
        depreciationApplied: false,
      });

      expect(result.factors.yearMatchPenalty).toBe(0);
      expect(result.warnings).not.toContain(expect.stringContaining('year match'));
    });

    it('should apply 20-point penalty for 69% year match rate', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        yearMatchRate: 69,
        sampleSize: 10,
        depreciationApplied: false,
      });

      expect(result.factors.yearMatchPenalty).toBe(20);
      expect(result.warnings).toContain('Moderate year match rate (69.0%)');
    });

    it('should apply 20-point penalty for 40% year match rate', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        yearMatchRate: 40,
        sampleSize: 10,
        depreciationApplied: false,
      });

      expect(result.factors.yearMatchPenalty).toBe(20);
      expect(result.warnings).toContain('Moderate year match rate (40.0%)');
    });

    it('should apply 40-point penalty for 39% year match rate', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        yearMatchRate: 39,
        sampleSize: 10,
        depreciationApplied: false,
      });

      expect(result.factors.yearMatchPenalty).toBe(40);
      expect(result.warnings).toContain('Low year match rate (39.0%)');
    });

    it('should apply 40-point penalty for 0% year match rate', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        yearMatchRate: 0,
        sampleSize: 10,
        depreciationApplied: false,
      });

      expect(result.factors.yearMatchPenalty).toBe(40);
      expect(result.warnings).toContain('Low year match rate (0.0%)');
    });
  });

  describe('Sample Size Thresholds', () => {
    it('should apply no penalty for 6 listings', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        yearMatchRate: 100,
        sampleSize: 6,
        depreciationApplied: false,
      });

      expect(result.factors.sampleSizePenalty).toBe(0);
      expect(result.warnings).not.toContain(expect.stringContaining('sample size'));
    });

    it('should apply 15-point penalty for 5 listings', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        yearMatchRate: 100,
        sampleSize: 5,
        depreciationApplied: false,
      });

      expect(result.factors.sampleSizePenalty).toBe(15);
      expect(result.warnings).toContain('Small sample size (5 listings)');
    });

    it('should apply 15-point penalty for 3 listings', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        yearMatchRate: 100,
        sampleSize: 3,
        depreciationApplied: false,
      });

      expect(result.factors.sampleSizePenalty).toBe(15);
      expect(result.warnings).toContain('Small sample size (3 listings)');
    });

    it('should apply 30-point penalty for 2 listings', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        yearMatchRate: 100,
        sampleSize: 2,
        depreciationApplied: false,
      });

      expect(result.factors.sampleSizePenalty).toBe(30);
      expect(result.warnings).toContain('Very small sample size (2 listings)');
    });

    it('should apply 30-point penalty for 1 listing', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        yearMatchRate: 100,
        sampleSize: 1,
        depreciationApplied: false,
      });

      expect(result.factors.sampleSizePenalty).toBe(30);
      expect(result.warnings).toContain('Very small sample size (1 listings)');
    });
  });

  describe('Depreciation Penalty', () => {
    it('should apply 50-point penalty when depreciation is applied', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        yearMatchRate: 100,
        sampleSize: 10,
        depreciationApplied: true,
      });

      expect(result.factors.depreciationPenalty).toBe(50);
      expect(result.warnings).toContain('Depreciation was applied to newer vehicles');
    });

    it('should not apply penalty when depreciation is not applied', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        yearMatchRate: 100,
        sampleSize: 10,
        depreciationApplied: false,
      });

      expect(result.factors.depreciationPenalty).toBe(0);
      expect(result.warnings).not.toContain(expect.stringContaining('Depreciation'));
    });
  });

  describe('Combined Penalties', () => {
    it('should not go below 0 with multiple penalties', () => {
      // Worst case: low source count, very stale, low year match, small sample, depreciation
      const result = calculateConfidence({
        sourceCount: 1, // Base 60
        dataAgeDays: 40, // -40
        yearMatchRate: 10, // -40
        sampleSize: 1, // -30
        depreciationApplied: true, // -50
      });

      // 60 - 40 - 40 - 30 - 50 = -100, but should be clamped to 0
      expect(result.score).toBe(0);
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should calculate correct score with moderate penalties', () => {
      const result = calculateConfidence({
        sourceCount: 3, // Base 95
        dataAgeDays: 10, // -20
        yearMatchRate: 50, // -20
        sampleSize: 4, // -15
        depreciationApplied: false, // -0
      });

      // 95 - 20 - 20 - 15 = 40
      expect(result.score).toBe(40);
    });

    it('should maintain high score with no penalties', () => {
      const result = calculateConfidence({
        sourceCount: 5, // Base 95
        dataAgeDays: 0, // -0
        yearMatchRate: 100, // -0
        sampleSize: 10, // -0
        depreciationApplied: false, // -0
      });

      expect(result.score).toBe(95);
    });
  });

  describe('Warnings Generation', () => {
    it('should generate multiple warnings when multiple issues exist', () => {
      const result = calculateConfidence({
        sourceCount: 2,
        dataAgeDays: 35,
        yearMatchRate: 30,
        sampleSize: 2,
        depreciationApplied: true,
      });

      expect(result.warnings).toHaveLength(4);
      expect(result.warnings).toContain('Data is very stale (30+ days old)');
      expect(result.warnings).toContain('Low year match rate (30.0%)');
      expect(result.warnings).toContain('Very small sample size (2 listings)');
      expect(result.warnings).toContain('Depreciation was applied to newer vehicles');
    });

    it('should generate no warnings for perfect data', () => {
      const result = calculateConfidence({
        sourceCount: 5,
        dataAgeDays: 0,
        yearMatchRate: 100,
        sampleSize: 20,
        depreciationApplied: false,
      });

      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('Optional Parameters', () => {
    it('should work without year match rate (non-vehicle properties)', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        sampleSize: 10,
        depreciationApplied: false,
      });

      expect(result.score).toBe(95);
      expect(result.factors.yearMatchPenalty).toBeUndefined();
    });

    it('should work without sample size', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        yearMatchRate: 100,
        depreciationApplied: false,
      });

      expect(result.score).toBe(95);
      expect(result.factors.sampleSizePenalty).toBeUndefined();
    });

    it('should work without depreciation flag', () => {
      const result = calculateConfidence({
        sourceCount: 3,
        dataAgeDays: 0,
        yearMatchRate: 100,
        sampleSize: 10,
      });

      expect(result.score).toBe(95);
      expect(result.factors.depreciationPenalty).toBeUndefined();
    });
  });

  describe('Input Validation', () => {
    it('should throw error for negative source count', () => {
      expect(() =>
        calculateConfidence({
          sourceCount: -1,
          dataAgeDays: 0,
        })
      ).toThrow('Source count cannot be negative');
    });

    it('should throw error for negative data age', () => {
      expect(() =>
        calculateConfidence({
          sourceCount: 3,
          dataAgeDays: -5,
        })
      ).toThrow('Data age cannot be negative');
    });

    it('should throw error for year match rate > 100', () => {
      expect(() =>
        calculateConfidence({
          sourceCount: 3,
          dataAgeDays: 0,
          yearMatchRate: 101,
        })
      ).toThrow('Year match rate must be between 0 and 100');
    });

    it('should throw error for year match rate < 0', () => {
      expect(() =>
        calculateConfidence({
          sourceCount: 3,
          dataAgeDays: 0,
          yearMatchRate: -1,
        })
      ).toThrow('Year match rate must be between 0 and 100');
    });

    it('should throw error for negative sample size', () => {
      expect(() =>
        calculateConfidence({
          sourceCount: 3,
          dataAgeDays: 0,
          sampleSize: -1,
        })
      ).toThrow('Sample size cannot be negative');
    });
  });
});
