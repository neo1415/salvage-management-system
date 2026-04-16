/**
 * AssetAnalyticsService
 * 
 * Service for calculating asset and attribute performance analytics.
 * Tasks 5.1.1-5.1.5
 * 
 * @module intelligence/services/asset-analytics
 */

import { db } from '@/lib/db';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import {
  assetPerformanceAnalytics,
  attributePerformanceAnalytics,
} from '@/lib/db/schema/analytics';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { bids } from '@/lib/db/schema/bids';

export class AssetAnalyticsService {
  /**
   * Calculate asset performance metrics
   * Task 5.1.1: Implement asset performance calculation
   */
  async calculateAssetPerformance(
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    // Calculate performance for each asset type/make/model/year combination
    const performanceData: any = await db.execute(sql`
      WITH auction_stats AS (
        SELECT 
          sc.asset_type,
          sc.asset_details->>'make' AS make,
          sc.asset_details->>'model' AS model,
          (sc.asset_details->>'year')::int AS year,
          sc.damage_severity,
          a.id AS auction_id,
          a.current_bid AS final_price,
          a.end_time,
          COUNT(b.id) AS bid_count,
          CASE WHEN a.current_bid IS NOT NULL THEN 1 ELSE 0 END AS sold
        FROM ${auctions} a
        JOIN ${salvageCases} sc ON a.case_id = sc.id
        LEFT JOIN ${bids} b ON b.auction_id = a.id
        WHERE a.status = 'closed'
          AND a.end_time BETWEEN ${periodStart.toISOString()} AND ${periodEnd.toISOString()}
        GROUP BY sc.asset_type, sc.asset_details, sc.damage_severity, a.id
      )
      SELECT 
        asset_type,
        make,
        model,
        year,
        damage_severity,
        COUNT(*) AS total_auctions,
        SUM(bid_count) AS total_bids,
        AVG(bid_count) AS avg_bids_per_auction,
        AVG(final_price) AS avg_final_price,
        AVG(sold) AS avg_sell_through_rate,
        AVG(EXTRACT(EPOCH FROM (end_time - ${periodStart.toISOString()}::timestamp)) / 3600) AS avg_time_to_sell
      FROM auction_stats
      GROUP BY asset_type, make, model, year, damage_severity
    `);

    // Insert or update performance analytics
    for (const row of performanceData) {
      const demandScore = this.calculateDemandScore(
        parseInt(row.total_auctions),
        parseFloat(row.avg_bids_per_auction),
        parseFloat(row.avg_sell_through_rate)
      );

      await db.insert(assetPerformanceAnalytics).values({
        assetType: row.asset_type,
        make: row.make,
        model: row.model,
        year: row.year,
        damageSeverity: row.damage_severity,
        totalAuctions: parseInt(row.total_auctions),
        totalBids: parseInt(row.total_bids),
        avgBidsPerAuction: row.avg_bids_per_auction,
        avgFinalPrice: row.avg_final_price,
        avgSellThroughRate: row.avg_sell_through_rate,
        avgTimeToSell: Math.round(parseFloat(row.avg_time_to_sell || '0')),
        demandScore,
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
      });
    }
  }

  /**
   * Calculate attribute performance metrics
   * Task 5.1.2: Implement attribute performance calculation
   */
  async calculateAttributePerformance(
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    // Calculate performance for color attribute
    await this.calculateColorPerformance(periodStart, periodEnd);
    
    // Calculate performance for trim attribute
    await this.calculateTrimPerformance(periodStart, periodEnd);
    
    // Calculate performance for storage attribute (electronics)
    await this.calculateStoragePerformance(periodStart, periodEnd);
  }

  private async calculateColorPerformance(periodStart: Date, periodEnd: Date): Promise<void> {
    const colorData: any = await db.execute(sql`
      WITH color_stats AS (
        SELECT 
          sc.asset_type,
          sc.asset_details->>'color' AS color,
          a.current_bid AS final_price,
          sc.market_value,
          COUNT(b.id) AS bid_count
        FROM ${auctions} a
        JOIN ${salvageCases} sc ON a.case_id = sc.id
        LEFT JOIN ${bids} b ON b.auction_id = a.id
        WHERE a.status = 'closed'
          AND a.end_time BETWEEN ${periodStart.toISOString()} AND ${periodEnd.toISOString()}
          AND sc.asset_details->>'color' IS NOT NULL
        GROUP BY sc.asset_type, sc.asset_details->>'color', a.current_bid, sc.market_value
      ),
      baseline AS (
        SELECT 
          asset_type,
          AVG(final_price) AS baseline_price
        FROM color_stats
        GROUP BY asset_type
      )
      SELECT 
        cs.asset_type,
        cs.color,
        COUNT(*) AS total_auctions,
        AVG(cs.final_price - b.baseline_price) AS avg_price_premium,
        AVG(cs.bid_count) AS avg_bid_count
      FROM color_stats cs
      JOIN baseline b ON cs.asset_type = b.asset_type
      GROUP BY cs.asset_type, cs.color
    `);

    for (const row of colorData) {
      const popularityScore = this.calculatePopularityScore(
        parseInt(row.total_auctions),
        parseFloat(row.avg_bid_count)
      );

      await db.insert(attributePerformanceAnalytics).values({
        assetType: row.asset_type,
        attributeType: 'color',
        attributeValue: row.color,
        totalAuctions: parseInt(row.total_auctions),
        avgPricePremium: row.avg_price_premium,
        avgBidCount: row.avg_bid_count,
        popularityScore,
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
      });
    }
  }

  private async calculateTrimPerformance(periodStart: Date, periodEnd: Date): Promise<void> {
    const trimData: any = await db.execute(sql`
      WITH trim_stats AS (
        SELECT 
          sc.asset_type,
          sc.asset_details->>'trim' AS trim,
          a.current_bid AS final_price,
          sc.market_value,
          COUNT(b.id) AS bid_count
        FROM ${auctions} a
        JOIN ${salvageCases} sc ON a.case_id = sc.id
        LEFT JOIN ${bids} b ON b.auction_id = a.id
        WHERE a.status = 'closed'
          AND a.end_time BETWEEN ${periodStart.toISOString()} AND ${periodEnd.toISOString()}
          AND sc.asset_details->>'trim' IS NOT NULL
        GROUP BY sc.asset_type, sc.asset_details->>'trim', a.current_bid, sc.market_value
      ),
      baseline AS (
        SELECT 
          asset_type,
          AVG(final_price) AS baseline_price
        FROM trim_stats
        GROUP BY asset_type
      )
      SELECT 
        ts.asset_type,
        ts.trim,
        COUNT(*) AS total_auctions,
        AVG(ts.final_price - b.baseline_price) AS avg_price_premium,
        AVG(ts.bid_count) AS avg_bid_count
      FROM trim_stats ts
      JOIN baseline b ON ts.asset_type = b.asset_type
      GROUP BY ts.asset_type, ts.trim
    `);

    for (const row of trimData) {
      const popularityScore = this.calculatePopularityScore(
        parseInt(row.total_auctions),
        parseFloat(row.avg_bid_count)
      );

      await db.insert(attributePerformanceAnalytics).values({
        assetType: row.asset_type,
        attributeType: 'trim',
        attributeValue: row.trim,
        totalAuctions: parseInt(row.total_auctions),
        avgPricePremium: row.avg_price_premium,
        avgBidCount: row.avg_bid_count,
        popularityScore,
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
      });
    }
  }

  private async calculateStoragePerformance(periodStart: Date, periodEnd: Date): Promise<void> {
    const storageData: any = await db.execute(sql`
      WITH storage_stats AS (
        SELECT 
          sc.asset_type,
          sc.asset_details->>'storage' AS storage,
          a.current_bid AS final_price,
          sc.market_value,
          COUNT(b.id) AS bid_count
        FROM ${auctions} a
        JOIN ${salvageCases} sc ON a.case_id = sc.id
        LEFT JOIN ${bids} b ON b.auction_id = a.id
        WHERE a.status = 'closed'
          AND a.end_time BETWEEN ${periodStart.toISOString()} AND ${periodEnd.toISOString()}
          AND sc.asset_type = 'electronics'
          AND sc.asset_details->>'storage' IS NOT NULL
        GROUP BY sc.asset_type, sc.asset_details->>'storage', a.current_bid, sc.market_value
      ),
      baseline AS (
        SELECT 
          asset_type,
          AVG(final_price) AS baseline_price
        FROM storage_stats
        GROUP BY asset_type
      )
      SELECT 
        ss.asset_type,
        ss.storage,
        COUNT(*) AS total_auctions,
        AVG(ss.final_price - b.baseline_price) AS avg_price_premium,
        AVG(ss.bid_count) AS avg_bid_count
      FROM storage_stats ss
      JOIN baseline b ON ss.asset_type = b.asset_type
      GROUP BY ss.asset_type, ss.storage
    `);

    for (const row of storageData) {
      const popularityScore = this.calculatePopularityScore(
        parseInt(row.total_auctions),
        parseFloat(row.avg_bid_count)
      );

      await db.insert(attributePerformanceAnalytics).values({
        assetType: row.asset_type,
        attributeType: 'storage',
        attributeValue: row.storage,
        totalAuctions: parseInt(row.total_auctions),
        avgPricePremium: row.avg_price_premium,
        avgBidCount: row.avg_bid_count,
        popularityScore,
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
      });
    }
  }

  /**
   * Calculate demand score (0-100)
   */
  private calculateDemandScore(
    totalAuctions: number,
    avgBidsPerAuction: number,
    avgSellThroughRate: number
  ): number {
    // Normalize metrics to 0-100 scale
    const auctionScore = Math.min(100, (totalAuctions / 10) * 30);
    const bidScore = Math.min(100, (avgBidsPerAuction / 5) * 40);
    const sellScore = avgSellThroughRate * 30;

    const totalScore = auctionScore + bidScore + sellScore;
    return Math.round(Math.min(100, totalScore));
  }

  /**
   * Calculate popularity score (0-100)
   */
  private calculatePopularityScore(
    totalAuctions: number,
    avgBidCount: number
  ): number {
    const auctionScore = Math.min(100, (totalAuctions / 20) * 50);
    const bidScore = Math.min(100, (avgBidCount / 5) * 50);

    const totalScore = auctionScore + bidScore;
    return Math.round(Math.min(100, totalScore));
  }

  /**
   * Get asset performance data (query method for API)
   */
  async getAssetPerformance(filters: {
    assetType?: string;
    make?: string;
    model?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const { assetType, make, model, startDate, endDate, limit = 50 } = filters;

    // Apply filters
    const conditions = [];
    if (assetType) {
      // Use sql template for enum comparison
      conditions.push(sql`${assetPerformanceAnalytics.assetType}::text = ${assetType}`);
    }
    if (make) {
      conditions.push(eq(assetPerformanceAnalytics.make, make));
    }
    if (model) {
      conditions.push(eq(assetPerformanceAnalytics.model, model));
    }
    if (startDate) {
      conditions.push(gte(assetPerformanceAnalytics.periodStart, startDate.toISOString().split('T')[0]));
    }
    if (endDate) {
      conditions.push(lte(assetPerformanceAnalytics.periodEnd, endDate.toISOString().split('T')[0]));
    }

    if (conditions.length > 0) {
      return await db
        .select()
        .from(assetPerformanceAnalytics)
        .where(and(...conditions))
        .orderBy(desc(assetPerformanceAnalytics.demandScore))
        .limit(limit);
    }

    return await db
      .select()
      .from(assetPerformanceAnalytics)
      .orderBy(desc(assetPerformanceAnalytics.demandScore))
      .limit(limit);
  }

  /**
   * Get attribute performance data (query method for API)
   */
  async getAttributePerformance(filters: {
    assetType?: string;
    attributeType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const { assetType, attributeType, startDate, endDate, limit = 50 } = filters;

    // Apply filters
    const conditions = [];
    if (assetType) {
      // Use sql template for enum comparison
      conditions.push(sql`${attributePerformanceAnalytics.assetType}::text = ${assetType}`);
    }
    if (attributeType) {
      conditions.push(eq(attributePerformanceAnalytics.attributeType, attributeType));
    }
    if (startDate) {
      conditions.push(gte(attributePerformanceAnalytics.periodStart, startDate.toISOString().split('T')[0]));
    }
    if (endDate) {
      conditions.push(lte(attributePerformanceAnalytics.periodEnd, endDate.toISOString().split('T')[0]));
    }

    if (conditions.length > 0) {
      return await db
        .select()
        .from(attributePerformanceAnalytics)
        .where(and(...conditions))
        .orderBy(desc(attributePerformanceAnalytics.popularityScore))
        .limit(limit);
    }

    return await db
      .select()
      .from(attributePerformanceAnalytics)
      .orderBy(desc(attributePerformanceAnalytics.popularityScore))
      .limit(limit);
  }
}
