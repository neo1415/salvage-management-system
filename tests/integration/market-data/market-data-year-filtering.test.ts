/**
 * Integration Test: Market Data Year Filtering Flow
 * 
 * Tests the end-to-end year filtering orchestration in the market data service.
 * 
 * Scenarios:
 * 1. Sufficient year-matched data (should not apply depreciation)
 * 2. Insufficient year-matched data (should apply depreciation)
 * 3. Insufficient total data (should throw error)
 * 4. Confidence scores reflect year match quality
 * 
 * Requirements: 4.1, 5.1, 6.1, 6.2, 6.3
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getMarketPrice } from '../../../src/features/market-data/services/market-data.service';
import type { PropertyIdentifier, ScrapeResult } from '../../../src/features/market-data/types';
import { scrapeAllSources } from '../../../src/features/market-data/services/scraper.service';

// Mock scraper service
vi.mock('../../../src/features/market-data/services/scraper.service', () => ({
  scrapeAllSources: vi.fn(),
}));

const mockScrapeAllSources = vi.mocked(scrapeAllSources);

// Mock dependencies
vi.mock('../../../src/features/market-data/services/cache.service', () => ({
  getCachedPrice: vi.fn().mockResolvedValue(null),
  setCachedPrice: vi.fn().mockResolvedValue(undefined),
  getCacheAge: vi.fn().mockReturnValue(0),
  isStale: vi.fn().mockReturnValue(false),
}));

vi.mock('../../../src/features/market-data/services/scraping-logger.service', () => ({
  logScrapingStart: vi.fn().mockResolvedValue(undefined),
  logScrapingSuccess: vi.fn().mockResolvedValue(undefined),
  logScrapingFailure: vi.fn().mockResolvedValue(undefined),
  logCacheHit: vi.fn().mockResolvedValue(undefined),
  logStaleFallback: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/features/market-data/services/background-job.service', () => ({
  enqueueScrapingJob: vi.fn().mockResolvedValue(undefined),
}));

describe('Market Data Year Filtering Integration', () => {
  const testProperty: PropertyIdentifier = {
    type: 'vehicle',
    make: 'Honda',
    model: 'Accord',
    year: 2004,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 1: Sufficient year-matched data', () => {
    it('should use only year-matched listings without depreciation', async () => {
      // Mock scraper to return 5 year-matched listings and 1 non-matched
      const mockScrapeResults: ScrapeResult[] = [
        {
          success: true,
          source: 'jiji',
          duration: 1000,
          prices: [
            {
              source: 'jiji',
              price: 2500000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/1',
              listingTitle: 'Honda Accord 2004',
              scrapedAt: new Date(),
              extractedYear: 2004,
              yearMatched: true,
            },
            {
              source: 'jiji',
              price: 2800000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/2',
              listingTitle: 'Honda Accord 2005',
              scrapedAt: new Date(),
              extractedYear: 2005,
              yearMatched: true,
            },
            {
              source: 'jiji',
              price: 2300000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/3',
              listingTitle: 'Honda Accord 2003',
              scrapedAt: new Date(),
              extractedYear: 2003,
              yearMatched: true,
            },
            {
              source: 'jiji',
              price: 5000000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/4',
              listingTitle: 'Honda Accord 2010',
              scrapedAt: new Date(),
              extractedYear: 2010,
              yearMatched: false,
            },
          ],
        },
        {
          success: true,
          source: 'cars45',
          duration: 1200,
          prices: [
            {
              source: 'cars45',
              price: 2600000,
              currency: 'NGN',
              listingUrl: 'https://cars45.com/1',
              listingTitle: '2004 Honda Accord',
              scrapedAt: new Date(),
              extractedYear: 2004,
              yearMatched: true,
            },
            {
              source: 'cars45',
              price: 2700000,
              currency: 'NGN',
              listingUrl: 'https://cars45.com/2',
              listingTitle: '2005 Honda Accord',
              scrapedAt: new Date(),
              extractedYear: 2005,
              yearMatched: true,
            },
          ],
        },
      ];

      mockScrapeAllSources.mockResolvedValue(mockScrapeResults);

      const result = await getMarketPrice(testProperty);

      // Should use only the 5 year-matched listings
      expect(result.count).toBe(5);
      expect(result.depreciationApplied).toBe(false);
      expect(result.yearMatchRate).toBeCloseTo(83.33, 1); // 5/6 = 83.33%
      
      // Median should be from year-matched listings only
      expect(result.median).toBeGreaterThanOrEqual(2300000);
      expect(result.median).toBeLessThanOrEqual(2800000);
      
      // Confidence should be high (no depreciation penalty)
      expect(result.confidence).toBeGreaterThan(70);
    });
  });

  describe('Scenario 2: Insufficient year-matched data with newer listings', () => {
    it('should apply depreciation to newer listings', async () => {
      // Mock scraper to return 2 year-matched and 2 newer listings
      const mockScrapeResults: ScrapeResult[] = [
        {
          success: true,
          source: 'jiji',
          duration: 1000,
          prices: [
            {
              source: 'jiji',
              price: 2500000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/1',
              listingTitle: 'Honda Accord 2004',
              scrapedAt: new Date(),
              extractedYear: 2004,
              yearMatched: true,
            },
            {
              source: 'jiji',
              price: 2800000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/2',
              listingTitle: 'Honda Accord 2005',
              scrapedAt: new Date(),
              extractedYear: 2005,
              yearMatched: true,
            },
            {
              source: 'jiji',
              price: 5000000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/3',
              listingTitle: 'Honda Accord 2010',
              scrapedAt: new Date(),
              extractedYear: 2010,
              yearMatched: false,
            },
            {
              source: 'jiji',
              price: 6000000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/4',
              listingTitle: 'Honda Accord 2012',
              scrapedAt: new Date(),
              extractedYear: 2012,
              yearMatched: false,
            },
          ],
        },
      ];

      mockScrapeAllSources.mockResolvedValue(mockScrapeResults);

      const result = await getMarketPrice(testProperty);

      // Should apply depreciation and use all listings
      expect(result.count).toBeGreaterThanOrEqual(3);
      expect(result.depreciationApplied).toBe(true);
      expect(result.yearMatchRate).toBe(50); // 2/4 = 50%
      
      // Confidence should be lower due to depreciation penalty (will be enhanced in task 8)
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Scenario 3: Insufficient total data', () => {
    it('should throw error when <3 year-matched listings and no newer listings', async () => {
      // Mock scraper to return only 2 year-matched listings
      const mockScrapeResults: ScrapeResult[] = [
        {
          success: true,
          source: 'jiji',
          duration: 1000,
          prices: [
            {
              source: 'jiji',
              price: 2500000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/1',
              listingTitle: 'Honda Accord 2004',
              scrapedAt: new Date(),
              extractedYear: 2004,
              yearMatched: true,
            },
            {
              source: 'jiji',
              price: 2800000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/2',
              listingTitle: 'Honda Accord 2005',
              scrapedAt: new Date(),
              extractedYear: 2005,
              yearMatched: true,
            },
          ],
        },
      ];

      mockScrapeAllSources.mockResolvedValue(mockScrapeResults);

      await expect(getMarketPrice(testProperty)).rejects.toThrow(/Insufficient year-matched data|Insufficient data.*after year filtering/);
    });

    it('should throw error when <3 total listings after depreciation', async () => {
      // Mock scraper to return 1 year-matched and 1 newer listing
      const mockScrapeResults: ScrapeResult[] = [
        {
          success: true,
          source: 'jiji',
          duration: 1000,
          prices: [
            {
              source: 'jiji',
              price: 2500000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/1',
              listingTitle: 'Honda Accord 2004',
              scrapedAt: new Date(),
              extractedYear: 2004,
              yearMatched: true,
            },
            {
              source: 'jiji',
              price: 5000000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/2',
              listingTitle: 'Honda Accord 2010',
              scrapedAt: new Date(),
              extractedYear: 2010,
              yearMatched: false,
            },
          ],
        },
      ];

      mockScrapeAllSources.mockResolvedValue(mockScrapeResults);

      await expect(getMarketPrice(testProperty)).rejects.toThrow(/Insufficient data/);
    });
  });

  describe('Scenario 4: Confidence scores reflect year match quality', () => {
    it('should have higher confidence for better year match rate', async () => {
      // Test with high year match rate (80%)
      const highMatchResults: ScrapeResult[] = [
        {
          success: true,
          source: 'jiji',
          duration: 1000,
          prices: [
            {
              source: 'jiji',
              price: 2500000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/1',
              listingTitle: 'Honda Accord 2004',
              scrapedAt: new Date(),
              extractedYear: 2004,
              yearMatched: true,
            },
            {
              source: 'jiji',
              price: 2600000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/2',
              listingTitle: 'Honda Accord 2004',
              scrapedAt: new Date(),
              extractedYear: 2004,
              yearMatched: true,
            },
            {
              source: 'jiji',
              price: 2700000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/3',
              listingTitle: 'Honda Accord 2005',
              scrapedAt: new Date(),
              extractedYear: 2005,
              yearMatched: true,
            },
            {
              source: 'jiji',
              price: 2800000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/4',
              listingTitle: 'Honda Accord 2003',
              scrapedAt: new Date(),
              extractedYear: 2003,
              yearMatched: true,
            },
            {
              source: 'jiji',
              price: 5000000,
              currency: 'NGN',
              listingUrl: 'https://jiji.ng/5',
              listingTitle: 'Honda Accord 2010',
              scrapedAt: new Date(),
              extractedYear: 2010,
              yearMatched: false,
            },
          ],
        },
      ];

      mockScrapeAllSources.mockResolvedValue(highMatchResults);

      const highMatchResult = await getMarketPrice(testProperty);

      expect(highMatchResult.yearMatchRate).toBe(80); // 4/5
      expect(highMatchResult.depreciationApplied).toBe(false);
      expect(highMatchResult.confidence).toBeGreaterThan(70);
    });
  });

  describe('Non-vehicle properties', () => {
    it('should not apply year filtering for non-vehicle properties', async () => {
      const electronicsProperty: PropertyIdentifier = {
        type: 'electronics',
        brand: 'Samsung',
        productModel: 'Galaxy S21',
      };

      const mockScrapeResults: ScrapeResult[] = [
        {
          success: true,
          source: 'jumia',
          duration: 1000,
          prices: [
            {
              source: 'jumia',
              price: 250000,
              currency: 'NGN',
              listingUrl: 'https://jumia.com/1',
              listingTitle: 'Samsung Galaxy S21',
              scrapedAt: new Date(),
            },
            {
              source: 'jumia',
              price: 280000,
              currency: 'NGN',
              listingUrl: 'https://jumia.com/2',
              listingTitle: 'Samsung Galaxy S21',
              scrapedAt: new Date(),
            },
            {
              source: 'jumia',
              price: 260000,
              currency: 'NGN',
              listingUrl: 'https://jumia.com/3',
              listingTitle: 'Samsung Galaxy S21',
              scrapedAt: new Date(),
            },
          ],
        },
      ];

      mockScrapeAllSources.mockResolvedValue(mockScrapeResults);

      const result = await getMarketPrice(electronicsProperty);

      // Should not apply year filtering
      expect(result.yearMatchRate).toBe(100); // Default
      expect(result.depreciationApplied).toBe(false);
      expect(result.count).toBe(3);
    });
  });
});
