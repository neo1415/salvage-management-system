/**
 * AnalyticsAggregationService Unit Tests
 * Task 5.5.6: Add unit tests for AnalyticsAggregationService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsAggregationService } from '@/features/intelligence/services/analytics-aggregation.service';

// Mock all service dependencies
vi.mock('@/features/intelligence/services/asset-analytics.service', () => ({
  AssetAnalyticsService: class {
    calculateAssetPerformance = vi.fn().mockResolvedValue(undefined);
    calculateAttributePerformance = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('@/features/intelligence/services/temporal-analytics.service', () => ({
  TemporalAnalyticsService: class {
    calculateHourlyPatterns = vi.fn().mockResolvedValue(undefined);
    calculateDailyPatterns = vi.fn().mockResolvedValue(undefined);
    calculateSeasonalPatterns = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('@/features/intelligence/services/geographic-analytics.service', () => ({
  GeographicAnalyticsService: class {
    calculateGeographicPatterns = vi.fn().mockResolvedValue(undefined);
  },
}));

vi.mock('@/features/intelligence/services/behavioral-analytics.service', () => ({
  BehavioralAnalyticsService: class {
    segmentVendors = vi.fn().mockResolvedValue(undefined);
    calculateConversionFunnel = vi.fn().mockResolvedValue(undefined);
  },
}));

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}));

describe('AnalyticsAggregationService', () => {
  let service: AnalyticsAggregationService;

  beforeEach(() => {
    service = new AnalyticsAggregationService();
    vi.clearAllMocks();
  });

  describe('runHourlyRollup', () => {
    it('should create hourly rollup', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock metrics data
      (db.execute as any).mockResolvedValueOnce([
        {
          total_auctions: 50,
          total_bids: 200,
          avg_bids_per_auction: 4,
          avg_final_price: 2000000,
          active_vendors: 25,
        },
      ]);

      await service.runHourlyRollup();

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('runDailyRollup', () => {
    it('should run all daily analytics calculations', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock metrics data
      (db.execute as any).mockResolvedValueOnce([
        {
          total_auctions: 100,
          total_bids: 500,
          avg_bids_per_auction: 5,
          avg_final_price: 2500000,
          active_vendors: 50,
        },
      ]);

      // Spy on the service's internal instances
      const assetServiceSpy = vi.spyOn(service as any, 'assetService', 'get').mockReturnValue({
        calculateAssetPerformance: vi.fn().mockResolvedValue(undefined),
        calculateAttributePerformance: vi.fn().mockResolvedValue(undefined),
      });
      const temporalServiceSpy = vi.spyOn(service as any, 'temporalService', 'get').mockReturnValue({
        calculateHourlyPatterns: vi.fn().mockResolvedValue(undefined),
        calculateDailyPatterns: vi.fn().mockResolvedValue(undefined),
        calculateSeasonalPatterns: vi.fn().mockResolvedValue(undefined),
      });
      const geoServiceSpy = vi.spyOn(service as any, 'geoService', 'get').mockReturnValue({
        calculateGeographicPatterns: vi.fn().mockResolvedValue(undefined),
      });
      const behavioralServiceSpy = vi.spyOn(service as any, 'behavioralService', 'get').mockReturnValue({
        segmentVendors: vi.fn().mockResolvedValue(undefined),
        calculateConversionFunnel: vi.fn().mockResolvedValue(undefined),
      });

      await service.runDailyRollup();

      // Verify all services were called
      expect((service as any).assetService.calculateAssetPerformance).toHaveBeenCalled();
      expect((service as any).assetService.calculateAttributePerformance).toHaveBeenCalled();
      expect((service as any).temporalService.calculateHourlyPatterns).toHaveBeenCalled();
      expect((service as any).temporalService.calculateDailyPatterns).toHaveBeenCalled();
      expect((service as any).geoService.calculateGeographicPatterns).toHaveBeenCalled();
      expect((service as any).behavioralService.calculateConversionFunnel).toHaveBeenCalled();
    });
  });

  describe('runWeeklyRollup', () => {
    it('should run weekly analytics calculations', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock metrics data
      (db.execute as any).mockResolvedValueOnce([
        {
          total_auctions: 500,
          total_bids: 2500,
          avg_bids_per_auction: 5,
          avg_final_price: 2500000,
          active_vendors: 100,
        },
      ]);

      // Spy on the service's internal instance
      vi.spyOn(service as any, 'behavioralService', 'get').mockReturnValue({
        segmentVendors: vi.fn().mockResolvedValue(undefined),
        calculateConversionFunnel: vi.fn().mockResolvedValue(undefined),
      });

      await service.runWeeklyRollup();

      // Verify vendor segmentation was called
      expect((service as any).behavioralService.segmentVendors).toHaveBeenCalled();
    });
  });

  describe('runMonthlyRollup', () => {
    it('should run monthly analytics calculations', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock metrics data
      (db.execute as any).mockResolvedValueOnce([
        {
          total_auctions: 2000,
          total_bids: 10000,
          avg_bids_per_auction: 5,
          avg_final_price: 2500000,
          active_vendors: 200,
        },
      ]);

      // Spy on the service's internal instance
      vi.spyOn(service as any, 'temporalService', 'get').mockReturnValue({
        calculateHourlyPatterns: vi.fn().mockResolvedValue(undefined),
        calculateDailyPatterns: vi.fn().mockResolvedValue(undefined),
        calculateSeasonalPatterns: vi.fn().mockResolvedValue(undefined),
      });

      await service.runMonthlyRollup();

      // Verify seasonal patterns were calculated
      expect((service as any).temporalService.calculateSeasonalPatterns).toHaveBeenCalled();
    });
  });

  describe('createRollup', () => {
    it('should create rollup with correct metrics', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock metrics data
      (db.execute as any).mockResolvedValueOnce([
        {
          total_auctions: 100,
          total_bids: 500,
          avg_bids_per_auction: 5,
          avg_final_price: 2500000,
          active_vendors: 50,
        },
      ]);

      // Call private method through public method
      await service.runHourlyRollup();

      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle missing data gracefully', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock empty metrics
      (db.execute as any).mockResolvedValueOnce([
        {
          total_auctions: null,
          total_bids: null,
          avg_bids_per_auction: null,
          avg_final_price: null,
          active_vendors: null,
        },
      ]);

      await service.runHourlyRollup();

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle database errors in hourly rollup', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock database error
      (db.execute as any).mockRejectedValueOnce(new Error('Database error'));

      await expect(service.runHourlyRollup()).rejects.toThrow('Database error');
    });

    it('should handle service errors in daily rollup', async () => {
      // Spy on the service's internal instance and make it throw
      vi.spyOn(service as any, 'assetService', 'get').mockReturnValue({
        calculateAssetPerformance: vi.fn().mockRejectedValue(new Error('Service error')),
        calculateAttributePerformance: vi.fn().mockResolvedValue(undefined),
      });

      await expect(service.runDailyRollup()).rejects.toThrow('Service error');
    });
  });
});
