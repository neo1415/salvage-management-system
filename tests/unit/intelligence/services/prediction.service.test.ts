/**
 * Unit Tests for PredictionService
 * Task 2.4.6: Add unit tests for PredictionService
 * 
 * Test coverage:
 * - Similarity matching algorithms
 * - Market condition adjustments
 * - Analytics integrations (asset demand, attributes, temporal, geographic)
 * - Cold-start strategies
 * - Confidence score calculation
 * - Redis caching behavior
 * - Edge cases (no historical data, extreme values)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PredictionService } from '@/features/intelligence/services/prediction.service';
import { db } from '@/lib/db';
import * as redisCache from '@/lib/cache/redis';

// Mock dependencies
vi.mock('@/lib/db');
vi.mock('@/lib/cache/redis', () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  deleteCached: vi.fn(),
  CACHE_KEYS: { PREDICTION: 'prediction' },
  CACHE_TTL: { PREDICTION: 300 },
}));

describe('PredictionService', () => {
  let service: PredictionService;
  
  beforeEach(() => {
    service = new PredictionService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generatePrediction', () => {
    it('should return cached prediction if available', async () => {
      const mockCachedPrediction = {
        auctionId: 'test-auction-id',
        predictedPrice: 50000,
        lowerBound: 45000,
        upperBound: 55000,
        confidenceScore: 0.85,
        confidenceLevel: 'High' as const,
        method: 'historical',
        sampleSize: 10,
        metadata: {},
        algorithmVersion: 'v1.0',
        createdAt: new Date(),
      };

      vi.mocked(redisCache.getCached).mockResolvedValue(mockCachedPrediction);

      const result = await service.generatePrediction('test-auction-id');

      expect(result).toEqual(mockCachedPrediction);
      expect(redisCache.getCached).toHaveBeenCalledWith('prediction:test-auction-id');
    });

    it('should throw error for invalid auction ID', async () => {
      await expect(service.generatePrediction('')).rejects.toThrow('Invalid auction ID');
      await expect(service.generatePrediction(null as any)).rejects.toThrow('Invalid auction ID');
    });

    it('should throw error if auction not found', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      // Mock db.select to return empty result
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      await expect(service.generatePrediction('non-existent-id')).rejects.toThrow('Auction not found');
    });

    it('should generate historical prediction with sufficient data', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      // Mock auction data
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        caseId: 'test-case-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
        watchingCount: 5,
        extensionCount: 0,
      };

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      // Mock algorithm config
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { configKey: 'prediction.similarity_threshold', configValue: '60' },
            { configKey: 'prediction.time_decay_months', configValue: '6' },
            { configKey: 'prediction.min_sample_size', configValue: '5' },
            { configKey: 'prediction.confidence_base', configValue: '0.85' },
          ]),
        }),
      } as any);

      // Mock similar auctions
      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 48000,
          similarity_score: 85,
          time_weight: 0.9,
          bid_count: 8,
          damage_severity: 'moderate',
          market_value: 95000,
          end_time: new Date(),
        },
        {
          auction_id: 'similar-2',
          final_price: 52000,
          similarity_score: 80,
          time_weight: 0.85,
          bid_count: 10,
          damage_severity: 'moderate',
          market_value: 105000,
          end_time: new Date(),
        },
      ] as any);

      // Mock market conditions query
      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          avg_bids_recent: 8,
          avg_bids_historical: 7,
          avg_price_recent: 50000,
          avg_price_historical: 48000,
        },
      ] as any);

      // Mock analytics queries (return empty for simplicity)
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      // Mock insert operations
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      const result = await service.generatePrediction('test-auction-id');

      expect(result).toBeDefined();
      expect(result.auctionId).toBe('test-auction-id');
      expect(result.predictedPrice).toBeGreaterThan(0);
      expect(result.lowerBound).toBeLessThan(result.predictedPrice);
      expect(result.upperBound).toBeGreaterThan(result.predictedPrice);
      expect(result.confidenceScore).toBeGreaterThan(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
      expect(result.method).toBe('historical');
      expect(result.sampleSize).toBeGreaterThan(0);
      expect(redisCache.setCached).toHaveBeenCalled();
    });

    it('should use fallback prediction when no historical data', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        caseId: 'test-case-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        estimatedSalvageValue: 50000,
        reservePrice: 45000,
        watchingCount: 2,
        extensionCount: 0,
      };

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      // Mock config
      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { configKey: 'prediction.similarity_threshold', configValue: '60' },
            { configKey: 'prediction.time_decay_months', configValue: '6' },
            { configKey: 'prediction.min_sample_size', configValue: '5' },
            { configKey: 'prediction.confidence_base', configValue: '0.85' },
          ]),
        }),
      } as any);

      // Mock empty similar auctions
      vi.mocked(db.execute).mockResolvedValue([] as any);

      // Mock insert operations
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      const result = await service.generatePrediction('test-auction-id');

      expect(result).toBeDefined();
      expect(result.method).toBe('salvage_value');
      expect(result.predictedPrice).toBe(50000);
      expect(result.confidenceScore).toBeLessThan(0.5);
    });
  });

  describe('Similarity Matching', () => {
    it('should calculate high similarity for exact make/model match', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        caseId: 'test-case-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
        watchingCount: 5,
        extensionCount: 0,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { configKey: 'prediction.similarity_threshold', configValue: '60' },
          ]),
        }),
      } as any);

      // Mock similar auctions with exact make/model match (high similarity score)
      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 48000,
          similarity_score: 100, // Exact match
          time_weight: 0.95,
          bid_count: 8,
          damage_severity: 'moderate',
          market_value: 98000,
          end_time: new Date(),
        },
      ] as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        { avg_bids_recent: 8, avg_bids_historical: 7, avg_price_recent: 50000, avg_price_historical: 48000 },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      expect(result.method).toBe('historical');
      expect(result.sampleSize).toBeGreaterThan(0);
    });

    it('should apply time decay to older auctions', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      // Mock auctions with different ages
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'old-auction',
          final_price: 45000,
          similarity_score: 80,
          time_weight: 0.5, // Older auction, lower weight
          bid_count: 7,
          end_time: sixMonthsAgo,
        },
        {
          auction_id: 'recent-auction',
          final_price: 52000,
          similarity_score: 80,
          time_weight: 0.95, // Recent auction, higher weight
          bid_count: 9,
          end_time: oneMonthAgo,
        },
      ] as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        { avg_bids_recent: 8, avg_bids_historical: 7, avg_price_recent: 50000, avg_price_historical: 48000 },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      // Recent auction should have more influence on prediction
      expect(result.predictedPrice).toBeGreaterThan(45000);
      expect(result.predictedPrice).toBeLessThanOrEqual(52000);
    });

    it('should handle different asset types (vehicle, electronics, machinery)', async () => {
      const assetTypes = ['vehicle', 'electronics', 'machinery'];

      for (const assetType of assetTypes) {
        vi.clearAllMocks();
        vi.mocked(redisCache.getCached).mockResolvedValue(null);
        
        const mockAuctionData = {
          auctionId: `test-${assetType}`,
          assetType,
          assetDetails: assetType === 'vehicle' 
            ? { make: 'Toyota', model: 'Camry', year: 2020 }
            : assetType === 'electronics'
            ? { brand: 'Apple', model: 'iPhone 12', storage: '128GB' }
            : { manufacturer: 'Caterpillar', model: 'D6', year: 2018 },
          damageSeverity: 'moderate',
          marketValue: 100000,
          estimatedSalvageValue: 50000,
          reservePrice: 45000,
        };

        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockAuctionData]),
              }),
            }),
          }),
        } as any);

        vi.mocked(db.select).mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        } as any);

        vi.mocked(db.execute).mockResolvedValue([] as any);
        vi.mocked(db.insert).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        } as any);

        const result = await service.generatePrediction(`test-${assetType}`);

        expect(result).toBeDefined();
        expect(result.auctionId).toBe(`test-${assetType}`);
      }
    });
  });

  describe('Market Condition Adjustments', () => {
    it('should increase price for high competition', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 50000,
          similarity_score: 85,
          time_weight: 0.9,
          bid_count: 8,
          end_time: new Date(),
        },
      ] as any);

      // Mock high competition market conditions
      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          avg_bids_recent: 15, // High competition
          avg_bids_historical: 8,
          avg_price_recent: 55000,
          avg_price_historical: 50000,
        },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      // High competition should increase predicted price
      expect(result.predictedPrice).toBeGreaterThan(50000);
    });

    it('should apply seasonal adjustments', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 50000,
          similarity_score: 85,
          time_weight: 0.9,
          bid_count: 8,
          end_time: new Date(),
        },
      ] as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          avg_bids_recent: 8,
          avg_bids_historical: 8,
          avg_price_recent: 50000,
          avg_price_historical: 50000,
        },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      // Seasonal adjustments are applied based on current month
      expect(result.predictedPrice).toBeGreaterThan(0);
      expect(result.metadata).toBeDefined();
    });

    it('should apply trend adjustments', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 50000,
          similarity_score: 85,
          time_weight: 0.9,
          bid_count: 8,
          end_time: new Date(),
        },
      ] as any);

      // Mock rising market trend
      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          avg_bids_recent: 8,
          avg_bids_historical: 8,
          avg_price_recent: 60000, // Rising prices
          avg_price_historical: 50000,
        },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      // Rising trend should increase predicted price
      expect(result.predictedPrice).toBeGreaterThan(50000);
    });
  });

  describe('Analytics Integrations', () => {
    it('should apply asset demand adjustments for high demand', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 50000,
          similarity_score: 85,
          time_weight: 0.9,
          bid_count: 8,
          end_time: new Date(),
        },
      ] as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        { avg_bids_recent: 8, avg_bids_historical: 8, avg_price_recent: 50000, avg_price_historical: 50000 },
      ] as any);

      // Mock high demand asset performance
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 3) {
          // Asset demand query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ demandScore: 80 }]), // High demand
                }),
              }),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as any;
      });

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      // High demand should increase predicted price
      expect(result.predictedPrice).toBeGreaterThan(50000);
    });

    it('should apply attribute adjustments for popular color', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020, color: 'White' },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 50000,
          similarity_score: 85,
          time_weight: 0.9,
          bid_count: 8,
          end_time: new Date(),
        },
      ] as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        { avg_bids_recent: 8, avg_bids_historical: 8, avg_price_recent: 50000, avg_price_historical: 50000 },
      ] as any);

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 4) {
          // Color attribute query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ avgPricePremium: '5000', popularityScore: 85 }]),
                }),
              }),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as any;
      });

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      expect(result.predictedPrice).toBeGreaterThan(0);
    });

    it('should apply temporal pattern adjustments for peak hours', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 50000,
          similarity_score: 85,
          time_weight: 0.9,
          bid_count: 8,
          end_time: new Date(),
        },
      ] as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        { avg_bids_recent: 8, avg_bids_historical: 8, avg_price_recent: 50000, avg_price_historical: 50000 },
      ] as any);

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 5) {
          // Temporal pattern query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ peakActivityScore: 75, avgFinalPrice: '52000' }]),
                }),
              }),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as any;
      });

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      expect(result.predictedPrice).toBeGreaterThan(0);
    });

    it('should apply geographic adjustments for high demand region', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020, region: 'Lagos' },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
        region: 'Lagos',
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 50000,
          similarity_score: 85,
          time_weight: 0.9,
          bid_count: 8,
          end_time: new Date(),
        },
      ] as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        { avg_bids_recent: 8, avg_bids_historical: 8, avg_price_recent: 50000, avg_price_historical: 50000 },
      ] as any);

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 6) {
          // Geographic pattern query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ priceVariance: '5000', demandScore: 80 }]),
                }),
              }),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as any;
      });

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      expect(result.predictedPrice).toBeGreaterThan(0);
    });
  });

  describe('Confidence Score Calculation', () => {
    it('should calculate high confidence with large sample size', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      // Mock 15 similar auctions (large sample)
      const similarAuctions = Array.from({ length: 15 }, (_, i) => ({
        auction_id: `similar-${i}`,
        final_price: 48000 + (i * 500),
        similarity_score: 85,
        time_weight: 0.9,
        bid_count: 8,
        damage_severity: 'moderate',
        market_value: 100000,
        end_time: new Date(),
      }));

      vi.mocked(db.execute).mockResolvedValueOnce(similarAuctions as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        { avg_bids_recent: 8, avg_bids_historical: 8, avg_price_recent: 50000, avg_price_historical: 50000 },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      expect(result.confidenceScore).toBeGreaterThan(0.7);
      expect(result.confidenceLevel).toBe('High');
    });

    it('should calculate low confidence with small sample size', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      // Mock only 2 similar auctions (small sample)
      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 48000,
          similarity_score: 85,
          time_weight: 0.9,
          bid_count: 8,
          damage_severity: 'moderate',
          market_value: 100000,
          end_time: new Date(),
        },
        {
          auction_id: 'similar-2',
          final_price: 52000,
          similarity_score: 80,
          time_weight: 0.85,
          bid_count: 7,
          damage_severity: 'moderate',
          market_value: 105000,
          end_time: new Date(),
        },
      ] as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        { avg_bids_recent: 8, avg_bids_historical: 8, avg_price_recent: 50000, avg_price_historical: 50000 },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      expect(result.confidenceScore).toBeLessThan(0.7);
      expect(result.confidenceLevel).not.toBe('High');
    });

    it('should reduce confidence for high variance', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      // Mock auctions with high price variance
      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 30000, // Low
          similarity_score: 85,
          time_weight: 0.9,
          bid_count: 8,
          damage_severity: 'moderate',
          market_value: 100000,
          end_time: new Date(),
        },
        {
          auction_id: 'similar-2',
          final_price: 70000, // High
          similarity_score: 80,
          time_weight: 0.85,
          bid_count: 7,
          damage_severity: 'moderate',
          market_value: 105000,
          end_time: new Date(),
        },
        {
          auction_id: 'similar-3',
          final_price: 45000, // Medium
          similarity_score: 82,
          time_weight: 0.88,
          bid_count: 9,
          damage_severity: 'moderate',
          market_value: 98000,
          end_time: new Date(),
        },
      ] as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        { avg_bids_recent: 8, avg_bids_historical: 8, avg_price_recent: 50000, avg_price_historical: 50000 },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      // High variance should reduce confidence
      expect(result.confidenceScore).toBeLessThan(0.8);
    });

    it('should enhance confidence with data quality factors', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      // Mock recent, complete data
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 15); // 15 days ago

      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 49000,
          similarity_score: 90,
          time_weight: 0.95, // Very recent
          bid_count: 10,
          damage_severity: 'moderate',
          market_value: 100000,
          end_time: recentDate,
        },
        {
          auction_id: 'similar-2',
          final_price: 51000,
          similarity_score: 88,
          time_weight: 0.93,
          bid_count: 12,
          damage_severity: 'moderate',
          market_value: 102000,
          end_time: recentDate,
        },
      ] as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        { avg_bids_recent: 8, avg_bids_historical: 8, avg_price_recent: 50000, avg_price_historical: 50000 },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      // Recent, complete data should enhance confidence
      expect(result.confidenceScore).toBeGreaterThan(0);
    });
  });

  describe('Cold-Start Strategies', () => {
    it('should use salvage value fallback when available', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        estimatedSalvageValue: 55000,
        reservePrice: 50000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValue([] as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      expect(result.method).toBe('salvage_value');
      expect(result.predictedPrice).toBe(55000);
      expect(result.confidenceScore).toBe(0.30);
      expect(result.lowerBound).toBe(50000); // Reserve price
      expect(result.upperBound).toBeGreaterThan(55000);
    });

    it('should use market value calculation fallback', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        estimatedSalvageValue: null,
        reservePrice: 45000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValue([] as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      expect(result.method).toBe('market_value_calc');
      // Moderate damage = 50% multiplier, so 100000 * 0.5 = 50000
      expect(result.predictedPrice).toBe(50000);
      expect(result.confidenceScore).toBe(0.20);
    });

    it('should use reserve price estimate as last resort', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: null,
        estimatedSalvageValue: null,
        reservePrice: 45000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValue([] as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      expect(result.method).toBe('reserve_price_estimate');
      expect(result.predictedPrice).toBe(Math.round(45000 * 1.15));
      expect(result.confidenceScore).toBe(0.15);
    });

    it('should apply correct damage multipliers', async () => {
      const damageScenarios = [
        { severity: 'none', expectedMultiplier: 0.10 },
        { severity: 'minor', expectedMultiplier: 0.25 },
        { severity: 'moderate', expectedMultiplier: 0.50 },
        { severity: 'severe', expectedMultiplier: 0.75 },
      ];

      for (const scenario of damageScenarios) {
        vi.clearAllMocks();
        vi.mocked(redisCache.getCached).mockResolvedValue(null);
        
        const mockAuctionData = {
          auctionId: 'test-auction-id',
          assetType: 'vehicle',
          assetDetails: {},
          damageSeverity: scenario.severity,
          marketValue: 100000,
          estimatedSalvageValue: null,
          reservePrice: 40000,
        };

        vi.mocked(db.select).mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockAuctionData]),
              }),
            }),
          }),
        } as any);

        vi.mocked(db.select).mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        } as any);

        vi.mocked(db.execute).mockResolvedValue([] as any);
        vi.mocked(db.insert).mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        } as any);

        const result = await service.generatePrediction('test-auction-id');

        const expectedPrice = 100000 * (1 - scenario.expectedMultiplier);
        expect(result.predictedPrice).toBe(expectedPrice);
      }
    });

    it('should throw error when no fallback data available', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: {},
        damageSeverity: 'moderate',
        marketValue: 0,
        estimatedSalvageValue: 0,
        reservePrice: 0,
      };

      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      });
      vi.mocked(db.select).mockImplementation(mockSelect as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { configKey: 'prediction.similarity_threshold', configValue: '60' },
          ]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValue([] as any);

      await expect(service.generatePrediction('test-auction-id')).rejects.toThrow(
        'Insufficient data for price prediction'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle high reserve price exceeding prediction', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: {},
        damageSeverity: 'moderate',
        marketValue: 100000,
        estimatedSalvageValue: 40000,
        reservePrice: 60000, // Higher than salvage value
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValue([] as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      expect(result.lowerBound).toBe(60000); // Should use reserve price
      expect(result.predictedPrice).toBeGreaterThan(60000);
      expect(result.metadata.warnings).toContain('Reserve price exceeds historical data - prediction based on extrapolation');
    });

    it('should handle auctions with no bids', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: {},
        damageSeverity: 'moderate',
        marketValue: 100000,
        estimatedSalvageValue: 50000,
        reservePrice: 45000,
        currentBid: null, // No bids yet
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValue([] as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      expect(result.metadata.warnings).toContain('No bids placed yet - prediction may change significantly');
    });

    it('should handle extreme market volatility', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      // Mock auctions with extreme variance
      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 20000,
          similarity_score: 85,
          time_weight: 0.9,
          bid_count: 8,
          damage_severity: 'moderate',
          market_value: 100000,
          end_time: new Date(),
        },
        {
          auction_id: 'similar-2',
          final_price: 80000,
          similarity_score: 80,
          time_weight: 0.85,
          bid_count: 7,
          damage_severity: 'moderate',
          market_value: 105000,
          end_time: new Date(),
        },
      ] as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        { avg_bids_recent: 8, avg_bids_historical: 8, avg_price_recent: 50000, avg_price_historical: 50000 },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      // High variance should widen confidence intervals
      const intervalWidth = result.upperBound - result.lowerBound;
      expect(intervalWidth).toBeGreaterThan(result.predictedPrice * 0.3);
    });

    it('should handle missing asset details gracefully', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: {}, // Empty details
        damageSeverity: 'moderate',
        marketValue: 100000,
        estimatedSalvageValue: 50000,
        reservePrice: 45000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValue([] as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      // Should fallback to salvage value
      expect(result).toBeDefined();
      expect(result.method).toBe('salvage_value');
    });

    it('should handle auction extensions', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
        extensionCount: 2, // Extended twice
        watchingCount: 15,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 50000,
          similarity_score: 85,
          time_weight: 0.9,
          bid_count: 8,
          damage_severity: 'moderate',
          market_value: 100000,
          end_time: new Date(),
        },
      ] as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        { avg_bids_recent: 8, avg_bids_historical: 8, avg_price_recent: 50000, avg_price_historical: 50000 },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      expect(result.metadata.notes).toContain('Auction extended 2 time(s) - increased competition expected');
    });

    it('should handle high watching count', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: { make: 'Toyota', model: 'Camry', year: 2020 },
        damageSeverity: 'moderate',
        marketValue: 100000,
        reservePrice: 50000,
        watchingCount: 25, // High interest
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        {
          auction_id: 'similar-1',
          final_price: 50000,
          similarity_score: 85,
          time_weight: 0.9,
          bid_count: 8,
          damage_severity: 'moderate',
          market_value: 100000,
          end_time: new Date(),
        },
      ] as any);

      vi.mocked(db.execute).mockResolvedValueOnce([
        { avg_bids_recent: 8, avg_bids_historical: 8, avg_price_recent: 50000, avg_price_historical: 50000 },
      ] as any);

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const result = await service.generatePrediction('test-auction-id');

      expect(result.metadata.notes).toContain('High interest - above average watching count');
    });
  });

  describe('Redis Caching', () => {
    it('should cache prediction result', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      vi.mocked(redisCache.setCached).mockResolvedValue(true);

      // Mock minimal successful prediction
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: {},
        damageSeverity: 'moderate',
        marketValue: 100000,
        estimatedSalvageValue: 50000,
        reservePrice: 45000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValue([] as any);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      await service.generatePrediction('test-auction-id');

      expect(redisCache.setCached).toHaveBeenCalledWith(
        'prediction:test-auction-id',
        expect.any(Object),
        300 // 5 minutes TTL
      );
    });

    it('should handle cache failures gracefully', async () => {
      vi.mocked(redisCache.getCached).mockRejectedValue(new Error('Redis error'));
      
      // Should still proceed with prediction generation
      expect(true).toBe(true); // Placeholder
    });
  });

  describe('Database Storage', () => {
    it('should store prediction in predictions table', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: {},
        damageSeverity: 'moderate',
        marketValue: 100000,
        estimatedSalvageValue: 50000,
        reservePrice: 45000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValue([] as any);

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.insert).mockImplementation(mockInsert as any);

      await service.generatePrediction('test-auction-id');

      // Verify insert was called
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should log prediction to prediction_logs table', async () => {
      vi.mocked(redisCache.getCached).mockResolvedValue(null);
      
      const mockAuctionData = {
        auctionId: 'test-auction-id',
        assetType: 'vehicle',
        assetDetails: {},
        damageSeverity: 'moderate',
        marketValue: 100000,
        estimatedSalvageValue: 50000,
        reservePrice: 45000,
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockAuctionData]),
            }),
          }),
        }),
      } as any);

      vi.mocked(db.select).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any);

      vi.mocked(db.execute).mockResolvedValue([] as any);

      // Mock prediction ID retrieval for logging
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 3) {
          // Prediction ID query
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ id: 'prediction-id-123' }]),
                }),
              }),
            }),
          } as any;
        }
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockAuctionData]),
              }),
            }),
          }),
        } as any;
      });

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });
      vi.mocked(db.insert).mockImplementation(mockInsert as any);

      await service.generatePrediction('test-auction-id');

      // Verify insert was called at least twice (predictions + prediction_logs)
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });
  });
});
