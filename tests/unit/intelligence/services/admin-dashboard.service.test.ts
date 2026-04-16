/**
 * Unit Tests for AdminDashboardService
 * Task 15.2.6: Add service tests for admin-dashboard.service.ts
 * 
 * Test coverage:
 * - System metrics retrieval
 * - Accuracy metrics calculation
 * - Vendor segment distribution
 * - Schema evolution log
 * - ML datasets retrieval
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminDashboardService } from '@/features/intelligence/services/admin-dashboard.service';
import { db } from '@/lib/db';
import { redis } from '@/lib/cache/redis';

// Mock dependencies
vi.mock('@/lib/db');
vi.mock('@/lib/cache/redis', () => ({
  redis: {
    info: vi.fn(),
    keys: vi.fn(),
  },
}));

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;

  beforeEach(() => {
    service = new AdminDashboardService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSystemMetrics', () => {
    it('should retrieve system health metrics', async () => {
      vi.mocked(redis.info).mockResolvedValue('keyspace_hits:850\nkeyspace_misses:150');

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ avgResponseTime: 145 }]),
        }),
      } as any);

      const metrics = await service.getSystemMetrics();

      expect(metrics).toHaveProperty('cacheHitRate');
      expect(metrics).toHaveProperty('avgResponseTime');
      expect(metrics).toHaveProperty('jobsRunning');
      expect(metrics).toHaveProperty('lastRefresh');
      expect(metrics.cacheHitRate).toBeCloseTo(85, 0);
      expect(metrics.avgResponseTime).toBe(145);
    });

    it('should handle Redis info parsing errors gracefully', async () => {
      vi.mocked(redis.info).mockResolvedValue('invalid_format');

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ avgResponseTime: 150 }]),
        }),
      } as any);

      const metrics = await service.getSystemMetrics();

      expect(metrics.cacheHitRate).toBe(0);
      expect(metrics.avgResponseTime).toBe(150);
    });

    it('should handle missing response time data', async () => {
      vi.mocked(redis.info).mockResolvedValue('keyspace_hits:900\nkeyspace_misses:100');

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const metrics = await service.getSystemMetrics();

      expect(metrics.avgResponseTime).toBe(0);
    });

    it('should throw error on database failure', async () => {
      vi.mocked(redis.info).mockResolvedValue('keyspace_hits:850\nkeyspace_misses:150');

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);

      await expect(service.getSystemMetrics()).rejects.toThrow('Database error');
    });
  });

  describe('getAccuracyMetrics', () => {
    it('should retrieve accuracy metrics for specified period', async () => {
      const mockMetrics = [
        { date: '2024-01-01', accuracy: 88.5, avgError: 11.5, predictions: 100 },
        { date: '2024-01-02', accuracy: 89.0, avgError: 11.0, predictions: 120 },
        { date: '2024-01-03', accuracy: 87.5, avgError: 12.5, predictions: 110 },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockMetrics),
          }),
        }),
      } as any);

      const result = await service.getAccuracyMetrics(30);

      expect(result.data).toHaveLength(3);
      expect(result.summary.avgAccuracy).toBeCloseTo(88.33, 1);
      expect(result.summary.avgError).toBeCloseTo(11.67, 1);
      expect(result.summary.totalPredictions).toBe(330);
    });

    it('should handle empty metrics gracefully', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await service.getAccuracyMetrics(30);

      expect(result.data).toHaveLength(0);
      expect(result.summary.avgAccuracy).toBe(0);
      expect(result.summary.avgError).toBe(0);
      expect(result.summary.totalPredictions).toBe(0);
    });

    it('should use default period of 30 days', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await service.getAccuracyMetrics();

      expect(db.select).toHaveBeenCalled();
    });

    it('should throw error on database failure', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      } as any);

      await expect(service.getAccuracyMetrics(30)).rejects.toThrow('Database error');
    });
  });

  describe('getVendorSegmentDistribution', () => {
    it('should retrieve vendor segment distribution', async () => {
      const mockSegments = [
        { segment: 'High-Value', count: 45, avgBidAmount: 5000000, avgWinRate: 0.35 },
        { segment: 'Active', count: 120, avgBidAmount: 3000000, avgWinRate: 0.25 },
        { segment: 'Occasional', count: 80, avgBidAmount: 2000000, avgWinRate: 0.15 },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockSegments),
          }),
        }),
      } as any);

      const result = await service.getVendorSegmentDistribution();

      expect(result.segments).toHaveLength(3);
      expect(result.total).toBe(245);
      expect(result.segments[0].percentage).toBeCloseTo(18.37, 1);
      expect(result.segments[1].percentage).toBeCloseTo(48.98, 1);
      expect(result.segments[2].percentage).toBeCloseTo(32.65, 1);
    });

    it('should handle empty segments gracefully', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await service.getVendorSegmentDistribution();

      expect(result.segments).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should throw error on database failure', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          groupBy: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      } as any);

      await expect(service.getVendorSegmentDistribution()).rejects.toThrow('Database error');
    });
  });

  describe('getSchemaEvolutionLog', () => {
    it('should retrieve schema evolution changes', async () => {
      const mockChanges = [
        {
          id: '1',
          changeType: 'new_asset_type',
          entityType: 'vehicle',
          entityName: 'electric_scooter',
          detectedAt: new Date('2024-01-15'),
          status: 'pending',
          sampleCount: 15,
          confidence: 0.85,
        },
        {
          id: '2',
          changeType: 'new_attribute',
          entityType: 'vehicle',
          entityName: 'battery_capacity',
          detectedAt: new Date('2024-01-14'),
          status: 'approved',
          sampleCount: 25,
          confidence: 0.92,
        },
        {
          id: '3',
          changeType: 'schema_update',
          entityType: 'electronics',
          entityName: 'screen_size',
          detectedAt: new Date('2024-01-13'),
          status: 'rejected',
          sampleCount: 8,
          confidence: 0.65,
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(mockChanges),
          }),
        }),
      } as any);

      const result = await service.getSchemaEvolutionLog(50);

      expect(result.changes).toHaveLength(3);
      expect(result.pending).toBe(1);
      expect(result.approved).toBe(1);
      expect(result.rejected).toBe(1);
    });

    it('should use default limit of 50', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      await service.getSchemaEvolutionLog();

      expect(db.select).toHaveBeenCalled();
    });

    it('should handle empty changes gracefully', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await service.getSchemaEvolutionLog(50);

      expect(result.changes).toHaveLength(0);
      expect(result.pending).toBe(0);
      expect(result.approved).toBe(0);
      expect(result.rejected).toBe(0);
    });

    it('should throw error on database failure', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      } as any);

      await expect(service.getSchemaEvolutionLog(50)).rejects.toThrow('Database error');
    });
  });

  describe('getMLDatasets', () => {
    it('should retrieve ML training datasets', async () => {
      const mockDatasets = [
        {
          id: 'ds-1',
          datasetType: 'price_prediction',
          recordCount: 5000,
          featureCount: 25,
          createdAt: new Date('2024-01-15'),
          format: 'csv',
          size: 2048000,
          trainSplit: 70,
          validationSplit: 15,
          testSplit: 15,
        },
        {
          id: 'ds-2',
          datasetType: 'recommendation',
          recordCount: 10000,
          featureCount: 30,
          createdAt: new Date('2024-01-14'),
          format: 'json',
          size: 5120000,
          trainSplit: 80,
          validationSplit: 10,
          testSplit: 10,
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockDatasets),
        }),
      } as any);

      const result = await service.getMLDatasets();

      expect(result.datasets).toHaveLength(2);
      expect(result.totalRecords).toBe(15000);
      expect(result.totalSize).toBe(7168000);
    });

    it('should handle empty datasets gracefully', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      const result = await service.getMLDatasets();

      expect(result.datasets).toHaveLength(0);
      expect(result.totalRecords).toBe(0);
      expect(result.totalSize).toBe(0);
    });

    it('should throw error on database failure', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);

      await expect(service.getMLDatasets()).rejects.toThrow('Database error');
    });
  });

  describe('parseCacheHitRate', () => {
    it('should parse cache hit rate correctly', async () => {
      vi.mocked(redis.info).mockResolvedValue('keyspace_hits:850\nkeyspace_misses:150');

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ avgResponseTime: 145 }]),
        }),
      } as any);

      const metrics = await service.getSystemMetrics();

      expect(metrics.cacheHitRate).toBeCloseTo(85, 0);
    });

    it('should return 0 for invalid format', async () => {
      vi.mocked(redis.info).mockResolvedValue('invalid_data');

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ avgResponseTime: 145 }]),
        }),
      } as any);

      const metrics = await service.getSystemMetrics();

      expect(metrics.cacheHitRate).toBe(0);
    });

    it('should handle zero total requests', async () => {
      vi.mocked(redis.info).mockResolvedValue('keyspace_hits:0\nkeyspace_misses:0');

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ avgResponseTime: 145 }]),
        }),
      } as any);

      const metrics = await service.getSystemMetrics();

      expect(metrics.cacheHitRate).toBe(0);
    });
  });
});
