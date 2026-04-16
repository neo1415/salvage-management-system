/**
 * BehavioralAnalyticsService
 * Tasks 5.4.1-5.4.5
 */

import { db } from '@/lib/db';
import { sql, eq, and, gte, lte } from 'drizzle-orm';
import { vendorSegments, sessionAnalytics, conversionFunnelAnalytics } from '@/lib/db/schema/analytics';
import { vendors } from '@/lib/db/schema/vendors';
import { bids } from '@/lib/db/schema/bids';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';

export class BehavioralAnalyticsService {
  /**
   * Track vendor session
   * Task 5.4.2: Implement session tracking and analytics
   */
  async trackSession(
    vendorId: string,
    sessionId: string,
    startTime: Date,
    endTime: Date,
    actionsPerformed: string[],
    auctionsViewed: string[]
  ): Promise<void> {
    const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
    const bounceRate = auctionsViewed.length === 1 ? '1.0000' : '0.0000';

    await db.insert(sessionAnalytics).values({
      vendorId,
      sessionId,
      startTime,
      endTime,
      durationSeconds,
      auctionsViewed: auctionsViewed.length,
      bidsPlaced: actionsPerformed.filter(a => a === 'bid_placed').length,
      bounceRate,
    });
  }

  /**
   * Get session analytics for a vendor
   */
  async getVendorSessionAnalytics(vendorId: string, periodStart: Date, periodEnd: Date): Promise<any> {
    const sessions: any = await db.execute(sql`
      SELECT 
        COUNT(*) AS total_sessions,
        AVG(duration_seconds) AS avg_session_duration,
        AVG(auctions_viewed) AS avg_auctions_per_session,
        AVG(bids_placed) AS avg_bids_per_session,
        AVG(bounce_rate) AS avg_bounce_rate
      FROM ${sessionAnalytics}
      WHERE vendor_id = ${vendorId}
        AND start_time BETWEEN ${periodStart.toISOString()} AND ${periodEnd.toISOString()}
    `);

    return sessions[0] || {
      total_sessions: 0,
      avg_session_duration: 0,
      avg_auctions_per_session: 0,
      avg_bids_per_session: 0,
      avg_bounce_rate: 0,
    };
  }

  async segmentVendors(): Promise<void> {
    const result: any = await db.execute(sql`
      WITH vendor_stats AS (
        SELECT 
          v.id AS vendor_id,
          AVG(b.amount / NULLIF(sc.market_value, 0)) AS avg_bid_to_value_ratio,
          ARRAY_AGG(DISTINCT sc.asset_type) AS preferred_asset_types,
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY b.amount) AS price_p25,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY b.amount) AS price_p75,
          COUNT(b.id) / NULLIF(COUNT(DISTINCT DATE_TRUNC('week', b.created_at)), 0) AS bids_per_week,
          COUNT(b.id) FILTER (WHERE a.current_bidder = v.id)::float / NULLIF(COUNT(b.id), 0) AS overall_win_rate,
          MAX(b.created_at) AS last_bid_at
        FROM ${vendors} v
        LEFT JOIN ${bids} b ON b.vendor_id = v.id
        LEFT JOIN ${auctions} a ON b.auction_id = a.id
        LEFT JOIN ${salvageCases} sc ON a.case_id = sc.id
        WHERE b.created_at > NOW() - INTERVAL '6 months'
        GROUP BY v.id
      )
      SELECT * FROM vendor_stats
    `);

    const vendorData = result.rows || result;

    for (const row of vendorData) {
      const priceSegment = this.determinePriceSegment(parseFloat(row.avg_bid_to_value_ratio) || 0);
      const activitySegment = this.determineActivitySegment(parseFloat(row.bids_per_week) || 0);
      const categorySegment = row.preferred_asset_types?.length > 3 ? 'generalist' : 'specialist';

      // Convert last_bid_at to Date object if it's a string
      const lastBidAt = row.last_bid_at ? new Date(row.last_bid_at) : null;

      await db.insert(vendorSegments).values({
        vendorId: row.vendor_id,
        priceSegment,
        categorySegment,
        activitySegment,
        avgBidToValueRatio: row.avg_bid_to_value_ratio?.toString() || '0',
        preferredAssetTypes: row.preferred_asset_types || [],
        preferredPriceRange: { min: parseFloat(row.price_p25) || 0, max: parseFloat(row.price_p75) || 0 },
        bidsPerWeek: row.bids_per_week?.toString() || '0',
        overallWinRate: row.overall_win_rate?.toString() || '0',
        lastBidAt,
      }).onConflictDoUpdate({
        target: vendorSegments.vendorId,
        set: {
          priceSegment,
          categorySegment,
          activitySegment,
          avgBidToValueRatio: row.avg_bid_to_value_ratio?.toString() || '0',
          preferredAssetTypes: row.preferred_asset_types || [],
          preferredPriceRange: { min: parseFloat(row.price_p25) || 0, max: parseFloat(row.price_p75) || 0 },
          bidsPerWeek: row.bids_per_week?.toString() || '0',
          overallWinRate: row.overall_win_rate?.toString() || '0',
          lastBidAt,
          updatedAt: new Date(),
        },
      });
    }
  }

  private determinePriceSegment(bidToValueRatio: number): string {
    if (bidToValueRatio < 0.6) return 'bargain_hunter';
    if (bidToValueRatio > 0.9) return 'premium_buyer';
    return 'value_seeker';
  }

  private determineActivitySegment(bidsPerWeek: number): string {
    if (bidsPerWeek >= 5) return 'active_bidder';
    if (bidsPerWeek >= 2) return 'regular_bidder';
    return 'selective_bidder';
  }

  async calculateConversionFunnel(periodStart: Date, periodEnd: Date): Promise<void> {
    const funnelData: any = await db.execute(sql`
      SELECT 
        sc.asset_type,
        COUNT(DISTINCT a.id) AS total_views,
        COUNT(DISTINCT a.id) FILTER (WHERE a.watching_count > 0) AS total_watches,
        COUNT(DISTINCT b.auction_id) AS total_bids,
        COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder IS NOT NULL) AS total_wins
      FROM ${auctions} a
      JOIN ${salvageCases} sc ON a.case_id = sc.id
      LEFT JOIN ${bids} b ON b.auction_id = a.id
      WHERE a.end_time BETWEEN ${periodStart.toISOString()} AND ${periodEnd.toISOString()}
      GROUP BY sc.asset_type
    `);

    for (const row of funnelData) {
      const totalViews = parseInt(row.total_views);
      const totalWatches = parseInt(row.total_watches);
      const totalBids = parseInt(row.total_bids);
      const totalWins = parseInt(row.total_wins);

      await db.insert(conversionFunnelAnalytics).values({
        assetType: row.asset_type,
        totalViews,
        totalWatches,
        totalBids,
        totalWins,
        viewToWatchRate: totalViews > 0 ? (totalWatches / totalViews).toFixed(4) : '0',
        watchToBidRate: totalWatches > 0 ? (totalBids / totalWatches).toFixed(4) : '0',
        bidToWinRate: totalBids > 0 ? (totalWins / totalBids).toFixed(4) : '0',
        overallConversionRate: totalViews > 0 ? (totalWins / totalViews).toFixed(4) : '0',
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
      });
    }
  }

  /**
   * Get vendor segments data (query method for API)
   */
  async getVendorSegments(filters: {
    segment?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const { segment, startDate, endDate, limit = 50 } = filters;

    let query = db.select().from(vendorSegments);

    // Build where conditions
    const conditions = [];

    if (segment) {
      conditions.push(
        sql`${vendorSegments.priceSegment} = ${segment} OR ${vendorSegments.categorySegment} = ${segment} OR ${vendorSegments.activitySegment} = ${segment}`
      );
    }

    if (startDate) {
      conditions.push(gte(vendorSegments.lastBidAt, startDate));
    }

    if (endDate) {
      conditions.push(lte(vendorSegments.lastBidAt, endDate));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.limit(limit);
  }

  /**
   * Get session metrics data (query method for API)
   */
  async getSessionMetrics(filters: {
    vendorId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    const { vendorId, startDate, endDate, limit = 50 } = filters;

    const conditions = [];
    if (vendorId) {
      conditions.push(eq(sessionAnalytics.vendorId, vendorId));
    }
    if (startDate) {
      conditions.push(gte(sessionAnalytics.startTime, startDate));
    }
    if (endDate) {
      conditions.push(lte(sessionAnalytics.endTime, endDate));
    }

    let sessions;
    if (conditions.length > 0) {
      sessions = await db
        .select()
        .from(sessionAnalytics)
        .where(and(...conditions))
        .limit(limit);
    } else {
      sessions = await db
        .select()
        .from(sessionAnalytics)
        .limit(limit);
    }

    // Calculate aggregate metrics
    if (sessions.length === 0) {
      return {
        metrics: {
          totalSessions: 0,
          avgDuration: 0,
          avgPagesViewed: 0,
          avgBidsPlaced: 0,
          avgBounceRate: 0,
        },
        trends: [],
      };
    }

    const metrics = {
      totalSessions: sessions.length,
      avgDuration: sessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) / sessions.length,
      avgPagesViewed: sessions.reduce((sum, s) => sum + (s.pagesViewed || 0), 0) / sessions.length,
      avgBidsPlaced: sessions.reduce((sum, s) => sum + (s.bidsPlaced || 0), 0) / sessions.length,
      avgBounceRate: sessions.reduce((sum, s) => sum + parseFloat(s.bounceRate?.toString() || '0'), 0) / sessions.length,
    };

    return {
      metrics,
      trends: sessions,
    };
  }

  /**
   * Get conversion funnel data (query method for API)
   */
  async getConversionFunnel(filters: {
    assetType?: string;
    vendorSegment?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { assetType, startDate, endDate } = filters;

    const conditions = [];
    if (assetType) {
      // Use sql template for enum comparison
      conditions.push(sql`${conversionFunnelAnalytics.assetType}::text = ${assetType}`);
    }
    if (startDate) {
      conditions.push(gte(conversionFunnelAnalytics.periodStart, startDate.toISOString().split('T')[0]));
    }
    if (endDate) {
      conditions.push(lte(conversionFunnelAnalytics.periodEnd, endDate.toISOString().split('T')[0]));
    }

    let funnels;
    if (conditions.length > 0) {
      funnels = await db
        .select()
        .from(conversionFunnelAnalytics)
        .where(and(...conditions));
    } else {
      funnels = await db
        .select()
        .from(conversionFunnelAnalytics);
    }

    // Aggregate if multiple records
    if (funnels.length === 0) {
      return null;
    }

    if (funnels.length === 1) {
      return funnels[0];
    }

    // Aggregate multiple funnel records
    const aggregated = {
      totalViews: funnels.reduce((sum, f) => sum + (f.totalViews || 0), 0),
      totalWatches: funnels.reduce((sum, f) => sum + (f.totalWatches || 0), 0),
      totalBids: funnels.reduce((sum, f) => sum + (f.totalBids || 0), 0),
      totalWins: funnels.reduce((sum, f) => sum + (f.totalWins || 0), 0),
    };

    return {
      ...aggregated,
      viewToWatchRate: aggregated.totalViews > 0 ? (aggregated.totalWatches / aggregated.totalViews).toFixed(4) : '0',
      watchToBidRate: aggregated.totalWatches > 0 ? (aggregated.totalBids / aggregated.totalWatches).toFixed(4) : '0',
      bidToWinRate: aggregated.totalBids > 0 ? (aggregated.totalWins / aggregated.totalBids).toFixed(4) : '0',
      overallConversionRate: aggregated.totalViews > 0 ? (aggregated.totalWins / aggregated.totalViews).toFixed(4) : '0',
    };
  }
}
