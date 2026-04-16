/**
 * Performance Tests for Analytics Services
 * 
 * Requirements:
 * - Query response time <1s
 * - Handle complex aggregations efficiently
 * - Verify index usage
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { AssetAnalyticsService } from '@/features/intelligence/services/asset-analytics.service';
import { TemporalAnalyticsService } from '@/features/intelligence/services/temporal-analytics.service';
import { BehavioralAnalyticsService } from '@/features/intelligence/services/behavioral-analytics.service';
import { db } from '@/lib/db';

describe('Analytics Services Performance Tests', () => {
  let assetAnalyticsService: AssetAnalyticsService;
  let temporalAnalyticsService: TemporalAnalyticsService;
  let behavioralAnalyticsService: BehavioralAnalyticsService;

  beforeAll(() => {
    assetAnalyticsService = new AssetAnalyticsService();
    temporalAnalyticsService = new TemporalAnalyticsService();
    behavioralAnalyticsService = new BehavioralAnalyticsService();
  });

  describe('Asset Analytics Performance', () => {
    it('should calculate asset performance within 1s', async () => {
      const startTime = performance.now();
      
      await assetAnalyticsService.calculateAssetPerformance();
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000);
      
      console.log(`Asset performance calculation: ${responseTime.toFixed(2)}ms`);
    });

    it('should calculate attribute performance within 1s', async () => {
      const startTime = performance.now();
      
      await assetAnalyticsService.calculateAttributePerformance();
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000);
      
      console.log(`Attribute performance calculation: ${responseTime.toFixed(2)}ms`);
    });

    it('should handle multiple concurrent asset queries', async () => {
      const promises = [
        assetAnalyticsService.calculateAssetPerformance(),
        assetAnalyticsService.calculateAssetPerformance(),
        assetAnalyticsService.calculateAssetPerformance(),
      ];

      const startTime = performance.now();
      await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete in reasonable time even with concurrent queries
      expect(totalTime).toBeLessThan(3000);
      
      console.log(`3 concurrent asset queries: ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Temporal Analytics Performance', () => {
    it('should analyze hourly patterns within 1s', async () => {
      const startTime = performance.now();
      
      await temporalAnalyticsService.analyzeHourlyPatterns();
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000);
      
      console.log(`Hourly pattern analysis: ${responseTime.toFixed(2)}ms`);
    });

    it('should analyze daily patterns within 1s', async () => {
      const startTime = performance.now();
      
      await temporalAnalyticsService.analyzeDailyPatterns();
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000);
      
      console.log(`Daily pattern analysis: ${responseTime.toFixed(2)}ms`);
    });

    it('should analyze seasonal patterns within 1s', async () => {
      const startTime = performance.now();
      
      await temporalAnalyticsService.analyzeSeasonalPatterns();
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000);
      
      console.log(`Seasonal pattern analysis: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Behavioral Analytics Performance', () => {
    it('should segment vendors within 1s', async () => {
      const startTime = performance.now();
      
      await behavioralAnalyticsService.segmentVendors();
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000);
      
      console.log(`Vendor segmentation: ${responseTime.toFixed(2)}ms`);
    });

    it('should analyze conversion funnel within 1s', async () => {
      const startTime = performance.now();
      
      await behavioralAnalyticsService.analyzeConversionFunnel();
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000);
      
      console.log(`Conversion funnel analysis: ${responseTime.toFixed(2)}ms`);
    });

    it('should track session analytics within 1s', async () => {
      const startTime = performance.now();
      
      await behavioralAnalyticsService.trackSessionAnalytics();
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000);
      
      console.log(`Session analytics tracking: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Complex Query Performance', () => {
    it('should handle complex aggregation queries efficiently', async () => {
      const startTime = performance.now();
      
      // Simulate complex multi-table join and aggregation
      const result = await db.execute(`
        SELECT 
          a.asset_type,
          COUNT(DISTINCT a.id) as auction_count,
          AVG(a.final_price) as avg_price,
          COUNT(DISTINCT b.vendor_id) as unique_bidders,
          AVG(b.amount) as avg_bid
        FROM auctions a
        LEFT JOIN bids b ON a.id = b.auction_id
        WHERE a.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY a.asset_type
        ORDER BY auction_count DESC
      `);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000);
      
      console.log(`Complex aggregation query: ${responseTime.toFixed(2)}ms`);
    });

    it('should efficiently query with date range filters', async () => {
      const startTime = performance.now();
      
      const result = await db.execute(`
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as count,
          AVG(final_price) as avg_price
        FROM auctions
        WHERE created_at >= NOW() - INTERVAL '90 days'
          AND status = 'closed'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date DESC
      `);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(500);
      
      console.log(`Date range query: ${responseTime.toFixed(2)}ms`);
    });

    it('should efficiently query with multiple joins', async () => {
      const startTime = performance.now();
      
      const result = await db.execute(`
        SELECT 
          v.id,
          v.business_name,
          COUNT(DISTINCT b.auction_id) as auctions_participated,
          COUNT(DISTINCT CASE WHEN b.is_winning THEN b.auction_id END) as auctions_won,
          AVG(b.amount) as avg_bid_amount
        FROM vendors v
        LEFT JOIN bids b ON v.id = b.vendor_id
        LEFT JOIN auctions a ON b.auction_id = a.id
        WHERE a.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY v.id, v.business_name
        HAVING COUNT(DISTINCT b.auction_id) > 0
        ORDER BY auctions_won DESC
        LIMIT 100
      `);
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000);
      
      console.log(`Multi-join query: ${responseTime.toFixed(2)}ms`);
    });
  });

  describe('Index Usage Verification', () => {
    it('should use indexes for auction queries', async () => {
      const result = await db.execute(`
        EXPLAIN ANALYZE
        SELECT * FROM auctions
        WHERE status = 'active'
          AND end_time > NOW()
        ORDER BY created_at DESC
        LIMIT 20
      `);

      const plan = JSON.stringify(result);
      
      // Verify index scan is used (not sequential scan)
      expect(plan.toLowerCase()).toContain('index');
      
      console.log('Auction query uses indexes');
    });

    it('should use indexes for bid queries', async () => {
      const result = await db.execute(`
        EXPLAIN ANALYZE
        SELECT * FROM bids
        WHERE auction_id = '00000000-0000-0000-0000-000000000000'
        ORDER BY created_at DESC
      `);

      const plan = JSON.stringify(result);
      
      expect(plan.toLowerCase()).toContain('index');
      
      console.log('Bid query uses indexes');
    });

    it('should use indexes for analytics queries', async () => {
      const result = await db.execute(`
        EXPLAIN ANALYZE
        SELECT * FROM asset_performance_analytics
        WHERE asset_type = 'vehicle'
          AND calculated_at >= NOW() - INTERVAL '7 days'
        ORDER BY calculated_at DESC
      `);

      const plan = JSON.stringify(result);
      
      expect(plan.toLowerCase()).toContain('index');
      
      console.log('Analytics query uses indexes');
    });
  });
});
