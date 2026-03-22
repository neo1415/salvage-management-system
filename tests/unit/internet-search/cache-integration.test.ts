/**
 * Unit tests for Cache Integration Service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { cacheIntegrationService } from '@/features/internet-search/services/cache-integration.service';
import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';
import type { MarketPriceResult, PartPriceResult } from '@/features/internet-search/services/internet-search.service';

// Mock Redis client
vi.mock('@/lib/redis/client', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn()
  }
}));

import { redis } from '@/lib/redis/client';

describe('CacheIntegrationService', () => {
  const mockRedis = redis as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Market Price Caching', () => {
    const testItem: ItemIdentifier = {
      type: 'vehicle',
      make: 'Toyota',
      model: 'Camry',
      year: 2021,
      condition: 'Foreign Used (Tokunbo)'
    };

    const testResult: MarketPriceResult = {
      priceData: {
        prices: [
          { price: 18800000, currency: 'NGN', source: 'test', confidence: 85 }
        ],
        averagePrice: 18800000,
        medianPrice: 18800000,
        priceRange: { min: 18800000, max: 18800000 },
        confidence: 85,
        currency: 'NGN',
        extractedAt: new Date()
      },
      query: 'Toyota Camry 2021 Foreign Used price Nigeria',
      resultsProcessed: 5,
      executionTime: 1500,
      dataSource: 'internet_search',
      success: true
    };

    it('should cache market price result', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cacheIntegrationService.setCachedMarketPrice(testItem, testResult);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('internet_search:market:'),
        expect.objectContaining({
          query: testResult.query,
          item: testItem,
          priceData: testResult.priceData
        }),
        { ex: 24 * 60 * 60 }
      );
    });

    it('should retrieve cached market price result', async () => {
      const cachedResult = {
        id: 'test-id',
        query: testResult.query,
        item: testItem,
        priceData: testResult.priceData,
        resultsProcessed: testResult.resultsProcessed,
        executionTime: testResult.executionTime,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        hitCount: 0
      };

      mockRedis.get.mockResolvedValue(cachedResult);
      mockRedis.set.mockResolvedValue('OK');

      const result = await cacheIntegrationService.getCachedMarketPrice(testItem);

      expect(result).toEqual(expect.objectContaining({
        query: testResult.query,
        item: testItem,
        priceData: testResult.priceData
      }));
      expect(mockRedis.get).toHaveBeenCalledWith(
        expect.stringContaining('internet_search:market:')
      );
    });

    it('should return null for cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheIntegrationService.getCachedMarketPrice(testItem);

      expect(result).toBeNull();
    });

    it('should return null for expired cache entry', async () => {
      const expiredResult = {
        id: 'test-id',
        query: testResult.query,
        item: testItem,
        priceData: testResult.priceData,
        resultsProcessed: testResult.resultsProcessed,
        executionTime: testResult.executionTime,
        cachedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired 24 hours ago
        hitCount: 0
      };

      mockRedis.get.mockResolvedValue(expiredResult);
      mockRedis.del.mockResolvedValue(1);

      const result = await cacheIntegrationService.getCachedMarketPrice(testItem);

      expect(result).toBeNull();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('Part Price Caching', () => {
    const testItem: ItemIdentifier = {
      type: 'vehicle',
      make: 'Toyota',
      model: 'Camry',
      year: 2021,
      condition: 'Foreign Used (Tokunbo)'
    };

    const testPartResult: PartPriceResult = {
      partName: 'windshield',
      priceData: {
        prices: [
          { price: 45000, currency: 'NGN', source: 'test', confidence: 75 }
        ],
        averagePrice: 45000,
        confidence: 75,
        currency: 'NGN',
        extractedAt: new Date()
      },
      query: 'Toyota Camry 2021 windshield price Nigeria',
      resultsProcessed: 3,
      executionTime: 1200,
      dataSource: 'internet_search',
      success: true
    };

    it('should cache part price result', async () => {
      mockRedis.set.mockResolvedValue('OK');

      await cacheIntegrationService.setCachedPartPrice(testItem, testPartResult);

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('internet_search:part:'),
        expect.objectContaining({
          query: testPartResult.query,
          item: testItem,
          partName: testPartResult.partName,
          priceData: testPartResult.priceData
        }),
        { ex: 24 * 60 * 60 }
      );
    });

    it('should retrieve cached part price result', async () => {
      const cachedResult = {
        id: 'test-part-id',
        query: testPartResult.query,
        item: testItem,
        partName: testPartResult.partName,
        priceData: testPartResult.priceData,
        cachedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        hitCount: 0
      };

      mockRedis.get.mockResolvedValue(cachedResult);
      mockRedis.set.mockResolvedValue('OK');

      const result = await cacheIntegrationService.getCachedPartPrice(
        testItem,
        'windshield',
        'glass'
      );

      expect(result).toEqual(expect.objectContaining({
        query: testPartResult.query,
        partName: testPartResult.partName,
        priceData: testPartResult.priceData
      }));
    });
  });

  describe('Cache Metrics', () => {
    it('should return default metrics when no data exists', async () => {
      mockRedis.get.mockResolvedValue(null);

      const metrics = await cacheIntegrationService.getMetrics();

      expect(metrics).toEqual({
        totalHits: 0,
        totalMisses: 0,
        hitRate: 0,
        entryCount: 0,
        popularQueries: []
      });
    });

    it('should calculate hit rate correctly', async () => {
      const mockMetrics = {
        totalHits: 80,
        totalMisses: 20,
        hitRate: 0, // Will be calculated
        entryCount: 100,
        popularQueries: []
      };

      mockRedis.get.mockResolvedValue(mockMetrics);

      const metrics = await cacheIntegrationService.getMetrics();

      expect(metrics.hitRate).toBe(80); // 80/(80+20) * 100 = 80%
    });

    it('should return popular queries sorted by hit count', async () => {
      const mockQueries = {
        'Toyota Camry price': 15,
        'Honda Accord price': 10,
        'Lexus ES price': 20
      };

      mockRedis.get.mockResolvedValue(mockQueries);

      const popularQueries = await cacheIntegrationService.getPopularQueries(5);

      expect(popularQueries).toEqual([
        { query: 'Lexus ES price', hits: 20 },
        { query: 'Toyota Camry price', hits: 15 },
        { query: 'Honda Accord price', hits: 10 }
      ]);
    });
  });

  describe('Cache Key Generation', () => {
    beforeEach(() => {
      // Reset all mocks before each test
      vi.clearAllMocks();
    });

    it('should generate consistent cache keys for identical items', async () => {
      const item1: ItemIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      const item2: ItemIdentifier = {
        type: 'vehicle',
        make: 'toyota', // Different case
        model: 'camry', // Different case
        year: 2021
      };

      // Mock cache miss for both calls
      mockRedis.get.mockResolvedValue(null);

      await cacheIntegrationService.getCachedMarketPrice(item1);
      await cacheIntegrationService.getCachedMarketPrice(item2);

      // Get the cache keys from the calls (should be the first parameter of each call)
      const calls = mockRedis.get.mock.calls.filter(call => 
        call[0].startsWith('internet_search:market:')
      );
      
      expect(calls.length).toBe(2);
      expect(calls[0][0]).toBe(calls[1][0]); // Keys should be the same due to normalization
    });

    it('should generate different cache keys for different items', async () => {
      const item1: ItemIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      };

      const item2: ItemIdentifier = {
        type: 'vehicle',
        make: 'Honda',
        model: 'Accord',
        year: 2021
      };

      mockRedis.get.mockResolvedValue(null);

      await cacheIntegrationService.getCachedMarketPrice(item1);
      await cacheIntegrationService.getCachedMarketPrice(item2);

      // Get the cache keys from the calls
      const calls = mockRedis.get.mock.calls.filter(call => 
        call[0].startsWith('internet_search:market:')
      );
      
      expect(calls.length).toBe(2);
      expect(calls[0][0]).not.toBe(calls[1][0]); // Keys should be different
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis errors gracefully in getCachedMarketPrice', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await cacheIntegrationService.getCachedMarketPrice({
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2021
      });

      expect(result).toBeNull();
    });

    it('should handle Redis errors gracefully in setCachedMarketPrice', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

      const testResult: MarketPriceResult = {
        priceData: {
          prices: [],
          confidence: 0,
          currency: 'NGN',
          extractedAt: new Date()
        },
        query: 'test query',
        resultsProcessed: 0,
        executionTime: 0,
        dataSource: 'internet_search',
        success: false
      };

      // Should not throw an error
      await expect(
        cacheIntegrationService.setCachedMarketPrice(
          { type: 'vehicle', make: 'Toyota', model: 'Camry', year: 2021 },
          testResult
        )
      ).resolves.toBeUndefined();
    });
  });
});