/**
 * Unit tests for Internet Search Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InternetSearchService } from '@/features/internet-search/services/internet-search.service';

describe('InternetSearchService Unit Tests', () => {
  let service: InternetSearchService;

  beforeEach(() => {
    service = new InternetSearchService();
  });

  describe('Constructor and Initialization', () => {
    it('should create service instance', () => {
      expect(service).toBeInstanceOf(InternetSearchService);
    });

    it('should have all required methods', () => {
      expect(typeof service.searchMarketPrice).toBe('function');
      expect(typeof service.searchPartPrice).toBe('function');
      expect(typeof service.searchMultiplePartPrices).toBe('function');
      expect(typeof service.getAggregatedMarketPrice).toBe('function');
      expect(typeof service.healthCheck).toBe('function');
    });
  });

  describe('getCommonPartsForVehicle (private method behavior)', () => {
    it('should return empty array for non-vehicle items', async () => {
      // Test indirectly through getAggregatedMarketPrice
      const mockSearchMarketPrice = vi.spyOn(service, 'searchMarketPrice').mockResolvedValue({
        priceData: {
          prices: [],
          confidence: 80,
          currency: 'NGN',
          extractedAt: new Date()
        },
        query: 'test query',
        resultsProcessed: 0,
        executionTime: 100,
        dataSource: 'internet_search',
        success: true
      });

      const mockSearchMultiplePartPrices = vi.spyOn(service, 'searchMultiplePartPrices').mockResolvedValue([]);

      await service.getAggregatedMarketPrice(
        {
          type: 'electronics',
          brand: 'Apple',
          model: 'iPhone 13',
          condition: 'excellent'
        },
        { includePartPrices: true }
      );

      // Should not call searchMultiplePartPrices for non-vehicle items
      expect(mockSearchMultiplePartPrices).not.toHaveBeenCalled();
      
      mockSearchMarketPrice.mockRestore();
      mockSearchMultiplePartPrices.mockRestore();
    });

    it('should include part searches for vehicle items', async () => {
      const mockSearchMarketPrice = vi.spyOn(service, 'searchMarketPrice').mockResolvedValue({
        priceData: {
          prices: [],
          confidence: 80,
          currency: 'NGN',
          extractedAt: new Date()
        },
        query: 'test query',
        resultsProcessed: 0,
        executionTime: 100,
        dataSource: 'internet_search',
        success: true
      });

      const mockSearchMultiplePartPrices = vi.spyOn(service, 'searchMultiplePartPrices').mockResolvedValue([
        {
          partName: 'windshield',
          priceData: {
            prices: [],
            confidence: 70,
            currency: 'NGN',
            extractedAt: new Date()
          },
          query: 'windshield price',
          resultsProcessed: 0,
          executionTime: 50,
          dataSource: 'internet_search',
          success: true
        }
      ]);

      await service.getAggregatedMarketPrice(
        {
          type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          condition: 'excellent'
        },
        { includePartPrices: true }
      );

      // Should call searchMultiplePartPrices for vehicle items
      expect(mockSearchMultiplePartPrices).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'vehicle' }),
        expect.arrayContaining([
          expect.objectContaining({ name: 'windshield' }),
          expect.objectContaining({ name: 'headlight' }),
          expect.objectContaining({ name: 'bumper' }),
          expect.objectContaining({ name: 'side mirror' })
        ]),
        expect.any(Object)
      );
      
      mockSearchMarketPrice.mockRestore();
      mockSearchMultiplePartPrices.mockRestore();
    });
  });

  describe('Confidence Calculation Logic', () => {
    it('should calculate aggregated confidence correctly with part prices', async () => {
      const mockSearchMarketPrice = vi.spyOn(service, 'searchMarketPrice').mockResolvedValue({
        priceData: {
          prices: [],
          confidence: 80,
          currency: 'NGN',
          extractedAt: new Date(),
          averagePrice: 45000000
        },
        query: 'test query',
        resultsProcessed: 1,
        executionTime: 100,
        dataSource: 'internet_search',
        success: true
      });

      const mockSearchMultiplePartPrices = vi.spyOn(service, 'searchMultiplePartPrices').mockResolvedValue([
        {
          partName: 'windshield',
          priceData: {
            prices: [],
            confidence: 70,
            currency: 'NGN',
            extractedAt: new Date()
          },
          query: 'windshield price',
          resultsProcessed: 1,
          executionTime: 50,
          dataSource: 'internet_search',
          success: true
        },
        {
          partName: 'headlight',
          priceData: {
            prices: [],
            confidence: 60,
            currency: 'NGN',
            extractedAt: new Date()
          },
          query: 'headlight price',
          resultsProcessed: 1,
          executionTime: 50,
          dataSource: 'internet_search',
          success: true
        }
      ]);

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

      // Aggregated confidence should be average of market (80) and parts average (65) = 72.5 rounded to 73
      expect(result.aggregatedConfidence).toBe(73);
      expect(result.recommendedPrice).toBe(45000000);
      
      mockSearchMarketPrice.mockRestore();
      mockSearchMultiplePartPrices.mockRestore();
    });

    it('should use market confidence when no part prices available', async () => {
      const mockSearchMarketPrice = vi.spyOn(service, 'searchMarketPrice').mockResolvedValue({
        priceData: {
          prices: [],
          confidence: 85,
          currency: 'NGN',
          extractedAt: new Date(),
          averagePrice: 850000
        },
        query: 'test query',
        resultsProcessed: 1,
        executionTime: 100,
        dataSource: 'internet_search',
        success: true
      });

      const result = await service.getAggregatedMarketPrice(
        {
          type: 'electronics',
          brand: 'Apple',
          model: 'iPhone 13',
          condition: 'excellent'
        },
        { includePartPrices: false }
      );

      expect(result.aggregatedConfidence).toBe(85);
      expect(result.recommendedPrice).toBe(850000);
      
      mockSearchMarketPrice.mockRestore();
    });
  });

  describe('Price Recommendation Logic', () => {
    it('should use average price for high confidence results', async () => {
      const mockSearchMarketPrice = vi.spyOn(service, 'searchMarketPrice').mockResolvedValue({
        priceData: {
          prices: [],
          confidence: 80,
          currency: 'NGN',
          extractedAt: new Date(),
          averagePrice: 1000000,
          medianPrice: 950000
        },
        query: 'test query',
        resultsProcessed: 1,
        executionTime: 100,
        dataSource: 'internet_search',
        success: true
      });

      const result = await service.getAggregatedMarketPrice(
        {
          type: 'electronics',
          brand: 'Samsung',
          model: 'Galaxy S21',
          condition: 'excellent'
        }
      );

      expect(result.recommendedPrice).toBe(1000000); // Should use average price
      
      mockSearchMarketPrice.mockRestore();
    });

    it('should use median price for low confidence results', async () => {
      const mockSearchMarketPrice = vi.spyOn(service, 'searchMarketPrice').mockResolvedValue({
        priceData: {
          prices: [],
          confidence: 30, // Low confidence
          currency: 'NGN',
          extractedAt: new Date(),
          averagePrice: 1000000,
          medianPrice: 950000
        },
        query: 'test query',
        resultsProcessed: 1,
        executionTime: 100,
        dataSource: 'internet_search',
        success: true
      });

      const result = await service.getAggregatedMarketPrice(
        {
          type: 'electronics',
          brand: 'Samsung',
          model: 'Galaxy S21',
          condition: 'excellent'
        }
      );

      expect(result.recommendedPrice).toBe(950000); // Should use median price for low confidence
      
      mockSearchMarketPrice.mockRestore();
    });

    it('should handle missing price data gracefully', async () => {
      const mockSearchMarketPrice = vi.spyOn(service, 'searchMarketPrice').mockResolvedValue({
        priceData: {
          prices: [],
          confidence: 0,
          currency: 'NGN',
          extractedAt: new Date()
          // No averagePrice or medianPrice
        },
        query: 'test query',
        resultsProcessed: 0,
        executionTime: 100,
        dataSource: 'internet_search',
        success: false,
        error: 'No results found'
      });

      const result = await service.getAggregatedMarketPrice(
        {
          type: 'electronics',
          brand: 'UnknownBrand',
          model: 'UnknownModel',
          condition: 'excellent'
        }
      );

      expect(result.recommendedPrice).toBeUndefined();
      expect(result.aggregatedConfidence).toBe(0);
      
      mockSearchMarketPrice.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle search method failures gracefully', async () => {
      const mockSearchMarketPrice = vi.spyOn(service, 'searchMarketPrice').mockRejectedValue(
        new Error('Network error')
      );

      await expect(service.getAggregatedMarketPrice(
        {
          type: 'vehicle',
          make: 'Toyota',
          model: 'Camry',
          year: 2021,
          condition: 'excellent'
        }
      )).rejects.toThrow('Network error');
      
      mockSearchMarketPrice.mockRestore();
    });

    it('should handle partial part search failures', async () => {
      const mockSearchMarketPrice = vi.spyOn(service, 'searchMarketPrice').mockResolvedValue({
        priceData: {
          prices: [],
          confidence: 80,
          currency: 'NGN',
          extractedAt: new Date(),
          averagePrice: 45000000
        },
        query: 'test query',
        resultsProcessed: 1,
        executionTime: 100,
        dataSource: 'internet_search',
        success: true
      });

      const mockSearchMultiplePartPrices = vi.spyOn(service, 'searchMultiplePartPrices').mockResolvedValue([
        {
          partName: 'windshield',
          priceData: {
            prices: [],
            confidence: 70,
            currency: 'NGN',
            extractedAt: new Date()
          },
          query: 'windshield price',
          resultsProcessed: 1,
          executionTime: 50,
          dataSource: 'internet_search',
          success: true
        },
        {
          partName: 'headlight',
          priceData: {
            prices: [],
            confidence: 0,
            currency: 'NGN',
            extractedAt: new Date()
          },
          query: 'headlight price',
          resultsProcessed: 0,
          executionTime: 50,
          dataSource: 'internet_search',
          success: false,
          error: 'Part search failed'
        }
      ]);

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

      // Should still work with partial part search failures
      expect(result.marketPrice.success).toBe(true);
      expect(result.partPrices).toHaveLength(2);
      expect(result.partPrices![0].success).toBe(true);
      expect(result.partPrices![1].success).toBe(false);
      
      mockSearchMarketPrice.mockRestore();
      mockSearchMultiplePartPrices.mockRestore();
    });
  });

  describe('Input Validation', () => {
    it('should handle various item types correctly', async () => {
      const mockSearchMarketPrice = vi.spyOn(service, 'searchMarketPrice').mockResolvedValue({
        priceData: {
          prices: [],
          confidence: 75,
          currency: 'NGN',
          extractedAt: new Date(),
          averagePrice: 500000
        },
        query: 'test query',
        resultsProcessed: 1,
        executionTime: 100,
        dataSource: 'internet_search',
        success: true
      });

      const itemTypes = [
        { type: 'vehicle' as const, make: 'Toyota', model: 'Camry', year: 2021, condition: 'excellent' as const },
        { type: 'electronics' as const, brand: 'Apple', model: 'iPhone 13', condition: 'excellent' as const },
        { type: 'appliance' as const, brand: 'Samsung', model: 'Refrigerator', condition: 'good' as const }
      ];

      for (const item of itemTypes) {
        const result = await service.getAggregatedMarketPrice(item);
        expect(result.marketPrice.success).toBe(true);
        expect(result.aggregatedConfidence).toBe(75);
      }
      
      mockSearchMarketPrice.mockRestore();
    });
  });
});