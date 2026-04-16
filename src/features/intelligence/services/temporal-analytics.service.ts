/**
 * TemporalAnalyticsService
 * 
 * Service for analyzing temporal patterns (hourly, daily, seasonal).
 * Tasks 5.2.1-5.2.6
 * 
 * @module intelligence/services/temporal-analytics
 */

import { db } from '@/lib/db';
import { sql, eq, and, gte, lte, desc } from 'drizzle-orm';
import { temporalPatternsAnalytics } from '@/lib/db/schema/analytics';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { bids } from '@/lib/db/schema/bids';

export class TemporalAnalyticsService {
  /**
   * Calculate hourly bidding patterns
   * Task 5.2.1: Implement hourly bidding pattern analysis
   */
  async calculateHourlyPatterns(periodStart: Date, periodEnd: Date): Promise<void> {
    const hourlyData: any = await db.execute(sql`
      SELECT 
        sc.asset_type,
        EXTRACT(HOUR FROM b.created_at) AS hour_of_day,
        COUNT(b.id) AS bid_count,
        AVG(b.amount) AS avg_bid_amount,
        COUNT(DISTINCT b.vendor_id) AS vendor_activity
      FROM ${bids} b
      JOIN ${auctions} a ON b.auction_id = a.id
      JOIN ${salvageCases} sc ON a.case_id = sc.id
      WHERE b.created_at BETWEEN ${periodStart.toISOString()} AND ${periodEnd.toISOString()}
      GROUP BY sc.asset_type, EXTRACT(HOUR FROM b.created_at)
    `);

    for (const row of hourlyData) {
      const peakScore = this.calculatePeakActivityScore(
        parseInt(row.bid_count),
        parseInt(row.vendor_activity)
      );

      await db.insert(temporalPatternsAnalytics).values({
        assetType: row.asset_type,
        hourOfDay: parseInt(row.hour_of_day),
        dayOfWeek: null,
        monthOfYear: null,
        avgBidCount: row.bid_count,
        avgFinalPrice: row.avg_bid_amount,
        avgVendorActivity: row.vendor_activity,
        peakActivityScore: peakScore,
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
      });
    }
  }

  /**
   * Calculate daily patterns (day of week)
   * Task 5.2.2: Implement daily pattern analysis
   */
  async calculateDailyPatterns(periodStart: Date, periodEnd: Date): Promise<void> {
    const dailyData: any = await db.execute(sql`
      SELECT 
        sc.asset_type,
        EXTRACT(DOW FROM b.created_at) AS day_of_week,
        COUNT(b.id) AS bid_count,
        AVG(b.amount) AS avg_bid_amount,
        COUNT(DISTINCT b.vendor_id) AS vendor_activity
      FROM ${bids} b
      JOIN ${auctions} a ON b.auction_id = a.id
      JOIN ${salvageCases} sc ON a.case_id = sc.id
      WHERE b.created_at BETWEEN ${periodStart.toISOString()} AND ${periodEnd.toISOString()}
      GROUP BY sc.asset_type, EXTRACT(DOW FROM b.created_at)
    `);

    for (const row of dailyData) {
      const peakScore = this.calculatePeakActivityScore(
        parseInt(row.bid_count),
        parseInt(row.vendor_activity)
      );

      await db.insert(temporalPatternsAnalytics).values({
        assetType: row.asset_type,
        hourOfDay: null,
        dayOfWeek: parseInt(row.day_of_week),
        monthOfYear: null,
        avgBidCount: row.bid_count,
        avgFinalPrice: row.avg_bid_amount,
        avgVendorActivity: row.vendor_activity,
        peakActivityScore: peakScore,
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
      });
    }
  }

  /**
   * Calculate seasonal patterns (month of year)
   * Task 5.2.3: Implement seasonal pattern analysis
   */
  async calculateSeasonalPatterns(periodStart: Date, periodEnd: Date): Promise<void> {
    const seasonalData: any = await db.execute(sql`
      SELECT 
        sc.asset_type,
        EXTRACT(MONTH FROM b.created_at) AS month_of_year,
        COUNT(b.id) AS bid_count,
        AVG(b.amount) AS avg_bid_amount,
        COUNT(DISTINCT b.vendor_id) AS vendor_activity
      FROM ${bids} b
      JOIN ${auctions} a ON b.auction_id = a.id
      JOIN ${salvageCases} sc ON a.case_id = sc.id
      WHERE b.created_at BETWEEN ${periodStart.toISOString()} AND ${periodEnd.toISOString()}
      GROUP BY sc.asset_type, EXTRACT(MONTH FROM b.created_at)
    `);

    for (const row of seasonalData) {
      const peakScore = this.calculatePeakActivityScore(
        parseInt(row.bid_count),
        parseInt(row.vendor_activity)
      );

      await db.insert(temporalPatternsAnalytics).values({
        assetType: row.asset_type,
        hourOfDay: null,
        dayOfWeek: null,
        monthOfYear: parseInt(row.month_of_year),
        avgBidCount: row.bid_count,
        avgFinalPrice: row.avg_bid_amount,
        avgVendorActivity: row.vendor_activity,
        peakActivityScore: peakScore,
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
      });
    }
  }

  /**
   * Calculate peak activity score (0-100)
   * Task 5.2.4: Implement peak activity score calculation
   */
  private calculatePeakActivityScore(bidCount: number, vendorActivity: number): number {
    // Normalize to 0-100 scale
    const bidScore = Math.min(100, (bidCount / 50) * 60);
    const vendorScore = Math.min(100, (vendorActivity / 10) * 40);

    return Math.round(bidScore + vendorScore);
  }

  /**
   * Get temporal patterns data (query method for API)
   */
  async getTemporalPatterns(filters: {
    assetType?: string;
    patternType?: 'hourly' | 'daily' | 'weekly' | 'monthly';
    startDate?: Date;
    endDate?: Date;
  }) {
    const { assetType, patternType, startDate, endDate } = filters;

    // Apply filters
    const conditions = [];
    if (assetType) {
      // Use sql template for enum comparison
      conditions.push(sql`${temporalPatternsAnalytics.assetType}::text = ${assetType}`);
    }
    if (patternType === 'hourly') {
      conditions.push(sql`${temporalPatternsAnalytics.hourOfDay} IS NOT NULL`);
    } else if (patternType === 'daily') {
      conditions.push(sql`${temporalPatternsAnalytics.dayOfWeek} IS NOT NULL`);
    } else if (patternType === 'monthly') {
      conditions.push(sql`${temporalPatternsAnalytics.monthOfYear} IS NOT NULL`);
    }
    if (startDate) {
      conditions.push(gte(temporalPatternsAnalytics.periodStart, startDate.toISOString().split('T')[0]));
    }
    if (endDate) {
      conditions.push(lte(temporalPatternsAnalytics.periodEnd, endDate.toISOString().split('T')[0]));
    }

    if (conditions.length > 0) {
      return await db
        .select()
        .from(temporalPatternsAnalytics)
        .where(and(...conditions))
        .orderBy(desc(temporalPatternsAnalytics.peakActivityScore));
    }

    return await db
      .select()
      .from(temporalPatternsAnalytics)
      .orderBy(desc(temporalPatternsAnalytics.peakActivityScore));
  }
}
