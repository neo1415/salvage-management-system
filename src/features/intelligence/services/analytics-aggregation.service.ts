/**
 * AnalyticsAggregationService
 * Tasks 5.5.1-5.5.6
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { analyticsRollups } from '@/lib/db/schema/ml-training';
import { AssetAnalyticsService } from './asset-analytics.service';
import { TemporalAnalyticsService } from './temporal-analytics.service';
import { GeographicAnalyticsService } from './geographic-analytics.service';
import { BehavioralAnalyticsService } from './behavioral-analytics.service';

type RollupPeriod = typeof analyticsRollups.$inferInsert.rollupPeriod;
type RollupMetrics = NonNullable<typeof analyticsRollups.$inferInsert.metrics>;

interface RollupRow {
  total_auctions: string | null;
  total_bids: string | null;
  avg_bids_per_auction: string | null;
  avg_final_price: string | null;
  active_vendors: string | null;
}

export class AnalyticsAggregationService {
  private assetService = new AssetAnalyticsService();
  private temporalService = new TemporalAnalyticsService();
  private geoService = new GeographicAnalyticsService();
  private behavioralService = new BehavioralAnalyticsService();

  async runHourlyRollup(): Promise<void> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    console.log(`[Analytics Aggregation] Starting hourly rollup for period: ${oneHourAgo.toISOString()} to ${now.toISOString()}`);
    
    await this.createRollup('hourly', oneHourAgo, now);
    
    console.log(`[Analytics Aggregation] Hourly rollup completed successfully`);
  }

  async runDailyRollup(): Promise<void> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    console.log(`[Analytics Aggregation] Starting daily rollup for period: ${oneDayAgo.toISOString()} to ${now.toISOString()}`);

    await this.assetService.calculateAssetPerformance(oneDayAgo, now);
    await this.assetService.calculateAttributePerformance(oneDayAgo, now);
    await this.temporalService.calculateHourlyPatterns(oneDayAgo, now);
    await this.temporalService.calculateDailyPatterns(oneDayAgo, now);
    await this.geoService.calculateGeographicPatterns(oneDayAgo, now);
    await this.behavioralService.calculateConversionFunnel(oneDayAgo, now);

    await this.createRollup('daily', oneDayAgo, now);
    
    console.log(`[Analytics Aggregation] Daily rollup completed successfully`);
  }

  async runWeeklyRollup(): Promise<void> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    console.log(`[Analytics Aggregation] Starting weekly rollup for period: ${oneWeekAgo.toISOString()} to ${now.toISOString()}`);

    await this.behavioralService.segmentVendors();
    await this.createRollup('weekly', oneWeekAgo, now);
    
    console.log(`[Analytics Aggregation] Weekly rollup completed successfully`);
  }

  async runMonthlyRollup(): Promise<void> {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    console.log(`[Analytics Aggregation] Starting monthly rollup for period: ${oneMonthAgo.toISOString()} to ${now.toISOString()}`);

    await this.temporalService.calculateSeasonalPatterns(oneMonthAgo, now);
    await this.createRollup('monthly', oneMonthAgo, now);
    
    console.log(`[Analytics Aggregation] Monthly rollup completed successfully`);
  }

  private async createRollup(period: RollupPeriod, periodStart: Date, periodEnd: Date): Promise<void> {
    try {
      const result = await db.execute(sql`
        SELECT 
          COUNT(DISTINCT a.id) AS total_auctions,
          COUNT(DISTINCT b.id) AS total_bids,
          AVG(bid_counts.bid_count) AS avg_bids_per_auction,
          AVG(a.current_bid) AS avg_final_price,
          COUNT(DISTINCT b.vendor_id) AS active_vendors
        FROM auctions a
        LEFT JOIN bids b ON b.auction_id = a.id
        LEFT JOIN (
          SELECT auction_id, COUNT(*) AS bid_count
          FROM bids
          GROUP BY auction_id
        ) bid_counts ON bid_counts.auction_id = a.id
        WHERE a.end_time BETWEEN ${periodStart} AND ${periodEnd}
      `);

      const metrics = result as unknown as RollupRow[];
      const row = metrics[0] ?? {
        total_auctions: '0',
        total_bids: '0',
        avg_bids_per_auction: '0',
        avg_final_price: '0',
        active_vendors: '0',
      };

      const rollupMetrics: RollupMetrics = {
        totalAuctions: parseInt(row.total_auctions || '0'),
        totalBids: parseInt(row.total_bids || '0'),
        avgBidsPerAuction: parseFloat(row.avg_bids_per_auction || '0'),
        avgFinalPrice: parseFloat(row.avg_final_price || '0'),
        avgSellThroughRate: null,
        activeVendors: parseInt(row.active_vendors || '0'),
        avgVendorActivity: null,
        avgPredictionAccuracy: null,
        avgConfidenceScore: null,
        totalPredictions: null,
        totalRecommendations: null,
        avgMatchScore: null,
        clickThroughRate: null,
        bidConversionRate: null,
        fraudAlertsCount: null,
        avgRiskScore: null,
      };

      await db.insert(analyticsRollups).values({
        rollupPeriod: period,
        assetType: null,
        periodStart,
        periodEnd,
        metrics: rollupMetrics,
      });

      console.log(`[Analytics Aggregation] Created ${period} rollup: ${row.total_auctions} auctions, ${row.total_bids} bids, ${row.active_vendors} vendors`);
    } catch (error) {
      console.error(`[Analytics Aggregation] Error creating ${period} rollup:`, error);
      throw error;
    }
  }
}
