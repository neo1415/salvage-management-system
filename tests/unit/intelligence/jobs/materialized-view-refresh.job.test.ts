/**
 * Unit Tests for Materialized View Refresh Jobs
 * Phase 9.1: Tasks 9.1.1, 9.1.2, 9.1.3, 9.1.4, 9.1.5
 * 
 * Test coverage:
 * - Vendor bidding patterns refresh
 * - Market conditions refresh
 * - Distributed locking (Redis lock acquisition/release)
 * - Concurrent execution prevention
 * - Error handling and logging
 * - Lock expiration (TTL)
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
  },
}));

describe('Materialized View Refresh Jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Vendor Bidding Patterns Refresh', () => {
    it('should refresh vendor_bidding_patterns_mv successfully', async () => {
      // Mock lock acquisition
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);
      vi.mocked(db.execute).mockResolvedValue(undefined as any);

      const { refreshMaterializedViewsNow } = await import(
        '@/features/intelligence/jobs/materialized-view-refresh.job'
      );

      const result = await refreshMaterializedViewsNow();

      expect(result.success).toBe(true);
      expect(redisCache.getCached).toHaveBeenCalled();
      expect(redisCache.setCached).toHaveBeenCalled();
      expect(db.execute).toHaveBeenCalled();
    });

    it('should skip refresh if lock is already held', async () => {
      // Mock lock already held
      vi.mocked(redisCache.getCached).mockResolvedValue('existing-lock');

      const { refreshMaterializedViewsNow } = await import(
        '@/features/intelligence/jobs/materialized-view-refresh.job'
      );

      await refreshMaterializedViewsNow();

      // Should not execute refresh
      expect(db.execute).not.toHaveBeenCalled();
    });

    it('should release lock after successful refresh', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);
      vi.mocked(db.execute).mockResolvedValue(undefined as any);

      const { refreshMaterializedViewsNow } = await import(
        '@/features/intelligence/jobs/materialized-view-refresh.job'
      );

      await refreshMaterializedViewsNow();

      // Should release lock (set with TTL 0)
      expect(redisCache.setCached).toHaveBeenCalledWith(
        expect.any(String),
        '',
        0
      );
    });

    it('should release lock even if refresh fails', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);
      vi.mocked(db.execute).mockRejectedValue(new Error('Database error'));

      const { refreshMaterializedViewsNow } = await import(
        '@/features/intelligence/jobs/materialized-view-refresh.job'
      );

      const result = await refreshMaterializedViewsNow();

      // Job continues even if individual views fail (by design)
      expect(result.success).toBe(true);
      // Should still release lock (called twice, once per view)
      expect(redisCache.setCached).toHaveBeenCalledWith(
        expect.any(String),
        '',
        0
      );
    });

    it('should set lock with correct TTL (300 seconds)', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);
      vi.mocked(db.execute).mockResolvedValue(undefined as any);

      const { refreshMaterializedViewsNow } = await import(
        '@/features/intelligence/jobs/materialized-view-refresh.job'
      );

      await refreshMaterializedViewsNow();

      // Should set lock with 300 second TTL
      expect(redisCache.setCached).toHaveBeenCalledWith(
        expect.stringContaining('lock'),
        expect.any(String),
        300
      );
    });
  });

  describe('Market Conditions Refresh', () => {
    it('should refresh market_conditions_mv successfully', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);
      vi.mocked(db.execute).mockResolvedValue(undefined as any);

      const { refreshMaterializedViewsNow } = await import(
        '@/features/intelligence/jobs/materialized-view-refresh.job'
      );

      const result = await refreshMaterializedViewsNow();

      expect(result.success).toBe(true);
      expect(db.execute).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);
      vi.mocked(db.execute).mockRejectedValue(new Error('Connection timeout'));

      const { refreshMaterializedViewsNow } = await import(
        '@/features/intelligence/jobs/materialized-view-refresh.job'
      );

      const result = await refreshMaterializedViewsNow();

      // Job continues even if individual views fail (by design)
      expect(result.success).toBe(true);
      // Errors are logged but don't stop execution
      expect(db.execute).toHaveBeenCalled();
    });
  });

  describe('Distributed Locking', () => {
    it('should prevent concurrent execution with same lock key', async () => {
      // First call acquires lock for both views
      vi.mocked(redisCache.getCached)
        .mockResolvedValueOnce(null) // Bidding patterns - no lock
        .mockResolvedValueOnce(null) // Market conditions - no lock
        .mockResolvedValueOnce('existing-lock') // Bidding patterns - locked
        .mockResolvedValueOnce('existing-lock'); // Market conditions - locked

      vi.mocked(redisCache.setCached).mockResolvedValue(true);
      vi.mocked(db.execute).mockResolvedValue(undefined as any);

      const { refreshMaterializedViewsNow } = await import(
        '@/features/intelligence/jobs/materialized-view-refresh.job'
      );

      // First call should succeed (2 views)
      await refreshMaterializedViewsNow();

      // Second concurrent call should be skipped (both views locked)
      await refreshMaterializedViewsNow();

      // Should only execute twice (once for each view in first call)
      expect(db.execute).toHaveBeenCalledTimes(2);
    });

    it('should handle Redis connection errors during lock acquisition', async () => {
      vi.mocked(redisCache.getCached).mockRejectedValue(new Error('Redis unavailable'));

      const { refreshMaterializedViewsNow } = await import(
        '@/features/intelligence/jobs/materialized-view-refresh.job'
      );

      const result = await refreshMaterializedViewsNow();

      // Should not crash, but may not execute
      expect(result).toBeDefined();
    });
  });

  describe('Error Handling and Logging', () => {
    it('should log job execution on success', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);
      vi.mocked(db.execute).mockResolvedValue(undefined as any);

      const { refreshMaterializedViewsNow } = await import(
        '@/features/intelligence/jobs/materialized-view-refresh.job'
      );

      await refreshMaterializedViewsNow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Job execution log'),
        expect.any(Object)
      );
    });

    it('should log errors with details', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);
      vi.mocked(db.execute).mockRejectedValue(new Error('Test error'));

      const { refreshMaterializedViewsNow } = await import(
        '@/features/intelligence/jobs/materialized-view-refresh.job'
      );

      await refreshMaterializedViewsNow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should send alert on job failure', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);
      vi.mocked(db.execute).mockRejectedValue(new Error('Critical failure'));

      const { refreshMaterializedViewsNow } = await import(
        '@/features/intelligence/jobs/materialized-view-refresh.job'
      );

      await refreshMaterializedViewsNow();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('JOB FAILURE ALERT'),
        expect.anything()
      );
    });
  });

  describe('Job Manager Integration', () => {
    it('should start all materialized view refresh jobs', async () => {
      const { startMaterializedViewRefreshJobs } = await import(
        '@/features/intelligence/jobs/materialized-view-refresh.job'
      );

      expect(() => startMaterializedViewRefreshJobs()).not.toThrow();
    });

    it('should stop all materialized view refresh jobs', async () => {
      const { startMaterializedViewRefreshJobs, stopMaterializedViewRefreshJobs } = await import(
        '@/features/intelligence/jobs/materialized-view-refresh.job'
      );

      startMaterializedViewRefreshJobs();
      expect(() => stopMaterializedViewRefreshJobs()).not.toThrow();
    });
  });
});
