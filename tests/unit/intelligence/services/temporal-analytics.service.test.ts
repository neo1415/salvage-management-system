/**
 * TemporalAnalyticsService Unit Tests
 * Task 5.2.6: Add unit tests for TemporalAnalyticsService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemporalAnalyticsService } from '@/features/intelligence/services/temporal-analytics.service';

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}));

describe('TemporalAnalyticsService', () => {
  let service: TemporalAnalyticsService;

  beforeEach(() => {
    service = new TemporalAnalyticsService();
    vi.clearAllMocks();
  });

  describe('calculateHourlyPatterns', () => {
    it('should calculate hourly bidding patterns', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock hourly data
      (db.execute as any).mockResolvedValueOnce([
        {
          asset_type: 'vehicle',
          hour_of_day: 14,
          bid_count: 50,
          avg_bid_amount: 2000000,
          vendor_activity: 10,
        },
        {
          asset_type: 'vehicle',
          hour_of_day: 15,
          bid_count: 75,
          avg_bid_amount: 2100000,
          vendor_activity: 15,
        },
      ]);

      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      await service.calculateHourlyPatterns(periodStart, periodEnd);

      expect(db.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculateDailyPatterns', () => {
    it('should calculate daily bidding patterns', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock daily data
      (db.execute as any).mockResolvedValueOnce([
        {
          asset_type: 'vehicle',
          day_of_week: 1, // Monday
          bid_count: 200,
          avg_bid_amount: 2000000,
          vendor_activity: 40,
        },
        {
          asset_type: 'vehicle',
          day_of_week: 5, // Friday
          bid_count: 300,
          avg_bid_amount: 2200000,
          vendor_activity: 60,
        },
      ]);

      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      await service.calculateDailyPatterns(periodStart, periodEnd);

      expect(db.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculateSeasonalPatterns', () => {
    it('should calculate seasonal bidding patterns', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock seasonal data
      (db.execute as any).mockResolvedValueOnce([
        {
          asset_type: 'vehicle',
          month_of_year: 1, // January
          bid_count: 500,
          avg_bid_amount: 2000000,
          vendor_activity: 100,
        },
        {
          asset_type: 'vehicle',
          month_of_year: 12, // December
          bid_count: 800,
          avg_bid_amount: 2500000,
          vendor_activity: 150,
        },
      ]);

      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-12-31');

      await service.calculateSeasonalPatterns(periodStart, periodEnd);

      expect(db.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('calculatePeakActivityScore', () => {
    it('should calculate peak activity score correctly', () => {
      // Access private method through type assertion
      const calculateScore = (service as any).calculatePeakActivityScore.bind(service);

      // Test low activity
      const lowScore = calculateScore(10, 2);
      expect(lowScore).toBeLessThan(50);

      // Test medium activity
      const mediumScore = calculateScore(25, 5);
      expect(mediumScore).toBeGreaterThan(30);
      expect(mediumScore).toBeLessThan(70);

      // Test high activity
      const highScore = calculateScore(50, 10);
      expect(highScore).toBeGreaterThan(70);

      // Test maximum activity
      const maxScore = calculateScore(100, 20);
      expect(maxScore).toBeGreaterThanOrEqual(100); // Score can exceed 100 before capping
    });

    it('should handle edge cases', () => {
      const calculateScore = (service as any).calculatePeakActivityScore.bind(service);

      // Zero activity
      expect(calculateScore(0, 0)).toBe(0);

      // Only bids, no vendors
      expect(calculateScore(50, 0)).toBeGreaterThan(0);

      // Only vendors, no bids
      expect(calculateScore(0, 10)).toBeGreaterThan(0);
    });
  });
});
