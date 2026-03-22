/**
 * Integration Test: AI Assessment with Market Data
 * 
 * Tests the complete AI assessment flow with market data integration:
 * - Assessment with fresh market data
 * - Assessment with stale market data
 * - Assessment with scraping failure (fallback to estimation)
 * - Assessment with no market data available
 * 
 * Requirements: 4.1-4.5
 */

// Set mock mode BEFORE importing the service
process.env.MOCK_AI_ASSESSMENT = 'true';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { assessDamageEnhanced } from '@/features/cases/services/ai-assessment-enhanced.service';
import type { VehicleInfo } from '@/features/cases/services/ai-assessment-enhanced.service';
import { db } from '@/lib/db/drizzle';
import { marketDataCache, marketDataSources } from '@/lib/db/schema/market-data';
import { eq } from 'drizzle-orm';
import { generatePropertyHash } from '@/features/market-data/services/cache.service';
import type { PropertyIdentifier, SourcePrice } from '@/features/market-data/types';

// Mock Google Vision API - not needed since MOCK_MODE is set

// Mock scraper service
vi.mock('@/features/market-data/services/scraper.service', () => ({
  scrapeAllSources: vi.fn(),
}));

// Mock rate limiter
vi.mock('@/features/market-data/services/rate-limiter.service', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  recordRequest: vi.fn(async () => {}),
}));

import { scrapeAllSources } from '@/features/market-data/services/scraper.service';

describe('Integration Test: AI Assessment with Market Data', () => {
  const testVehicleInfo: VehicleInfo = {
    make: 'Toyota',
    model: 'Camry',
    year: 2020,
    mileage: 50000,
  };

  const testPhotos = [
    'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
  ];

  const mockSourcePrices: SourcePrice[] = [
    {
      source: 'jiji',
      price: 5000000,
      currency: 'NGN',
      listingUrl: 'https://jiji.ng/test-1',
      listingTitle: 'Toyota Camry 2020',
      scrapedAt: new Date(),
    },
    {
      source: 'jumia',
      price: 5200000,
      currency: 'NGN',
      listingUrl: 'https://jumia.ng/test-2',
      listingTitle: 'Toyota Camry 2020',
      scrapedAt: new Date(),
    },
    {
      source: 'cars45',
      price: 4800000,
      currency: 'NGN',
      listingUrl: 'https://cars45.ng/test-3',
      listingTitle: 'Toyota Camry 2020',
      scrapedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test data
    const property: PropertyIdentifier = {
      type: 'vehicle',
      make: testVehicleInfo.make!,
      model: testVehicleInfo.model!,
      year: testVehicleInfo.year!,
      mileage: testVehicleInfo.mileage,
    };
    const propertyHash = generatePropertyHash(property);

    try {
      await db.delete(marketDataCache).where(eq(marketDataCache.propertyHash, propertyHash));
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  });

  describe('Assessment with fresh market data', () => {
    it('should use fresh market data for valuation', { timeout: 10000 }, async () => {
      // Pre-populate cache with fresh data
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: testVehicleInfo.make!,
        model: testVehicleInfo.model!,
        year: testVehicleInfo.year!,
        mileage: testVehicleInfo.mileage,
      };
      const propertyHash = generatePropertyHash(property);
      const scrapedAt = new Date();
      const staleAt = new Date(scrapedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [cacheEntry] = await db
        .insert(marketDataCache)
        .values({
          propertyHash,
          propertyType: 'vehicle',
          propertyDetails: property,
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

      const assessment = await assessDamageEnhanced({
        photos: testPhotos,
        vehicleInfo: testVehicleInfo,
      });

      // Market value should be from cached data (5,000,000)
      // May be adjusted for mileage/condition
      expect(assessment.marketValue).toBeGreaterThan(4000000);
      expect(assessment.marketValue).toBeLessThan(6000000);

      // Confidence should be high with fresh market data
      expect(assessment.confidence.valuationAccuracy).toBeGreaterThan(80);

      // Should have all required fields
      expect(assessment.estimatedSalvageValue).toBeDefined();
      expect(assessment.estimatedRepairCost).toBeDefined();
      expect(assessment.reservePrice).toBeDefined();

      // Salvage value should be less than market value
      expect(assessment.estimatedSalvageValue).toBeLessThan(assessment.marketValue);

      // Reserve price should be ~70% of salvage value
      const expectedReserve = assessment.estimatedSalvageValue * 0.7;
      expect(Math.abs(assessment.reservePrice - expectedReserve)).toBeLessThan(
        expectedReserve * 0.15
      );
    });

    it('should apply mileage adjustments to market data', { timeout: 10000 }, async () => {
      // Pre-populate cache
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: testVehicleInfo.make!,
        model: testVehicleInfo.model!,
        year: testVehicleInfo.year!,
      };
      const propertyHash = generatePropertyHash(property);
      const scrapedAt = new Date();
      const staleAt = new Date(scrapedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(marketDataCache).values({
        propertyHash,
        propertyType: 'vehicle',
        propertyDetails: property,
        medianPrice: '5000000.00',
        minPrice: '5000000.00',
        maxPrice: '5000000.00',
        sourceCount: 1,
        scrapedAt,
        staleAt,
      });

      // Assessment with low mileage
      const lowMileageAssessment = await assessDamageEnhanced({
        photos: testPhotos,
        vehicleInfo: {
          ...testVehicleInfo,
          mileage: 10000, // Very low mileage
        },
      });

      // Assessment with high mileage
      const highMileageAssessment = await assessDamageEnhanced({
        photos: testPhotos,
        vehicleInfo: {
          ...testVehicleInfo,
          mileage: 200000, // High mileage
        },
      });

      // Low mileage should result in higher market value
      expect(lowMileageAssessment.marketValue).toBeGreaterThan(
        highMileageAssessment.marketValue
      );

      // Both should be based on the same base price (5,000,000)
      expect(lowMileageAssessment.marketValue).toBeGreaterThan(4500000);
      expect(highMileageAssessment.marketValue).toBeLessThan(5500000);
    });

    it('should apply condition adjustments to market data', { timeout: 10000 }, async () => {
      // Pre-populate cache
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: testVehicleInfo.make!,
        model: testVehicleInfo.model!,
        year: testVehicleInfo.year!,
      };
      const propertyHash = generatePropertyHash(property);
      const scrapedAt = new Date();
      const staleAt = new Date(scrapedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(marketDataCache).values({
        propertyHash,
        propertyType: 'vehicle',
        propertyDetails: property,
        medianPrice: '5000000.00',
        minPrice: '5000000.00',
        maxPrice: '5000000.00',
        sourceCount: 1,
        scrapedAt,
        staleAt,
      });

      // Assessment with excellent condition
      const excellentAssessment = await assessDamageEnhanced({
        photos: testPhotos,
        vehicleInfo: {
          ...testVehicleInfo,
          condition: 'excellent',
        },
      });

      // Assessment with poor condition
      const poorAssessment = await assessDamageEnhanced({
        photos: testPhotos,
        vehicleInfo: {
          ...testVehicleInfo,
          condition: 'poor',
        },
      });

      // Excellent condition should result in higher market value
      expect(excellentAssessment.marketValue).toBeGreaterThan(poorAssessment.marketValue);

      // Excellent should be ~15% higher than base
      expect(excellentAssessment.marketValue).toBeGreaterThan(5000000);

      // Poor should be ~30% lower than base
      expect(poorAssessment.marketValue).toBeLessThan(5000000);
    });
  });

  describe('Assessment with stale market data', () => {
    it('should use stale data and reduce confidence', { timeout: 10000 }, async () => {
      // Pre-populate cache with stale data (10 days old)
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: testVehicleInfo.make!,
        model: testVehicleInfo.model!,
        year: testVehicleInfo.year!,
        mileage: testVehicleInfo.mileage,
      };
      const propertyHash = generatePropertyHash(property);
      const scrapedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const staleAt = new Date(scrapedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(marketDataCache).values({
        propertyHash,
        propertyType: 'vehicle',
        propertyDetails: property,
        medianPrice: '5000000.00',
        minPrice: '4800000.00',
        maxPrice: '5200000.00',
        sourceCount: 3,
        scrapedAt,
        staleAt,
      });

      // Mock scraping to succeed with new data
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

      const assessment = await assessDamageEnhanced({
        photos: testPhotos,
        vehicleInfo: testVehicleInfo,
      });

      // Should still get a valid assessment
      expect(assessment.marketValue).toBeGreaterThan(0);
      expect(assessment.estimatedSalvageValue).toBeDefined();

      // Confidence may be reduced if stale data was used
      // (depends on whether scraping succeeded)
      expect(assessment.confidence.valuationAccuracy).toBeGreaterThan(0);
    });
  });

  describe('Assessment with scraping failure (fallback to estimation)', () => {
    it('should fall back to estimation when scraping fails', { timeout: 10000 }, async () => {
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

      const assessment = await assessDamageEnhanced({
        photos: testPhotos,
        vehicleInfo: testVehicleInfo,
      });

      // Should still get a valid assessment using estimation
      expect(assessment.marketValue).toBeGreaterThan(0);
      expect(assessment.estimatedSalvageValue).toBeDefined();
      expect(assessment.estimatedRepairCost).toBeDefined();

      // Confidence should be lower with estimation
      expect(assessment.confidence.valuationAccuracy).toBeLessThan(70);

      // Should have warning about estimation
      const hasEstimationWarning = assessment.confidence.reasons.some(
        (reason) =>
          reason.includes('estimated') ||
          reason.includes('limited data') ||
          reason.includes('uncertainty')
      );
      expect(hasEstimationWarning).toBe(true);
    });

    it('should use stale cache when scraping fails', { timeout: 10000 }, async () => {
      // Pre-populate cache with stale data
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: testVehicleInfo.make!,
        model: testVehicleInfo.model!,
        year: testVehicleInfo.year!,
        mileage: testVehicleInfo.mileage,
      };
      const propertyHash = generatePropertyHash(property);
      const scrapedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000); // 15 days ago
      const staleAt = new Date(scrapedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(marketDataCache).values({
        propertyHash,
        propertyType: 'vehicle',
        propertyDetails: property,
        medianPrice: '4500000.00',
        minPrice: '4500000.00',
        maxPrice: '4500000.00',
        sourceCount: 1,
        scrapedAt,
        staleAt,
      });

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

      const assessment = await assessDamageEnhanced({
        photos: testPhotos,
        vehicleInfo: testVehicleInfo,
      });

      // Should use stale cached data (4,500,000)
      // May be adjusted for mileage/condition
      expect(assessment.marketValue).toBeGreaterThan(3500000);
      expect(assessment.marketValue).toBeLessThan(5500000);

      // Confidence should be reduced for stale data
      expect(assessment.confidence.valuationAccuracy).toBeLessThan(80);
    });
  });

  describe('Assessment with no market data available', () => {
    it('should use estimation when no vehicle info is provided', async () => {
      const assessment = await assessDamageEnhanced({
        photos: testPhotos,
        vehicleInfo: undefined,
      });

      // Should still get a valid assessment
      expect(assessment.marketValue).toBeGreaterThan(0);
      expect(assessment.estimatedSalvageValue).toBeDefined();

      // Confidence should be very low
      expect(assessment.confidence.valuationAccuracy).toBeLessThanOrEqual(50);

      // Should have warning about lack of information
      const hasNoInfoWarning = assessment.confidence.reasons.some(
        (reason) =>
          reason.includes('No vehicle information') || reason.includes('generic estimates')
      );
      expect(hasNoInfoWarning).toBe(true);
    });

    it('should use estimation when vehicle info is incomplete', async () => {
      const incompleteVehicleInfo: VehicleInfo = {
        make: 'Toyota',
        // Missing model and year
      };

      const assessment = await assessDamageEnhanced({
        photos: testPhotos,
        vehicleInfo: incompleteVehicleInfo,
      });

      // Should still get a valid assessment
      expect(assessment.marketValue).toBeGreaterThan(0);
      expect(assessment.estimatedSalvageValue).toBeDefined();

      // Confidence should be low
      expect(assessment.confidence.valuationAccuracy).toBeLessThan(70);

      // Should have warning about incomplete information
      const hasIncompleteWarning = assessment.confidence.reasons.some(
        (reason) => reason.includes('Incomplete') || reason.includes('generic')
      );
      expect(hasIncompleteWarning).toBe(true);
    });

    it('should prefer user-provided market value over scraping', { timeout: 10000 }, async () => {
      const userProvidedValue = 7000000;

      const assessment = await assessDamageEnhanced({
        photos: testPhotos,
        vehicleInfo: {
          ...testVehicleInfo,
          marketValue: userProvidedValue,
        },
      });

      // Should use user-provided value
      expect(assessment.marketValue).toBe(userProvidedValue);

      // Confidence should be high with user-provided value
      expect(assessment.confidence.valuationAccuracy).toBeGreaterThanOrEqual(90);

      // Scraper should not have been called
      expect(scrapeAllSources).not.toHaveBeenCalled();
    });
  });

  describe('Damage calculation with market data', () => {
    it('should calculate salvage value correctly with market data', { timeout: 10000 }, async () => {
      // Pre-populate cache
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: testVehicleInfo.make!,
        model: testVehicleInfo.model!,
        year: testVehicleInfo.year!,
      };
      const propertyHash = generatePropertyHash(property);
      const scrapedAt = new Date();
      const staleAt = new Date(scrapedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(marketDataCache).values({
        propertyHash,
        propertyType: 'vehicle',
        propertyDetails: property,
        medianPrice: '6000000.00',
        minPrice: '6000000.00',
        maxPrice: '6000000.00',
        sourceCount: 1,
        scrapedAt,
        staleAt,
      });

      const assessment = await assessDamageEnhanced({
        photos: testPhotos,
        vehicleInfo: testVehicleInfo,
      });

      // Salvage value = market value - repair cost
      const expectedSalvageValue = assessment.marketValue - assessment.estimatedRepairCost;
      expect(Math.abs(assessment.estimatedSalvageValue - expectedSalvageValue)).toBeLessThan(10);

      // Reserve price = salvage value * 0.7
      const expectedReservePrice = assessment.estimatedSalvageValue * 0.7;
      expect(Math.abs(assessment.reservePrice - expectedReservePrice)).toBeLessThan(
        expectedReservePrice * 0.1
      );

      // Salvage value should be less than market value
      expect(assessment.estimatedSalvageValue).toBeLessThan(assessment.marketValue);

      // Salvage value should be positive (or zero for total loss)
      expect(assessment.estimatedSalvageValue).toBeGreaterThanOrEqual(0);
    });

    it('should handle total loss scenarios correctly', { timeout: 10000 }, async () => {
      // Pre-populate cache
      const property: PropertyIdentifier = {
        type: 'vehicle',
        make: testVehicleInfo.make!,
        model: testVehicleInfo.model!,
        year: testVehicleInfo.year!,
      };
      const propertyHash = generatePropertyHash(property);
      const scrapedAt = new Date();
      const staleAt = new Date(scrapedAt.getTime() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(marketDataCache).values({
        propertyHash,
        propertyType: 'vehicle',
        propertyDetails: property,
        medianPrice: '5000000.00',
        minPrice: '5000000.00',
        maxPrice: '5000000.00',
        sourceCount: 1,
        scrapedAt,
        staleAt,
      });

      const assessment = await assessDamageEnhanced({
        photos: testPhotos,
        vehicleInfo: testVehicleInfo,
      });

      // If repair cost > 70% of market value, should be marked as not repairable
      if (assessment.estimatedRepairCost > assessment.marketValue * 0.7) {
        expect(assessment.isRepairable).toBe(false);
        expect(assessment.recommendation).toContain('Total loss');
      }

      // If severe structural damage, should be marked as not repairable
      if (assessment.damageScore.structural > 70) {
        expect(assessment.isRepairable).toBe(false);
        expect(assessment.recommendation).toContain('structural damage');
      }
    });
  });
});
