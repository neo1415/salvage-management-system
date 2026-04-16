/**
 * Unit Tests for AssetAnalyticsService
 * Task 12.1.4: Write unit tests for AssetAnalyticsService (>80% coverage)
 * 
 * Test coverage:
 * - Asset performance calculation (make/model/year)
 * - Attribute performance calculation (color/trim/storage)
 * - Daily aggregation logic
 * - Demand score calculation
 * - Popularity score calculation
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AssetAnalyticsService } from '@/features/intelligence/services/asset-analytics.service';
import { db } from '@/lib/db';

// Mock dependencies
vi.mock('@/lib/db');

describe('AssetAnalyticsService', () => {
  let service: AssetAnalyticsService;
  let periodStart: Date;
  let periodEnd: Date;

  beforeEach(() => {
    service = new AssetAnalyticsService();
    periodStart = new Date('2024-01-01');
    periodEnd = new Date('2024-01-31');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateAssetPerformance', () => {
    it('should calculate asset performance metrics correctly', async () => {
      // Mock database query results
      const mockPerformanceData = [
        {
          asset_type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          damage_severity: 'moderate',
          total_auctions: 10,
          total_bids: 50,
          avg_bids_per_auction: 5.0,
          avg_final_price: 1500000,
          avg_sell_through_rate: 0.8,
          avg_time_to_sell: 48,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockPerformanceData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.calculateAssetPerformance(periodStart, periodEnd);

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(db.insert).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple asset types', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          damage_severity: 'minor',
          total_auctions: 5,
          total_bids: 25,
          avg_bids_per_auction: 5.0,
          avg_final_price: 2000000,
          avg_sell_through_rate: 0.9,
          avg_time_to_sell: 36,
        },
        {
          asset_type: 'electronics',
          make: 'Apple',
          model: 'iPhone 13',
          year: 2021,
          damage_severity: 'minor',
          total_auctions: 8,
          total_bids: 40,
          avg_bids_per_auction: 5.0,
          avg_final_price: 500000,
          avg_sell_through_rate: 0.85,
          avg_time_to_sell: 24,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.calculateAssetPerformance(periodStart, periodEnd);

      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('should calculate demand score correctly', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          make: 'Honda',
          model: 'Accord',
          year: 2019,
          damage_severity: 'moderate',
          total_auctions: 15,
          total_bids: 75,
          avg_bids_per_auction: 5.0,
          avg_final_price: 1800000,
          avg_sell_through_rate: 0.75,
          avg_time_to_sell: 60,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      
      let capturedValues: any;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          capturedValues = vals;
          return Promise.resolve(undefined);
        }),
      } as any);

      await service.calculateAssetPerformance(periodStart, periodEnd);

      expect(capturedValues).toBeDefined();
      expect(capturedValues.demandScore).toBeGreaterThanOrEqual(0);
      expect(capturedValues.demandScore).toBeLessThanOrEqual(100);
    });

    it('should handle empty results', async () => {
      vi.mocked(db.execute).mockResolvedValue([] as any);

      await service.calculateAssetPerformance(periodStart, periodEnd);

      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should handle null values gracefully', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          make: 'Toyota',
          model: 'Corolla',
          year: 2018,
          damage_severity: 'severe',
          total_auctions: 3,
          total_bids: 10,
          avg_bids_per_auction: 3.33,
          avg_final_price: null,
          avg_sell_through_rate: 0.5,
          avg_time_to_sell: null,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.calculateAssetPerformance(periodStart, periodEnd);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle different damage severity levels', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          make: 'Nissan',
          model: 'Altima',
          year: 2020,
          damage_severity: 'minor',
          total_auctions: 5,
          total_bids: 30,
          avg_bids_per_auction: 6.0,
          avg_final_price: 2200000,
          avg_sell_through_rate: 0.95,
          avg_time_to_sell: 30,
        },
        {
          asset_type: 'vehicle',
          make: 'Nissan',
          model: 'Altima',
          year: 2020,
          damage_severity: 'severe',
          total_auctions: 5,
          total_bids: 15,
          avg_bids_per_auction: 3.0,
          avg_final_price: 800000,
          avg_sell_through_rate: 0.6,
          avg_time_to_sell: 72,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.calculateAssetPerformance(periodStart, periodEnd);

      expect(db.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('calculateAttributePerformance', () => {
    it('should calculate all attribute types', async () => {
      vi.mocked(db.execute).mockResolvedValue([] as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.calculateAttributePerformance(periodStart, periodEnd);

      // Should call execute 3 times (color, trim, storage)
      expect(db.execute).toHaveBeenCalledTimes(3);
    });

    it('should calculate color performance correctly', async () => {
      const mockColorData = [
        {
          asset_type: 'vehicle',
          color: 'Black',
          total_auctions: 20,
          avg_price_premium: 50000,
          avg_bid_count: 6.5,
        },
        {
          asset_type: 'vehicle',
          color: 'White',
          total_auctions: 18,
          avg_price_premium: 30000,
          avg_bid_count: 5.8,
        },
      ];

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockColorData as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.calculateAttributePerformance(periodStart, periodEnd);

      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('should calculate trim performance correctly', async () => {
      const mockTrimData = [
        {
          asset_type: 'vehicle',
          trim: 'LE',
          total_auctions: 15,
          avg_price_premium: 20000,
          avg_bid_count: 5.2,
        },
        {
          asset_type: 'vehicle',
          trim: 'XLE',
          total_auctions: 12,
          avg_price_premium: 80000,
          avg_bid_count: 7.1,
        },
      ];

      vi.mocked(db.execute)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce(mockTrimData as any)
        .mockResolvedValueOnce([] as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.calculateAttributePerformance(periodStart, periodEnd);

      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('should calculate storage performance for electronics', async () => {
      const mockStorageData = [
        {
          asset_type: 'electronics',
          storage: '128GB',
          total_auctions: 10,
          avg_price_premium: 15000,
          avg_bid_count: 4.5,
        },
        {
          asset_type: 'electronics',
          storage: '256GB',
          total_auctions: 8,
          avg_price_premium: 35000,
          avg_bid_count: 5.8,
        },
      ];

      vi.mocked(db.execute)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce(mockStorageData as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.calculateAttributePerformance(periodStart, periodEnd);

      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('should calculate popularity score correctly', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          color: 'Red',
          total_auctions: 25,
          avg_price_premium: 40000,
          avg_bid_count: 6.0,
        },
      ];

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockData as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);

      let capturedValues: any;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          capturedValues = vals;
          return Promise.resolve(undefined);
        }),
      } as any);

      await service.calculateAttributePerformance(periodStart, periodEnd);

      expect(capturedValues).toBeDefined();
      expect(capturedValues.popularityScore).toBeGreaterThanOrEqual(0);
      expect(capturedValues.popularityScore).toBeLessThanOrEqual(100);
    });

    it('should handle negative price premiums', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          color: 'Brown',
          total_auctions: 5,
          avg_price_premium: -20000, // Less popular color
          avg_bid_count: 3.2,
        },
      ];

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockData as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.calculateAttributePerformance(periodStart, periodEnd);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle empty attribute results', async () => {
      vi.mocked(db.execute)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);

      await service.calculateAttributePerformance(periodStart, periodEnd);

      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe('Demand Score Calculation', () => {
    it('should calculate high demand score for popular assets', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          make: 'Toyota',
          model: 'Land Cruiser',
          year: 2021,
          damage_severity: 'minor',
          total_auctions: 20, // High volume
          total_bids: 150,
          avg_bids_per_auction: 7.5, // High interest
          avg_final_price: 5000000,
          avg_sell_through_rate: 0.95, // High sell-through
          avg_time_to_sell: 24,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      
      let capturedDemandScore: number | undefined;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          capturedDemandScore = vals.demandScore;
          return Promise.resolve(undefined);
        }),
      } as any);

      await service.calculateAssetPerformance(periodStart, periodEnd);

      expect(capturedDemandScore).toBeGreaterThan(70);
    });

    it('should calculate low demand score for unpopular assets', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          make: 'Unknown',
          model: 'Model',
          year: 2010,
          damage_severity: 'severe',
          total_auctions: 2, // Low volume
          total_bids: 4,
          avg_bids_per_auction: 2.0, // Low interest
          avg_final_price: 300000,
          avg_sell_through_rate: 0.3, // Low sell-through
          avg_time_to_sell: 120,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      
      let capturedDemandScore: number | undefined;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          capturedDemandScore = vals.demandScore;
          return Promise.resolve(undefined);
        }),
      } as any);

      await service.calculateAssetPerformance(periodStart, periodEnd);

      expect(capturedDemandScore).toBeLessThan(40);
    });

    it('should cap demand score at 100', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          make: 'Luxury',
          model: 'Brand',
          year: 2023,
          damage_severity: 'none',
          total_auctions: 50, // Very high volume
          total_bids: 500,
          avg_bids_per_auction: 10.0, // Very high interest
          avg_final_price: 10000000,
          avg_sell_through_rate: 1.0, // Perfect sell-through
          avg_time_to_sell: 12,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      
      let capturedDemandScore: number | undefined;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          capturedDemandScore = vals.demandScore;
          return Promise.resolve(undefined);
        }),
      } as any);

      await service.calculateAssetPerformance(periodStart, periodEnd);

      expect(capturedDemandScore).toBeLessThanOrEqual(100);
    });

    it('should handle zero values in demand calculation', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          make: 'Test',
          model: 'Model',
          year: 2015,
          damage_severity: 'moderate',
          total_auctions: 0,
          total_bids: 0,
          avg_bids_per_auction: 0,
          avg_final_price: 0,
          avg_sell_through_rate: 0,
          avg_time_to_sell: 0,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      
      let capturedDemandScore: number | undefined;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          capturedDemandScore = vals.demandScore;
          return Promise.resolve(undefined);
        }),
      } as any);

      await service.calculateAssetPerformance(periodStart, periodEnd);

      expect(capturedDemandScore).toBe(0);
    });
  });

  describe('Popularity Score Calculation', () => {
    it('should calculate high popularity score for popular attributes', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          color: 'Silver',
          total_auctions: 30, // High volume
          avg_price_premium: 60000,
          avg_bid_count: 8.0, // High interest
        },
      ];

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockData as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);

      let capturedPopularityScore: number | undefined;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          capturedPopularityScore = vals.popularityScore;
          return Promise.resolve(undefined);
        }),
      } as any);

      await service.calculateAttributePerformance(periodStart, periodEnd);

      expect(capturedPopularityScore).toBeGreaterThan(60);
    });

    it('should calculate low popularity score for unpopular attributes', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          color: 'Beige',
          total_auctions: 3, // Low volume
          avg_price_premium: -10000,
          avg_bid_count: 2.5, // Low interest
        },
      ];

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockData as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);

      let capturedPopularityScore: number | undefined;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          capturedPopularityScore = vals.popularityScore;
          return Promise.resolve(undefined);
        }),
      } as any);

      await service.calculateAttributePerformance(periodStart, periodEnd);

      expect(capturedPopularityScore).toBeLessThan(40);
    });

    it('should cap popularity score at 100', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          trim: 'Limited',
          total_auctions: 50, // Very high volume
          avg_price_premium: 150000,
          avg_bid_count: 12.0, // Very high interest
        },
      ];

      vi.mocked(db.execute)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce(mockData as any)
        .mockResolvedValueOnce([] as any);

      let capturedPopularityScore: number | undefined;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockImplementation((vals) => {
          capturedPopularityScore = vals.popularityScore;
          return Promise.resolve(undefined);
        }),
      } as any);

      await service.calculateAttributePerformance(periodStart, periodEnd);

      expect(capturedPopularityScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in asset performance calculation', async () => {
      vi.mocked(db.execute).mockRejectedValue(new Error('Database connection failed'));

      await expect(
        service.calculateAssetPerformance(periodStart, periodEnd)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle database errors in attribute performance calculation', async () => {
      vi.mocked(db.execute).mockRejectedValue(new Error('Query timeout'));

      await expect(
        service.calculateAttributePerformance(periodStart, periodEnd)
      ).rejects.toThrow('Query timeout');
    });

    it('should handle insert errors gracefully', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          damage_severity: 'moderate',
          total_auctions: 10,
          total_bids: 50,
          avg_bids_per_auction: 5.0,
          avg_final_price: 1500000,
          avg_sell_through_rate: 0.8,
          avg_time_to_sell: 48,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('Constraint violation')),
      } as any);

      await expect(
        service.calculateAssetPerformance(periodStart, periodEnd)
      ).rejects.toThrow('Constraint violation');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large numbers', async () => {
      const mockData = [
        {
          asset_type: 'property',
          make: 'Commercial',
          model: 'Building',
          year: 2022,
          damage_severity: 'minor',
          total_auctions: 1,
          total_bids: 100,
          avg_bids_per_auction: 100.0,
          avg_final_price: 999999999.99,
          avg_sell_through_rate: 1.0,
          avg_time_to_sell: 720,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.calculateAssetPerformance(periodStart, periodEnd);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle decimal precision correctly', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          make: 'Honda',
          model: 'Civic',
          year: 2019,
          damage_severity: 'minor',
          total_auctions: 7,
          total_bids: 23,
          avg_bids_per_auction: 3.285714,
          avg_final_price: 1234567.89,
          avg_sell_through_rate: 0.7142857,
          avg_time_to_sell: 42.5,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.calculateAssetPerformance(periodStart, periodEnd);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle date range boundaries', async () => {
      const startDate = new Date('2024-01-01T00:00:00Z');
      const endDate = new Date('2024-01-01T23:59:59Z');

      vi.mocked(db.execute).mockResolvedValue([] as any);

      await service.calculateAssetPerformance(startDate, endDate);

      expect(db.execute).toHaveBeenCalled();
    });

    it('should handle missing optional fields', async () => {
      const mockData = [
        {
          asset_type: 'machinery',
          make: null,
          model: null,
          year: null,
          damage_severity: null,
          total_auctions: 5,
          total_bids: 15,
          avg_bids_per_auction: 3.0,
          avg_final_price: 800000,
          avg_sell_through_rate: 0.6,
          avg_time_to_sell: 60,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.calculateAssetPerformance(periodStart, periodEnd);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle special characters in attribute values', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          color: "Pearl White / Black Roof",
          total_auctions: 5,
          avg_price_premium: 25000,
          avg_bid_count: 4.5,
        },
      ];

      vi.mocked(db.execute)
        .mockResolvedValueOnce(mockData as any)
        .mockResolvedValueOnce([] as any)
        .mockResolvedValueOnce([] as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.calculateAttributePerformance(periodStart, periodEnd);

      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete daily aggregation workflow', async () => {
      // Mock asset performance data
      const assetData = [
        {
          asset_type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          damage_severity: 'moderate',
          total_auctions: 10,
          total_bids: 50,
          avg_bids_per_auction: 5.0,
          avg_final_price: 1500000,
          avg_sell_through_rate: 0.8,
          avg_time_to_sell: 48,
        },
      ];

      // Mock attribute performance data
      const colorData = [
        {
          asset_type: 'vehicle',
          color: 'Black',
          total_auctions: 15,
          avg_price_premium: 40000,
          avg_bid_count: 5.5,
        },
      ];

      vi.mocked(db.execute)
        .mockResolvedValueOnce(assetData as any) // Asset performance
        .mockResolvedValueOnce(colorData as any) // Color
        .mockResolvedValueOnce([] as any) // Trim
        .mockResolvedValueOnce([] as any); // Storage

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      // Run both calculations
      await service.calculateAssetPerformance(periodStart, periodEnd);
      await service.calculateAttributePerformance(periodStart, periodEnd);

      expect(db.execute).toHaveBeenCalledTimes(4);
      expect(db.insert).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple asset types in single period', async () => {
      const mockData = [
        {
          asset_type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2020,
          damage_severity: 'moderate',
          total_auctions: 10,
          total_bids: 50,
          avg_bids_per_auction: 5.0,
          avg_final_price: 1500000,
          avg_sell_through_rate: 0.8,
          avg_time_to_sell: 48,
        },
        {
          asset_type: 'electronics',
          make: 'Samsung',
          model: 'Galaxy S21',
          year: 2021,
          damage_severity: 'minor',
          total_auctions: 8,
          total_bids: 40,
          avg_bids_per_auction: 5.0,
          avg_final_price: 400000,
          avg_sell_through_rate: 0.85,
          avg_time_to_sell: 24,
        },
        {
          asset_type: 'machinery',
          make: 'Caterpillar',
          model: 'Excavator',
          year: 2018,
          damage_severity: 'severe',
          total_auctions: 2,
          total_bids: 6,
          avg_bids_per_auction: 3.0,
          avg_final_price: 8000000,
          avg_sell_through_rate: 0.5,
          avg_time_to_sell: 120,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.calculateAssetPerformance(periodStart, periodEnd);

      expect(db.insert).toHaveBeenCalledTimes(3);
    });
  });
});
