/**
 * Unit Tests for Confidence Scoring Service Edge Cases
 * 
 * Feature: market-data-scraping-system
 * Tests edge cases and boundary conditions for confidence scoring
 */

import { describe, test, expect } from 'vitest';
import {
  calculateConfidence,
  isFreshData,
  isStaleData,
  isVeryStaleData,
} from '@/features/market-data/services/confidence.service';

describe('Confidence Scoring Service - Edge Cases', () => {
  describe('Invalid Input Handling', () => {
    test('negative source count throws error', () => {
      expect(() =>
        calculateConfidence({ sourceCount: -1, dataAgeDays: 0 })
      ).toThrow('Source count cannot be negative');
    });

    test('negative data age throws error', () => {
      expect(() =>
        calculateConfidence({ sourceCount: 1, dataAgeDays: -5 })
      ).toThrow('Data age cannot be negative');
    });

    test('zero source count returns zero confidence', () => {
      const result = calculateConfidence({ sourceCount: 0, dataAgeDays: 0 });
      
      expect(result.score).toBe(0);
      expect(result.factors.baseScore).toBe(0);
      expect(result.factors.sourceCount).toBe(0);
    });
  });

  describe('Boundary Conditions', () => {
    test('exactly 7 days old applies staleness penalty', () => {
      const result = calculateConfidence({ sourceCount: 3, dataAgeDays: 7 });
      
      expect(result.factors.stalenessPenalty).toBe(20);
      expect(result.score).toBe(75); // 95 - 20
    });

    test('6.99 days old does not apply staleness penalty', () => {
      const result = calculateConfidence({ sourceCount: 3, dataAgeDays: 6.99 });
      
      expect(result.factors.stalenessPenalty).toBe(0);
      expect(result.score).toBe(95);
    });

    test('exactly 30 days old applies maximum staleness penalty', () => {
      const result = calculateConfidence({ sourceCount: 3, dataAgeDays: 30 });
      
      expect(result.factors.stalenessPenalty).toBe(40);
      expect(result.score).toBe(55); // 95 - 40
    });

    test('29.99 days old applies moderate staleness penalty', () => {
      const result = calculateConfidence({ sourceCount: 3, dataAgeDays: 29.99 });
      
      expect(result.factors.stalenessPenalty).toBe(20);
      expect(result.score).toBe(75); // 95 - 20
    });
  });

  describe('Source Count Variations', () => {
    test('1 source with fresh data', () => {
      const result = calculateConfidence({ sourceCount: 1, dataAgeDays: 0 });
      
      expect(result.score).toBe(60);
      expect(result.factors.baseScore).toBe(60);
      expect(result.factors.stalenessPenalty).toBe(0);
    });

    test('2 sources with fresh data', () => {
      const result = calculateConfidence({ sourceCount: 2, dataAgeDays: 0 });
      
      expect(result.score).toBe(80);
      expect(result.factors.baseScore).toBe(80);
    });

    test('3 sources with fresh data', () => {
      const result = calculateConfidence({ sourceCount: 3, dataAgeDays: 0 });
      
      expect(result.score).toBe(95);
      expect(result.factors.baseScore).toBe(95);
    });

    test('4+ sources treated same as 3 sources', () => {
      const result4 = calculateConfidence({ sourceCount: 4, dataAgeDays: 0 });
      const result10 = calculateConfidence({ sourceCount: 10, dataAgeDays: 0 });
      
      expect(result4.score).toBe(95);
      expect(result10.score).toBe(95);
    });
  });

  describe('Staleness Penalty Application', () => {
    test('1 source with very stale data can reach zero confidence', () => {
      const result = calculateConfidence({ sourceCount: 1, dataAgeDays: 100 });
      
      expect(result.score).toBe(20); // 60 - 40
    });

    test('confidence never goes below zero', () => {
      // Even with maximum penalty, score should not be negative
      const result = calculateConfidence({ sourceCount: 1, dataAgeDays: 1000 });
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBe(20); // 60 - 40 = 20
    });

    test('2 sources with very stale data', () => {
      const result = calculateConfidence({ sourceCount: 2, dataAgeDays: 50 });
      
      expect(result.score).toBe(40); // 80 - 40
    });

    test('3 sources with moderate staleness', () => {
      const result = calculateConfidence({ sourceCount: 3, dataAgeDays: 15 });
      
      expect(result.score).toBe(75); // 95 - 20
    });
  });

  describe('Data Freshness Classification', () => {
    test('isFreshData boundary at 7 days', () => {
      expect(isFreshData(0)).toBe(true);
      expect(isFreshData(6)).toBe(true);
      expect(isFreshData(6.99)).toBe(true);
      expect(isFreshData(7)).toBe(false);
      expect(isFreshData(8)).toBe(false);
    });

    test('isStaleData range 7-30 days', () => {
      expect(isStaleData(6.99)).toBe(false);
      expect(isStaleData(7)).toBe(true);
      expect(isStaleData(15)).toBe(true);
      expect(isStaleData(29.99)).toBe(true);
      expect(isStaleData(30)).toBe(false);
      expect(isStaleData(31)).toBe(false);
    });

    test('isVeryStaleData 30+ days', () => {
      expect(isVeryStaleData(29.99)).toBe(false);
      expect(isVeryStaleData(30)).toBe(true);
      expect(isVeryStaleData(100)).toBe(true);
      expect(isVeryStaleData(365)).toBe(true);
    });
  });

  describe('Extreme Values', () => {
    test('very large source count', () => {
      const result = calculateConfidence({ sourceCount: 1000, dataAgeDays: 0 });
      
      expect(result.score).toBe(95);
      expect(result.factors.sourceCount).toBe(1000);
    });

    test('very old data (years)', () => {
      const result = calculateConfidence({ sourceCount: 3, dataAgeDays: 365 });
      
      expect(result.score).toBe(55); // 95 - 40
      expect(result.factors.dataAgeDays).toBe(365);
    });

    test('zero age data (brand new)', () => {
      const result = calculateConfidence({ sourceCount: 3, dataAgeDays: 0 });
      
      expect(result.score).toBe(95);
      expect(result.factors.stalenessPenalty).toBe(0);
    });

    test('fractional days', () => {
      const result = calculateConfidence({ sourceCount: 2, dataAgeDays: 0.5 });
      
      expect(result.score).toBe(80);
      expect(result.factors.stalenessPenalty).toBe(0);
    });
  });

  describe('Confidence Result Structure', () => {
    test('result includes all required fields', () => {
      const result = calculateConfidence({ sourceCount: 2, dataAgeDays: 10 });
      
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('factors');
      expect(result.factors).toHaveProperty('baseScore');
      expect(result.factors).toHaveProperty('sourceCount');
      expect(result.factors).toHaveProperty('dataAgeDays');
      expect(result.factors).toHaveProperty('stalenessPenalty');
    });

    test('factors match input values', () => {
      const result = calculateConfidence({ sourceCount: 2, dataAgeDays: 10 });
      
      expect(result.factors.sourceCount).toBe(2);
      expect(result.factors.dataAgeDays).toBe(10);
    });

    test('score calculation is correct', () => {
      const result = calculateConfidence({ sourceCount: 2, dataAgeDays: 10 });
      
      const expectedScore = result.factors.baseScore - result.factors.stalenessPenalty;
      expect(result.score).toBe(expectedScore);
    });
  });
});
