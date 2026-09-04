/**
 * Unit tests for Price Extraction Service
 */

import { describe, it, expect, vi } from 'vitest';
import { 
  PriceExtractionService, 
  priceExtractor 
} from '@/features/internet-search/services/price-extraction.service';
import type { SerperSearchResult } from '@/lib/integrations/serper-api';
import type { ItemIdentifier } from '@/features/internet-search/services/query-builder.service';

// Default valuation policy is pure; its live policy dependency must never load a DB.
vi.mock('@/features/business-policy/business-policy.service', () => ({
  businessPolicyService: { getEffectivePolicy: vi.fn(() => { throw new Error('Live policy access forbidden in price extraction tests'); }) },
}));

const listing = (snippet: string, extra: Partial<SerperSearchResult> = {}): SerperSearchResult => ({
  title: 'Asset for sale', link: 'https://jiji.ng/listing', snippet, position: 1, ...extra,
});

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

    it('rejects multiple listing amounts instead of treating them as comparable assets', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'Car Prices',
          link: 'https://example.com',
          snippet: 'Toyota Camry ₦2.5m, Honda Accord ₦500k',
          position: 1
        }
      ];

      const result = service.extractPrices(mockResults, 'vehicle');
      
      expect(result.prices).toHaveLength(0);
      expect(result.rejectedPrices?.map(p => p.price)).toEqual([2500000, 500000]);
      expect(result.rejectedPrices?.every(p => /ambiguous/i.test(p.rejectionReason))).toBe(true);
    });

    it('does not choose between conflicting price formats in one listing', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'Various Price Formats',
          link: 'https://jiji.ng/test',
          snippet: '₦1,500,000 or NGN 2000000 or 3 million naira',
          position: 1
        }
      ];

      const result = service.extractPrices(mockResults, 'vehicle');
      
      expect(result.prices).toHaveLength(0);
      expect(result.rejectedPrices?.map(p => p.price)).toEqual([1500000, 2000000, 3000000]);
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
      
      expect(result.prices).toHaveLength(1);
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
      const result = service.extractPrices([10000000, 20000000, 30000000].map((price, index) =>
        listing(`NGN ${price}`, { link: `https://jiji.ng/asset-${index}` })), 'vehicle');

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
    it.each([
      ['vehicle', 'N8.4m', 8400000],
      ['electronics', 'NGN 420 thousand', 420000],
      ['appliance', '450k naira', 450000],
      ['machinery', 'N42 million', 42000000],
      ['property', '1.25 billion naira', 1250000000],
      ['scrap', 'NGN 8,400.125', 8400.125],
      ['building_materials', 'N1,250k', 1250000],
      ['agriculture', 'N8.4m', 8400000],
      ['equipment', 'US$8.4m', 84000000],
      ['machinery', 'GBP 42 thousand', 840000],
      ['electronics', '1.25k EUR', 37500],
      ['property', 'EUR 1.2 million', 36000000],
      ['vehicle', 'N8-9m', 8500000],
      ['electronics', '350-450 thousand naira', 400000],
      ['machinery', '$80k - $100k', 900000],
      ['vehicle', 'N800,000 - N1m', 900000],
    ] as const)('parses one complete %s amount: %s', (type, text, expected) => {
      const result = service.extractPrices([listing(text)], type, undefined, {
        exchangeRates: { USD: 10, GBP: 20, EUR: 30 },
      });
      expect(result.prices.map(p => p.price)).toEqual([expected]);
      expect(result.rejectedPrices).toEqual([]);
    });

    it.each(['N8.4m', 'N8400000', '8.4 million naira'])('does not produce hidden partial matches for %s', text => {
      const result = service.extractPrices([listing(text)], 'agriculture');
      expect([...result.prices, ...(result.rejectedPrices || [])].map(p => p.price)).toEqual([8400000]);
    });

    it.each(['C$8.4m', 'CA$8.4m', 'A$8.4m', 'CAD $8.4m', '$8.4m CAD', 'CAD 8400000', '8400000 CAD', 'JPY 8400000', 'INR 8400000', 'GHS 8400000', 'VIN8400000', 'N8,40,000', 'N8.4millionaire', '-N8400000', 'N8m - $9m'])('does not invent NGN or a partial supported amount from %s', text => {
      const result = service.extractPrices([listing(text)]);
      expect(result.prices).toEqual([]);
      expect(result.rejectedPrices).toEqual([]);
    });

    it.each(['CAD', 'AUD', 'JPY', 'GHS', 'KES', 'unknown'])('ignores unsupported structured currency %s', currency => {
      expect(service.extractPrices([listing('Price on request', { price: 8400000, currency })]).prices).toEqual([]);
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('does not replace invalid explicit exchange rate %s with a default', rate => {
      const result = service.extractPrices([listing('$8.4m', { price: 8400000, currency: 'USD' })], undefined, undefined, {
        exchangeRates: { USD: rate },
      });
      expect(result.prices).toEqual([]);
    });

    it('normalizes structured currencies and deduplicates equivalent title, snippet and structured prices', () => {
      const result = service.extractPrices([listing('N8.4m', {
        title: 'Asset NGN 8,400,000', price: 8400000, currency: ' ngn ',
      })]);
      expect(result.prices.map(p => p.price)).toEqual([8400000]);
      expect(result.rejectedPrices).toEqual([]);
    });

    it.each(['vehicle', 'electronics', 'appliance', 'machinery', 'property', 'scrap', 'agriculture', 'building_materials'] as const)(
      'rejects ambiguous %s amounts before bounds can hide one candidate', type => {
        const result = service.extractPrices([listing('N8.4m and N8.4')], type);
        expect(result.prices).toEqual([]);
        expect(result.rejectedPrices?.map(p => p.price)).toEqual([8400000, 8.4]);
        expect(result.rejectedPrices?.every(p => /ambiguous/i.test(p.rejectionReason))).toBe(true);
      }
    );

    it('rejects conflicting title and structured amounts without using either as authority', () => {
      const result = service.extractPrices([listing('N8.4m', {
        title: 'Other model N9m', price: 10000000, currency: 'NGN',
      })]);
      expect(result.prices).toEqual([]);
      expect(result.rejectedPrices).toHaveLength(3);
    });

    it.each(['Deposit N840000', 'N840000 refundable deposit', 'Downpayment N840000', 'N840000 monthly', 'N840000/month'])('rejects partial payments without an item identity: %s', text => {
      const result = service.extractPrices([listing(text)]);
      expect(result.prices).toEqual([]);
      expect(result.rejectedPrices?.[0].rejectionReason).toMatch(/deposit|installment/);
    });

    it.each(['stock', 'goods_in_transit', 'building_materials', 'scrap', 'agriculture'] as const)(
      'uses explicit price denominators, not packaging mentions, for %s', type => {
        const item = { type, description: 'yellow maize grain', quantity: '50', unitOfMeasure: 'bags' } as ItemIdentifier;
        const result = service.extractPrices([
          listing('Yellow maize grain 50 kg bags N85000 per bag'),
          listing('Yellow maize grain packed in bags N900000/tonne', { link: 'https://jiji.ng/tonne' }),
        ], type, undefined, { item });
        expect(result.prices.map(p => p.price)).toEqual([85000]);
        expect(result.rejectedPrices?.[0].rejectionReason).toMatch(/unit/);
      }
    );

    it.each(['per 20 bags', 'per truck', '/kg', 'per tonne or per bag'])(
      'rejects ambiguous or incompatible bulk price denominator %s', denominator => {
        const result = service.extractPrices([listing(`Yellow maize grain in bags N85000 ${denominator}`)], 'agriculture', undefined, {
          item: { type: 'agriculture', description: 'yellow maize grain', quantity: '50', unitOfMeasure: 'bags' },
        });
        expect(result.prices).toEqual([]);
        expect(result.rejectedPrices?.[0].rejectionReason).toMatch(/unit/);
      }
    );

    it('uses one midpoint for a formatted price range without double-counting endpoints', () => {
      const result = service.extractPrices([{
        title: 'Fairly used Apple iPhone 12 128GB',
        link: 'https://example.ng/iphone-12-range',
        snippet: 'Fairly used iPhone 12 128GB: ₦350k - ₦450k depending on condition',
        position: 1,
      }], 'electronics', undefined, {
        item: { type: 'electronics', brand: 'Apple', model: 'iPhone 12', storageCapacity: '128GB', condition: 'Heavily Used' },
      });

      expect(result.prices).toHaveLength(1);
      expect(result.prices[0].price).toBe(400000);
      expect(result.prices[0].originalText).toContain('range midpoint');
    });

    it('rejects installment amounts and ambiguous new-or-used inventory', () => {
      const item = { type: 'electronics' as const, brand: 'Apple', model: 'iPhone 12', condition: 'Heavily Used' as const };
      const result = service.extractPrices([
        {
          title: 'Apple iPhone 12 on installment',
          link: 'https://example.ng/installment',
          snippet: 'Pay ₦75,000 per month for iPhone 12',
          position: 1,
        },
        {
          title: 'Apple iPhone 12 new and used available',
          link: 'https://example.ng/mixed-condition',
          snippet: 'Brand new and fairly used iPhone 12 from ₦500,000',
          position: 2,
        },
      ], 'electronics', undefined, { item });

      expect(result.prices).toHaveLength(0);
      expect(result.rejectedPrices?.some((entry) => entry.rejectionReason.includes('installment'))).toBe(true);
      expect(result.rejectedPrices?.some((entry) => entry.rejectionReason.includes('ambiguous'))).toBe(true);
    });

    it('rejects rent as property sale value', () => {
      const result = service.extractPrices([{
        title: '3 bedroom detached house for rent in Lekki',
        link: 'https://property.example.ng/lekki-rent',
        snippet: 'Annual rent ₦8,000,000 per year',
        position: 1,
      }], 'property', undefined, {
        item: { type: 'property', propertyType: 'detached house', location: 'Lekki Lagos', bedrooms: 3, condition: 'Nigerian Used' },
      });

      expect(result.prices).toHaveLength(0);
      expect(result.rejectedPrices?.some((entry) => entry.rejectionReason.includes('Rental'))).toBe(true);
    });

    it('matches description-only bulk assets and rejects incompatible unit prices', () => {
      const item = {
        type: 'agriculture' as const,
        description: 'yellow maize grain',
        quantity: '50',
        unitOfMeasure: 'bags',
      };
      const result = service.extractPrices([
        {
          title: 'Yellow maize grain price per bag',
          link: 'https://commodities.example.ng/maize-bag',
          snippet: 'Yellow maize grain ₦85,000 per bag',
          position: 1,
        },
        {
          title: 'Yellow maize grain wholesale per tonne',
          link: 'https://commodities.example.ng/maize-tonne',
          snippet: 'Yellow maize grain ₦900,000 per tonne',
          position: 2,
        },
        {
          title: 'White rice price per bag',
          link: 'https://commodities.example.ng/rice',
          snippet: 'White rice ₦95,000 per bag',
          position: 3,
        },
      ], 'agriculture', undefined, { item });

      expect(result.prices.map((entry) => entry.price)).toEqual([85000]);
      expect(result.rejectedPrices?.some((entry) => entry.price === 900000 && entry.rejectionReason.includes('unit'))).toBe(true);
      expect(result.rejectedPrices?.some((entry) => entry.price === 95000 && entry.rejectionReason.includes('description'))).toBe(true);
    });

    it('keeps an exact fairly-used iPhone 12 listing and rejects newer variants, new stock, and accessories', () => {
      const mockResults: SerperSearchResult[] = [
        {
          title: 'Fairly used Apple iPhone 12 128GB',
          link: 'https://jiji.ng/mobile-phones/iphone-12',
          snippet: 'Clean fairly used iPhone 12 128GB for ₦420,000',
          position: 1,
        },
        {
          title: 'Apple iPhone 15 Pro Max 256GB',
          link: 'https://store.example.ng/iphone-15-pro-max',
          snippet: 'Used iPhone 15 Pro Max for ₦3,000,000',
          position: 2,
        },
        {
          title: 'Brand new Apple iPhone 12 128GB sealed pack',
          link: 'https://store.example.ng/new-iphone-12',
          snippet: 'Brand new iPhone 12 128GB for ₦950,000',
          position: 3,
        },
        {
          title: 'iPhone 12 replacement screen',
          link: 'https://parts.example.ng/iphone-12-screen',
          snippet: 'Replacement screen only ₦180,000',
          position: 4,
        },
      ];

      const result = service.extractPrices(mockResults, 'electronics', undefined, {
        item: {
          type: 'electronics',
          brand: 'Apple',
          model: 'iPhone 12',
          storageCapacity: '128GB',
          condition: 'Heavily Used',
        },
      });

      expect(result.prices.map((entry) => entry.price)).toEqual([420000]);
      expect(result.rejectedPrices?.some((entry) => entry.price === 3000000 && entry.rejectionReason.includes('generation'))).toBe(true);
      expect(result.rejectedPrices?.some((entry) => entry.price === 950000 && entry.rejectionReason.toLowerCase().includes('brand-new'))).toBe(true);
      expect(result.rejectedPrices?.some((entry) => entry.price === 180000 && entry.rejectionReason.includes('accessory'))).toBe(true);
    });

    it('rejects mismatched appliance and machinery models before calculating a market median', () => {
      const appliance = service.extractPrices([{
        title: 'Samsung RT38 refrigerator used',
        link: 'https://example.ng/rt38',
        snippet: 'Samsung RT38 used fridge ₦480,000',
        position: 1,
      }], 'appliance', undefined, {
        item: { type: 'appliance', brand: 'LG', model: 'GC-B459', condition: 'Nigerian Used' },
      });

      const machinery = service.extractPrices([{
        title: 'CAT 320 excavator used',
        link: 'https://example.ng/cat-320',
        snippet: 'CAT 320 excavator ₦42,000,000',
        position: 1,
      }], 'machinery', undefined, {
        item: { type: 'machinery', brand: 'Komatsu', machineryType: 'Excavator', model: 'PC200', condition: 'Nigerian Used' },
      });

      expect(appliance.prices).toHaveLength(0);
      expect(machinery.prices).toHaveLength(0);
    });

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
