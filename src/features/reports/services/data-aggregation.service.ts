/**
 * Data Aggregation Service
 * 
 * Handles complex data aggregation and calculations for reports
 * Task 3: Core Report Engine Foundation
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments, bids, vendors, users } from '@/lib/db/schema';
import { eq, and, gte, lte, sql, inArray, desc, type AnyColumn } from 'drizzle-orm';
import { ReportFilters } from '../types';
import { formatVendorDisplayName } from '@/lib/utils/vendor-display-name';

export class DataAggregationService {
  /**
   * Build date range condition
   */
  private static buildDateRangeCondition(
    dateColumn: AnyColumn,
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
      conditions.push(sql`${salvageCases.assetType} = ANY(${filters.assetTypes})`);
    }
    
    // Status
    if (filters.status && filters.status.length > 0) {
      conditions.push(sql`${salvageCases.status} = ANY(${filters.status})`);
    }
    
    // User IDs (adjuster)
    if (filters.userIds && filters.userIds.length > 0) {
      conditions.push(inArray(salvageCases.createdBy, filters.userIds));
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
        adjusterId: salvageCases.createdBy,
        auctionId: auctions.id,
        currentBid: auctions.currentBid,
        reservePrice: salvageCases.reservePrice,
        auctionStatus: auctions.status,
        winnerId: auctions.currentBidder,
        auctionCreatedAt: auctions.createdAt,
        auctionClosedAt: auctions.updatedAt,
        paymentId: payments.id,
        paymentAmount: sql<string>`COALESCE(${auctions.finalSettledAmount}, ${payments.amount})`,
        paymentStatus: payments.status,
        paymentMethod: payments.paymentMethod,
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
      conditions.push(sql`${payments.status} = ANY(${filters.status})`);
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

    const paymentRows = await db
      .select({
        paymentId: payments.id,
        amount: payments.amount,
        status: payments.status,
        method: payments.paymentMethod,
        createdAt: payments.createdAt,
        verifiedAt: payments.verifiedAt,
        vendorId: payments.vendorId,
        auctionId: payments.auctionId,
        vendorBusinessName: vendors.businessName,
        vendorUserFullName: users.fullName,
        vendorTier: vendors.tier,
      })
      .from(payments)
      .leftJoin(vendors, eq(payments.vendorId, vendors.id))
      .leftJoin(users, eq(vendors.userId, users.id))
      .where(whereClause);

    return paymentRows.map((row) => ({
      paymentId: row.paymentId,
      amount: row.amount,
      status: row.status,
      method: row.method,
      createdAt: row.createdAt,
      verifiedAt: row.verifiedAt,
      vendorId: row.vendorId,
      auctionId: row.auctionId,
      vendorName: formatVendorDisplayName({
        businessName: row.vendorBusinessName,
        fullName: row.vendorUserFullName,
      }),
      vendorTier: row.vendorTier,
    }));
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
      conditions.push(sql`${auctions.status} = ANY(${filters.status})`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const auctionData = await db
      .select({
        auctionId: auctions.id,
        caseId: auctions.caseId,
        currentBid: auctions.currentBid,
        reservePrice: salvageCases.reservePrice,
        status: auctions.status,
        winnerId: auctions.currentBidder,
        createdAt: auctions.createdAt,
        closedAt: auctions.updatedAt,
        startTime: auctions.startTime,
        endTime: auctions.endTime,
      })
      .from(auctions)
      .leftJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(whereClause);

    // Get bids for these auctions
    const auctionIds = auctionData.map(a => a.auctionId);
    
    const bidData = auctionIds.length > 0
      ? await db
        .select({
          bidId: bids.id,
          auctionId: bids.auctionId,
          vendorId: bids.vendorId,
          amount: bids.amount,
          createdAt: bids.createdAt,
        })
        .from(bids)
        .where(inArray(bids.auctionId, auctionIds))
        .orderBy(desc(bids.createdAt))
      : [];

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

    const vendorRows = await db
      .select({
        vendorId: vendors.id,
        businessName: vendors.businessName,
        vendorUserFullName: users.fullName,
        tier: vendors.tier,
        rating: vendors.rating,
        status: vendors.status,
        performanceStats: vendors.performanceStats,
        createdAt: vendors.createdAt,
      })
      .from(vendors)
      .leftJoin(users, eq(vendors.userId, users.id))
      .where(whereClause);

    return vendorRows.map((row) => ({
      vendorId: row.vendorId,
      businessName: formatVendorDisplayName({
        businessName: row.businessName,
        fullName: row.vendorUserFullName,
      }),
      tier: row.tier,
      rating: row.rating,
      status: row.status,
      performanceStats: row.performanceStats,
      createdAt: row.createdAt,
    }));
  }

  /**
   * Calculate summary statistics
   */
  static calculateSummaryStats<T>(data: T[], valueField: keyof T) {
    if (data.length === 0) {
      return {
        count: 0,
        sum: 0,
        average: 0,
        min: 0,
        max: 0,
      };
    }

    const values = data.map(item => Number(item[valueField] || 0));
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
  static calculateTrend<T>(
    data: T[],
    dateField: keyof T,
    valueField: keyof T,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ) {
    const grouped: Record<string, { values: number[]; count: number }> = {};

    for (const item of data) {
      const date = new Date(String(item[dateField]));
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

      grouped[key].values.push(Number(item[valueField] || 0));
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
