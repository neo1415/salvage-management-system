/**
 * Integration Test: Market Data Service
 * 
 * Tests the complete market data service flow including:
 * - Cache miss → scrape → aggregate → store
 * - Cache hit flow
 * - Stale data fallback
 * - All sources fail scenario
 * 
 * Requirements: 2.3-2.6, 7.3, 7.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getMarketPrice, refreshMarketPrice } from '@/features/market-data/services/market-data.service';
import type { PropertyIdentifier, SourcePrice } from '@/features/market-data/types';
import { db } from '@/lib/db/drizzle';
import { marketDataCache, marketDataSources, scrapingLogs, backgroundJobs } from '@/lib/db/schema/market-data';
import { eq } from 'drizzle-orm';
import { generatePropertyHash } from '@/features/market-data/services/cache.service';

// Mock scraper service
vi.mock('@/features/market-data/services/scraper.service', () => ({
  scrapeAllSources: vi.fn(),
}));

// Mock rate limiter to avoid actual KV calls
vi.mock('@/features/market-data/services/rate-limiter.service', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  recordRequest: vi.fn(async () => {}),
}));

import { scrapeAllSources } from '@/features/market-data/services/scraper.service';

describe('Integration Test: Market Data Service', () => {
  const testProperty: PropertyIdentifier = {
    type: 'vehicle',
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
  };

  const mockSourcePrices: SourcePrice[] = [
    {
      source: 'jiji',
      price: 5000000,
      currency: 'NGN',
      listingUrl: 'https://jiji.ng/test-1',
      listingTitle: 'Toyota Camry 2020',
      scrapedAt: new Date(),
      extractedYear: 2020,
      yearMatched: true,
    },
    {
      source: 'jumia',
      price: 5200000,
      currency: 'NGN',
      listingUrl: 'https://jumia.ng/test-2',
      listingTitle: 'Toyota Camry 2020',
      scrapedAt: new Date(),
      extractedYear: 2020,
      yearMatched: true,
    },
    {
      source: 'cars45',
      price: 4800000,
      currency: 'NGN',
      listingUrl: 'https://cars45.ng/test-3',
      listingTitle: 'Toyota Camry 2020',
      scrapedAt: new Date(),
      extractedYear: 2020,
      yearMatched: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test data
    const propertyHash = generatePropertyHash(testProperty);
    try {
      await db.delete(marketDataCache).where(eq(marketDataCache.propertyHash, propertyHash));
      await db.delete(scrapingLogs).where(eq(scrapingLogs.propertyHash, propertyHash));
      await db.delete(backgroundJobs).where(eq(backgroundJobs.propertyHash, propertyHash));
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });

  describe('Cache miss → scrape → aggregate → store', () => {
    it('should scrape, aggregate, and cache when no cache exists', { timeout: 10000 }, async () => {
      // Mock successful scraping
      vi.mocked(scrapeAllSources).mockResolvedValue([
        {
          success: true,
          source: 'jiji',
          prices: [mockSourcePrices[0]],
          duration: 1000,
        },
        {
          success: true,
          source: 'jumia',
          prices: [mockSourcePrices[1]],
          duration: 1200,
        },
        {
          success: true,
          source: 'cars45',
          prices: [mockSourcePrices[2]],
          duration: 900,
        },
        {
          success: false,
          source: 'cheki',
          prices: [],
          error: 'Timeout',
          duration: 5000,
        },
      ]);

      const result = await getMarketPrice(testProperty);

      // Verify result structure
      expect(result).toBeDefined();
      expect(result.median).toBe(5000000); // Median of [4800000, 5000000, 5200000]
      expect(result.min).toBe(4800000);
      expect(result.max).toBe(5200000);
      expect(result.count).toBe(3);
      expect(result.sources).toHaveLength(3);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.isFresh).toBe(true);
      expect(result.cacheAge).toBe(0);

      // Verify data was cached
      const propertyHash = generatePropertyHash(testProperty);
      const cached = await db
        .select()
        .from(marketDataCache)
        .where(eq(marketDataCache.propertyHash, propertyHash))
        .limit(1);

      expect(cached).toHaveLength(1);
      expect(cached[0].medianPrice).toBe('5000000.00');
      expect(cached[0].sourceCount).toBe(3);

      // Verify source prices were stored
      const sources = await db
        .select()
        .from(marketDataSources)
        .where(eq(marketDataSources.cacheId, cached[0].id));

      expect(sources).toHaveLength(3);
    });

    it('should handle partial scraping failures gracefully', { timeout: 10000 }, async () => {
      // Mock partial scraping success
      vi.mocked(scrapeAllSources).mockResolvedValue([
        {
          success: true,
          source: 'jiji',
          prices: [mockSourcePrices[0]],
          duration: 1000,
        },
        {
          success: false,
          source: 'jumia',
          prices: [],
          error: 'HTTP 500',
          duration: 2000,
        },
        {
          success: false,
          source: 'cars45',
          prices: [],
          error: 'Timeout',
          duration: 5000,
        },
        {
          success: false,
          source: 'cheki',
          prices: [],
          error: 'Network error',
          duration: 3000,
        },
      ]);

      const result = await getMarketPrice(testProperty);

      // Should still return result with single source
      expect(result).toBeDefined();
      expect(result.median).toBe(5000000);
      expect(result.count).toBe(1);
      expect(result.sources).toHaveLength(1);
      expect(result.confidence).toBeLessThan(70); // Lower confidence with single source
    });
  });

  describe('Cache hit flow', () => {
    it('should return cached data when fresh cache exists', async () => {
      // Pre-populate cache with fresh data
      const propertyHash = generatePropertyHash(testProperty);
      const scrapedAt = new Date();
      const staleAt = new Date(scrapedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later

      const [cacheEntry] = await db
        .insert(marketDataCache)
        .values({
          propertyHash,
          propertyType: testProperty.type,
          propertyDetails: testProperty,
          medianPrice: '5000000.00',
          minPrice: '4800000.00',
          maxPrice: '5200000.00',
          sourceCount: 3,
          scrapedAt,
          staleAt,
        })
        .returning();

      await db.insert(marketDataSources).values([
        {
          cacheId: cacheEntry.id,
          sourceName: 'jiji',
          price: '5000000.00',
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test-1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt,
        },
        {
          cacheId: cacheEntry.id,
          sourceName: 'jumia',
          price: '5200000.00',
          currency: 'NGN',
          listingUrl: 'https://jumia.ng/test-2',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt,
        },
        {
          cacheId: cacheEntry.id,
          sourceName: 'cars45',
          price: '4800000.00',
          currency: 'NGN',
          listingUrl: 'https://cars45.ng/test-3',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt,
        },
      ]);

      const result = await getMarketPrice(testProperty);

      // Should return cached data without scraping
      expect(result).toBeDefined();
      expect(result.median).toBe(5000000);
      expect(result.count).toBe(3);
      expect(result.isFresh).toBe(true);
      expect(result.cacheAge).toBe(0);

      // Verify scraper was NOT called
      expect(scrapeAllSources).not.toHaveBeenCalled();
    });

    it('should initiate background job for stale cache', { timeout: 10000 }, async () => {
      // Pre-populate cache with stale data (8 days old)
      const propertyHash = generatePropertyHash(testProperty);
      const scrapedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      const staleAt = new Date(scrapedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [cacheEntry] = await db
        .insert(marketDataCache)
        .values({
          propertyHash,
          propertyType: testProperty.type,
          propertyDetails: testProperty,
          medianPrice: '5000000.00',
          minPrice: '4800000.00',
          maxPrice: '5200000.00',
          sourceCount: 3,
          scrapedAt,
          staleAt,
        })
        .returning();

      await db.insert(marketDataSources).values([
        {
          cacheId: cacheEntry.id,
          sourceName: 'jiji',
          price: '5000000.00',
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test-1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt,
        },
      ]);

      // Mock scraping to succeed
      vi.mocked(scrapeAllSources).mockResolvedValue([
        {
          success: true,
          source: 'jiji',
          prices: [mockSourcePrices[0]],
          duration: 1000,
        },
        {
          success: true,
          source: 'jumia',
          prices: [mockSourcePrices[1]],
          duration: 1200,
        },
      ]);

      const result = await getMarketPrice(testProperty);

      // Should scrape and return fresh data
      expect(result).toBeDefined();
      expect(scrapeAllSources).toHaveBeenCalled();
    });
  });

  describe('Stale data fallback', () => {
    it('should return stale cache when all sources fail', async () => {
      // Pre-populate cache with stale data
      const propertyHash = generatePropertyHash(testProperty);
      const scrapedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const staleAt = new Date(scrapedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [cacheEntry] = await db
        .insert(marketDataCache)
        .values({
          propertyHash,
          propertyType: testProperty.type,
          propertyDetails: testProperty,
          medianPrice: '5000000.00',
          minPrice: '4800000.00',
          maxPrice: '5200000.00',
          sourceCount: 3,
          scrapedAt,
          staleAt,
        })
        .returning();

      await db.insert(marketDataSources).values([
        {
          cacheId: cacheEntry.id,
          sourceName: 'jiji',
          price: '5000000.00',
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test-1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt,
        },
        {
          cacheId: cacheEntry.id,
          sourceName: 'jumia',
          price: '5200000.00',
          currency: 'NGN',
          listingUrl: 'https://jumia.ng/test-2',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt,
        },
      ]);

      // Mock all sources failing
      vi.mocked(scrapeAllSources).mockResolvedValue([
        {
          success: false,
          source: 'jiji',
          prices: [],
          error: 'HTTP 500',
          duration: 2000,
        },
        {
          success: false,
          source: 'jumia',
          prices: [],
          error: 'Timeout',
          duration: 5000,
        },
        {
          success: false,
          source: 'cars45',
          prices: [],
          error: 'Network error',
          duration: 3000,
        },
        {
          success: false,
          source: 'cheki',
          prices: [],
          error: 'DNS error',
          duration: 1000,
        },
      ]);

      const result = await getMarketPrice(testProperty);

      // Should return stale cached data
      expect(result).toBeDefined();
      expect(result.median).toBe(5000000);
      expect(result.count).toBe(2);
      expect(result.isFresh).toBe(false);
      expect(result.cacheAge).toBe(10);
      expect(result.confidence).toBeLessThan(70); // Reduced confidence for stale data
    });

    it('should return very stale cache with further reduced confidence', async () => {
      // Pre-populate cache with very stale data (35 days old)
      const propertyHash = generatePropertyHash(testProperty);
      const scrapedAt = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      const staleAt = new Date(scrapedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [cacheEntry] = await db
        .insert(marketDataCache)
        .values({
          propertyHash,
          propertyType: testProperty.type,
          propertyDetails: testProperty,
          medianPrice: '5000000.00',
          minPrice: '5000000.00',
          maxPrice: '5000000.00',
          sourceCount: 1,
          scrapedAt,
          staleAt,
        })
        .returning();

      await db.insert(marketDataSources).values([
        {
          cacheId: cacheEntry.id,
          sourceName: 'jiji',
          price: '5000000.00',
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test-1',
          listingTitle: 'Toyota Camry 2020',
          scrapedAt,
        },
      ]);

      // Mock all sources failing
      vi.mocked(scrapeAllSources).mockResolvedValue([
        {
          success: false,
          source: 'jiji',
          prices: [],
          error: 'HTTP 500',
          duration: 2000,
        },
        {
          success: false,
          source: 'jumia',
          prices: [],
          error: 'Timeout',
          duration: 5000,
        },
        {
          success: false,
          source: 'cars45',
          prices: [],
          error: 'Network error',
          duration: 3000,
        },
        {
          success: false,
          source: 'cheki',
          prices: [],
          error: 'DNS error',
          duration: 1000,
        },
      ]);

      const result = await getMarketPrice(testProperty);

      // Should return very stale cached data with low confidence
      expect(result).toBeDefined();
      expect(result.median).toBe(5000000);
      expect(result.isFresh).toBe(false);
      expect(result.cacheAge).toBe(35);
      expect(result.confidence).toBeLessThan(30); // Very low confidence (single source + 40 point penalty)
    });
  });

  describe('All sources fail scenario', () => {
    it('should throw error when all sources fail and no cache exists', async () => {
      // Mock all sources failing
      vi.mocked(scrapeAllSources).mockResolvedValue([
        {
          success: false,
          source: 'jiji',
          prices: [],
          error: 'HTTP 500',
          duration: 2000,
        },
        {
          success: false,
          source: 'jumia',
          prices: [],
          error: 'Timeout',
          duration: 5000,
        },
        {
          success: false,
          source: 'cars45',
          prices: [],
          error: 'Network error',
          duration: 3000,
        },
        {
          success: false,
          source: 'cheki',
          prices: [],
          error: 'DNS error',
          duration: 1000,
        },
      ]);

      await expect(getMarketPrice(testProperty)).rejects.toThrow(
        'Unable to retrieve market price: all sources failed and no cached data available'
      );
    });

    it('should throw error for unsupported property type', async () => {
      const invalidProperty = {
        type: 'furniture' as any,
        brand: 'IKEA',
      };

      await expect(getMarketPrice(invalidProperty)).rejects.toThrow(
        'Unsupported property type: furniture'
      );
    });
  });

  describe('Manual refresh', () => {
    it('should force scraping and update cache on refresh', async () => {
      // Pre-populate cache with old data
      const propertyHash = generatePropertyHash(testProperty);
      const oldScrapedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const staleAt = new Date(oldScrapedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(marketDataCache).values({
        propertyHash,
        propertyType: testProperty.type,
        propertyDetails: testProperty,
        medianPrice: '4500000.00', // Old price
        minPrice: '4500000.00',
        maxPrice: '4500000.00',
        sourceCount: 1,
        scrapedAt: oldScrapedAt,
        staleAt,
      });

      // Mock successful scraping with new prices
      vi.mocked(scrapeAllSources).mockResolvedValue([
        {
          success: true,
          source: 'jiji',
          prices: [mockSourcePrices[0]],
          duration: 1000,
        },
        {
          success: true,
          source: 'jumia',
          prices: [mockSourcePrices[1]],
          duration: 1200,
        },
        {
          success: true,
          source: 'cars45',
          prices: [mockSourcePrices[2]],
          duration: 900,
        },
      ]);

      await refreshMarketPrice(testProperty);

      // Verify cache was updated
      const cached = await db
        .select()
        .from(marketDataCache)
        .where(eq(marketDataCache.propertyHash, propertyHash))
        .limit(1);

      expect(cached).toHaveLength(1);
      expect(cached[0].medianPrice).toBe('5000000.00'); // New price
      expect(cached[0].sourceCount).toBe(3);
    });

    it('should throw error when refresh fails', async () => {
      // Mock all sources failing
      vi.mocked(scrapeAllSources).mockResolvedValue([
        {
          success: false,
          source: 'jiji',
          prices: [],
          error: 'HTTP 500',
          duration: 2000,
        },
        {
          success: false,
          source: 'jumia',
          prices: [],
          error: 'Timeout',
          duration: 5000,
        },
        {
          success: false,
          source: 'cars45',
          prices: [],
          error: 'Network error',
          duration: 3000,
        },
        {
          success: false,
          source: 'cheki',
          prices: [],
          error: 'DNS error',
          duration: 1000,
        },
      ]);

      await expect(refreshMarketPrice(testProperty)).rejects.toThrow(
        'Refresh failed: no prices retrieved from any source'
      );
    });
  });
});
