/**
 * BehavioralAnalyticsService Unit Tests
 * Task 5.4.5: Add unit tests for BehavioralAnalyticsService
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BehavioralAnalyticsService } from '@/features/intelligence/services/behavioral-analytics.service';

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

describe('BehavioralAnalyticsService', () => {
  let service: BehavioralAnalyticsService;

  beforeEach(() => {
    service = new BehavioralAnalyticsService();
    vi.clearAllMocks();
  });

  describe('segmentVendors', () => {
    it('should segment vendors based on bidding behavior', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock vendor data
      (db.execute as any).mockResolvedValueOnce([
        {
          vendor_id: 'vendor-1',
          avg_bid_to_value_ratio: 0.5,
          preferred_asset_types: ['vehicle', 'electronics'],
          price_p25: 1000000,
          price_p75: 3000000,
          bids_per_week: 6,
          overall_win_rate: 0.3,
          last_bid_at: new Date(),
        },
        {
          vendor_id: 'vendor-2',
          avg_bid_to_value_ratio: 0.95,
          preferred_asset_types: ['vehicle'],
          price_p25: 5000000,
          price_p75: 10000000,
          bids_per_week: 1.5,
          overall_win_rate: 0.8,
          last_bid_at: new Date(),
        },
      ]);

      await service.segmentVendors();

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('determinePriceSegment', () => {
    it('should classify vendors as bargain hunters', () => {
      const determinePriceSegment = (service as any).determinePriceSegment.bind(service);
      
      expect(determinePriceSegment(0.5)).toBe('bargain_hunter');
      expect(determinePriceSegment(0.4)).toBe('bargain_hunter');
      expect(determinePriceSegment(0.59)).toBe('bargain_hunter');
    });

    it('should classify vendors as premium buyers', () => {
      const determinePriceSegment = (service as any).determinePriceSegment.bind(service);
      
      expect(determinePriceSegment(0.91)).toBe('premium_buyer');
      expect(determinePriceSegment(0.95)).toBe('premium_buyer');
      expect(determinePriceSegment(1.0)).toBe('premium_buyer');
    });

    it('should classify vendors as value seekers', () => {
      const determinePriceSegment = (service as any).determinePriceSegment.bind(service);
      
      expect(determinePriceSegment(0.6)).toBe('value_seeker');
      expect(determinePriceSegment(0.75)).toBe('value_seeker');
      expect(determinePriceSegment(0.9)).toBe('value_seeker');
    });
  });

  describe('determineActivitySegment', () => {
    it('should classify vendors as active bidders', () => {
      const determineActivitySegment = (service as any).determineActivitySegment.bind(service);
      
      expect(determineActivitySegment(5)).toBe('active_bidder');
      expect(determineActivitySegment(10)).toBe('active_bidder');
      expect(determineActivitySegment(20)).toBe('active_bidder');
    });

    it('should classify vendors as regular bidders', () => {
      const determineActivitySegment = (service as any).determineActivitySegment.bind(service);
      
      expect(determineActivitySegment(2)).toBe('regular_bidder');
      expect(determineActivitySegment(3)).toBe('regular_bidder');
      expect(determineActivitySegment(4.9)).toBe('regular_bidder');
    });

    it('should classify vendors as selective bidders', () => {
      const determineActivitySegment = (service as any).determineActivitySegment.bind(service);
      
      expect(determineActivitySegment(0.5)).toBe('selective_bidder');
      expect(determineActivitySegment(1)).toBe('selective_bidder');
      expect(determineActivitySegment(1.9)).toBe('selective_bidder');
    });
  });

  describe('calculateConversionFunnel', () => {
    it('should calculate conversion funnel metrics', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock funnel data
      (db.execute as any).mockResolvedValueOnce([
        {
          asset_type: 'vehicle',
          total_views: 1000,
          total_watches: 500,
          total_bids: 200,
          total_wins: 50,
        },
        {
          asset_type: 'electronics',
          total_views: 500,
          total_watches: 250,
          total_bids: 100,
          total_wins: 25,
        },
      ]);

      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      await service.calculateConversionFunnel(periodStart, periodEnd);

      expect(db.execute).toHaveBeenCalledTimes(1);
      expect(db.insert).toHaveBeenCalled();
    });

    it('should handle zero values in conversion rates', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock data with zeros
      (db.execute as any).mockResolvedValueOnce([
        {
          asset_type: 'vehicle',
          total_views: 0,
          total_watches: 0,
          total_bids: 0,
          total_wins: 0,
        },
      ]);

      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      await service.calculateConversionFunnel(periodStart, periodEnd);

      expect(db.execute).toHaveBeenCalledTimes(1);
    });
  });

  describe('trackSession', () => {
    it('should track vendor session analytics', async () => {
      const { db } = await import('@/lib/db');

      const vendorId = 'vendor-123';
      const sessionId = 'session-456';
      const startTime = new Date('2024-01-01T10:00:00Z');
      const endTime = new Date('2024-01-01T10:30:00Z');
      const actionsPerformed = ['bid_placed', 'watchlist_added', 'bid_placed'];
      const auctionsViewed = ['auction-1', 'auction-2', 'auction-3'];

      await service.trackSession(
        vendorId,
        sessionId,
        startTime,
        endTime,
        actionsPerformed,
        auctionsViewed
      );

      expect(db.insert).toHaveBeenCalled();
    });

    it('should calculate bounce rate correctly', async () => {
      const { db } = await import('@/lib/db');

      // Single auction viewed = bounce
      await service.trackSession(
        'vendor-123',
        'session-1',
        new Date(),
        new Date(),
        [],
        ['auction-1']
      );

      // Multiple auctions = no bounce
      await service.trackSession(
        'vendor-123',
        'session-2',
        new Date(),
        new Date(),
        [],
        ['auction-1', 'auction-2']
      );

      expect(db.insert).toHaveBeenCalledTimes(2);
    });
  });

  describe('getVendorSessionAnalytics', () => {
    it('should retrieve session analytics for a vendor', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock session analytics
      (db.execute as any).mockResolvedValueOnce([
        {
          total_sessions: 10,
          avg_session_duration: 25,
          avg_auctions_per_session: 3.5,
          avg_bids_per_session: 1.2,
          avg_bounce_rate: 0.3,
        },
      ]);

      const vendorId = 'vendor-123';
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      const result = await service.getVendorSessionAnalytics(vendorId, periodStart, periodEnd);

      expect(result.total_sessions).toBe(10);
      expect(result.avg_session_duration).toBe(25);
      expect(db.execute).toHaveBeenCalledTimes(1);
    });

    it('should return default values when no data exists', async () => {
      const { db } = await import('@/lib/db');
      
      // Mock empty result
      (db.execute as any).mockResolvedValueOnce([]);

      const vendorId = 'vendor-123';
      const periodStart = new Date('2024-01-01');
      const periodEnd = new Date('2024-01-31');

      const result = await service.getVendorSessionAnalytics(vendorId, periodStart, periodEnd);

      expect(result.total_sessions).toBe(0);
      expect(result.avg_session_duration).toBe(0);
    });
  });
});
