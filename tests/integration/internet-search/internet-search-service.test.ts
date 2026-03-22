/**
 * Integration tests for Internet Search Service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InternetSearchService } from '@/features/internet-search/services/internet-search.service';
import { serperApi } from '@/lib/integrations/serper-api';
import type { SerperSearchResponse } from '@/lib/integrations/serper-api';

// Mock the Serper API
vi.mock('@/lib/integrations/serper-api', () => ({
  serperApi: {
    search: vi.fn()
  }
}));

const mockSerperApi = vi.mocked(serperApi);

describe('InternetSearchService Integration', () => {
  let service: InternetSearchService;

  beforeEach(() => {
    service = new InternetSearchService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('searchMarketPrice', () => {
    it('should successfully search for vehicle market price', async () => {
      const mockResponse: SerperSearchResponse = {
        success: true,
        organic: [
          {
            title: 'Toyota Camry 2021 for Sale',
            link: 'https://jiji.ng/cars/toyota-camry',
            snippet: 'Toyota Camry 2021 Black · ₦ 48,950,000. Clean foreign used.',
            position: 1
          },
          {
            title: 'Camry 2021 Price in Nigeria',
            link: 'https://cars45.com/listing/toyota-camry-2021',
            snippet: 'Buy Toyota Camry 2021 for ₦45,000,000 in Lagos',
            position: 2
          }
        ],
        searchParameters: {
          q: 'Toyota Camry 2021 price Nigeria site:jiji.ng OR site:cars45.com',
          type: 'search',
          engine: 'google'
        }
      };

      mockSerperApi.search.mockResolvedValue(mockResponse);

      const result = await service.searchMarketPrice({
        item: {
          type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          condition: 'excellent'
        }
      });

      expect(result.success).toBe(true);
      expect(result.dataSource).toBe('internet_search');
      expect(result.priceData.prices.length).toBeGreaterThan(0);
      expect(result.priceData.averagePrice).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.resultsProcessed).toBe(2);
      expect(mockSerperApi.search).toHaveBeenCalledOnce();
    });

    it('should handle electronics market price search', async () => {
      const mockResponse: SerperSearchResponse = {
        success: true,
        organic: [
          {
            title: 'iPhone 13 Pro Price in Nigeria',
            link: 'https://jumia.com.ng/iphone-13-pro',
            snippet: 'iPhone 13 Pro 128GB ₦800,000 - ₦950,000',
            position: 1
          }
        ],
        searchParameters: {
          q: 'iPhone 13 Pro price Nigeria site:jumia.com.ng OR site:konga.com',
          type: 'search',
          engine: 'google'
        }
      };

      mockSerperApi.search.mockResolvedValue(mockResponse);

      const result = await service.searchMarketPrice({
        item: {
          type: 'electronics',
          brand: 'Apple',
          model: 'iPhone 13 Pro',
          condition: 'excellent'
        }
      });

      expect(result.success).toBe(true);
      expect(result.priceData.prices.length).toBeGreaterThan(0);
      expect(result.priceData.prices[0].price).toBeGreaterThan(500000);
      expect(result.priceData.prices[0].price).toBeLessThan(2000000);
    });

    it('should handle API timeout gracefully', async () => {
      // Mock a delayed response
      mockSerperApi.search.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 5000))
      );

      const result = await service.searchMarketPrice({
        item: {
          type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          condition: 'excellent'
        },
        timeout: 1000 // 1 second timeout
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.priceData.prices).toHaveLength(0);
      expect(result.priceData.confidence).toBe(0);
    });

    it('should handle API errors gracefully', async () => {
      mockSerperApi.search.mockResolvedValue({
        success: false,
        error: 'API rate limit exceeded',
        searchParameters: {
          q: 'test query',
          type: 'search',
          engine: 'google'
        }
      });

      const result = await service.searchMarketPrice({
        item: {
          type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          condition: 'excellent'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('rate limit');
      expect(result.priceData.prices).toHaveLength(0);
    });

    it('should handle empty search results', async () => {
      mockSerperApi.search.mockResolvedValue({
        success: true,
        organic: [],
        searchParameters: {
          q: 'test query',
          type: 'search',
          engine: 'google'
        }
      });

      const result = await service.searchMarketPrice({
        item: {
          type: 'vehicle',
          make: 'UnknownMake',
          model: 'UnknownModel',
          year: 2025,
          condition: 'excellent'
        }
      });

      expect(result.success).toBe(true);
      expect(result.priceData.prices).toHaveLength(0);
      expect(result.priceData.confidence).toBe(0);
      expect(result.resultsProcessed).toBe(0);
    });
  });

  describe('searchPartPrice', () => {
    it('should successfully search for vehicle part prices', async () => {
      const mockResponse: SerperSearchResponse = {
        success: true,
        organic: [
          {
            title: 'Toyota Camry Windshield Replacement',
            link: 'https://autoglass.ng/toyota-camry-windshield',
            snippet: 'Toyota Camry windshield replacement ₦85,000 - ₦120,000',
            position: 1
          },
          {
            title: 'Camry Front Glass Price',
            link: 'https://carparts.ng/windshield',
            snippet: 'Original Toyota Camry front glass ₦95,000',
            position: 2
          }
        ],
        searchParameters: {
          q: 'Toyota Camry windshield price Nigeria replacement parts',
          type: 'search',
          engine: 'google'
        }
      };

      mockSerperApi.search.mockResolvedValue(mockResponse);

      const result = await service.searchPartPrice({
        item: {
          type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          condition: 'excellent'
        },
        partName: 'windshield',
        damageType: 'glass'
      });

      expect(result.success).toBe(true);
      expect(result.partName).toBe('windshield');
      expect(result.priceData.prices.length).toBeGreaterThan(0);
      expect(result.priceData.averagePrice).toBeGreaterThan(50000);
      expect(result.priceData.averagePrice).toBeLessThan(200000);
    });

    it('should handle part search timeout', async () => {
      mockSerperApi.search.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 5000))
      );

      const result = await service.searchPartPrice({
        item: {
          type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          condition: 'excellent'
        },
        partName: 'headlight',
        timeout: 1000
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      expect(result.partName).toBe('headlight');
    });
  });

  describe('searchMultiplePartPrices', () => {
    it('should search for multiple parts in parallel', async () => {
      const mockResponse: SerperSearchResponse = {
        success: true,
        organic: [
          {
            title: 'Car Parts Price',
            link: 'https://carparts.ng/parts',
            snippet: 'Various car parts available ₦50,000 - ₦150,000',
            position: 1
          }
        ],
        searchParameters: {
          q: 'car parts price Nigeria',
          type: 'search',
          engine: 'google'
        }
      };

      mockSerperApi.search.mockResolvedValue(mockResponse);

      const parts = [
        { name: 'windshield', damageType: 'glass' },
        { name: 'headlight', damageType: 'lighting' },
        { name: 'bumper', damageType: 'body' }
      ];

      const results = await service.searchMultiplePartPrices(
        {
          type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          condition: 'excellent'
        },
        parts
      );

      expect(results).toHaveLength(3);
      expect(results[0].partName).toBe('windshield');
      expect(results[1].partName).toBe('headlight');
      expect(results[2].partName).toBe('bumper');
      expect(mockSerperApi.search).toHaveBeenCalledTimes(3);
    });

    it('should handle partial failures in multiple part searches', async () => {
      let callCount = 0;
      mockSerperApi.search.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          // Second call fails
          return Promise.reject(new Error('API error'));
        }
        return Promise.resolve({
          success: true,
          organic: [
            {
              title: 'Car Part Price',
              link: 'https://example.com',
              snippet: 'Part price ₦75,000',
              position: 1
            }
          ],
          searchParameters: {
            q: 'car part price',
            type: 'search',
            engine: 'google'
          }
        });
      });

      const parts = [
        { name: 'windshield' },
        { name: 'headlight' },
        { name: 'bumper' }
      ];

      const results = await service.searchMultiplePartPrices(
        {
          type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          condition: 'excellent'
        },
        parts
      );

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('getAggregatedMarketPrice', () => {
    it('should provide aggregated market price with part validation', async () => {
      const marketResponse: SerperSearchResponse = {
        success: true,
        organic: [
          {
            title: 'Toyota Camry 2021 Price',
            link: 'https://jiji.ng/cars',
            snippet: 'Toyota Camry 2021 ₦45,000,000',
            position: 1
          }
        ],
        searchParameters: {
          q: 'Toyota Camry 2021 price Nigeria',
          type: 'search',
          engine: 'google'
        }
      };

      const partResponse: SerperSearchResponse = {
        success: true,
        organic: [
          {
            title: 'Car Parts',
            link: 'https://parts.ng',
            snippet: 'Windshield ₦85,000, Headlight ₦45,000',
            position: 1
          }
        ],
        searchParameters: {
          q: 'car parts price',
          type: 'search',
          engine: 'google'
        }
      };

      mockSerperApi.search.mockResolvedValueOnce(marketResponse);
      mockSerperApi.search.mockResolvedValue(partResponse);

      const result = await service.getAggregatedMarketPrice(
        {
          type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          condition: 'excellent'
        },
        { includePartPrices: true }
      );

      expect(result.marketPrice.success).toBe(true);
      expect(result.partPrices).toBeDefined();
      expect(result.partPrices!.length).toBeGreaterThan(0);
      expect(result.aggregatedConfidence).toBeGreaterThan(0);
      expect(result.recommendedPrice).toBeGreaterThan(0);
    });

    it('should handle market price search without part validation', async () => {
      const mockResponse: SerperSearchResponse = {
        success: true,
        organic: [
          {
            title: 'iPhone Price',
            link: 'https://jumia.com.ng',
            snippet: 'iPhone 13 Pro ₦850,000',
            position: 1
          }
        ],
        searchParameters: {
          q: 'iPhone 13 Pro price Nigeria',
          type: 'search',
          engine: 'google'
        }
      };

      mockSerperApi.search.mockResolvedValue(mockResponse);

      const result = await service.getAggregatedMarketPrice(
        {
          type: 'electronics',
          brand: 'Apple',
          model: 'iPhone 13 Pro',
          condition: 'excellent'
        },
        { includePartPrices: false }
      );

      expect(result.marketPrice.success).toBe(true);
      expect(result.partPrices).toBeUndefined();
      expect(result.aggregatedConfidence).toBeGreaterThan(0);
      expect(result.recommendedPrice).toBe(850000);
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status for successful API response', async () => {
      mockSerperApi.search.mockResolvedValue({
        success: true,
        organic: [],
        searchParameters: {
          q: 'test query',
          type: 'search',
          engine: 'google'
        }
      });

      const result = await service.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.apiStatus).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.responseTime).toBeLessThan(2000);
    });

    it('should return degraded status for slow API response', async () => {
      mockSerperApi.search.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            success: true,
            organic: [],
            searchParameters: {
              q: 'test query',
              type: 'search',
              engine: 'google'
            }
          }), 2500)
        )
      );

      const result = await service.healthCheck();

      expect(result.status).toBe('degraded');
      expect(result.apiStatus).toBe(true);
      expect(result.responseTime).toBeGreaterThan(2000);
    });

    it('should return unhealthy status for API failure', async () => {
      mockSerperApi.search.mockResolvedValue({
        success: false,
        error: 'API key invalid',
        searchParameters: {
          q: 'test query',
          type: 'search',
          engine: 'google'
        }
      });

      const result = await service.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.apiStatus).toBe(false);
      expect(result.error).toContain('API key invalid');
    });

    it('should handle network errors in health check', async () => {
      mockSerperApi.search.mockRejectedValue(new Error('Network error'));

      const result = await service.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.apiStatus).toBe(false);
      expect(result.error).toContain('Network error');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should respect maxResults parameter', async () => {
      const mockResponse: SerperSearchResponse = {
        success: true,
        organic: Array.from({ length: 20 }, (_, i) => ({
          title: `Result ${i + 1}`,
          link: `https://example${i}.com`,
          snippet: `Price ₦${(i + 1) * 100000}`,
          position: i + 1
        })),
        searchParameters: {
          q: 'test query',
          type: 'search',
          engine: 'google'
        }
      };

      mockSerperApi.search.mockResolvedValue(mockResponse);

      const result = await service.searchMarketPrice({
        item: {
          type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          condition: 'excellent'
        },
        maxResults: 5
      });

      expect(mockSerperApi.search).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ num: 5 })
      );
    });

    it('should handle concurrent searches efficiently', async () => {
      const mockResponse: SerperSearchResponse = {
        success: true,
        organic: [
          {
            title: 'Test Result',
            link: 'https://example.com',
            snippet: 'Price ₦500000',
            position: 1
          }
        ],
        searchParameters: {
          q: 'test query',
          type: 'search',
          engine: 'google'
        }
      };

      mockSerperApi.search.mockResolvedValue(mockResponse);

      const promises = Array.from({ length: 3 }, () =>
        service.searchMarketPrice({
          item: {
            type: 'electronics',
            brand: 'Samsung',
            model: 'Galaxy S21',
            condition: 'excellent'
          }
        })
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(mockSerperApi.search).toHaveBeenCalledTimes(3);
    });
  });
});