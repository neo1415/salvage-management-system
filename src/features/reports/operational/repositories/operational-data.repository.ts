/**
 * Operational Data Repository
 * 
 * Repository layer for operational data access
 * Task 11: Operational Data Repository
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, bids, vendors, users } from '@/lib/db/schema';
import { eq, and, gte, lte, sql, inArray, desc, count } from 'drizzle-orm';
import { ReportFilters } from '../../types';

export interface CaseProcessingData {
  caseId: string;
  claimReference: string;
  assetType: string;
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
  processingTimeHours: number | null;
  adjusterId: string;
  adjusterName: string;
}

export interface AuctionPerformanceData {
  auctionId: string;
  caseId: string;
  status: string;
  currentBid: string;
  reservePrice: string;
  bidCount: number;
  uniqueBidders: number;
  startTime: Date;
  endTime: Date;
  closedAt: Date | null;
  winnerId: string | null;
  durationHours: number;
  reserveMet: boolean;
}

export interface VendorPerformanceData {
  vendorId: string;
  vendorName: string;
  tier: string;
  totalBids: number;
  totalWins: number;
  winRate: number;
  averageBidAmount: number;
  totalSpent: number;
  participationRate: number;
}

export class OperationalDataRepository {
  /**
   * Build date range condition
   */
  private static buildDateCondition(dateColumn: any, startDate?: string, endDate?: string) {
    const conditions = [];
    if (startDate) conditions.push(gte(dateColumn, new Date(startDate)));
    if (endDate) conditions.push(lte(dateColumn, new Date(endDate)));
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  /**
   * Get case processing data
   */
  static async getCaseProcessingData(filters: ReportFilters): Promise<CaseProcessingData[]> {
    const conditions = [];

    // Date range
    const dateCondition = this.buildDateCondition(
      salvageCases.createdAt,
      filters.startDate,
      filters.endDate
    );
    if (dateCondition) conditions.push(dateCondition);

    // Asset types
    if (filters.assetTypes && filters.assetTypes.length > 0) {
      conditions.push(inArray(salvageCases.assetType, filters.assetTypes));
    }

    // Status
    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(salvageCases.status, filters.status));
    }

    // Adjuster filter
    if (filters.userIds && filters.userIds.length > 0) {
      conditions.push(inArray(salvageCases.createdBy, filters.userIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db
      .select({
        caseId: salvageCases.id,
        claimReference: salvageCases.claimReference,
        assetType: salvageCases.assetType,
        status: salvageCases.status,
        createdAt: salvageCases.createdAt,
        approvedAt: salvageCases.approvedAt,
        adjusterId: salvageCases.createdBy,
        adjusterName: users.fullName,
      })
      .from(salvageCases)
      .leftJoin(users, eq(salvageCases.createdBy, users.id))
      .where(whereClause)
      .orderBy(desc(salvageCases.createdAt));

    return results.map(row => {
      let processingTimeHours: number | null = null;
      if (row.approvedAt && row.createdAt) {
        const diffMs = row.approvedAt.getTime() - row.createdAt.getTime();
        processingTimeHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }

      return {
        caseId: row.caseId,
        claimReference: row.claimReference,
        assetType: row.assetType,
        status: row.status,
        createdAt: row.createdAt,
        approvedAt: row.approvedAt,
        processingTimeHours,
        adjusterId: row.adjusterId,
        adjusterName: row.adjusterName || 'Unknown',
      };
    });
  }

  /**
   * Get auction performance data
   */
  static async getAuctionPerformanceData(filters: ReportFilters): Promise<AuctionPerformanceData[]> {
    const conditions = [];

    // Date range
    const dateCondition = this.buildDateCondition(
      auctions.createdAt,
      filters.startDate,
      filters.endDate
    );
    if (dateCondition) conditions.push(dateCondition);

    // Status
    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(auctions.status, filters.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get auctions
    const auctionResults = await db
      .select({
        auctionId: auctions.id,
        caseId: auctions.caseId,
        status: auctions.status,
        currentBid: auctions.currentBid,
        reservePrice: salvageCases.reservePrice,
        startTime: auctions.startTime,
        endTime: auctions.endTime,
        closedAt: auctions.updatedAt, // Use updatedAt as proxy for closedAt
        currentBidder: auctions.currentBidder,
      })
      .from(auctions)
      .leftJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(whereClause);

    // Get bid counts for each auction
    const auctionIds = auctionResults.map(a => a.auctionId);
    
    let bidCounts: Record<string, { count: number; uniqueBidders: number }> = {};
    if (auctionIds.length > 0) {
      const bidResults = await db
        .select({
          auctionId: bids.auctionId,
          bidCount: count(bids.id),
          uniqueBidders: sql<number>`COUNT(DISTINCT ${bids.vendorId})`,
        })
        .from(bids)
        .where(inArray(bids.auctionId, auctionIds))
        .groupBy(bids.auctionId);

      bidCounts = Object.fromEntries(
        bidResults.map(r => [
          r.auctionId,
          { count: r.bidCount, uniqueBidders: Number(r.uniqueBidders) },
        ])
      );
    }

    return auctionResults.map(row => {
      const bidData = bidCounts[row.auctionId] || { count: 0, uniqueBidders: 0 };
      
      const durationMs = row.closedAt
        ? row.closedAt.getTime() - row.startTime.getTime()
        : row.endTime.getTime() - row.startTime.getTime();
      const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;

      const currentBid = parseFloat(row.currentBid || '0');
      const reservePrice = parseFloat(row.reservePrice || '0');
      const reserveMet = currentBid >= reservePrice;

      return {
        auctionId: row.auctionId,
        caseId: row.caseId,
        status: row.status,
        currentBid: row.currentBid,
        reservePrice: row.reservePrice,
        bidCount: bidData.count,
        uniqueBidders: bidData.uniqueBidders,
        startTime: row.startTime,
        endTime: row.endTime,
        closedAt: row.closedAt,
        winnerId: row.currentBidder,
        durationHours,
        reserveMet,
      };
    });
  }

  /**
   * Get vendor performance data
   */
  static async getVendorPerformanceData(filters: ReportFilters): Promise<VendorPerformanceData[]> {
    const conditions = [];

    // Date range for bids
    const dateCondition = this.buildDateCondition(
      bids.createdAt,
      filters.startDate,
      filters.endDate
    );
    if (dateCondition) conditions.push(dateCondition);

    // Vendor filter
    if (filters.vendorIds && filters.vendorIds.length > 0) {
      conditions.push(inArray(bids.vendorId, filters.vendorIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get all bids with vendor info
    const bidQuery = db
      .select({
        vendorId: bids.vendorId,
        vendorName: vendors.businessName,
        vendorTier: vendors.tier,
        bidAmount: bids.amount,
        auctionId: bids.auctionId,
        currentBidder: auctions.currentBidder,
      })
      .from(bids)
      .leftJoin(vendors, eq(bids.vendorId, vendors.id))
      .leftJoin(auctions, eq(bids.auctionId, auctions.id));

    const bidResults = whereClause 
      ? await bidQuery.where(whereClause)
      : await bidQuery;

    // Group by vendor
    const vendorMap = new Map<string, {
      name: string;
      tier: string;
      bids: number[];
      wins: number;
      auctions: Set<string>;
    }>();

    for (const row of bidResults) {
      if (!vendorMap.has(row.vendorId)) {
        vendorMap.set(row.vendorId, {
          name: row.vendorName || 'Unknown',
          tier: row.vendorTier || 'bronze',
          bids: [],
          wins: 0,
          auctions: new Set(),
        });
      }

      const vendor = vendorMap.get(row.vendorId)!;
      vendor.bids.push(parseFloat(row.bidAmount));
      vendor.auctions.add(row.auctionId);
      
      if (row.currentBidder === row.vendorId) {
        vendor.wins++;
      }
    }

    // Get total auctions for participation rate
    const auctionDateCondition = this.buildDateCondition(auctions.createdAt, filters.startDate, filters.endDate);
    
    const totalAuctionsQuery = db
      .select({ count: count(auctions.id) })
      .from(auctions);
    
    const totalAuctions = auctionDateCondition
      ? await totalAuctionsQuery.where(auctionDateCondition)
      : await totalAuctionsQuery;

    const totalAuctionCount = totalAuctions[0]?.count || 0;

    return Array.from(vendorMap.entries()).map(([vendorId, data]) => {
      const totalBids = data.bids.length;
      const averageBidAmount = totalBids > 0
        ? data.bids.reduce((sum, bid) => sum + bid, 0) / totalBids
        : 0;
      const winRate = totalBids > 0 ? (data.wins / totalBids) * 100 : 0;
      const participationRate = totalAuctionCount > 0
        ? (data.auctions.size / totalAuctionCount) * 100
        : 0;

      return {
        vendorId,
        vendorName: data.name,
        tier: data.tier,
        totalBids,
        totalWins: data.wins,
        winRate: Math.round(winRate * 100) / 100,
        averageBidAmount: Math.round(averageBidAmount * 100) / 100,
        totalSpent: Math.round(data.bids.reduce((sum, bid) => sum + bid, 0) * 100) / 100,
        participationRate: Math.round(participationRate * 100) / 100,
      };
    }).sort((a, b) => b.totalWins - a.totalWins);
  }
}
