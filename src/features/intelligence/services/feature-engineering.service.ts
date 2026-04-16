/**
 * FeatureEngineeringService
 * Tasks 6.1.1-6.1.7
 */

import { db } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { featureVectors } from '@/lib/db/schema/ml-training';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { vendors } from '@/lib/db/schema/vendors';
import { bids } from '@/lib/db/schema/bids';

export class FeatureEngineeringService {
  /**
   * Normalize numerical features to 0-1 range
   * Task 6.1.4: Implement normalization for numerical features
   */
  normalizeFeatures(features: Record<string, number>, ranges: Record<string, { min: number; max: number }>): Record<string, number> {
    const normalized: Record<string, number> = {};
    
    for (const [key, value] of Object.entries(features)) {
      if (ranges[key]) {
        const { min, max } = ranges[key];
        const range = max - min;
        normalized[key] = range > 0 ? (value - min) / range : 0;
      } else {
        normalized[key] = value;
      }
    }
    
    return normalized;
  }

  /**
   * One-hot encode categorical features
   * Task 6.1.5: Implement one-hot encoding for categorical features
   */
  oneHotEncode(feature: string, value: string, possibleValues: string[]): Record<string, number> {
    const encoded: Record<string, number> = {};
    
    for (const possibleValue of possibleValues) {
      encoded[`${feature}_${possibleValue}`] = value === possibleValue ? 1 : 0;
    }
    
    return encoded;
  }

  /**
   * Impute missing values
   * Task 6.1.6: Implement missing value imputation strategies
   */
  imputeMissingValues(
    features: Record<string, any>,
    strategy: 'mean' | 'median' | 'mode' | 'zero' = 'mean',
    historicalData?: Record<string, number[]>
  ): Record<string, any> {
    const imputed: Record<string, any> = { ...features };
    
    for (const [key, value] of Object.entries(imputed)) {
      if (value === null || value === undefined || (typeof value === 'number' && isNaN(value))) {
        if (strategy === 'zero') {
          imputed[key] = 0;
        } else if (strategy === 'mean' && historicalData?.[key] && historicalData[key].length > 0) {
          const values = historicalData[key];
          imputed[key] = values.reduce((a, b) => a + b, 0) / values.length;
        } else if (strategy === 'median' && historicalData?.[key] && historicalData[key].length > 0) {
          const values = [...historicalData[key]].sort((a, b) => a - b);
          const mid = Math.floor(values.length / 2);
          imputed[key] = values.length % 2 === 0 
            ? (values[mid - 1] + values[mid]) / 2 
            : values[mid];
        } else if (strategy === 'mode' && historicalData?.[key] && historicalData[key].length > 0) {
          const values = historicalData[key];
          const frequency: Record<number, number> = {};
          let maxFreq = 0;
          let mode = 0;
          
          for (const val of values) {
            frequency[val] = (frequency[val] || 0) + 1;
            if (frequency[val] > maxFreq) {
              maxFreq = frequency[val];
              mode = val;
            }
          }
          
          imputed[key] = mode;
        } else {
          imputed[key] = 0; // Default fallback
        }
      }
    }
    
    return imputed;
  }

  async computeAuctionFeatures(auctionId: string): Promise<void> {
    const auctionData: any = await db.execute(sql`
      SELECT 
        a.id,
        a.current_bid,
        a.watching_count,
        a.end_time,
        sc.asset_type,
        sc.asset_details,
        sc.damage_severity,
        sc.market_value,
        sc.estimated_salvage_value,
        sc.damaged_parts,
        COUNT(b.id) AS bid_count,
        AVG(b.amount) AS avg_bid_amount
      FROM ${auctions} a
      JOIN ${salvageCases} sc ON a.case_id = sc.id
      LEFT JOIN ${bids} b ON b.auction_id = a.id
      WHERE a.id = ${auctionId}
      GROUP BY a.id, sc.id
    `);

    if (auctionData.length === 0) return;

    const row = auctionData[0];
    const endTime = new Date(row.end_time);

    const features = {
      assetType: row.asset_type,
      make: row.asset_details?.make,
      model: row.asset_details?.model,
      year: row.asset_details?.year ? parseInt(row.asset_details.year) : undefined,
      damageSeverity: row.damage_severity,
      marketValue: parseFloat(row.market_value || '0'),
      estimatedSalvageValue: parseFloat(row.estimated_salvage_value || '0'),
      hourSin: Math.sin((2 * Math.PI * endTime.getHours()) / 24),
      hourCos: Math.cos((2 * Math.PI * endTime.getHours()) / 24),
      dayOfWeekSin: Math.sin((2 * Math.PI * endTime.getDay()) / 7),
      dayOfWeekCos: Math.cos((2 * Math.PI * endTime.getDay()) / 7),
      monthSin: Math.sin((2 * Math.PI * endTime.getMonth()) / 12),
      monthCos: Math.cos((2 * Math.PI * endTime.getMonth()) / 12),
      damagedPartsCount: row.damaged_parts?.length || 0,
    };

    await db.insert(featureVectors).values({
      entityType: 'auction',
      entityId: auctionId,
      features,
      version: 'v1.0',
    });
  }

  async computeVendorFeatures(vendorId: string): Promise<void> {
    const vendorData: any = await db.execute(sql`
      SELECT 
        v.id,
        v.rating,
        COUNT(b.id) AS total_bids,
        AVG(b.amount) AS avg_bid_amount,
        COUNT(b.id) FILTER (WHERE a.current_bidder = v.id)::float / NULLIF(COUNT(b.id), 0) AS win_rate
      FROM ${vendors} v
      LEFT JOIN ${bids} b ON b.vendor_id = v.id
      LEFT JOIN ${auctions} a ON b.auction_id = a.id
      WHERE v.id = ${vendorId}
        AND b.created_at > NOW() - INTERVAL '6 months'
      GROUP BY v.id
    `);

    if (vendorData.length === 0) return;

    const row = vendorData[0];

    const features = {
      vendorRating: parseFloat(row.rating || '0'),
      vendorWinRate: parseFloat(row.win_rate || '0'),
      vendorTotalBids: parseInt(row.total_bids || '0'),
      vendorAvgBidAmount: parseFloat(row.avg_bid_amount || '0'),
    };

    await db.insert(featureVectors).values({
      entityType: 'vendor',
      entityId: vendorId,
      features,
      version: 'v1.0',
    });
  }
}
