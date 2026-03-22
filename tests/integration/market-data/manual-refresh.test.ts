/**
 * Integration Test: Manual Market Data Refresh
 * 
 * Tests the admin endpoint for manually refreshing market data
 * 
 * Requirements: 2.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db/drizzle';
import { marketDataCache } from '@/lib/db/schema/market-data';
import { eq } from 'drizzle-orm';
import { generatePropertyHash } from '@/features/market-data/services/cache.service';
import type { PropertyIdentifier } from '@/features/market-data/types';

// Mock next-auth
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

// Mock scraper service
vi.mock('@/features/market-data/services/scraper.service', () => ({
  scrapeAllSources: vi.fn(async () => [
    {
      success: true,
      source: 'jiji',
      prices: [
        {
          source: 'jiji',
          price: 5500000,
          currency: 'NGN',
          listingUrl: 'https://jiji.ng/test',
          listingTitle: 'Test Vehicle',
          scrapedAt: new Date(),
        },
      ],
      duration: 1000,
    },
  ]),
}));

// Mock rate limiter
vi.mock('@/features/market-data/services/rate-limiter.service', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  recordRequest: vi.fn(async () => {}),
}));

import { getServerSession } from 'next-auth';

describe('Integration Test: Manual Market Data Refresh', () => {
  const testProperty: PropertyIdentifier = {
    type: 'vehicle',
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test data
    const propertyHash = generatePropertyHash(testProperty);
    try {
      await db.delete(marketDataCache).where(eq(marketDataCache.propertyHash, propertyHash));
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });

  describe('Successful refresh', () => {
    it('should refresh market data when admin authenticated', async () => {
      // Mock admin session
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'admin-1',
          email: 'admin@example.com',
          role: 'admin',
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any);

      // Call refresh endpoint
      const response = await fetch('http://localhost:3000/api/admin/market-data/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          property: testProperty,
        }),
      });

      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('initiated successfully');
      expect(data.property).toEqual(testProperty);

      // Verify data was refreshed in cache
      const propertyHash = generatePropertyHash(testProperty);
      const [cachedData] = await db
        .select()
        .from(marketDataCache)
        .where(eq(marketDataCache.propertyHash, propertyHash));

      expect(cachedData).toBeDefined();
      expect(Number(cachedData.medianPrice)).toBeGreaterThan(0);
    });

    it('should force re-scraping even with fresh cache', async () => {
      // Mock admin session
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'admin-1',
          email: 'admin@example.com',
          role: 'admin',
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any);

      // Pre-populate cache with fresh data
      const propertyHash = generatePropertyHash(testProperty);
      const scrapedAt = new Date();
      const staleAt = new Date(scrapedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(marketDataCache).values({
        propertyHash,
        propertyType: 'vehicle',
        propertyDetails: testProperty,
        medianPrice: '5000000.00',
        minPrice: '5000000.00',
        maxPrice: '5000000.00',
        sourceCount: 1,
        scrapedAt,
        staleAt,
      });

      // Call refresh endpoint
      const response = await fetch('http://localhost:3000/api/admin/market-data/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          property: testProperty,
        }),
      });

      expect(response.ok).toBe(true);

      // Verify scraper was called (forced refresh)
      const { scrapeAllSources } = await import('@/features/market-data/services/scraper.service');
      expect(scrapeAllSources).toHaveBeenCalled();

      // Verify cache was updated
      const [updatedCache] = await db
        .select()
        .from(marketDataCache)
        .where(eq(marketDataCache.propertyHash, propertyHash));

      expect(updatedCache).toBeDefined();
      // Updated timestamp should be more recent
      expect(updatedCache.scrapedAt.getTime()).toBeGreaterThan(scrapedAt.getTime());
    });
  });

  describe('Authentication and authorization', () => {
    it('should reject unauthenticated requests', async () => {
      // Mock no session
      vi.mocked(getServerSession).mockResolvedValue(null);

      const response = await fetch('http://localhost:3000/api/admin/market-data/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          property: testProperty,
        }),
      });

      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should reject non-admin users', async () => {
      // Mock non-admin session
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'user-1',
          email: 'user@example.com',
          role: 'vendor',
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any);

      const response = await fetch('http://localhost:3000/api/admin/market-data/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          property: testProperty,
        }),
      });

      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toContain('Forbidden');
    });
  });

  describe('Input validation', () => {
    beforeEach(() => {
      // Mock admin session for all validation tests
      vi.mocked(getServerSession).mockResolvedValue({
        user: {
          id: 'admin-1',
          email: 'admin@example.com',
          role: 'admin',
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      } as any);
    });

    it('should reject missing property', async () => {
      const response = await fetch('http://localhost:3000/api/admin/market-data/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Invalid property');
    });

    it('should reject invalid property type', async () => {
      const response = await fetch('http://localhost:3000/api/admin/market-data/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          property: {
            type: 'invalid',
          },
        }),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Invalid property type');
    });

    it('should reject vehicle without required fields', async () => {
      const response = await fetch('http://localhost:3000/api/admin/market-data/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          property: {
            type: 'vehicle',
            make: 'Toyota',
            // Missing model and year
          },
        }),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Invalid vehicle property');
    });

    it('should reject electronics without required fields', async () => {
      const response = await fetch('http://localhost:3000/api/admin/market-data/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          property: {
            type: 'electronics',
            brand: 'Samsung',
            // Missing productModel and productType
          },
        }),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Invalid electronics property');
    });

    it('should reject building without required fields', async () => {
      const response = await fetch('http://localhost:3000/api/admin/market-data/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          property: {
            type: 'building',
            location: 'Lagos',
            // Missing propertyType and size
          },
        }),
      });

      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toContain('Invalid building property');
    });
  });
});

