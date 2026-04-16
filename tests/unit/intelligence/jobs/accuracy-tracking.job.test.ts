/**
 * Unit Tests for Accuracy Tracking Jobs
 * Phase 9.3: Tasks 9.3.1, 9.3.2, 9.3.3, 9.3.4
 * 
 * Test coverage:
 * - Prediction accuracy calculation
 * - Recommendation effectiveness tracking
 * - Algorithm parameter tuning
 * - Accuracy alert triggers (< 85% for predictions, < 10% for recommendations)
 * - Minimum sample size requirements (10 predictions, 50 recommendations)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as redisCache from '@/lib/cache/redis';
import { db } from '@/lib/db';

// Mock dependencies
vi.mock('@/lib/cache/redis', () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}));

describe('Accuracy Tracking Jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Prediction Accuracy Calculation', () => {
    it('should calculate prediction accuracy successfully', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      // Mock prediction accuracy query result
      vi.mocked(db.execute).mockResolvedValue([
        {
          total_predictions: '15',
          avg_error_rate: '0.12',
          within_bounds_count: '13',
          avg_confidence_score: '0.85',
        },
      ] as any);

      const { runAccuracyTrackingNow } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      const result = await runAccuracyTrackingNow('prediction');

      expect(result.success).toBe(true);
      expect(db.execute).toHaveBeenCalled();
    });

    it('should trigger alert when accuracy drops below 85%', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      // Mock low accuracy (80%)
      vi.mocked(db.execute).mockResolvedValue([
        {
          total_predictions: '20',
          avg_error_rate: '0.20', // 80% accuracy
          within_bounds_count: '15',
          avg_confidence_score: '0.75',
        },
      ] as any);

      const { runAccuracyTrackingNow } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      await runAccuracyTrackingNow('prediction');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('ACCURACY ALERT'),
        expect.anything()
      );
    });

    it('should not trigger alert if sample size is below minimum (10)', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      // Mock low accuracy but small sample
      vi.mocked(db.execute).mockResolvedValue([
        {
          total_predictions: '5', // Below minimum
          avg_error_rate: '0.20',
          within_bounds_count: '3',
          avg_confidence_score: '0.70',
        },
      ] as any);

      const { runAccuracyTrackingNow } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      await runAccuracyTrackingNow('prediction');

      // Should not trigger alert due to small sample
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('ACCURACY ALERT'),
        expect.anything()
      );
    });

    it('should calculate bounds accuracy correctly', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      vi.mocked(db.execute).mockResolvedValue([
        {
          total_predictions: '20',
          avg_error_rate: '0.10',
          within_bounds_count: '17', // 85% within bounds
          avg_confidence_score: '0.85',
        },
      ] as any);

      const { runAccuracyTrackingNow } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      await runAccuracyTrackingNow('prediction');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Bounds Accuracy: 85.00%')
      );
    });
  });

  describe('Recommendation Effectiveness Tracking', () => {
    it('should track recommendation effectiveness successfully', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      // Mock recommendation effectiveness query result
      vi.mocked(db.execute).mockResolvedValue([
        {
          total_recommendations: '100',
          clicked_count: '30',
          bid_placed_count: '15',
          avg_match_score: '75.5',
        },
      ] as any);

      const { runAccuracyTrackingNow } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      const result = await runAccuracyTrackingNow('recommendation');

      expect(result.success).toBe(true);
      expect(db.execute).toHaveBeenCalled();
    });

    it('should trigger alert when bid conversion rate drops below 10%', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      // Mock low conversion rate (8%)
      vi.mocked(db.execute).mockResolvedValue([
        {
          total_recommendations: '100',
          clicked_count: '25',
          bid_placed_count: '8', // 8% conversion
          avg_match_score: '70.0',
        },
      ] as any);

      const { runAccuracyTrackingNow } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      await runAccuracyTrackingNow('recommendation');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('ACCURACY ALERT'),
        expect.anything()
      );
    });

    it('should not trigger alert if sample size is below minimum (50)', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      // Mock low conversion but small sample
      vi.mocked(db.execute).mockResolvedValue([
        {
          total_recommendations: '30', // Below minimum
          clicked_count: '10',
          bid_placed_count: '2', // 6.7% conversion
          avg_match_score: '65.0',
        },
      ] as any);

      const { runAccuracyTrackingNow } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      await runAccuracyTrackingNow('recommendation');

      // Should not trigger alert due to small sample
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('ACCURACY ALERT'),
        expect.anything()
      );
    });

    it('should calculate click-through rate correctly', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      vi.mocked(db.execute).mockResolvedValue([
        {
          total_recommendations: '100',
          clicked_count: '40', // 40% CTR
          bid_placed_count: '20',
          avg_match_score: '80.0',
        },
      ] as any);

      const { runAccuracyTrackingNow } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      await runAccuracyTrackingNow('recommendation');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Click-Through Rate: 40.00%')
      );
    });
  });

  describe('Algorithm Parameter Tuning', () => {
    it('should tune algorithm parameters based on accuracy', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      // Mock accuracy metrics
      vi.mocked(db.execute).mockResolvedValue([
        {
          avg_error_rate: '0.12',
          bounds_accuracy: '0.88',
        },
      ] as any);

      // Mock current config
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { configKey: 'prediction.similarity_threshold', configValue: '70' },
            ]),
          }),
        }),
      } as any);

      // Mock update
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const { runAccuracyTrackingNow } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      const result = await runAccuracyTrackingNow('tuning');

      expect(result.success).toBe(true);
    });

    it('should increase threshold when error rate is high', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      // Mock high error rate (16%)
      vi.mocked(db.execute).mockResolvedValue([
        {
          avg_error_rate: '0.16',
          bounds_accuracy: '0.80',
        },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { configKey: 'prediction.similarity_threshold', configValue: '70' },
            ]),
          }),
        }),
      } as any);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const { runAccuracyTrackingNow } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      await runAccuracyTrackingNow('tuning');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Adjusted similarity threshold: 70 → 75')
      );
    });

    it('should decrease threshold when accuracy is high', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      // Mock low error rate (8%) and high bounds accuracy
      vi.mocked(db.execute).mockResolvedValue([
        {
          avg_error_rate: '0.08',
          bounds_accuracy: '0.90',
        },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { configKey: 'prediction.similarity_threshold', configValue: '70' },
            ]),
          }),
        }),
      } as any);

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      const { runAccuracyTrackingNow } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      await runAccuracyTrackingNow('tuning');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Adjusted similarity threshold: 70 → 65')
      );
    });

    it('should not adjust threshold beyond bounds (50-80)', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      vi.mocked(db.execute).mockResolvedValue([
        {
          avg_error_rate: '0.20', // Very high error
          bounds_accuracy: '0.70',
        },
      ] as any);

      // Already at max threshold
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              { configKey: 'prediction.similarity_threshold', configValue: '80' },
            ]),
          }),
        }),
      } as any);

      const mockUpdate = vi.fn();
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: mockUpdate,
        }),
      } as any);

      const { runAccuracyTrackingNow } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      await runAccuracyTrackingNow('tuning');

      // Should not update (already at max)
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Distributed Locking', () => {
    it('should use separate locks for different tracking types', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);
      vi.mocked(db.execute).mockResolvedValue([{}] as any);

      const { runAccuracyTrackingNow } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      await runAccuracyTrackingNow('prediction');
      await runAccuracyTrackingNow('recommendation');

      expect(redisCache.getCached).toHaveBeenCalledWith(
        expect.stringContaining('prediction_accuracy')
      );
      expect(redisCache.getCached).toHaveBeenCalledWith(
        expect.stringContaining('recommendation_effectiveness')
      );
    });
  });

  describe('Job Manager Integration', () => {
    it('should start all accuracy tracking jobs', async () => {
      const { startAccuracyTrackingJobs } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      expect(() => startAccuracyTrackingJobs()).not.toThrow();
    });

    it('should stop all accuracy tracking jobs', async () => {
      const { startAccuracyTrackingJobs, stopAccuracyTrackingJobs } = await import(
        '@/features/intelligence/jobs/accuracy-tracking.job'
      );

      startAccuracyTrackingJobs();
      expect(() => stopAccuracyTrackingJobs()).not.toThrow();
    });
  });
});
