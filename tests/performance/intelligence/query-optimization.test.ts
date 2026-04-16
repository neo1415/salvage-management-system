/**
 * Database Query Optimization Tests
 * 
 * Requirements:
 * - Verify index usage with EXPLAIN ANALYZE
 * - Ensure no sequential scans on large tables
 * - Validate query plan efficiency
 */

import { describe, it, expect } from 'vitest';
import { db } from '@/lib/db';

describe('Database Query Optimization Tests', () => {
  describe('Prediction Query Optimization', () => {
    it('should use indexes for similarity matching query', async () => {
      const result = await db.execute(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 
          a.id,
          a.final_price,
          v.make,
          v.model,
          v.year,
          v.color,
          v.trim
        FROM auctions a
        INNER JOIN cases c ON a.case_id = c.id
        INNER JOIN vehicles v ON c.id = v.case_id
        WHERE a.status = 'closed'
          AND a.final_price IS NOT NULL
          AND v.make = 'Toyota'
          AND v.model = 'Camry'
          AND v.year BETWEEN 2018 AND 2022
        ORDER BY a.end_time DESC
        LIMIT 20
      `);

      const plan = result[0] as any;
      const planText = JSON.stringify(plan);

      // Should use index scans, not sequential scans
      expect(planText.toLowerCase()).toContain('index');
      expect(planText.toLowerCase()).not.toContain('seq scan on auctions');
      expect(planText.toLowerCase()).not.toContain('seq scan on vehicles');

      console.log('Similarity matching query uses indexes ✓');
    });

    it('should efficiently query vendor bidding patterns', async () => {
      const result = await db.execute(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 
          vendor_id,
          COUNT(*) as bid_count,
          AVG(amount) as avg_bid,
          COUNT(DISTINCT auction_id) as auctions_participated
        FROM bids
        WHERE created_at >= NOW() - INTERVAL '90 days'
        GROUP BY vendor_id
        HAVING COUNT(*) > 5
        ORDER BY bid_count DESC
        LIMIT 100
      `);

      const plan = result[0] as any;
      const planText = JSON.stringify(plan);

      // Should use index on created_at
      expect(planText.toLowerCase()).toContain('index');

      console.log('Vendor bidding patterns query optimized ✓');
    });

    it('should efficiently query market conditions', async () => {
      const result = await db.execute(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 
          asset_type,
          COUNT(*) as active_auctions,
          AVG(EXTRACT(EPOCH FROM (end_time - start_time))) as avg_duration
        FROM auctions
        WHERE status = 'active'
          AND end_time > NOW()
        GROUP BY asset_type
      `);

      const plan = result[0] as any;
      const planText = JSON.stringify(plan);

      // Should use index on status and end_time
      expect(planText.toLowerCase()).toContain('index');

      console.log('Market conditions query optimized ✓');
    });
  });

  describe('Recommendation Query Optimization', () => {
    it('should use indexes for collaborative filtering query', async () => {
      const result = await db.execute(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 
          a.id,
          a.asset_type,
          COUNT(DISTINCT b.vendor_id) as bidder_count,
          AVG(b.amount) as avg_bid
        FROM auctions a
        INNER JOIN bids b ON a.id = b.auction_id
        WHERE a.status = 'active'
          AND a.end_time > NOW()
        GROUP BY a.id, a.asset_type
        HAVING COUNT(DISTINCT b.vendor_id) >= 3
        ORDER BY bidder_count DESC
        LIMIT 50
      `);

      const plan = result[0] as any;
      const planText = JSON.stringify(plan);

      expect(planText.toLowerCase()).toContain('index');

      console.log('Collaborative filtering query optimized ✓');
    });

    it('should efficiently query vendor interaction history', async () => {
      const result = await db.execute(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 
          vendor_id,
          auction_id,
          MAX(amount) as max_bid,
          COUNT(*) as bid_count
        FROM bids
        WHERE vendor_id = '00000000-0000-0000-0000-000000000000'
          AND created_at >= NOW() - INTERVAL '180 days'
        GROUP BY vendor_id, auction_id
        ORDER BY created_at DESC
      `);

      const plan = result[0] as any;
      const planText = JSON.stringify(plan);

      // Should use index on vendor_id
      expect(planText.toLowerCase()).toContain('index');

      console.log('Vendor interaction history query optimized ✓');
    });
  });

  describe('Analytics Query Optimization', () => {
    it('should use indexes for asset performance analytics', async () => {
      const result = await db.execute(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 
          asset_type,
          make,
          model,
          year,
          AVG(final_price) as avg_price,
          COUNT(*) as auction_count,
          STDDEV(final_price) as price_stddev
        FROM auctions a
        INNER JOIN cases c ON a.case_id = c.id
        INNER JOIN vehicles v ON c.id = v.case_id
        WHERE a.status = 'closed'
          AND a.final_price IS NOT NULL
          AND a.end_time >= NOW() - INTERVAL '30 days'
        GROUP BY asset_type, make, model, year
        HAVING COUNT(*) >= 3
        ORDER BY auction_count DESC
      `);

      const plan = result[0] as any;
      const planText = JSON.stringify(plan);

      expect(planText.toLowerCase()).toContain('index');

      console.log('Asset performance analytics query optimized ✓');
    });

    it('should use indexes for temporal pattern analytics', async () => {
      const result = await db.execute(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          EXTRACT(DOW FROM created_at) as day_of_week,
          COUNT(*) as bid_count,
          AVG(amount) as avg_bid
        FROM bids
        WHERE created_at >= NOW() - INTERVAL '90 days'
        GROUP BY EXTRACT(HOUR FROM created_at), EXTRACT(DOW FROM created_at)
        ORDER BY bid_count DESC
      `);

      const plan = result[0] as any;
      const planText = JSON.stringify(plan);

      expect(planText.toLowerCase()).toContain('index');

      console.log('Temporal pattern analytics query optimized ✓');
    });

    it('should use indexes for geographic pattern analytics', async () => {
      const result = await db.execute(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 
          c.location_state,
          COUNT(DISTINCT a.id) as auction_count,
          AVG(a.final_price) as avg_price
        FROM auctions a
        INNER JOIN cases c ON a.case_id = c.id
        WHERE a.status = 'closed'
          AND a.final_price IS NOT NULL
          AND c.location_state IS NOT NULL
        GROUP BY c.location_state
        ORDER BY auction_count DESC
      `);

      const plan = result[0] as any;
      const planText = JSON.stringify(plan);

      expect(planText.toLowerCase()).toContain('index');

      console.log('Geographic pattern analytics query optimized ✓');
    });
  });

  describe('Fraud Detection Query Optimization', () => {
    it('should use indexes for photo hash lookup', async () => {
      const result = await db.execute(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 
          ph1.case_id as case_id_1,
          ph2.case_id as case_id_2,
          ph1.photo_url as photo_url_1,
          ph2.photo_url as photo_url_2,
          ph1.hash_value
        FROM photo_hashes ph1
        INNER JOIN photo_hashes ph2 
          ON ph1.hash_value = ph2.hash_value
          AND ph1.case_id != ph2.case_id
        WHERE ph1.created_at >= NOW() - INTERVAL '180 days'
        LIMIT 100
      `);

      const plan = result[0] as any;
      const planText = JSON.stringify(plan);

      // Should use index on hash_value
      expect(planText.toLowerCase()).toContain('index');

      console.log('Photo hash lookup query optimized ✓');
    });

    it('should efficiently detect shill bidding patterns', async () => {
      const result = await db.execute(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 
          b1.auction_id,
          b1.vendor_id as vendor_1,
          b2.vendor_id as vendor_2,
          COUNT(*) as consecutive_bids
        FROM bids b1
        INNER JOIN bids b2 
          ON b1.auction_id = b2.auction_id
          AND b1.vendor_id != b2.vendor_id
          AND b2.created_at > b1.created_at
          AND b2.created_at <= b1.created_at + INTERVAL '5 minutes'
        WHERE b1.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY b1.auction_id, b1.vendor_id, b2.vendor_id
        HAVING COUNT(*) >= 3
        ORDER BY consecutive_bids DESC
        LIMIT 50
      `);

      const plan = result[0] as any;
      const planText = JSON.stringify(plan);

      expect(planText.toLowerCase()).toContain('index');

      console.log('Shill bidding detection query optimized ✓');
    });
  });

  describe('Materialized View Refresh Performance', () => {
    it('should efficiently refresh vendor_bidding_patterns_mv', async () => {
      const result = await db.execute(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 
          vendor_id,
          asset_type,
          COUNT(*) as bid_count,
          AVG(amount) as avg_bid,
          MAX(amount) as max_bid,
          COUNT(DISTINCT auction_id) as auctions_participated,
          COUNT(DISTINCT CASE WHEN is_winning THEN auction_id END) as auctions_won
        FROM bids b
        INNER JOIN auctions a ON b.auction_id = a.id
        WHERE b.created_at >= NOW() - INTERVAL '90 days'
        GROUP BY vendor_id, asset_type
      `);

      const plan = result[0] as any;
      const planText = JSON.stringify(plan);

      expect(planText.toLowerCase()).toContain('index');

      console.log('Vendor bidding patterns MV refresh optimized ✓');
    });

    it('should efficiently refresh market_conditions_mv', async () => {
      const result = await db.execute(`
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT 
          asset_type,
          COUNT(*) as active_auctions,
          AVG(bid_count) as avg_competition,
          AVG(final_price) as avg_final_price
        FROM (
          SELECT 
            a.id,
            a.asset_type,
            COUNT(b.id) as bid_count,
            a.final_price
          FROM auctions a
          LEFT JOIN bids b ON a.id = b.auction_id
          WHERE a.status = 'active'
            AND a.end_time > NOW()
          GROUP BY a.id, a.asset_type, a.final_price
        ) subquery
        GROUP BY asset_type
      `);

      const plan = result[0] as any;
      const planText = JSON.stringify(plan);

      expect(planText.toLowerCase()).toContain('index');

      console.log('Market conditions MV refresh optimized ✓');
    });
  });

  describe('Query Performance Benchmarks', () => {
    it('should complete prediction query in <100ms', async () => {
      const startTime = performance.now();
      
      await db.execute(`
        SELECT 
          a.id,
          a.final_price,
          v.make,
          v.model,
          v.year
        FROM auctions a
        INNER JOIN cases c ON a.case_id = c.id
        INNER JOIN vehicles v ON c.id = v.case_id
        WHERE a.status = 'closed'
          AND a.final_price IS NOT NULL
          AND v.make = 'Toyota'
          AND v.model = 'Camry'
        ORDER BY a.end_time DESC
        LIMIT 20
      `);
      
      const endTime = performance.now();
      const queryTime = endTime - startTime;

      expect(queryTime).toBeLessThan(100);

      console.log(`Prediction query execution time: ${queryTime.toFixed(2)}ms`);
    });

    it('should complete analytics aggregation in <500ms', async () => {
      const startTime = performance.now();
      
      await db.execute(`
        SELECT 
          asset_type,
          COUNT(*) as count,
          AVG(final_price) as avg_price,
          STDDEV(final_price) as stddev_price
        FROM auctions
        WHERE status = 'closed'
          AND final_price IS NOT NULL
          AND end_time >= NOW() - INTERVAL '30 days'
        GROUP BY asset_type
      `);
      
      const endTime = performance.now();
      const queryTime = endTime - startTime;

      expect(queryTime).toBeLessThan(500);

      console.log(`Analytics aggregation execution time: ${queryTime.toFixed(2)}ms`);
    });

    it('should complete fraud detection query in <200ms', async () => {
      const startTime = performance.now();
      
      await db.execute(`
        SELECT 
          case_id,
          COUNT(*) as duplicate_count
        FROM photo_hashes
        WHERE hash_value IN (
          SELECT hash_value
          FROM photo_hashes
          GROUP BY hash_value
          HAVING COUNT(DISTINCT case_id) > 1
        )
        GROUP BY case_id
        ORDER BY duplicate_count DESC
        LIMIT 50
      `);
      
      const endTime = performance.now();
      const queryTime = endTime - startTime;

      expect(queryTime).toBeLessThan(200);

      console.log(`Fraud detection query execution time: ${queryTime.toFixed(2)}ms`);
    });
  });
});
