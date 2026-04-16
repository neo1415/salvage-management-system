/**
 * Unit Tests for FeatureEngineeringService
 * Task 12.1.5: Write unit tests for FeatureEngineeringService (>80% coverage)
 * 
 * Test coverage:
 * - Feature vector computation for auctions
 * - Feature vector computation for vendors
 * - Cyclical encoding for temporal features
 * - Normalization for numerical features
 * - One-hot encoding for categorical features
 * - Missing value imputation strategies
 * - Error handling
 * - Edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FeatureEngineeringService } from '@/features/intelligence/services/feature-engineering.service';
import { db } from '@/lib/db';

// Mock dependencies
vi.mock('@/lib/db');

describe('FeatureEngineeringService', () => {
  let service: FeatureEngineeringService;

  beforeEach(() => {
    service = new FeatureEngineeringService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('normalizeFeatures', () => {
    it('should normalize features to 0-1 range', () => {
      const features = {
        price: 1500000,
        year: 2020,
        mileage: 50000,
      };

      const ranges = {
        price: { min: 1000000, max: 2000000 },
        year: { min: 2015, max: 2023 },
        mileage: { min: 0, max: 100000 },
      };

      const result = service.normalizeFeatures(features, ranges);

      expect(result.price).toBe(0.5);
      expect(result.year).toBeCloseTo(0.625, 3);
      expect(result.mileage).toBe(0.5);
    });

    it('should handle features at minimum value', () => {
      const features = { value: 100 };
      const ranges = { value: { min: 100, max: 500 } };

      const result = service.normalizeFeatures(features, ranges);

      expect(result.value).toBe(0);
    });

    it('should handle features at maximum value', () => {
      const features = { value: 500 };
      const ranges = { value: { min: 100, max: 500 } };

      const result = service.normalizeFeatures(features, ranges);

      expect(result.value).toBe(1);
    });

    it('should handle zero range (min equals max)', () => {
      const features = { value: 100 };
      const ranges = { value: { min: 100, max: 100 } };

      const result = service.normalizeFeatures(features, ranges);

      expect(result.value).toBe(0);
    });

    it('should pass through features without ranges', () => {
      const features = { known: 50, unknown: 75 };
      const ranges = { known: { min: 0, max: 100 } };

      const result = service.normalizeFeatures(features, ranges);

      expect(result.known).toBe(0.5);
      expect(result.unknown).toBe(75);
    });

    it('should handle negative values', () => {
      const features = { temperature: -10 };
      const ranges = { temperature: { min: -20, max: 40 } };

      const result = service.normalizeFeatures(features, ranges);

      expect(result.temperature).toBeCloseTo(0.1667, 3);
    });

    it('should handle multiple features', () => {
      const features = {
        price: 1500000,
        year: 2020,
        mileage: 50000,
        rating: 4.5,
      };

      const ranges = {
        price: { min: 1000000, max: 2000000 },
        year: { min: 2015, max: 2023 },
        mileage: { min: 0, max: 100000 },
        rating: { min: 1, max: 5 },
      };

      const result = service.normalizeFeatures(features, ranges);

      expect(Object.keys(result)).toHaveLength(4);
      Object.values(result).forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('oneHotEncode', () => {
    it('should one-hot encode categorical features', () => {
      const result = service.oneHotEncode('color', 'red', ['red', 'blue', 'green']);

      expect(result).toEqual({
        color_red: 1,
        color_blue: 0,
        color_green: 0,
      });
    });

    it('should handle different selected values', () => {
      const result = service.oneHotEncode('assetType', 'electronics', ['vehicle', 'electronics', 'machinery']);

      expect(result).toEqual({
        assetType_vehicle: 0,
        assetType_electronics: 1,
        assetType_machinery: 0,
      });
    });

    it('should handle single possible value', () => {
      const result = service.oneHotEncode('status', 'active', ['active']);

      expect(result).toEqual({
        status_active: 1,
      });
    });

    it('should handle value not in possible values', () => {
      const result = service.oneHotEncode('color', 'yellow', ['red', 'blue', 'green']);

      expect(result).toEqual({
        color_red: 0,
        color_blue: 0,
        color_green: 0,
      });
    });

    it('should handle empty possible values array', () => {
      const result = service.oneHotEncode('feature', 'value', []);

      expect(result).toEqual({});
    });

    it('should handle special characters in values', () => {
      const result = service.oneHotEncode('trim', 'XLE Premium', ['LE', 'XLE Premium', 'Limited']);

      expect(result).toEqual({
        'trim_LE': 0,
        'trim_XLE Premium': 1,
        'trim_Limited': 0,
      });
    });

    it('should be case-sensitive', () => {
      const result = service.oneHotEncode('color', 'Red', ['red', 'Red', 'RED']);

      expect(result).toEqual({
        color_red: 0,
        color_Red: 1,
        color_RED: 0,
      });
    });
  });

  describe('imputeMissingValues', () => {
    it('should impute missing values with zero strategy', () => {
      const features = {
        price: 1000000,
        year: null,
        mileage: undefined,
        rating: NaN,
      };

      const result = service.imputeMissingValues(features, 'zero');

      expect(result.price).toBe(1000000);
      expect(result.year).toBe(0);
      expect(result.mileage).toBe(0);
      expect(result.rating).toBe(0);
    });

    it('should impute missing values with mean strategy', () => {
      const features = {
        price: null,
        year: 2020,
      };

      const historicalData = {
        price: [1000000, 1500000, 2000000],
        year: [2018, 2019, 2020, 2021],
      };

      const result = service.imputeMissingValues(features, 'mean', historicalData);

      expect(result.price).toBe(1500000);
      expect(result.year).toBe(2020);
    });

    it('should impute missing values with median strategy', () => {
      const features = {
        price: null,
        rating: undefined,
      };

      const historicalData = {
        price: [1000000, 1500000, 2000000, 2500000, 3000000],
        rating: [3, 4, 5, 5],
      };

      const result = service.imputeMissingValues(features, 'median', historicalData);

      expect(result.price).toBe(2000000); // Middle value
      expect(result.rating).toBe(4.5); // Average of two middle values
    });

    it('should impute missing values with mode strategy', () => {
      const features = {
        color: null,
        year: undefined,
      };

      const historicalData = {
        color: [1, 2, 2, 3, 2, 4], // 2 appears most frequently
        year: [2018, 2019, 2020, 2020, 2020, 2021], // 2020 appears most
      };

      const result = service.imputeMissingValues(features, 'mode', historicalData);

      expect(result.color).toBe(2);
      expect(result.year).toBe(2020);
    });

    it('should fallback to zero when historical data is missing', () => {
      const features = {
        price: null,
        year: undefined,
      };

      const result = service.imputeMissingValues(features, 'mean');

      expect(result.price).toBe(0);
      expect(result.year).toBe(0);
    });

    it('should not modify non-missing values', () => {
      const features = {
        price: 1500000,
        year: 2020,
        rating: 4.5,
      };

      const result = service.imputeMissingValues(features, 'zero');

      expect(result.price).toBe(1500000);
      expect(result.year).toBe(2020);
      expect(result.rating).toBe(4.5);
    });

    it('should handle empty historical data arrays', () => {
      const features = { value: null };
      const historicalData = { value: [] };

      const result = service.imputeMissingValues(features, 'mean', historicalData);

      // Empty array causes NaN in mean calculation, which gets imputed to 0
      expect(result.value).toBe(0);
    });

    it('should handle mixed missing and present values', () => {
      const features = {
        a: 100,
        b: null,
        c: 200,
        d: undefined,
        e: 300,
      };

      const result = service.imputeMissingValues(features, 'zero');

      expect(result.a).toBe(100);
      expect(result.b).toBe(0);
      expect(result.c).toBe(200);
      expect(result.d).toBe(0);
      expect(result.e).toBe(300);
    });
  });

  describe('computeAuctionFeatures', () => {
    it('should compute auction features with cyclical encoding', async () => {
      const auctionId = 'auction-123';
      const mockAuctionData = [
        {
          id: auctionId,
          current_bid: 1500000,
          watching_count: 10,
          end_time: new Date('2024-01-15T14:30:00Z'),
          asset_type: 'vehicle',
          asset_details: {
            make: 'Toyota',
            model: 'Camry',
            year: '2020',
          },
          damage_severity: 'moderate',
          market_value: '2000000',
          estimated_salvage_value: '1200000',
          damaged_parts: ['front bumper', 'hood', 'headlight'],
          bid_count: 5,
          avg_bid_amount: 1400000,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockAuctionData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeAuctionFeatures(auctionId);

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(db.insert).toHaveBeenCalledTimes(1);

      const insertCall = vi.mocked(db.insert).mock.results[0].value;
      const valuesCall = insertCall.values as any;
      expect(valuesCall).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'auction',
          entityId: auctionId,
          features: expect.objectContaining({
            assetType: 'vehicle',
            make: 'Toyota',
            model: 'Camry',
            year: 2020,
            damageSeverity: 'moderate',
            marketValue: 2000000,
            estimatedSalvageValue: 1200000,
            damagedPartsCount: 3,
          }),
          version: 'v1.0',
        })
      );
    });

    it('should compute cyclical temporal features correctly', async () => {
      const auctionId = 'auction-123';
      const testDate = new Date('2024-06-15T18:45:00Z'); // June 15, 6:45 PM

      const mockData = [
        {
          id: auctionId,
          end_time: testDate,
          asset_type: 'vehicle',
          asset_details: {},
          damage_severity: 'minor',
          market_value: '1000000',
          damaged_parts: [],
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeAuctionFeatures(auctionId);

      const insertCall = vi.mocked(db.insert).mock.results[0].value;
      const valuesCall = insertCall.values as any;
      const features = valuesCall.mock.calls[0][0].features;

      // Verify cyclical encoding exists
      expect(features).toHaveProperty('hourSin');
      expect(features).toHaveProperty('hourCos');
      expect(features).toHaveProperty('dayOfWeekSin');
      expect(features).toHaveProperty('dayOfWeekCos');
      expect(features).toHaveProperty('monthSin');
      expect(features).toHaveProperty('monthCos');

      // Verify values are in valid range [-1, 1]
      expect(features.hourSin).toBeGreaterThanOrEqual(-1);
      expect(features.hourSin).toBeLessThanOrEqual(1);
      expect(features.hourCos).toBeGreaterThanOrEqual(-1);
      expect(features.hourCos).toBeLessThanOrEqual(1);
    });

    it('should handle missing asset details', async () => {
      const auctionId = 'auction-123';
      const mockData = [
        {
          id: auctionId,
          end_time: new Date(),
          asset_type: 'vehicle',
          asset_details: null,
          damage_severity: 'moderate',
          market_value: '1500000',
          damaged_parts: null,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeAuctionFeatures(auctionId);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle auction not found', async () => {
      const auctionId = 'non-existent';

      vi.mocked(db.execute).mockResolvedValue([] as any);

      await service.computeAuctionFeatures(auctionId);

      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should handle zero damaged parts', async () => {
      const auctionId = 'auction-123';
      const mockData = [
        {
          id: auctionId,
          end_time: new Date(),
          asset_type: 'vehicle',
          asset_details: {},
          damage_severity: 'none',
          market_value: '2000000',
          damaged_parts: [],
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeAuctionFeatures(auctionId);

      const insertCall = vi.mocked(db.insert).mock.results[0].value;
      const valuesCall = insertCall.values as any;
      const features = valuesCall.mock.calls[0][0].features;

      expect(features.damagedPartsCount).toBe(0);
    });
  });

  describe('computeVendorFeatures', () => {
    it('should compute vendor features correctly', async () => {
      const vendorId = 'vendor-123';
      const mockVendorData = [
        {
          id: vendorId,
          rating: '4.5',
          total_bids: '50',
          avg_bid_amount: '1500000',
          win_rate: '0.3',
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockVendorData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeVendorFeatures(vendorId);

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(db.insert).toHaveBeenCalledTimes(1);

      const insertCall = vi.mocked(db.insert).mock.results[0].value;
      const valuesCall = insertCall.values as any;
      expect(valuesCall).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'vendor',
          entityId: vendorId,
          features: {
            vendorRating: 4.5,
            vendorWinRate: 0.3,
            vendorTotalBids: 50,
            vendorAvgBidAmount: 1500000,
          },
          version: 'v1.0',
        })
      );
    });

    it('should handle vendor with no bids', async () => {
      const vendorId = 'vendor-new';
      const mockData = [
        {
          id: vendorId,
          rating: '5.0',
          total_bids: '0',
          avg_bid_amount: null,
          win_rate: null,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeVendorFeatures(vendorId);

      const insertCall = vi.mocked(db.insert).mock.results[0].value;
      const valuesCall = insertCall.values as any;
      const features = valuesCall.mock.calls[0][0].features;

      expect(features.vendorTotalBids).toBe(0);
      expect(features.vendorAvgBidAmount).toBe(0);
      expect(features.vendorWinRate).toBe(0);
    });

    it('should handle vendor not found', async () => {
      const vendorId = 'non-existent';

      vi.mocked(db.execute).mockResolvedValue([] as any);

      await service.computeVendorFeatures(vendorId);

      expect(db.insert).not.toHaveBeenCalled();
    });

    it('should handle null rating', async () => {
      const vendorId = 'vendor-123';
      const mockData = [
        {
          id: vendorId,
          rating: null,
          total_bids: '10',
          avg_bid_amount: '1000000',
          win_rate: '0.2',
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeVendorFeatures(vendorId);

      const insertCall = vi.mocked(db.insert).mock.results[0].value;
      const valuesCall = insertCall.values as any;
      const features = valuesCall.mock.calls[0][0].features;

      expect(features.vendorRating).toBe(0);
    });

    it('should handle perfect win rate', async () => {
      const vendorId = 'vendor-pro';
      const mockData = [
        {
          id: vendorId,
          rating: '5.0',
          total_bids: '20',
          avg_bid_amount: '2000000',
          win_rate: '1.0',
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeVendorFeatures(vendorId);

      const insertCall = vi.mocked(db.insert).mock.results[0].value;
      const valuesCall = insertCall.values as any;
      const features = valuesCall.mock.calls[0][0].features;

      expect(features.vendorWinRate).toBe(1.0);
    });

    it('should handle very large bid amounts', async () => {
      const vendorId = 'vendor-whale';
      const mockData = [
        {
          id: vendorId,
          rating: '4.8',
          total_bids: '100',
          avg_bid_amount: '50000000',
          win_rate: '0.45',
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeVendorFeatures(vendorId);

      const insertCall = vi.mocked(db.insert).mock.results[0].value;
      const valuesCall = insertCall.values as any;
      const features = valuesCall.mock.calls[0][0].features;

      expect(features.vendorAvgBidAmount).toBe(50000000);
    });
  });

  describe('Cyclical Encoding', () => {
    it('should encode hour of day correctly', async () => {
      // Test that cyclical encoding produces values in valid range
      const testHours = [0, 6, 12, 18, 23];

      for (const hour of testHours) {
        const date = new Date(`2024-01-01T${hour.toString().padStart(2, '0')}:00:00Z`);
        const mockData = [
          {
            id: 'auction-test',
            end_time: date,
            asset_type: 'vehicle',
            asset_details: {},
            damage_severity: 'minor',
            market_value: '1000000',
            damaged_parts: [],
          },
        ];

        vi.clearAllMocks();
        vi.mocked(db.execute).mockResolvedValue(mockData as any);
        vi.mocked(db.insert).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        } as any);

        await service.computeAuctionFeatures('auction-test');

        const insertCall = vi.mocked(db.insert).mock.results[0].value;
        const valuesCall = insertCall.values as any;
        const features = valuesCall.mock.calls[0][0].features;

        // Verify cyclical encoding produces values in valid range [-1, 1]
        expect(features.hourSin).toBeGreaterThanOrEqual(-1);
        expect(features.hourSin).toBeLessThanOrEqual(1);
        expect(features.hourCos).toBeGreaterThanOrEqual(-1);
        expect(features.hourCos).toBeLessThanOrEqual(1);
        
        // Verify sin^2 + cos^2 = 1 (fundamental property of cyclical encoding)
        const sumOfSquares = features.hourSin ** 2 + features.hourCos ** 2;
        expect(sumOfSquares).toBeCloseTo(1, 5);
      }
    });

    it('should encode day of week correctly', async () => {
      const testDates = [
        new Date('2024-01-01T12:00:00Z'), // Monday
        new Date('2024-01-04T12:00:00Z'), // Thursday
        new Date('2024-01-07T12:00:00Z'), // Sunday
      ];

      for (const date of testDates) {
        const mockData = [
          {
            id: 'auction-test',
            end_time: date,
            asset_type: 'vehicle',
            asset_details: {},
            damage_severity: 'minor',
            market_value: '1000000',
            damaged_parts: [],
          },
        ];

        vi.clearAllMocks();
        vi.mocked(db.execute).mockResolvedValue(mockData as any);
        vi.mocked(db.insert).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        } as any);

        await service.computeAuctionFeatures('auction-test');

        const insertCall = vi.mocked(db.insert).mock.results[0].value;
        const valuesCall = insertCall.values as any;
        const features = valuesCall.mock.calls[0][0].features;

        expect(features.dayOfWeekSin).toBeGreaterThanOrEqual(-1);
        expect(features.dayOfWeekSin).toBeLessThanOrEqual(1);
        expect(features.dayOfWeekCos).toBeGreaterThanOrEqual(-1);
        expect(features.dayOfWeekCos).toBeLessThanOrEqual(1);
      }
    });

    it('should encode month correctly', async () => {
      const testMonths = [
        new Date('2024-01-15T12:00:00Z'), // January
        new Date('2024-04-15T12:00:00Z'), // April
        new Date('2024-07-15T12:00:00Z'), // July
        new Date('2024-10-15T12:00:00Z'), // October
      ];

      for (const date of testMonths) {
        const mockData = [
          {
            id: 'auction-test',
            end_time: date,
            asset_type: 'vehicle',
            asset_details: {},
            damage_severity: 'minor',
            market_value: '1000000',
            damaged_parts: [],
          },
        ];

        vi.clearAllMocks();
        vi.mocked(db.execute).mockResolvedValue(mockData as any);
        vi.mocked(db.insert).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        } as any);

        await service.computeAuctionFeatures('auction-test');

        const insertCall = vi.mocked(db.insert).mock.results[0].value;
        const valuesCall = insertCall.values as any;
        const features = valuesCall.mock.calls[0][0].features;

        expect(features.monthSin).toBeGreaterThanOrEqual(-1);
        expect(features.monthSin).toBeLessThanOrEqual(1);
        expect(features.monthCos).toBeGreaterThanOrEqual(-1);
        expect(features.monthCos).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in computeAuctionFeatures', async () => {
      vi.mocked(db.execute).mockRejectedValue(new Error('Database connection failed'));

      await expect(
        service.computeAuctionFeatures('auction-123')
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle database errors in computeVendorFeatures', async () => {
      vi.mocked(db.execute).mockRejectedValue(new Error('Query timeout'));

      await expect(
        service.computeVendorFeatures('vendor-123')
      ).rejects.toThrow('Query timeout');
    });

    it('should handle insert errors in computeAuctionFeatures', async () => {
      const mockData = [
        {
          id: 'auction-123',
          end_time: new Date(),
          asset_type: 'vehicle',
          asset_details: {},
          damage_severity: 'minor',
          market_value: '1000000',
          damaged_parts: [],
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('Constraint violation')),
      } as any);

      await expect(
        service.computeAuctionFeatures('auction-123')
      ).rejects.toThrow('Constraint violation');
    });

    it('should handle insert errors in computeVendorFeatures', async () => {
      const mockData = [
        {
          id: 'vendor-123',
          rating: '4.5',
          total_bids: '10',
          avg_bid_amount: '1000000',
          win_rate: '0.3',
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockRejectedValue(new Error('Duplicate key')),
      } as any);

      await expect(
        service.computeVendorFeatures('vendor-123')
      ).rejects.toThrow('Duplicate key');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large numerical values', () => {
      const features = {
        price: 999999999.99,
        value: 1000000000,
      };

      const ranges = {
        price: { min: 0, max: 1000000000 },
        value: { min: 0, max: 2000000000 },
      };

      const result = service.normalizeFeatures(features, ranges);

      expect(result.price).toBeCloseTo(0.99999999999, 5);
      expect(result.value).toBe(0.5);
    });

    it('should handle very small numerical values', () => {
      const features = {
        discount: 0.01,
        fee: 0.001,
      };

      const ranges = {
        discount: { min: 0, max: 1 },
        fee: { min: 0, max: 0.1 },
      };

      const result = service.normalizeFeatures(features, ranges);

      expect(result.discount).toBe(0.01);
      expect(result.fee).toBe(0.01);
    });

    it('should handle decimal precision in normalization', () => {
      const features = { value: 1234.5678 };
      const ranges = { value: { min: 1000, max: 2000 } };

      const result = service.normalizeFeatures(features, ranges);

      expect(result.value).toBeCloseTo(0.2345678, 6);
    });

    it('should handle empty features object', () => {
      const result = service.normalizeFeatures({}, {});

      expect(result).toEqual({});
    });

    it('should handle empty possible values in one-hot encoding', () => {
      const result = service.oneHotEncode('feature', 'value', []);

      expect(result).toEqual({});
    });

    it('should handle all missing values in imputation', () => {
      const features = {
        a: null,
        b: undefined,
        c: NaN,
      };

      const result = service.imputeMissingValues(features, 'zero');

      expect(result.a).toBe(0);
      expect(result.b).toBe(0);
      expect(result.c).toBe(0);
    });

    it('should handle single value in historical data for median', () => {
      const features = { value: null };
      const historicalData = { value: [100] };

      const result = service.imputeMissingValues(features, 'median', historicalData);

      expect(result.value).toBe(100);
    });

    it('should handle two values in historical data for median', () => {
      const features = { value: null };
      const historicalData = { value: [100, 200] };

      const result = service.imputeMissingValues(features, 'median', historicalData);

      expect(result.value).toBe(150);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete auction feature engineering workflow', async () => {
      const auctionId = 'auction-complete';
      const mockData = [
        {
          id: auctionId,
          current_bid: 1500000,
          watching_count: 15,
          end_time: new Date('2024-06-15T14:30:00Z'),
          asset_type: 'vehicle',
          asset_details: {
            make: 'Toyota',
            model: 'Land Cruiser',
            year: '2021',
            color: 'White',
            trim: 'VXR',
          },
          damage_severity: 'moderate',
          market_value: '8000000',
          estimated_salvage_value: '4000000',
          damaged_parts: ['front bumper', 'hood', 'headlight', 'radiator'],
          bid_count: 12,
          avg_bid_amount: 3500000,
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeAuctionFeatures(auctionId);

      expect(db.execute).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();

      const insertCall = vi.mocked(db.insert).mock.results[0].value;
      const valuesCall = insertCall.values as any;
      const savedData = valuesCall.mock.calls[0][0];

      expect(savedData.entityType).toBe('auction');
      expect(savedData.entityId).toBe(auctionId);
      expect(savedData.version).toBe('v1.0');
      expect(savedData.features).toMatchObject({
        assetType: 'vehicle',
        make: 'Toyota',
        model: 'Land Cruiser',
        year: 2021,
        damageSeverity: 'moderate',
        marketValue: 8000000,
        estimatedSalvageValue: 4000000,
        damagedPartsCount: 4,
      });
      expect(savedData.features).toHaveProperty('hourSin');
      expect(savedData.features).toHaveProperty('hourCos');
      expect(savedData.features).toHaveProperty('dayOfWeekSin');
      expect(savedData.features).toHaveProperty('dayOfWeekCos');
      expect(savedData.features).toHaveProperty('monthSin');
      expect(savedData.features).toHaveProperty('monthCos');
    });

    it('should handle complete vendor feature engineering workflow', async () => {
      const vendorId = 'vendor-complete';
      const mockData = [
        {
          id: vendorId,
          rating: '4.7',
          total_bids: '75',
          avg_bid_amount: '2500000',
          win_rate: '0.35',
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeVendorFeatures(vendorId);

      expect(db.execute).toHaveBeenCalled();
      expect(db.insert).toHaveBeenCalled();

      const insertCall = vi.mocked(db.insert).mock.results[0].value;
      const valuesCall = insertCall.values as any;
      const savedData = valuesCall.mock.calls[0][0];

      expect(savedData.entityType).toBe('vendor');
      expect(savedData.entityId).toBe(vendorId);
      expect(savedData.version).toBe('v1.0');
      expect(savedData.features).toEqual({
        vendorRating: 4.7,
        vendorWinRate: 0.35,
        vendorTotalBids: 75,
        vendorAvgBidAmount: 2500000,
      });
    });

    it('should handle normalization with imputation workflow', () => {
      const features = {
        price: 1500000,
        year: null,
        mileage: 50000,
        rating: undefined,
      };

      const historicalData = {
        year: [2018, 2019, 2020, 2021],
        rating: [4.0, 4.5, 5.0],
      };

      // First impute
      const imputed = service.imputeMissingValues(features, 'mean', historicalData);

      // Then normalize
      const ranges = {
        price: { min: 1000000, max: 2000000 },
        year: { min: 2015, max: 2023 },
        mileage: { min: 0, max: 100000 },
        rating: { min: 1, max: 5 },
      };

      const normalized = service.normalizeFeatures(imputed, ranges);

      expect(normalized.price).toBe(0.5);
      expect(normalized.year).toBeCloseTo(0.5625, 3); // (2019.5 - 2015) / 8
      expect(normalized.mileage).toBe(0.5);
      // Mean of [4.0, 4.5, 5.0] = 4.5, normalized: (4.5 - 1) / 4 = 0.875
      expect(normalized.rating).toBeCloseTo(0.875, 3);
    });

    it('should handle one-hot encoding with normalization', () => {
      const categoricalFeatures = service.oneHotEncode(
        'assetType',
        'vehicle',
        ['vehicle', 'electronics', 'machinery']
      );

      const numericalFeatures = {
        price: 1500000,
        year: 2020,
      };

      const ranges = {
        price: { min: 1000000, max: 2000000 },
        year: { min: 2015, max: 2023 },
      };

      const normalizedNumerical = service.normalizeFeatures(numericalFeatures, ranges);

      const combinedFeatures = {
        ...categoricalFeatures,
        ...normalizedNumerical,
      };

      expect(combinedFeatures).toMatchObject({
        assetType_vehicle: 1,
        assetType_electronics: 0,
        assetType_machinery: 0,
        price: 0.5,
        year: 0.625,
      });
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle electronics asset with storage attribute', async () => {
      const auctionId = 'auction-electronics';
      const mockData = [
        {
          id: auctionId,
          end_time: new Date('2024-03-20T10:00:00Z'),
          asset_type: 'electronics',
          asset_details: {
            make: 'Apple',
            model: 'iPhone 13 Pro',
            year: '2021',
            storage: '256GB',
            color: 'Graphite',
          },
          damage_severity: 'minor',
          market_value: '800000',
          estimated_salvage_value: '600000',
          damaged_parts: ['screen'],
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeAuctionFeatures(auctionId);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle machinery asset with different attributes', async () => {
      const auctionId = 'auction-machinery';
      const mockData = [
        {
          id: auctionId,
          end_time: new Date('2024-05-10T16:00:00Z'),
          asset_type: 'machinery',
          asset_details: {
            make: 'Caterpillar',
            model: '320D',
            year: '2018',
            hours: '5000',
          },
          damage_severity: 'severe',
          market_value: '50000000',
          estimated_salvage_value: '15000000',
          damaged_parts: ['hydraulic pump', 'boom', 'tracks'],
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeAuctionFeatures(auctionId);

      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle new vendor with minimal history', async () => {
      const vendorId = 'vendor-new';
      const mockData = [
        {
          id: vendorId,
          rating: '5.0',
          total_bids: '2',
          avg_bid_amount: '1200000',
          win_rate: '0.5',
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeVendorFeatures(vendorId);

      const insertCall = vi.mocked(db.insert).mock.results[0].value;
      const valuesCall = insertCall.values as any;
      const features = valuesCall.mock.calls[0][0].features;

      expect(features.vendorTotalBids).toBe(2);
      expect(features.vendorWinRate).toBe(0.5);
    });

    it('should handle experienced vendor with high activity', async () => {
      const vendorId = 'vendor-pro';
      const mockData = [
        {
          id: vendorId,
          rating: '4.9',
          total_bids: '500',
          avg_bid_amount: '5000000',
          win_rate: '0.42',
        },
      ];

      vi.mocked(db.execute).mockResolvedValue(mockData as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.computeVendorFeatures(vendorId);

      const insertCall = vi.mocked(db.insert).mock.results[0].value;
      const valuesCall = insertCall.values as any;
      const features = valuesCall.mock.calls[0][0].features;

      expect(features.vendorTotalBids).toBe(500);
      expect(features.vendorAvgBidAmount).toBe(5000000);
      expect(features.vendorWinRate).toBe(0.42);
    });
  });
});
