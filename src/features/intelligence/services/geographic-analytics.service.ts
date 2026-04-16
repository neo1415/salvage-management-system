/**
 * GeographicAnalyticsService
 * Tasks 5.3.1-5.3.5
 */

import { db } from '@/lib/db';
import { sql, eq, and, gte, lte, desc } from 'drizzle-orm';
import { geographicPatternsAnalytics } from '@/lib/db/schema/analytics';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';

export class GeographicAnalyticsService {
  async calculateGeographicPatterns(periodStart: Date, periodEnd: Date): Promise<void> {
    const geoData: any = await db.execute(sql`
      SELECT 
        sc.asset_type,
        sc.asset_details->>'region' AS region,
        COUNT(a.id) AS total_auctions,
        AVG(a.current_bid) AS avg_final_price,
        STDDEV(a.current_bid) AS price_variance,
        COUNT(DISTINCT b.vendor_id) AS avg_vendor_count
      FROM ${auctions} a
      JOIN ${salvageCases} sc ON a.case_id = sc.id
      LEFT JOIN bids b ON b.auction_id = a.id
      WHERE a.status = 'closed'
        AND a.end_time BETWEEN ${periodStart.toISOString()} AND ${periodEnd.toISOString()}
        AND sc.asset_details->>'region' IS NOT NULL
      GROUP BY sc.asset_type, sc.asset_details->>'region'
    `);

    for (const row of geoData) {
      const demandScore = Math.min(100, Math.round((parseInt(row.total_auctions) / 10) * 50 + (parseInt(row.avg_vendor_count) / 5) * 50));

      await db.insert(geographicPatternsAnalytics).values({
        region: row.region,
        assetType: row.asset_type,
        totalAuctions: parseInt(row.total_auctions),
        avgFinalPrice: row.avg_final_price,
        priceVariance: row.price_variance,
        avgVendorCount: row.avg_vendor_count,
        demandScore,
        periodStart: periodStart.toISOString().split('T')[0],
        periodEnd: periodEnd.toISOString().split('T')[0],
      });
    }
  }

  /**
   * Get geographic patterns data (query method for API)
   */
  async getGeographicPatterns(filters: {
    assetType?: string;
    region?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const { assetType, region, startDate, endDate } = filters;

    // Apply filters
    const conditions = [];
    if (assetType) {
      // Use sql template for enum comparison
      conditions.push(sql`${geographicPatternsAnalytics.assetType}::text = ${assetType}`);
    }
    if (region) {
      conditions.push(eq(geographicPatternsAnalytics.region, region));
    }
    if (startDate) {
      conditions.push(gte(geographicPatternsAnalytics.periodStart, startDate.toISOString().split('T')[0]));
    }
    if (endDate) {
      conditions.push(lte(geographicPatternsAnalytics.periodEnd, endDate.toISOString().split('T')[0]));
    }

    if (conditions.length > 0) {
      return await db
        .select()
        .from(geographicPatternsAnalytics)
        .where(and(...conditions))
        .orderBy(desc(geographicPatternsAnalytics.demandScore));
    }

    return await db
      .select()
      .from(geographicPatternsAnalytics)
      .orderBy(desc(geographicPatternsAnalytics.demandScore));
  }
}
