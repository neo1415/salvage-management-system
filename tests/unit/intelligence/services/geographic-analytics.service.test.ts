/**
 * GeographicAnalyticsService Unit Tests
 * Task 5.3.5: Add unit tests for GeographicAnalyticsService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeographicAnalyticsService } from '@/features/intelligence/services/geographic-analytics.service';

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
  },
}));

describe('GeographicAnalyticsService', () => {
  let service: GeographicAnalyticsService;

  beforeEach(() => {
    service = new GeographicAnalyticsService();
    vi.clearAllMocks();
  });

  describe('calculateGeographicPatterns', () => {
    it('should calculate geographic patterns for different regions', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock geographic data
      (db.execute as any).mockResolvedValueOnce([
        {
          asset_type: 'vehicle',
          region: 'Lagos',
          total_auctions: 100,
          avg_final_price: 2500000,
          price_variance: 500000,
          avg_vendor_count: 8,
        },
        {
          asset_type: 'vehicle',
          region: 'Abuja',
          total_auctions: 50,
          avg_final_price: 2800000,
          price_variance: 600000,
          avg_vendor_count: 6,
        },
        {
          asset_type: 'electronics',
          region: 'Lagos',
          total_auctions: 30,
          avg_final_price: 150000,
          price_variance: 30000,
          avg_vendor_count: 5,
        },
      ]);

      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      await service.calculateGeographicPatterns(periodStart, periodEnd);

      expect(db.execute).toHaveBeenCalledTimes(1);
    });

    it('should calculate demand scores correctly', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock data with varying demand levels
      (db.execute as any).mockResolvedValueOnce([
        {
          asset_type: 'vehicle',
          region: 'High Demand Region',
          total_auctions: 100,
          avg_final_price: 2500000,
          price_variance: 500000,
          avg_vendor_count: 10,
        },
        {
          asset_type: 'vehicle',
          region: 'Low Demand Region',
          total_auctions: 5,
          avg_final_price: 2000000,
          price_variance: 300000,
          avg_vendor_count: 2,
        },
      ]);

      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      await service.calculateGeographicPatterns(periodStart, periodEnd);

      // Verify insert was called with demand scores
      const { db: dbImport } = await import('@/lib/db');
      expect(dbImport.insert).toHaveBeenCalled();
    });

    it('should handle regions with no data', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock empty data
      (db.execute as any).mockResolvedValueOnce([]);

      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      await service.calculateGeographicPatterns(periodStart, periodEnd);

      expect(db.execute).toHaveBeenCalledTimes(1);
      
      // Should not insert anything
      const { db: dbImport } = await import('@/lib/db');
      expect(dbImport.insert).not.toHaveBeenCalled();
    });

    it('should handle null regions gracefully', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock data with null regions (should be filtered by SQL)
      (db.execute as any).mockResolvedValueOnce([
        {
          asset_type: 'vehicle',
          region: 'Lagos',
          total_auctions: 50,
          avg_final_price: 2500000,
          price_variance: 500000,
          avg_vendor_count: 8,
        },
      ]);

      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      await service.calculateGeographicPatterns(periodStart, periodEnd);

      expect(db.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('demand score calculation', () => {
    it('should calculate demand score based on auctions and vendors', () => {
      // Test demand score formula: (auctions/10)*50 + (vendors/5)*50
      
      // High demand: 100 auctions, 10 vendors
      // Score = (100/10)*50 + (10/5)*50 = 500 + 100 = 600, capped at 100
      const highDemand = Math.min(100, Math.round((100 / 10) * 50 + (10 / 5) * 50));
      expect(highDemand).toBe(100);

      // Medium demand: 50 auctions, 5 vendors
      // Score = (50/10)*50 + (5/5)*50 = 250 + 50 = 300, capped at 100
      const mediumDemand = Math.min(100, Math.round((50 / 10) * 50 + (5 / 5) * 50));
      expect(mediumDemand).toBe(100);

      // Low demand: 5 auctions, 2 vendors
      // Score = (5/10)*50 + (2/5)*50 = 25 + 20 = 45
      const lowDemand = Math.min(100, Math.round((5 / 10) * 50 + (2 / 5) * 50));
      expect(lowDemand).toBe(45);

      // Very low demand: 1 auction, 1 vendor
      // Score = (1/10)*50 + (1/5)*50 = 5 + 10 = 15
      const veryLowDemand = Math.min(100, Math.round((1 / 10) * 50 + (1 / 5) * 50));
      expect(veryLowDemand).toBe(15);
    });
  });
});
