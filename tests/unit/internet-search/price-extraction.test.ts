/**
 * Unit tests for Price Extraction Service
 */

import { describe, it, expect } from 'vitest';
import { 
  PriceExtractionService, 
  priceExtractor 
} from '@/features/internet-search/services/price-extraction.service';
import type { SerperSearchResult } from '@/lib/integrations/serper-api';

describe('PriceExtractionService', () => {
  const service = new PriceExtractionService();

  describe('extractPrices', () => {
    it('should extract Nigerian Naira prices correctly', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'Toyota Camry 2021 for Sale',
          link: 'https://jiji.ng/cars/toyota-camry',
          snippet: 'Toyota Camry 2021 Black · ₦ 48,950,000. Clean foreign used.',
          position: 1
        }
      ];

      const result = service.extractPrices(mockResults, 'vehicle');
      
      expect(result.prices).toHaveLength(1);
      expect(result.prices[0].price).toBe(48950000);
      expect(result.prices[0].currency).toBe('NGN');
      expect(result.prices[0].confidence).toBeGreaterThan(90);
    });

    it('should handle million/thousand abbreviations', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'Car Prices',
          link: 'https://example.com',
          snippet: 'Toyota Camry ₦2.5m, Honda Accord ₦500k',
          position: 1
        }
      ];

      const result = service.extractPrices(mockResults, 'vehicle');
      
      expect(result.prices).toHaveLength(2);
      expect(result.prices[0].price).toBe(2500000); // 2.5m
      expect(result.prices[1].price).toBe(500000);  // 500k
    });

    it('should extract multiple price formats', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'Various Price Formats',
          link: 'https://jiji.ng/test',
          snippet: '₦1,500,000 or NGN 2000000 or 3 million naira',
          position: 1
        }
      ];

      const result = service.extractPrices(mockResults, 'vehicle');
      
      expect(result.prices.length).toBeGreaterThanOrEqual(3);
      expect(result.prices.some(p => p.price === 1500000)).toBe(true);
      expect(result.prices.some(p => p.price === 2000000)).toBe(true);
      expect(result.prices.some(p => p.price === 3000000)).toBe(true);
    });

    it('should convert foreign currencies to Naira', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'International Prices',
          link: 'https://example.com',
          snippet: 'Price: $15,000 USD or £12,000 GBP', // Lower amounts to stay within vehicle range
          position: 1
        }
      ];

      const result = service.extractPrices(mockResults, 'vehicle');
      
      expect(result.prices.length).toBeGreaterThanOrEqual(2);
      // USD conversion: 15,000 * 1600 = 24,000,000 (valid vehicle price)
      expect(result.prices.some(p => p.price === 24000000)).toBe(true);
      // GBP conversion: 12,000 * 2000 = 24,000,000 (valid vehicle price)
      expect(result.prices.some(p => p.price === 24000000)).toBe(true);
    });

    it('should handle structured price data', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'Structured Price',
          link: 'https://example.com',
          snippet: 'Car for sale',
          position: 1,
          price: 25000000,
          currency: 'NGN'
        }
      ];

      const result = service.extractPrices(mockResults, 'vehicle');
      
      expect(result.prices).toHaveLength(1);
      expect(result.prices[0].price).toBe(25000000);
      expect(result.prices[0].confidence).toBeGreaterThan(85);
    });

    it('should filter out invalid prices for vehicle type', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'Invalid Prices',
          link: 'https://example.com',
          snippet: 'Car for ₦100 or ₦500,000,000,000', // Too low and too high
          position: 1
        }
      ];

      const result = service.extractPrices(mockResults, 'vehicle');
      
      expect(result.prices).toHaveLength(0); // Both prices should be filtered out
    });

    it('should calculate price statistics correctly', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'Multiple Prices',
          link: 'https://jiji.ng/test',
          snippet: '₦10,000,000 ₦20,000,000 ₦30,000,000',
          position: 1
        }
      ];

      const result = service.extractPrices(mockResults, 'vehicle');
      
      expect(result.averagePrice).toBe(20000000);
      expect(result.medianPrice).toBe(20000000);
      expect(result.priceRange?.min).toBe(10000000);
      expect(result.priceRange?.max).toBe(30000000);
    });

    it('should assign higher confidence to trusted sources', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'Jiji Price',
          link: 'https://jiji.ng/cars',
          snippet: '₦25,000,000',
          position: 1
        },
        {
          title: 'Unknown Source',
          link: 'https://unknown-site.com',
          snippet: '₦25,000,000',
          position: 2
        }
      ];

      const result = service.extractPrices(mockResults, 'vehicle');
      
      expect(result.prices).toHaveLength(2);
      const jijiPrice = result.prices.find(p => p.source.includes('jiji.ng'));
      const unknownPrice = result.prices.find(p => p.source.includes('unknown-site.com'));
      
      expect(jijiPrice?.confidence).toBeGreaterThan(unknownPrice?.confidence || 0);
    });

    it('should remove duplicate prices from same source', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'Duplicate Price 1',
          link: 'https://jiji.ng/car1',
          snippet: '₦25,000,000',
          position: 1
        },
        {
          title: 'Duplicate Price 2',
          link: 'https://jiji.ng/car2',
          snippet: '₦25,000,000', // Same price, same source
          position: 2
        }
      ];

      const result = service.extractPrices(mockResults, 'vehicle');
      
      expect(result.prices).toHaveLength(1); // Duplicate should be removed
    });

    it('should handle empty or invalid input gracefully', () => {
      const result = service.extractPrices([], 'vehicle');
      
      expect(result.prices).toHaveLength(0);
      expect(result.confidence).toBe(0);
      expect(result.averagePrice).toBeUndefined();
    });
  });

  describe('Price Validation', () => {
    it('should validate electronics prices correctly', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'iPhone Price',
          link: 'https://jumia.com.ng',
          snippet: 'iPhone 13 Pro ₦800,000', // Valid electronics price
          position: 1
        },
        {
          title: 'Invalid Electronics Price',
          link: 'https://example.com',
          snippet: 'Phone for ₦50', // Too low for electronics
          position: 2
        }
      ];

      const result = service.extractPrices(mockResults, 'electronics');
      
      expect(result.prices).toHaveLength(1);
      expect(result.prices[0].price).toBe(800000);
    });

    it('should validate appliance prices correctly', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'Refrigerator Price',
          link: 'https://konga.com',
          snippet: 'Samsung Fridge ₦150,000', // Valid appliance price
          position: 1
        }
      ];

      const result = service.extractPrices(mockResults, 'appliance');
      
      expect(result.prices).toHaveLength(1);
      expect(result.prices[0].price).toBe(150000);
    });
  });

  describe('Confidence Scoring', () => {
    it('should calculate higher confidence for consistent prices', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'Price 1',
          link: 'https://jiji.ng/1',
          snippet: '₦25,000,000',
          position: 1
        },
        {
          title: 'Price 2',
          link: 'https://cars45.com/2',
          snippet: '₦25,500,000', // Similar price
          position: 2
        }
      ];

      const result = service.extractPrices(mockResults, 'vehicle');
      
      expect(result.confidence).toBeGreaterThan(80); // Should be high due to consistency
    });
  });
});

describe('Singleton Export', () => {
  it('should export singleton instance', () => {
    expect(priceExtractor).toBeInstanceOf(PriceExtractionService);
  });
});