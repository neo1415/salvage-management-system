import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCachedPrice,
  setCachedPrice,
  markStale,
  generatePropertyHash,
} from '../../../src/features/market-data/services/cache.service';
import type { PropertyIdentifier, SourcePrice } from '../../../src/features/market-data/types';
import { db } from '../../../src/lib/db/drizzle';
import { marketDataCache, marketDataSources } from '../../../src/lib/db/schema/market-data';

/**
 * Cache Edge Cases Tests
 * 
 * Tests edge cases and error scenarios for cache operations
 * Requirements: 2.1-2.7
 */

describe('Cache Edge Cases', () => {
  beforeEach(async () => {
    await db.delete(marketDataSources);
    await db.delete(marketDataCache);
  });

  afterEach(async () => {
    await db.delete(marketDataSources);
    await db.delete(marketDataCache);
  });

  describe('Cache miss scenarios', () => {
    it('should return null for non-existent property', async () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'NonExistent',
        model: 'Ghost',
        year: 2099,
      };

      const result = await getCachedPrice(property);
      expect(result).toBeNull();
    });

    it('should return null for property with different case', async () => {
      const property1: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2015,
      };

      const property2: PropertyIdentifier = {
        type: 'vehicle',
        make: 'TOYOTA',
        model: 'CAMRY',
        year: 2015,
      };

      const prices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 3500000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test',
          listingTitle: 'Toyota Camry 2015',
          scrapedAt: new Date(),
        },
      ];

      await setCachedPrice(property1, prices);
      
      // Should find it because hash normalization handles case
      const result = await getCachedPrice(property2);
      expect(result).not.toBeNull();
      expect(result!.propertyDetails.make).toBe('Toyota');
    });

    it('should handle property with extra whitespace', async () => {
      const property1: PropertyIdentifier = {
        type: 'vehicle',
        make: '  Honda  ',
        model: '  Accord  ',
        year: 2018,
      };

      const property2: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Honda',
        model: 'Accord',
        year: 2018,
      };

      const prices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 4000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test',
          listingTitle: 'Honda Accord 2018',
          scrapedAt: new Date(),
        },
      ];

      await setCachedPrice(property1, prices);
      
      // Should find it because hash normalization trims whitespace
      const result = await getCachedPrice(property2);
      expect(result).not.toBeNull();
    });
  });

  describe('Concurrent cache updates', () => {
    it('should handle concurrent updates to same property', async () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Nissan',
        model: 'Altima',
        year: 2020,
      };

      const prices1: SourcePrice[] = [
        {
          source: 'jiji',
          price: 5000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test1',
          listingTitle: 'Nissan Altima 2020',
          scrapedAt: new Date(),
        },
      ];

      const prices2: SourcePrice[] = [
        {
          source: 'jumia',
          price: 5200000,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/test2',
          listingTitle: 'Nissan Altima 2020',
          scrapedAt: new Date(),
        },
      ];

      // Simulate concurrent updates
      await Promise.all([
        setCachedPrice(property, prices1),
        setCachedPrice(property, prices2),
      ]);

      // Should have one of the updates (last write wins)
      const result = await getCachedPrice(property);
      expect(result).not.toBeNull();
      expect(result!.prices.length).toBe(1);
    });

    it('should handle rapid sequential updates', { timeout: 15000 }, async () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Ford',
        model: 'Focus',
        year: 2019,
      };

      const updates = [
        [{ source: 'jiji', price: 3000000, currency: 'NGN', listingUrl: 'https://jiji.ng/1', listingTitle: 'Ford Focus', scrapedAt: new Date() }],
        [{ source: 'jumia', price: 3100000, currency: 'NGN', listingUrl: 'https://jumia.com/2', listingTitle: 'Ford Focus', scrapedAt: new Date() }],
        [{ source: 'cars45', price: 3200000, currency: 'NGN', listingUrl: 'https://cars45.com/3', listingTitle: 'Ford Focus', scrapedAt: new Date() }],
      ];

      for (const prices of updates) {
        await setCachedPrice(property, prices as SourcePrice[]);
      }

      const result = await getCachedPrice(property);
      expect(result).not.toBeNull();
      expect(result!.prices.length).toBe(1);
      expect(result!.prices[0].price).toBe(3200000);
    });
  });

  describe('Database connection failures', () => {
    it('should throw error when database is unavailable during get', async () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Test',
        model: 'Car',
        year: 2020,
      };

      // Mock database failure
      const originalSelect = db.select;
      vi.spyOn(db, 'select').mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(getCachedPrice(property)).rejects.toThrow('Failed to retrieve cached market data');

      // Restore
      db.select = originalSelect;
    });

    it('should throw error when database is unavailable during set', async () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Test',
        model: 'Car',
        year: 2020,
      };

      const prices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 1000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test',
          listingTitle: 'Test Car',
          scrapedAt: new Date(),
        },
      ];

      // Mock database failure
      const originalTransaction = db.transaction;
      vi.spyOn(db, 'transaction').mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(setCachedPrice(property, prices)).rejects.toThrow('Failed to store market data in cache');

      // Restore
      db.transaction = originalTransaction;
    });
  });

  describe('Edge case property identifiers', () => {
    it('should handle vehicle with only required fields', async () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Corolla',
        year: 2015,
      };

      const prices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 2500000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test',
          listingTitle: 'Toyota Corolla 2015',
          scrapedAt: new Date(),
        },
      ];

      await setCachedPrice(property, prices);
      const result = await getCachedPrice(property);

      expect(result).not.toBeNull();
      expect(result!.propertyDetails.make).toBe('Toyota');
      expect(result!.propertyDetails.mileage).toBeUndefined();
    });

    it('should handle vehicle with all optional fields', async () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'BMW',
        model: 'X5',
        year: 2020,
        mileage: 50000,
      };

      const prices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 15000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test',
          listingTitle: 'BMW X5 2020',
          scrapedAt: new Date(),
        },
      ];

      await setCachedPrice(property, prices);
      const result = await getCachedPrice(property);

      expect(result).not.toBeNull();
      expect(result!.propertyDetails.mileage).toBe(50000);
    });

    it('should handle electronics property', async () => {
      const property: PropertyIdentifier = {
        type: 'electronics',
        brand: 'Samsung',
        productModel: 'Galaxy S21',
        productType: 'smartphone',
      };

      const prices: SourcePrice[] = [
        {
          source: 'jumia',
          price: 350000,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/test',
          listingTitle: 'Samsung Galaxy S21',
          scrapedAt: new Date(),
        },
      ];

      await setCachedPrice(property, prices);
      const result = await getCachedPrice(property);

      expect(result).not.toBeNull();
      expect(result!.propertyType).toBe('electronics');
      expect(result!.propertyDetails.brand).toBe('Samsung');
    });

    it('should handle building property', async () => {
      const property: PropertyIdentifier = {
        type: 'building',
        location: 'Lagos',
        propertyType: 'apartment',
        size: 120,
        bedrooms: 3,
      };

      const prices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 50000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test',
          listingTitle: '3 Bedroom Apartment Lagos',
          scrapedAt: new Date(),
        },
      ];

      await setCachedPrice(property, prices);
      const result = await getCachedPrice(property);

      expect(result).not.toBeNull();
      expect(result!.propertyType).toBe('building');
      expect(result!.propertyDetails.bedrooms).toBe(3);
    });
  });

  describe('Price edge cases', () => {
    it('should handle single price', async () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Mazda',
        model: 'CX-5',
        year: 2021,
      };

      const prices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 8000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test',
          listingTitle: 'Mazda CX-5 2021',
          scrapedAt: new Date(),
        },
      ];

      await setCachedPrice(property, prices);
      const result = await getCachedPrice(property);

      expect(result).not.toBeNull();
      expect(result!.medianPrice).toBe(8000000);
      expect(result!.prices.length).toBe(1);
    });

    it('should handle very large prices', async () => {
      const property: PropertyIdentifier = {
        type: 'building',
        location: 'Ikoyi',
        propertyType: 'mansion',
        size: 500,
      };

      const prices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 500000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test',
          listingTitle: 'Luxury Mansion Ikoyi',
          scrapedAt: new Date(),
        },
      ];

      await setCachedPrice(property, prices);
      const result = await getCachedPrice(property);

      expect(result).not.toBeNull();
      expect(result!.medianPrice).toBe(500000000);
    });

    it('should handle prices with decimals', async () => {
      const property: PropertyIdentifier = {
        type: 'electronics',
        brand: 'Apple',
        productModel: 'iPhone 13',
        productType: 'smartphone',
      };

      const prices: SourcePrice[] = [
        {
          source: 'jumia',
          price: 450000.50,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/test',
          listingTitle: 'iPhone 13',
          scrapedAt: new Date(),
        },
      ];

      await setCachedPrice(property, prices);
      const result = await getCachedPrice(property);

      expect(result).not.toBeNull();
      expect(result!.medianPrice).toBeCloseTo(450000.50, 2);
    });
  });

  describe('Hash generation edge cases', () => {
    it('should generate different hashes for different makes', async () => {
      const property1: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2015,
      };

      const property2: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Honda',
        model: 'Camry',
        year: 2015,
      };

      const hash1 = generatePropertyHash(property1);
      const hash2 = generatePropertyHash(property2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hashes for different years', async () => {
      const property1: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2015,
      };

      const property2: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2016,
      };

      const hash1 = generatePropertyHash(property1);
      const hash2 = generatePropertyHash(property2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hashes for different property types', async () => {
      const property1: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2015,
      };

      const property2: PropertyIdentifier = {
        type: 'electronics',
        brand: 'Toyota',
        productModel: 'Camry',
      };

      const hash1 = generatePropertyHash(property1);
      const hash2 = generatePropertyHash(property2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Mark stale functionality', () => {
    it('should mark existing cache entry as stale', async () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Hyundai',
        model: 'Elantra',
        year: 2019,
      };

      const prices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 3500000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test',
          listingTitle: 'Hyundai Elantra 2019',
          scrapedAt: new Date(),
        },
      ];

      await setCachedPrice(property, prices);
      const cached = await getCachedPrice(property);
      expect(cached).not.toBeNull();

      const propertyHash = generatePropertyHash(property);
      await markStale(propertyHash);

      // Verify staleAt was updated (should be in the past now)
      const updated = await getCachedPrice(property);
      expect(updated).not.toBeNull();
      expect(updated!.staleAt.getTime()).toBeLessThan(new Date().getTime());
    });

    it('should not throw error when marking non-existent entry as stale', async () => {
      const propertyHash = 'nonexistent-hash-12345';
      
      // Should not throw
      await expect(markStale(propertyHash)).resolves.not.toThrow();
    });
  });
});
