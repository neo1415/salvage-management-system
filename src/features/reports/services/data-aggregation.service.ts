/**
 * Data Aggregation Service
 * 
 * Handles complex data aggregation and calculations for reports
 * Task 3: Core Report Engine Foundation
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments, bids, vendors, users } from '@/lib/db/schema';
import { eq, and, gte, lte, sql, inArray, desc } from 'drizzle-orm';
import { ReportFilters } from '../types';

export class DataAggregationService {
  /**
   * Build date range condition
   */
  private static buildDateRangeCondition(
    dateColumn: any,
    startDate?: string,
    endDate?: string
  ) {
    const conditions = [];
    
    if (startDate) {
      conditions.push(gte(dateColumn, new Date(startDate)));
    }
    
    if (endDate) {
      conditions.push(lte(dateColumn, new Date(endDate)));
    }
    
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Get cases with auctions and payments
   */
  static async getCasesWithDetails(filters: ReportFilters) {
    const conditions = [];
    
    // Date range
    if (filters.startDate || filters.endDate) {
      const dateCondition = this.buildDateRangeCondition(
        salvageCases.createdAt,
        filters.startDate,
        filters.endDate
      );
      if (dateCondition) conditions.push(dateCondition);
    }
    
    // Asset types
    if (filters.assetTypes && filters.assetTypes.length > 0) {
      conditions.push(inArray(salvageCases.assetType, filters.assetTypes));
    }
    
    // Status
    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(salvageCases.status, filters.status));
    }
    
    // User IDs (adjuster)
    if (filters.userIds && filters.userIds.length > 0) {
      conditions.push(inArray(salvageCases.adjusterId, filters.userIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return await db
      .select({
        caseId: salvageCases.id,
        claimReference: salvageCases.claimReference,
        assetType: salvageCases.assetType,
        marketValue: salvageCases.marketValue,
        estimatedSalvageValue: salvageCases.estimatedSalvageValue,
        caseStatus: salvageCases.status,
        caseCreatedAt: salvageCases.createdAt,
        adjusterId: salvageCases.adjusterId,
        auctionId: auctions.id,
        currentBid: auctions.currentBid,
        reservePrice: auctions.reservePrice,
        auctionStatus: auctions.status,
        winnerId: auctions.winnerId,
        auctionCreatedAt: auctions.createdAt,
        auctionClosedAt: auctions.closedAt,
        paymentId: payments.id,
        paymentAmount: payments.amount,
        paymentStatus: payments.status,
        paymentMethod: payments.method,
        paymentCreatedAt: payments.createdAt,
        paymentVerifiedAt: payments.verifiedAt,
        vendorId: payments.vendorId,
      })
      .from(salvageCases)
      .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
      .leftJoin(payments, eq(auctions.id, payments.auctionId))
      .where(whereClause);
  }

  /**
   * Get payments with details
   */
  static async getPaymentsWithDetails(filters: ReportFilters) {
    const conditions = [];
    
    // Date range
    if (filters.startDate || filters.endDate) {
      const dateCondition = this.buildDateRangeCondition(
        payments.createdAt,
        filters.startDate,
        filters.endDate
      );
      if (dateCondition) conditions.push(dateCondition);
    }
    
    // Status
    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(payments.status, filters.status));
    }
    
    // Vendor IDs
    if (filters.vendorIds && filters.vendorIds.length > 0) {
      conditions.push(inArray(payments.vendorId, filters.vendorIds));
    }
    
    // Amount range
    if (filters.minAmount !== undefined) {
      conditions.push(gte(payments.amount, filters.minAmount.toString()));
    }
    if (filters.maxAmount !== undefined) {
      conditions.push(lte(payments.amount, filters.maxAmount.toString()));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return await db
      .select({
        paymentId: payments.id,
        amount: payments.amount,
        status: payments.status,
        method: payments.method,
        createdAt: payments.createdAt,
        verifiedAt: payments.verifiedAt,
        vendorId: payments.vendorId,
        auctionId: payments.auctionId,
        vendorName: vendors.businessName,
        vendorTier: vendors.tier,
      })
      .from(payments)
      .leftJoin(vendors, eq(payments.vendorId, vendors.id))
      .where(whereClause);
  }

  /**
   * Get auctions with bids
   */
  static async getAuctionsWithBids(filters: ReportFilters) {
    const conditions = [];
    
    // Date range
    if (filters.startDate || filters.endDate) {
      const dateCondition = this.buildDateRangeCondition(
        auctions.createdAt,
        filters.startDate,
        filters.endDate
      );
      if (dateCondition) conditions.push(dateCondition);
    }
    
    // Status
    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(auctions.status, filters.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const auctionData = await db
      .select({
        auctionId: auctions.id,
        caseId: auctions.caseId,
        currentBid: auctions.currentBid,
        reservePrice: auctions.reservePrice,
        status: auctions.status,
        winnerId: auctions.winnerId,
        createdAt: auctions.createdAt,
        closedAt: auctions.closedAt,
        startTime: auctions.startTime,
        endTime: auctions.endTime,
      })
      .from(auctions)
      .where(whereClause);

    // Get bids for these auctions
    const auctionIds = auctionData.map(a => a.auctionId);
    
    let bidData: any[] = [];
    if (auctionIds.length > 0) {
      bidData = await db
        .select({
          bidId: bids.id,
          auctionId: bids.auctionId,
          vendorId: bids.vendorId,
          amount: bids.amount,
          createdAt: bids.createdAt,
        })
        .from(bids)
        .where(inArray(bids.auctionId, auctionIds))
        .orderBy(desc(bids.createdAt));
    }

    return { auctions: auctionData, bids: bidData };
  }

  /**
   * Get vendor statistics
   */
  static async getVendorStatistics(filters: ReportFilters) {
    const conditions = [];
    
    // Vendor IDs
    if (filters.vendorIds && filters.vendorIds.length > 0) {
      conditions.push(inArray(vendors.id, filters.vendorIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    return await db
      .select({
        vendorId: vendors.id,
        businessName: vendors.businessName,
        tier: vendors.tier,
        rating: vendors.rating,
        status: vendors.status,
        performanceStats: vendors.performanceStats,
        createdAt: vendors.createdAt,
      })
      .from(vendors)
      .where(whereClause);
  }

  /**
   * Calculate summary statistics
   */
  static calculateSummaryStats(data: any[], valueField: string) {
    if (data.length === 0) {
      return {
        count: 0,
        sum: 0,
        average: 0,
        min: 0,
        max: 0,
      };
    }

    const values = data.map(item => parseFloat(item[valueField] || '0'));
    const sum = values.reduce((acc, val) => acc + val, 0);
    const average = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      count: data.length,
      sum: Math.round(sum * 100) / 100,
      average: Math.round(average * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
    };
  }

  /**
   * Group data by field
   */
  static groupBy<T>(data: T[], field: keyof T): Record<string, T[]> {
    // Handle empty arrays
    if (!data || data.length === 0) {
      return {};
    }
    
    return data.reduce((acc, item) => {
      const key = String(item[field]);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }

  /**
   * Calculate trend data by date
   */
  static calculateTrend(
    data: any[],
    dateField: string,
    valueField: string,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ) {
    const grouped: Record<string, { values: number[]; count: number }> = {};

    for (const item of data) {
      const date = new Date(item[dateField]);
      let key: string;

      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped[key]) {
        grouped[key] = { values: [], count: 0 };
      }

      grouped[key].values.push(parseFloat(item[valueField] || '0'));
      grouped[key].count++;
    }

    return Object.entries(grouped)
      .map(([date, data]) => ({
        date,
        sum: Math.round(data.values.reduce((a, b) => a + b, 0) * 100) / 100,
        average: Math.round((data.values.reduce((a, b) => a + b, 0) / data.values.length) * 100) / 100,
        count: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
