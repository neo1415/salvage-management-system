/**
 * Unit Tests for Schema Evolution Jobs
 * Phase 9.5: Tasks 9.5.1, 9.5.2, 9.5.3
 * 
 * Test coverage:
 * - New asset type detection
 * - New attribute detection
 * - Automatic analytics table expansion
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Schema Evolution Jobs', () => {
  let redisCache: any;
  let SchemaEvolutionService: any;
  let runSchemaEvolutionNow: any;
  let startSchemaEvolutionJobs: any;
  let stopSchemaEvolutionJobs: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Mock Redis cache
    redisCache = {
      getCached: vi.fn(),
      setCached: vi.fn(),
    };
    vi.doMock('@/lib/cache/redis', () => redisCache);

    // Mock Schema Evolution Service
    SchemaEvolutionService = vi.fn(function(this: any) {
      this.detectNewAssetTypes = vi.fn().mockResolvedValue([]);
      this.detectNewAttributes = vi.fn().mockResolvedValue([]);
      this.expandAnalyticsTables = vi.fn().mockResolvedValue(undefined);
      this.expandAnalyticsTablesForAttribute = vi.fn().mockResolvedValue(undefined);
    });
    vi.doMock('@/features/intelligence/services/schema-evolution.service', () => ({
      SchemaEvolutionService,
    }));

    // Import module AFTER mocking
    const module = await import('@/features/intelligence/jobs/schema-evolution.job');
    runSchemaEvolutionNow = module.runSchemaEvolutionNow;
    startSchemaEvolutionJobs = module.startSchemaEvolutionJobs;
    stopSchemaEvolutionJobs = module.stopSchemaEvolutionJobs;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Asset Type Detection', () => {
    it('should detect new asset types successfully', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      SchemaEvolutionService.mockImplementation(function(this: any) {
        this.detectNewAssetTypes = vi.fn().mockResolvedValue(['furniture', 'jewelry']);
        this.detectNewAttributes = vi.fn().mockResolvedValue([]);
        this.expandAnalyticsTables = vi.fn().mockResolvedValue(undefined);
        this.expandAnalyticsTablesForAttribute = vi.fn().mockResolvedValue(undefined);
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/features/intelligence/services/schema-evolution.service', () => ({
        SchemaEvolutionService,
      }));
      const module = await import('@/features/intelligence/jobs/schema-evolution.job');

      const result = await module.runSchemaEvolutionNow('asset-types');

      expect(result.success).toBe(true);
    });

    it('should expand analytics tables for new asset types', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const mockExpand = vi.fn().mockResolvedValue(undefined);
      SchemaEvolutionService.mockImplementation(function(this: any) {
        this.detectNewAssetTypes = vi.fn().mockResolvedValue(['furniture']);
        this.detectNewAttributes = vi.fn().mockResolvedValue([]);
        this.expandAnalyticsTables = mockExpand;
        this.expandAnalyticsTablesForAttribute = vi.fn().mockResolvedValue(undefined);
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/features/intelligence/services/schema-evolution.service', () => ({
        SchemaEvolutionService,
      }));
      const module = await import('@/features/intelligence/jobs/schema-evolution.job');

      await module.runSchemaEvolutionNow('asset-types');

      expect(mockExpand).toHaveBeenCalledWith('furniture');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Expanded analytics tables for asset type: furniture')
      );
    });

    it('should handle no new asset types gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      SchemaEvolutionService.mockImplementation(function(this: any) {
        this.detectNewAssetTypes = vi.fn().mockResolvedValue([]);
        this.detectNewAttributes = vi.fn().mockResolvedValue([]);
        this.expandAnalyticsTables = vi.fn().mockResolvedValue(undefined);
        this.expandAnalyticsTablesForAttribute = vi.fn().mockResolvedValue(undefined);
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/features/intelligence/services/schema-evolution.service', () => ({
        SchemaEvolutionService,
      }));
      const module = await import('@/features/intelligence/jobs/schema-evolution.job');

      const result = await module.runSchemaEvolutionNow('asset-types');

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No new asset types detected')
      );
    });

    it('should handle expansion errors for individual asset types', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const mockExpand = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Expansion failed'));

      SchemaEvolutionService.mockImplementation(function(this: any) {
        this.detectNewAssetTypes = vi.fn().mockResolvedValue(['furniture', 'jewelry']);
        this.detectNewAttributes = vi.fn().mockResolvedValue([]);
        this.expandAnalyticsTables = mockExpand;
        this.expandAnalyticsTablesForAttribute = vi.fn().mockResolvedValue(undefined);
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/features/intelligence/services/schema-evolution.service', () => ({
        SchemaEvolutionService,
      }));
      const module = await import('@/features/intelligence/jobs/schema-evolution.job');

      const result = await module.runSchemaEvolutionNow('asset-types');

      expect(result.success).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to expand analytics for jewelry'),
        expect.anything()
      );
    });
  });

  describe('Attribute Detection', () => {
    it('should detect new attributes successfully', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      SchemaEvolutionService.mockImplementation(function(this: any) {
        this.detectNewAssetTypes = vi.fn().mockResolvedValue([]);
        this.detectNewAttributes = vi.fn().mockResolvedValue([
          { assetType: 'vehicle', attributeName: 'transmission_type' },
          { assetType: 'electronics', attributeName: 'screen_size' },
        ]);
        this.expandAnalyticsTables = vi.fn().mockResolvedValue(undefined);
        this.expandAnalyticsTablesForAttribute = vi.fn().mockResolvedValue(undefined);
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/features/intelligence/services/schema-evolution.service', () => ({
        SchemaEvolutionService,
      }));
      const module = await import('@/features/intelligence/jobs/schema-evolution.job');

      const result = await module.runSchemaEvolutionNow('attributes');

      expect(result.success).toBe(true);
    });

    it('should expand analytics tables for new attributes', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const mockExpand = vi.fn().mockResolvedValue(undefined);
      SchemaEvolutionService.mockImplementation(function(this: any) {
        this.detectNewAssetTypes = vi.fn().mockResolvedValue([]);
        this.detectNewAttributes = vi.fn().mockResolvedValue([
          { assetType: 'vehicle', attributeName: 'fuel_type' },
        ]);
        this.expandAnalyticsTables = vi.fn().mockResolvedValue(undefined);
        this.expandAnalyticsTablesForAttribute = mockExpand;
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/features/intelligence/services/schema-evolution.service', () => ({
        SchemaEvolutionService,
      }));
      const module = await import('@/features/intelligence/jobs/schema-evolution.job');

      await module.runSchemaEvolutionNow('attributes');

      expect(mockExpand).toHaveBeenCalledWith({
        assetType: 'vehicle',
        attributeName: 'fuel_type',
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Expanded analytics tables for attribute: fuel_type (vehicle)')
      );
    });

    it('should handle no new attributes gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      SchemaEvolutionService.mockImplementation(function(this: any) {
        this.detectNewAssetTypes = vi.fn().mockResolvedValue([]);
        this.detectNewAttributes = vi.fn().mockResolvedValue([]);
        this.expandAnalyticsTables = vi.fn().mockResolvedValue(undefined);
        this.expandAnalyticsTablesForAttribute = vi.fn().mockResolvedValue(undefined);
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/features/intelligence/services/schema-evolution.service', () => ({
        SchemaEvolutionService,
      }));
      const module = await import('@/features/intelligence/jobs/schema-evolution.job');

      const result = await module.runSchemaEvolutionNow('attributes');

      expect(result.success).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No new attributes detected')
      );
    });

    it('should handle expansion errors for individual attributes', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      const mockExpand = vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Expansion failed'));

      SchemaEvolutionService.mockImplementation(function(this: any) {
        this.detectNewAssetTypes = vi.fn().mockResolvedValue([]);
        this.detectNewAttributes = vi.fn().mockResolvedValue([
          { assetType: 'vehicle', attributeName: 'fuel_type' },
          { assetType: 'electronics', attributeName: 'screen_size' },
        ]);
        this.expandAnalyticsTables = vi.fn().mockResolvedValue(undefined);
        this.expandAnalyticsTablesForAttribute = mockExpand;
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/features/intelligence/services/schema-evolution.service', () => ({
        SchemaEvolutionService,
      }));
      const module = await import('@/features/intelligence/jobs/schema-evolution.job');

      const result = await module.runSchemaEvolutionNow('attributes');

      expect(result.success).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to expand analytics for screen_size'),
        expect.anything()
      );
    });
  });

  describe('Distributed Locking', () => {
    it('should use separate locks for asset types and attributes', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      await runSchemaEvolutionNow('asset-types');
      await runSchemaEvolutionNow('attributes');

      expect(redisCache.getCached).toHaveBeenCalledWith(
        expect.stringContaining('asset_type_detection')
      );
      expect(redisCache.getCached).toHaveBeenCalledWith(
        expect.stringContaining('attribute_detection')
      );
    });

    it('should set lock with correct TTL (3600 seconds)', async () => {
      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      await runSchemaEvolutionNow('asset-types');

      expect(redisCache.setCached).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        3600
      );
    });
  });

  describe('Error Handling', () => {
    it('should log errors and continue processing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');

      redisCache.getCached.mockResolvedValue(null);
      redisCache.setCached.mockResolvedValue(true);

      SchemaEvolutionService.mockImplementation(function(this: any) {
        this.detectNewAssetTypes = vi.fn().mockRejectedValue(new Error('Detection failed'));
        this.detectNewAttributes = vi.fn().mockResolvedValue([]);
        this.expandAnalyticsTables = vi.fn().mockResolvedValue(undefined);
        this.expandAnalyticsTablesForAttribute = vi.fn().mockResolvedValue(undefined);
      });

      vi.resetModules();
      vi.doMock('@/lib/cache/redis', () => redisCache);
      vi.doMock('@/features/intelligence/services/schema-evolution.service', () => ({
        SchemaEvolutionService,
      }));
      const module = await import('@/features/intelligence/jobs/schema-evolution.job');

      const result = await module.runSchemaEvolutionNow('asset-types');

      expect(result.success).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Job Manager Integration', () => {
    it('should start all schema evolution jobs', async () => {
      expect(() => startSchemaEvolutionJobs()).not.toThrow();
    });

    it('should stop all schema evolution jobs', async () => {
      startSchemaEvolutionJobs();
      expect(() => stopSchemaEvolutionJobs()).not.toThrow();
    });
  });
});
