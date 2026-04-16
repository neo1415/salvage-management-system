/**
 * Algorithm Tuning Job Tests
 * Phase 16: Task 16.1.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runAlgorithmTuningNow } from '@/features/intelligence/jobs/algorithm-tuning.job';
import { db } from '@/lib/db';
import { algorithmConfig } from '@/lib/db/schema/intelligence';
import { algorithmConfigHistory } from '@/lib/db/schema/ml-training';
import { predictions } from '@/lib/db/schema/intelligence';
import { auctions } from '@/lib/db/schema/auctions';
import { eq } from 'drizzle-orm';

// Mock Redis
vi.mock('@/lib/cache/redis', () => ({
  getCached: vi.fn().mockResolvedValue(null),
  setCached: vi.fn().mockResolvedValue(undefined),
}));

describe('Algorithm Tuning Job', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.delete(algorithmConfigHistory);
    
    // Insert default config
    await db.insert(algorithmConfig).values([
      {
        configKey: 'prediction.similarity_threshold',
        configValue: '60' as any,
        description: 'Minimum similarity score for historical matching',
        version: 'v1.0',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        configKey: 'prediction.confidence_base',
        configValue: '0.85' as any,
        description: 'Base confidence score for good data',
        version: 'v1.0',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]).onConflictDoNothing();
  });

  afterEach(async () => {
    // Clean up
    await db.delete(algorithmConfigHistory);
  });

  describe('Task 16.1.1: Algorithm Tuning Job Execution', () => {
    it('should run algorithm tuning job successfully', async () => {
      const result = await runAlgorithmTuningNow();
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should skip tuning with insufficient data', async () => {
      // Mock database to return no predictions
      const spy = vi.spyOn(db, 'execute');
      spy.mockResolvedValueOnce([{
        total_predictions: '0',
        avg_error_rate: '0',
        bounds_accuracy: '0',
        avg_confidence_score: '0',
        error_stddev: '0',
      }] as any);

      const result = await runAlgorithmTuningNow();
      
      expect(result.success).toBe(true);
      spy.mockRestore();
    });
  });

  describe('Task 16.1.2: Accuracy-Based Threshold Adjustment', () => {
    it('should increase threshold when error rate is high', async () => {
      // Mock high error rate
      const spy = vi.spyOn(db, 'execute');
      spy.mockResolvedValueOnce([{
        total_predictions: '50',
        avg_error_rate: '0.18', // 18% error rate
        bounds_accuracy: '0.70',
        avg_confidence_score: '0.80',
        error_stddev: '0.10',
      }] as any);

      await runAlgorithmTuningNow();

      // Check if threshold was increased
      const config = await db
        .select()
        .from(algorithmConfig)
        .where(eq(algorithmConfig.configKey, 'prediction.similarity_threshold'))
        .limit(1);

      expect(parseFloat(config[0].configValue as any)).toBeGreaterThan(60);
      
      spy.mockRestore();
    });

    it('should decrease threshold when error rate is low and bounds accuracy is high', async () => {
      // Mock low error rate and high bounds accuracy
      const spy = vi.spyOn(db, 'execute');
      spy.mockResolvedValueOnce([{
        total_predictions: '50',
        avg_error_rate: '0.07', // 7% error rate
        bounds_accuracy: '0.90', // 90% bounds accuracy
        avg_confidence_score: '0.85',
        error_stddev: '0.05',
      }] as any);

      await runAlgorithmTuningNow();

      // Check if threshold was decreased
      const config = await db
        .select()
        .from(algorithmConfig)
        .where(eq(algorithmConfig.configKey, 'prediction.similarity_threshold'))
        .limit(1);

      expect(parseFloat(config[0].configValue as any)).toBeLessThan(60);
      
      spy.mockRestore();
    });

    it('should not change threshold when performance is acceptable', async () => {
      // Mock acceptable performance
      const spy = vi.spyOn(db, 'execute');
      spy.mockResolvedValueOnce([{
        total_predictions: '50',
        avg_error_rate: '0.10', // 10% error rate
        bounds_accuracy: '0.82', // 82% bounds accuracy
        avg_confidence_score: '0.85',
        error_stddev: '0.08',
      }] as any);

      await runAlgorithmTuningNow();

      // Check if threshold remained the same
      const config = await db
        .select()
        .from(algorithmConfig)
        .where(eq(algorithmConfig.configKey, 'prediction.similarity_threshold'))
        .limit(1);

      expect(parseFloat(config[0].configValue as any)).toBe(60);
      
      spy.mockRestore();
    });

    it('should respect minimum threshold of 50', async () => {
      // Set threshold to 52
      await db
        .update(algorithmConfig)
        .set({ configValue: '52' as any })
        .where(eq(algorithmConfig.configKey, 'prediction.similarity_threshold'));

      // Mock very low error rate
      const spy = vi.spyOn(db, 'execute');
      spy.mockResolvedValueOnce([{
        total_predictions: '50',
        avg_error_rate: '0.05',
        bounds_accuracy: '0.95',
        avg_confidence_score: '0.90',
        error_stddev: '0.03',
      }] as any);

      await runAlgorithmTuningNow();

      // Check if threshold didn't go below 50
      const config = await db
        .select()
        .from(algorithmConfig)
        .where(eq(algorithmConfig.configKey, 'prediction.similarity_threshold'))
        .limit(1);

      expect(parseFloat(config[0].configValue as any)).toBeGreaterThanOrEqual(50);
      
      spy.mockRestore();
    });

    it('should respect maximum threshold of 80', async () => {
      // Set threshold to 78
      await db
        .update(algorithmConfig)
        .set({ configValue: '78' as any })
        .where(eq(algorithmConfig.configKey, 'prediction.similarity_threshold'));

      // Mock very high error rate
      const spy = vi.spyOn(db, 'execute');
      spy.mockResolvedValueOnce([{
        total_predictions: '50',
        avg_error_rate: '0.20',
        bounds_accuracy: '0.60',
        avg_confidence_score: '0.75',
        error_stddev: '0.15',
      }] as any);

      await runAlgorithmTuningNow();

      // Check if threshold didn't exceed 80
      const config = await db
        .select()
        .from(algorithmConfig)
        .where(eq(algorithmConfig.configKey, 'prediction.similarity_threshold'))
        .limit(1);

      expect(parseFloat(config[0].configValue as any)).toBeLessThanOrEqual(80);
      
      spy.mockRestore();
    });
  });

  describe('Task 16.1.3: Confidence Parameter Tuning', () => {
    it('should decrease confidence base when overconfident', async () => {
      // Mock overconfident predictions
      const spy = vi.spyOn(db, 'execute');
      spy.mockResolvedValueOnce([{
        total_predictions: '50',
        avg_error_rate: '0.10',
        bounds_accuracy: '0.65', // Low bounds accuracy
        avg_confidence_score: '0.85', // High confidence
        error_stddev: '0.08',
      }] as any);

      await runAlgorithmTuningNow();

      // Check if confidence base was decreased
      const config = await db
        .select()
        .from(algorithmConfig)
        .where(eq(algorithmConfig.configKey, 'prediction.confidence_base'))
        .limit(1);

      expect(parseFloat(config[0].configValue as any)).toBeLessThan(0.85);
      
      spy.mockRestore();
    });

    it('should increase confidence base when underconfident', async () => {
      // Mock underconfident predictions
      const spy = vi.spyOn(db, 'execute');
      spy.mockResolvedValueOnce([{
        total_predictions: '50',
        avg_error_rate: '0.10',
        bounds_accuracy: '0.90', // High bounds accuracy
        avg_confidence_score: '0.70', // Low confidence
        error_stddev: '0.08',
      }] as any);

      await runAlgorithmTuningNow();

      // Check if confidence base was increased
      const config = await db
        .select()
        .from(algorithmConfig)
        .where(eq(algorithmConfig.configKey, 'prediction.confidence_base'))
        .limit(1);

      expect(parseFloat(config[0].configValue as any)).toBeGreaterThan(0.85);
      
      spy.mockRestore();
    });

    it('should not change confidence base when well-calibrated', async () => {
      // Mock well-calibrated predictions
      const spy = vi.spyOn(db, 'execute');
      spy.mockResolvedValueOnce([{
        total_predictions: '50',
        avg_error_rate: '0.10',
        bounds_accuracy: '0.83', // Close to confidence
        avg_confidence_score: '0.85',
        error_stddev: '0.08',
      }] as any);

      await runAlgorithmTuningNow();

      // Check if confidence base remained the same
      const config = await db
        .select()
        .from(algorithmConfig)
        .where(eq(algorithmConfig.configKey, 'prediction.confidence_base'))
        .limit(1);

      expect(parseFloat(config[0].configValue as any)).toBe(0.85);
      
      spy.mockRestore();
    });
  });

  describe('Task 16.1.4: Config Change Logging', () => {
    it('should log config changes to algorithm_config_history', async () => {
      // Mock high error rate to trigger change
      const spy = vi.spyOn(db, 'execute');
      spy.mockResolvedValueOnce([{
        total_predictions: '50',
        avg_error_rate: '0.18',
        bounds_accuracy: '0.70',
        avg_confidence_score: '0.80',
        error_stddev: '0.10',
      }] as any);

      await runAlgorithmTuningNow();

      // Check if change was logged
      const history = await db
        .select()
        .from(algorithmConfigHistory)
        .where(eq(algorithmConfigHistory.configKey, 'prediction.similarity_threshold'));

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].changedBy).toBe('system_auto_tune');
      expect(history[0].changeReason).toBeDefined();
      expect(history[0].oldValue).toBeDefined();
      expect(history[0].newValue).toBeDefined();
      
      spy.mockRestore();
    });

    it('should include metadata in config history', async () => {
      // Mock high error rate to trigger change
      const spy = vi.spyOn(db, 'execute');
      spy.mockResolvedValueOnce([{
        total_predictions: '50',
        avg_error_rate: '0.18',
        bounds_accuracy: '0.70',
        avg_confidence_score: '0.80',
        error_stddev: '0.10',
      }] as any);

      await runAlgorithmTuningNow();

      // Check metadata
      const history = await db
        .select()
        .from(algorithmConfigHistory)
        .where(eq(algorithmConfigHistory.configKey, 'prediction.similarity_threshold'));

      expect(history[0].metadata).toBeDefined();
      const metadata = history[0].metadata as any;
      expect(metadata.avgErrorRate).toBeDefined();
      expect(metadata.boundsAccuracy).toBeDefined();
      expect(metadata.totalPredictions).toBeDefined();
      expect(metadata.oldThreshold).toBeDefined();
      expect(metadata.newThreshold).toBeDefined();
      
      spy.mockRestore();
    });

    it('should increment version number on config change', async () => {
      // Mock high error rate to trigger change
      const spy = vi.spyOn(db, 'execute');
      spy.mockResolvedValueOnce([{
        total_predictions: '50',
        avg_error_rate: '0.18',
        bounds_accuracy: '0.70',
        avg_confidence_score: '0.80',
        error_stddev: '0.10',
      }] as any);

      await runAlgorithmTuningNow();

      // Check version increment
      const config = await db
        .select()
        .from(algorithmConfig)
        .where(eq(algorithmConfig.configKey, 'prediction.similarity_threshold'))
        .limit(1);

      expect(config[0].version).not.toBe('v1.0');
      expect(config[0].version).toMatch(/v\d+\.\d+/);
      
      spy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      const spy = vi.spyOn(db, 'execute');
      spy.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await runAlgorithmTuningNow();
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      
      spy.mockRestore();
    });

    it('should handle missing config gracefully', async () => {
      // Delete config
      await db
        .delete(algorithmConfig)
        .where(eq(algorithmConfig.configKey, 'prediction.similarity_threshold'));

      const spy = vi.spyOn(db, 'execute');
      spy.mockResolvedValueOnce([{
        total_predictions: '50',
        avg_error_rate: '0.18',
        bounds_accuracy: '0.70',
        avg_confidence_score: '0.80',
        error_stddev: '0.10',
      }] as any);

      const result = await runAlgorithmTuningNow();
      
      // Should complete without crashing
      expect(result).toBeDefined();
      
      spy.mockRestore();
    });
  });
});
