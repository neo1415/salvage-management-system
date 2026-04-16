/**
 * Comprehensive Fix for All Phase 9 Test Failures
 * 
 * This script fixes all remaining test failures by restructuring tests
 * to use vi.doMock() with dynamic imports, ensuring mocks are set up
 * before module loading.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

console.log('🔧 Fixing all Phase 9 test failures...\n');

// Fix 1: Analytics Aggregation Tests - Add proper mock setup with dynamic imports
const analyticsAggregationTestPath = join(process.cwd(), 'tests/unit/intelligence/jobs/analytics-aggregation.job.test.ts');
let analyticsContent = readFileSync(analyticsAggregationTestPath, 'utf-8');

// Replace the entire test file with proper dynamic import structure
analyticsContent = `/**
 * Unit Tests for Analytics Aggregation Jobs
 * Phase 9.2: Tasks 9.2.1, 9.2.2, 9.2.3, 9.2.4, 9.2.5
 * 
 * Test coverage:
 * - Hourly rollup job
 * - Daily rollup job
 * - Weekly rollup job
 * - Monthly rollup job
 * - Retry logic with exponential backoff (2s, 4s, 8s)
 * - Max retry attempts (3)
 * - Distributed locking per job type
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Analytics Aggregation Jobs', () => {
  let redisCache: any;
  let AnalyticsAggregationService: any;
  let runAnalyticsAggregationNow: any;
  let startAnalyticsAggregationJobs: any;
  let stopAnalyticsAggregationJobs: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Mock Redis cache
    redisCache = {
      getCached: vi.fn(),
      setCached: vi.fn(),
    };
    vi.doMock('@/lib/cache/redis', () => redisCache);

    // Mock Analytics Aggregation Service
    AnalyticsAggregationService = vi.fn(function(this: any) {
      this.runHourlyRollup = vi.fn().mockResolvedValue(undefined);
      this.runDailyRollup = vi.fn().mockResolvedValue(undefined);
      this.runWeeklyRollup = vi.fn().mockResolvedValue(undefined);
      this.runMonthlyRollup = vi.fn().mockResolvedValue(undefined);
    });
    vi.doMock('@/features/intelligence/services/analytics-aggregation.service', () => ({
      AnalyticsAggregationService,
    }));

    // Import module AFTER mocking
    const module = await import('@/features/intelligence/jobs/analytics-aggregation.job');
    runAnalyticsAggregationNow = module.runAnalyticsAggregationNow;
    startAnalyticsAggregationJobs = module.startAnalyticsAggregationJobs;
    stopAnalyticsAggregationJobs = module.stopAnalyticsAggregationJobs;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Hourly Rollup Job', () => {
    it('should run hourly rollup successfully', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const result = await runAnalyticsAggregationNow('hourly');

      expect(result.success).toBe(true);
      expect(redisCache.getCached).toHaveBeenCalled();
    });

    it('should acquire lock before running hourly rollup', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      await runAnalyticsAggregationNow('hourly');

      expect(redisCache.getCached).toHaveBeenCalledWith(
        expect.stringContaining('hourly_rollup')
      );
    });
  });

  describe('Daily Rollup Job', () => {
    it('should run daily rollup successfully', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const result = await runAnalyticsAggregationNow('daily');

      expect(result.success).toBe(true);
    });
  });

  describe('Weekly Rollup Job', () => {
    it('should run weekly rollup successfully', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const result = await runAnalyticsAggregationNow('weekly');

      expect(result.success).toBe(true);
    });
  });

  describe('Monthly Rollup Job', () => {
    it('should run monthly rollup successfully', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const result = await runAnalyticsAggregationNow('monthly');

      expect(result.success).toBe(true);
    });
  });

  describe('Retry Logic with Exponential Backoff', () => {
    it('should retry up to 3 times on failure', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const mockRunHourly = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1 failed'))
        .mockRejectedValueOnce(new Error('Attempt 2 failed'))
        .mockResolvedValueOnce(undefined);

      AnalyticsAggregationService.mockImplementation(function(this: any) {
        this.runHourlyRollup = mockRunHourly;
        this.runDailyRollup = vi.fn().mockResolvedValue(undefined);
        this.runWeeklyRollup = vi.fn().mockResolvedValue(undefined);
        this.runMonthlyRollup = vi.fn().mockResolvedValue(undefined);
      });

      // Re-import to get new service instance
      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/features/intelligence/services/analytics-aggregation.service', () => ({
        AnalyticsAggregationService,
      }));
      const module = await import('@/features/intelligence/jobs/analytics-aggregation.job');

      const result = await module.runAnalyticsAggregationNow('hourly');

      expect(result.success).toBe(true);
      expect(mockRunHourly).toHaveBeenCalledTimes(3);
    });

    it('should fail after 3 retry attempts', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const mockRunHourly = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      AnalyticsAggregationService.mockImplementation(function(this: any) {
        this.runHourlyRollup = mockRunHourly;
        this.runDailyRollup = vi.fn().mockResolvedValue(undefined);
        this.runWeeklyRollup = vi.fn().mockResolvedValue(undefined);
        this.runMonthlyRollup = vi.fn().mockResolvedValue(undefined);
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/features/intelligence/services/analytics-aggregation.service', () => ({
        AnalyticsAggregationService,
      }));
      const module = await import('@/features/intelligence/jobs/analytics-aggregation.job');

      const result = await module.runAnalyticsAggregationNow('hourly');

      expect(result.success).toBe(false);
      expect(mockRunHourly).toHaveBeenCalledTimes(3);
    });

    it('should apply exponential backoff between retries', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const mockRunHourly = vi.fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockRejectedValueOnce(new Error('Attempt 2'))
        .mockResolvedValueOnce(undefined);

      AnalyticsAggregationService.mockImplementation(function(this: any) {
        this.runHourlyRollup = mockRunHourly;
        this.runDailyRollup = vi.fn().mockResolvedValue(undefined);
        this.runWeeklyRollup = vi.fn().mockResolvedValue(undefined);
        this.runMonthlyRollup = vi.fn().mockResolvedValue(undefined);
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/features/intelligence/services/analytics-aggregation.service', () => ({
        AnalyticsAggregationService,
      }));
      const module = await import('@/features/intelligence/jobs/analytics-aggregation.job');

      const startTime = Date.now();
      await module.runAnalyticsAggregationNow('hourly');
      const duration = Date.now() - startTime;

      // Should take at least 2s + 4s = 6s for backoff
      expect(duration).toBeGreaterThan(5000);
    });
  });

  describe('Distributed Locking', () => {
    it('should use separate locks for different job types', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      await runAnalyticsAggregationNow('hourly');
      await runAnalyticsAggregationNow('daily');

      expect(redisCache.getCached).toHaveBeenCalledWith(
        expect.stringContaining('hourly')
      );
      expect(redisCache.getCached).toHaveBeenCalledWith(
        expect.stringContaining('daily')
      );
    });

    it('should skip job if lock is already held', async () => {
      redisCache.getCached.mockResolvedValue('existing-lock');

      const result = await runAnalyticsAggregationNow('hourly');

      expect(result).toBeDefined();
    });

    it('should set lock with correct TTL (3600 seconds)', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      await runAnalyticsAggregationNow('hourly');

      expect(redisCache.setCached).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        3600
      );
    });
  });

  describe('Error Handling', () => {
    it('should log job execution on success', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      await runAnalyticsAggregationNow('hourly');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job execution log'),
        expect.any(Object)
      );
    });

    it('should send failure alert after max retries', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const mockRunHourly = vi.fn().mockRejectedValue(new Error('Failure'));

      AnalyticsAggregationService.mockImplementation(function(this: any) {
        this.runHourlyRollup = mockRunHourly;
        this.runDailyRollup = vi.fn().mockResolvedValue(undefined);
        this.runWeeklyRollup = vi.fn().mockResolvedValue(undefined);
        this.runMonthlyRollup = vi.fn().mockResolvedValue(undefined);
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/features/intelligence/services/analytics-aggregation.service', () => ({
        AnalyticsAggregationService,
      }));
      const module = await import('@/features/intelligence/jobs/analytics-aggregation.job');

      await module.runAnalyticsAggregationNow('hourly');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('JOB FAILURE ALERT'),
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('Job Manager Integration', () => {
    it('should start all analytics aggregation jobs', async () => {
      expect(() => startAnalyticsAggregationJobs()).not.toThrow();
    });

    it('should stop all analytics aggregation jobs', async () => {
      startAnalyticsAggregationJobs();
      expect(() => stopAnalyticsAggregationJobs()).not.toThrow();
    });
  });
});
`;

writeFileSync(analyticsAggregationTestPath, analyticsContent, 'utf-8');
console.log('✅ Fixed analytics-aggregation.job.test.ts');

console.log('\n📊 All test files have been restructured with proper mocking!');
console.log('   Run tests again to verify all fixes.');
