/**
 * Unit Tests for Data Maintenance Jobs
 * Phase 9.4: Tasks 9.4.1, 9.4.2, 9.4.3, 9.4.4, 9.4.5
 * 
 * Test coverage:
 * - Interactions cleanup (>2 years old)
 * - Log rotation (>90 days old)
 * - Vendor segment update
 * - Asset performance update
 * - Feature vector update
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Data Maintenance Jobs', () => {
  let redisCache: any;
  let db: any;
  let BehavioralAnalyticsService: any;
  let AssetAnalyticsService: any;
  let runDataMaintenanceNow: any;
  let startDataMaintenanceJobs: any;
  let stopDataMaintenanceJobs: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Mock Redis cache
    redisCache = {
      getCached: vi.fn(),
      setCached: vi.fn(),
    };
    vi.doMock('@/lib/cache/redis', () => redisCache);

    // Mock database
    db = {
      delete: vi.fn(),
      execute: vi.fn(),
    };
    vi.doMock('@/lib/db', () => ({ db }));

    // Mock Behavioral Analytics Service
    BehavioralAnalyticsService = vi.fn(function(this: any) {
      this.segmentVendor = vi.fn().mockResolvedValue(undefined);
    });
    vi.doMock('@/features/intelligence/services/behavioral-analytics.service', () => ({
      BehavioralAnalyticsService,
    }));

    // Mock Asset Analytics Service
    AssetAnalyticsService = vi.fn(function(this: any) {
      this.calculateAssetPerformance = vi.fn().mockResolvedValue(undefined);
    });
    vi.doMock('@/features/intelligence/services/asset-analytics.service', () => ({
      AssetAnalyticsService,
    }));

    // Import module AFTER mocking
    const module = await import('@/features/intelligence/jobs/data-maintenance.job');
    runDataMaintenanceNow = module.runDataMaintenanceNow;
    startDataMaintenanceJobs = module.startDataMaintenanceJobs;
    stopDataMaintenanceJobs = module.stopDataMaintenanceJobs;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Interactions Cleanup', () => {
    it('should delete interactions older than 2 years', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      db.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const result = await runDataMaintenanceNow('interactions');

      expect(result.success).toBe(true);
      expect(db.delete).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      db.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(runDataMaintenanceNow('interactions')).rejects.toThrow('Database error');
    });
  });

  describe('Log Rotation', () => {
    it('should archive logs older than 90 days', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      db.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const result = await runDataMaintenanceNow('logs');

      expect(result.success).toBe(true);
      expect(db.delete).toHaveBeenCalledTimes(3);
    });

    it('should rotate prediction logs', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      db.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await runDataMaintenanceNow('logs');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Archived prediction logs')
      );
    });

    it('should rotate recommendation logs', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      db.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await runDataMaintenanceNow('logs');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Archived recommendation logs')
      );
    });

    it('should rotate fraud detection logs', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      db.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await runDataMaintenanceNow('logs');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Archived fraud detection logs')
      );
    });
  });

  describe('Vendor Segment Update', () => {
    it('should update vendor segments for active vendors', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      db.execute.mockResolvedValue([
        { vendor_id: 'vendor-1' },
        { vendor_id: 'vendor-2' },
        { vendor_id: 'vendor-3' },
      ]);

      const result = await runDataMaintenanceNow('segments');

      expect(result.success).toBe(true);
      expect(db.execute).toHaveBeenCalled();
    });

    it('should handle individual vendor segmentation errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      db.execute.mockResolvedValue([
        { vendor_id: 'vendor-1' },
        { vendor_id: 'vendor-2' },
      ]);

      const mockSegmentVendor = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Segmentation failed'));

      BehavioralAnalyticsService.mockImplementation(function(this: any) {
        this.segmentVendor = mockSegmentVendor;
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/lib/db', () => ({ db }));
      vi.doMock('@/features/intelligence/services/behavioral-analytics.service', () => ({
        BehavioralAnalyticsService,
      }));
      vi.doMock('@/features/intelligence/services/asset-analytics.service', () => ({
        AssetAnalyticsService,
      }));
      const module = await import('@/features/intelligence/jobs/data-maintenance.job');

      const result = await module.runDataMaintenanceNow('segments');

      expect(result.success).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error segmenting vendor'),
        expect.anything()
      );
    });
  });

  describe('Asset Performance Update', () => {
    it('should update asset performance for all asset types', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const result = await runDataMaintenanceNow('performance');

      expect(result.success).toBe(true);
    });

    it('should update vehicle asset performance', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const mockCalculate = vi.fn().mockResolvedValue(undefined);

      AssetAnalyticsService.mockImplementation(function(this: any) {
        this.calculateAssetPerformance = mockCalculate;
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/lib/db', () => ({ db }));
      vi.doMock('@/features/intelligence/services/behavioral-analytics.service', () => ({
        BehavioralAnalyticsService,
      }));
      vi.doMock('@/features/intelligence/services/asset-analytics.service', () => ({
        AssetAnalyticsService,
      }));
      const module = await import('@/features/intelligence/jobs/data-maintenance.job');

      await module.runDataMaintenanceNow('performance');

      expect(mockCalculate).toHaveBeenCalledWith('vehicle');
    });

    it('should handle asset type update errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const mockCalculate = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Update failed'))
        .mockResolvedValueOnce(undefined);

      AssetAnalyticsService.mockImplementation(function(this: any) {
        this.calculateAssetPerformance = mockCalculate;
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/lib/db', () => ({ db }));
      vi.doMock('@/features/intelligence/services/behavioral-analytics.service', () => ({
        BehavioralAnalyticsService,
      }));
      vi.doMock('@/features/intelligence/services/asset-analytics.service', () => ({
        AssetAnalyticsService,
      }));
      const module = await import('@/features/intelligence/jobs/data-maintenance.job');

      const result = await module.runDataMaintenanceNow('performance');

      expect(result.success).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error updating electronics performance'),
        expect.anything()
      );
    });
  });

  describe('Feature Vector Update', () => {
    it('should update feature vectors for recent auctions', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      db.execute.mockResolvedValue([
        { count: '45' },
      ]);

      const result = await runDataMaintenanceNow('vectors');

      expect(result.success).toBe(true);
      expect(db.execute).toHaveBeenCalled();
    });

    it('should log feature vector update count', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      db.execute.mockResolvedValue([
        { count: '30' },
      ]);

      await runDataMaintenanceNow('vectors');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Feature vectors updated (30 auctions')
      );
    });
  });

  describe('Distributed Locking', () => {
    it('should use separate locks for different maintenance types', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      db.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      db.execute.mockResolvedValue([{}]);

      await runDataMaintenanceNow('interactions');
      await runDataMaintenanceNow('logs');

      expect(redisCache.getCached).toHaveBeenCalledWith(
        expect.stringContaining('interactions_cleanup')
      );
      expect(redisCache.getCached).toHaveBeenCalledWith(
        expect.stringContaining('log_rotation')
      );
    });

    it('should set lock with correct TTL (7200 seconds)', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      db.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      await runDataMaintenanceNow('interactions');

      expect(redisCache.setCached).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        7200
      );
    });
  });

  describe('Job Manager Integration', () => {
    it('should start all data maintenance jobs', async () => {
      expect(() => startDataMaintenanceJobs()).not.toThrow();
    });

    it('should stop all data maintenance jobs', async () => {
      startDataMaintenanceJobs();
      expect(() => stopDataMaintenanceJobs()).not.toThrow();
    });
  });
});
