import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import {
  generatePropertyHash,
  isStale,
  getCacheAge,
  getCachedPrice,
  setCachedPrice,
} from '../../../src/features/market-data/services/cache.service';
import type { PropertyIdentifier, SourcePrice } from '../../../src/features/market-data/types';
import { db } from '../../../src/lib/db/drizzle';
import { marketDataCache, marketDataSources } from '../../../src/lib/db/schema/market-data';

/**
 * Property 7: Scraping persistence
 * Feature: market-data-scraping-system
 * Validates: Requirements 2.1, 2.2
 * 
 * For any successful scrape operation, the pricing data should be stored 
 * in the PostgreSQL database with a valid timestamp
 */

/**
 * Property 8: Fresh cache usage
 * Feature: market-data-scraping-system
 * Validates: Requirements 2.3
 * 
 * For any cached data less than 7 days old, requesting market price should 
 * return cached data without initiating new scraping
 */

/**
 * Property 9: Stale data detection
 * Feature: market-data-scraping-system
 * Validates: Requirements 2.4
 * 
 * For any cached data older than 7 days, the system should mark it as stale
 */

describe('Cache Operations Property Tests', () => {
  // Clean up test data before and after each test
  beforeEach(async () => {
    try {
      // Delete all test data before each test
      await db.delete(marketDataSources);
      await db.delete(marketDataCache);
    } catch (error) {
      console.error('Before cleanup error:', error);
    }
  });

  afterEach(async () => {
    try {
      // Delete all test data after each test
      await db.delete(marketDataSources);
      await db.delete(marketDataCache);
    } catch (error) {
      console.error('After cleanup error:', error);
    }
  });

  // Arbitraries for property-based testing
  const vehicleArbitrary = fc.record({
    type: fc.constant('vehicle' as const),
    make: fc.stringMatching(/^[A-Z][a-z]{2,19}$/),
    model: fc.stringMatching(/^[A-Z][a-z0-9]{2,19}$/),
    year: fc.integer({ min: 2000, max: new Date().getFullYear() }),
  });

  const priceArbitrary = fc.record({
    source: fc.constantFrom('jiji', 'jumia', 'cars45', 'cheki'),
    price: fc.integer({ min: 100000, max: 50000000 }),
    currency: fc.constant('NGN'),
    listingUrl: fc.constantFrom(
      'https://jiji.ng/listing-1',
      'https://jumia.com.ng/listing-2',
      'https://cars45.com/listing-3',
      'https://cheki.com.ng/listing-4'
    ),
    listingTitle: fc.stringMatching(/^[A-Z][a-zA-Z0-9 ]{9,99}$/),
    scrapedAt: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
  });

  const pricesArrayArbitrary = fc.array(priceArbitrary, { minLength: 1, maxLength: 3 });

  describe('Property 7: Scraping persistence', () => {
    test.prop([vehicleArbitrary, pricesArrayArbitrary], { numRuns: 100, timeout: 120000 })(
      'should store pricing data with valid timestamp',
      async (property, prices) => {
        const beforeStore = new Date();
        
        await setCachedPrice(property, prices);
        
        const afterStore = new Date();
        const cached = await getCachedPrice(property);

        expect(cached).not.toBeNull();
        expect(cached!.prices.length).toBe(prices.length);
        expect(cached!.scrapedAt).toBeInstanceOf(Date);
        expect(cached!.scrapedAt.getTime()).toBeGreaterThanOrEqual(beforeStore.getTime());
        expect(cached!.scrapedAt.getTime()).toBeLessThanOrEqual(afterStore.getTime());
      }
    );

    test.prop([vehicleArbitrary, pricesArrayArbitrary], { numRuns: 100, timeout: 120000 })(
      'should persist all source prices',
      async (property, prices) => {
        await setCachedPrice(property, prices);
        const cached = await getCachedPrice(property);

        expect(cached).not.toBeNull();
        expect(cached!.prices.length).toBe(prices.length);
        
        // Verify each price was stored
        for (const originalPrice of prices) {
          const found = cached!.prices.find(
            (p) => p.source === originalPrice.source && 
                   Math.abs(p.price - originalPrice.price) < 0.01
          );
          expect(found).toBeDefined();
        }
      }
    );
  });

  describe('Property 8: Fresh cache usage', () => {
    test.prop([vehicleArbitrary, pricesArrayArbitrary], { numRuns: 100, timeout: 120000 })(
      'should return cached data for fresh cache (< 7 days)',
      async (property, prices) => {
        // Store data
        await setCachedPrice(property, prices);
        
        // Retrieve immediately (should be fresh)
        const cached = await getCachedPrice(property);

        expect(cached).not.toBeNull();
        expect(cached!.isStale).toBe(false);
        expect(getCacheAge(cached!.scrapedAt)).toBeLessThan(7);
      }
    );

    it('should mark data as fresh when less than 7 days old', () => {
      const now = new Date();
      const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      
      expect(isStale(sixDaysAgo)).toBe(false);
      expect(getCacheAge(sixDaysAgo)).toBe(6);
    });

    it('should mark data as fresh on day 7 boundary', () => {
      const now = new Date();
      const almostSevenDays = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000 - 1000));
      
      expect(isStale(almostSevenDays)).toBe(false);
    });
  });

  describe('Property 9: Stale data detection', () => {
    it('should mark data as stale when exactly 7 days old', () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 - 1000);
      
      expect(isStale(sevenDaysAgo)).toBe(true);
      expect(getCacheAge(sevenDaysAgo)).toBeGreaterThanOrEqual(7);
    });

    it('should mark data as stale when older than 7 days', () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      
      expect(isStale(tenDaysAgo)).toBe(true);
      expect(getCacheAge(tenDaysAgo)).toBe(10);
    });

    it('should mark data as stale when 30 days old', () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      expect(isStale(thirtyDaysAgo)).toBe(true);
      expect(getCacheAge(thirtyDaysAgo)).toBe(30);
    });

    test.prop([
      fc.integer({ min: 8, max: 365 })
    ], { numRuns: 100 })(
      'should mark data as stale for any age > 7 days',
      (daysOld) => {
        const now = new Date();
        const oldDate = new Date(now.getTime() - daysOld * 24 * 60 * 60 * 1000);
        
        expect(isStale(oldDate)).toBe(true);
        expect(getCacheAge(oldDate)).toBeGreaterThanOrEqual(7);
      }
    );
  });

  describe('Property hash generation', () => {
    test.prop([vehicleArbitrary], { numRuns: 100 })(
      'should generate consistent hash for same property',
      (property) => {
        const hash1 = generatePropertyHash(property);
        const hash2 = generatePropertyHash(property);
        
        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
      }
    );

    test.prop([vehicleArbitrary], { numRuns: 100 })(
      'should generate same hash regardless of case',
      (property) => {
        const hash1 = generatePropertyHash(property);
        
        const upperCaseProperty = {
          ...property,
          make: property.make?.toUpperCase(),
          model: property.model?.toUpperCase(),
        };
        
        const hash2 = generatePropertyHash(upperCaseProperty);
        
        expect(hash1).toBe(hash2);
      }
    );

    it('should generate different hashes for different properties', () => {
      const property1: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
        year: 2015,
      };

      const property2: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Honda',
        model: 'Accord',
        year: 2015,
      };

      const hash1 = generatePropertyHash(property1);
      const hash2 = generatePropertyHash(property2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Unit tests for cache operations', () => {
    it('should store and retrieve vehicle market data', async () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Camry',
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
        {
          source: 'cars45',
          price: 3800000,
          currency: 'NGN',
          listingUrl: 'https://cars45.com/test',
          listingTitle: 'Toyota Camry 2015',
          scrapedAt: new Date(),
        },
      ];

      await setCachedPrice(property, prices);
      const cached = await getCachedPrice(property);

      expect(cached).not.toBeNull();
      expect(cached!.propertyType).toBe('vehicle');
      expect(cached!.prices.length).toBe(2);
      expect(cached!.isStale).toBe(false);
    });

    it('should update existing cache entry', async () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Honda',
        model: 'Accord',
        year: 2018,
      };

      const initialPrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 4000000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test1',
          listingTitle: 'Honda Accord 2018',
          scrapedAt: new Date(),
        },
      ];

      const updatedPrices: SourcePrice[] = [
        {
          source: 'jiji',
          price: 4200000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test2',
          listingTitle: 'Honda Accord 2018 Updated',
          scrapedAt: new Date(),
        },
        {
          source: 'jumia',
          price: 4100000,
          currency: 'NGN',
          listingUrl: 'https://jumia.com/test',
          listingTitle: 'Honda Accord 2018',
          scrapedAt: new Date(),
        },
      ];

      // Store initial
      await setCachedPrice(property, initialPrices);
      const cached1 = await getCachedPrice(property);
      expect(cached1!.prices.length).toBe(1);

      // Update
      await setCachedPrice(property, updatedPrices);
      const cached2 = await getCachedPrice(property);
      expect(cached2!.prices.length).toBe(2);
      expect(cached2!.prices[0].price).toBe(4200000);
    }, 10000);

    it('should return null for non-existent cache', async () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'NonExistent',
        model: 'Model',
        year: 2020,
      };

      const cached = await getCachedPrice(property);
      expect(cached).toBeNull();
    });

    it('should throw error when caching empty price list', async () => {
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: 'Toyota',
        model: 'Corolla',
        year: 2019,
      };

      await expect(setCachedPrice(property, [])).rejects.toThrow('Cannot cache empty price list');
    });
  });
});
