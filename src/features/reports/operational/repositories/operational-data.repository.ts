/**
 * Operational Data Repository
 * 
 * Repository layer for operational data access
 * Task 11: Operational Data Repository
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, bids, users } from '@/lib/db/schema';
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
  marketValue: string;
  estimatedSalvageValue: string | null;
  reservePrice: string | null;
}

export interface AuctionPerformanceData {
  auctionId: string;
  caseId: string;
  claimReference: string;
  assetType: string;
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
  winningBid: string | null;
  bidderIds: string[];
  averageBidIncrement: number;
  timeToFirstBidMinutes: number | null;
  lastMinuteBids: number;
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
   * FIX: Exclude draft cases and calculate processing time in DAYS (to match Master Report)
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

    // CRITICAL FIX: Exclude draft cases (Master Report excludes drafts)
    conditions.push(sql`${salvageCases.status} != 'draft'`);

    // Asset types - use sql template for enum filtering
    if (filters.assetTypes && filters.assetTypes.length > 0) {
      conditions.push(sql`${salvageCases.assetType} = ANY(${filters.assetTypes})`);
    }

    // Status - use sql template for enum filtering
    if (filters.status && filters.status.length > 0) {
      conditions.push(sql`${salvageCases.status} = ANY(${filters.status})`);
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
        marketValue: salvageCases.marketValue,
        estimatedSalvageValue: salvageCases.estimatedSalvageValue,
        reservePrice: salvageCases.reservePrice,
      })
      .from(salvageCases)
      .leftJoin(users, eq(salvageCases.createdBy, users.id))
      .where(whereClause)
      .orderBy(desc(salvageCases.createdAt));

    return results.map(row => {
      // FIX: Calculate processing time in HOURS (service will convert to days for display)
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
        marketValue: row.marketValue || '0',
        estimatedSalvageValue: row.estimatedSalvageValue,
        reservePrice: row.reservePrice,
      };
    });
  }

  /**
   * Get auction performance data with comprehensive metrics
   * FIX: Match Master Report - filter by auction end_time (when auction closed)
   * Use DISTINCT ON to avoid duplicate auctions (in case of multiple payments per auction)
   * CRITICAL: Get the LATEST payment per auction to handle duplicate payments correctly
   */
  static async getAuctionPerformanceData(filters: ReportFilters): Promise<AuctionPerformanceData[]> {
    const startDate = filters.startDate || '2000-01-01';
    const endDate = filters.endDate || '2099-12-31';

    // FIX: Use raw SQL with proper DISTINCT ON to handle duplicate payments
    // Get the LATEST payment per auction (highest created_at)
    // Filter by auction end_time to match the date range selector
    const auctionResults = await db.execute(sql`
      SELECT DISTINCT ON (a.id)
        a.id as auction_id,
        a.case_id,
        sc.claim_reference,
        sc.asset_type,
        a.status,
        a.current_bid,
        sc.reserve_price,
        a.start_time,
        a.end_time,
        a.updated_at as closed_at,
        a.current_bidder,
        p.amount as winning_bid,
        p.id as payment_id
      FROM auctions a
      LEFT JOIN salvage_cases sc ON a.case_id = sc.id
      LEFT JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
      WHERE a.end_time >= ${startDate}::timestamp
        AND a.end_time <= ${endDate}::timestamp
        AND a.status IN ('closed', 'awaiting_payment')
        AND sc.status != 'draft'
      ORDER BY a.id, p.created_at DESC NULLS LAST
    `) as any[];

    // Get comprehensive bid data for each auction
    const auctionIds = auctionResults.map((a: any) => a.auction_id);
    
    let bidData: Record<string, { 
      count: number; 
      uniqueBidders: number;
      bidderIds: string[];
      avgIncrement: number;
      timeToFirstBid: number | null;
      lastMinuteBids: number;
    }> = {};

    if (auctionIds.length > 0) {
      // Get bid counts and unique bidders
      const bidResults = await db
        .select({
          auctionId: bids.auctionId,
          bidCount: count(bids.id),
          uniqueBidders: sql<number>`COUNT(DISTINCT ${bids.vendorId})`,
        })
        .from(bids)
        .where(inArray(bids.auctionId, auctionIds))
        .groupBy(bids.auctionId);

      // Get all bids for detailed analysis
      const allBids = await db
        .select({
          auctionId: bids.auctionId,
          vendorId: bids.vendorId,
          amount: bids.amount,
          createdAt: bids.createdAt,
        })
        .from(bids)
        .where(inArray(bids.auctionId, auctionIds))
        .orderBy(bids.auctionId, bids.createdAt);

      // Process bid data for each auction
      const auctionBids: Record<string, any[]> = {};
      allBids.forEach(bid => {
        if (!auctionBids[bid.auctionId]) auctionBids[bid.auctionId] = [];
        auctionBids[bid.auctionId].push(bid);
      });

      // Calculate metrics for each auction
      bidResults.forEach(result => {
        const auctionId = result.auctionId;
        const bidsForAuction = auctionBids[auctionId] || [];
        
        // Get unique bidder IDs
        const bidderIds = [...new Set(bidsForAuction.map(b => b.vendorId))];
        
        // Calculate average bid increment
        let avgIncrement = 0;
        if (bidsForAuction.length > 1) {
          const increments = [];
          for (let i = 1; i < bidsForAuction.length; i++) {
            const increment = parseFloat(bidsForAuction[i].amount) - parseFloat(bidsForAuction[i-1].amount);
            if (increment > 0) increments.push(increment);
          }
          avgIncrement = increments.length > 0 
            ? increments.reduce((sum, inc) => sum + inc, 0) / increments.length 
            : 0;
        }
        
        // Calculate time to first bid (in minutes)
        let timeToFirstBid: number | null = null;
        if (bidsForAuction.length > 0) {
          const auction = auctionResults.find((a: any) => a.auction_id === auctionId);
          if (auction) {
            const firstBidTime = new Date(bidsForAuction[0].createdAt).getTime();
            const startTime = new Date(auction.start_time).getTime();
            timeToFirstBid = Math.round((firstBidTime - startTime) / (1000 * 60));
          }
        }
        
        // Calculate last minute bids (bids in final hour)
        let lastMinuteBids = 0;
        if (bidsForAuction.length > 0) {
          const auction = auctionResults.find((a: any) => a.auction_id === auctionId);
          if (auction) {
            const endTime = new Date(auction.end_time).getTime();
            const oneHourBefore = endTime - (60 * 60 * 1000);
            lastMinuteBids = bidsForAuction.filter(b => 
              new Date(b.createdAt).getTime() >= oneHourBefore
            ).length;
          }
        }

        bidData[auctionId] = {
          count: result.bidCount,
          uniqueBidders: Number(result.uniqueBidders),
          bidderIds,
          avgIncrement,
          timeToFirstBid,
          lastMinuteBids,
        };
      });
    }

    return auctionResults.map((row: any) => {
      const data = bidData[row.auction_id] || { 
        count: 0, 
        uniqueBidders: 0,
        bidderIds: [],
        avgIncrement: 0,
        timeToFirstBid: null,
        lastMinuteBids: 0,
      };
      
      const startTime = new Date(row.start_time);
      const endTime = new Date(row.end_time);
      const closedAt = row.closed_at ? new Date(row.closed_at) : null;
      
      const durationMs = closedAt
        ? closedAt.getTime() - startTime.getTime()
        : endTime.getTime() - startTime.getTime();
      const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100;

      const currentBid = parseFloat(row.current_bid || '0');
      const reservePrice = parseFloat(row.reserve_price || '0');
      const reserveMet = currentBid >= reservePrice;

      // FIX: Winning bid comes from verified payment, not currentBid
      const winningBid = row.winning_bid || null;

      return {
        auctionId: row.auction_id,
        caseId: row.case_id,
        claimReference: row.claim_reference || 'Unknown',
        assetType: row.asset_type || 'unknown',
        status: row.status,
        currentBid: row.current_bid || '0',
        reservePrice: row.reserve_price || '0',
        bidCount: data.count,
        uniqueBidders: data.uniqueBidders,
        startTime,
        endTime,
        closedAt,
        winnerId: row.current_bidder,
        durationHours,
        reserveMet,
        winningBid,
        bidderIds: data.bidderIds,
        averageBidIncrement: Math.round(data.avgIncrement),
        timeToFirstBidMinutes: data.timeToFirstBid,
        lastMinuteBids: data.lastMinuteBids,
      };
    });
  }

  /**
   * Get vendor performance data
   * FIX: Match Master Report logic - use verified payments for totalSpent, fix win rate calculation
   */
  static async getVendorPerformanceData(filters: ReportFilters): Promise<VendorPerformanceData[]> {
    // Use raw SQL to match Master Report logic exactly
    const startDate = filters.startDate || '2000-01-01';
    const endDate = filters.endDate || '2099-12-31';

    const results = await db.execute(sql`
      WITH vendor_payments AS (
        SELECT 
          v.id as vendor_id,
          COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) as total_spent,
          COUNT(DISTINCT p.auction_id) as paid_auctions
        FROM vendors v
        LEFT JOIN payments p ON p.vendor_id = v.id AND p.status = 'verified'
        WHERE p.created_at >= ${startDate} AND p.created_at <= ${endDate}
        GROUP BY v.id
      )
      SELECT 
        v.id as vendor_id,
        v.business_name as vendor_name,
        v.tier,
        COUNT(DISTINCT b.auction_id) as auctions_participated,
        COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id) as auctions_won,
        CASE 
          WHEN COUNT(DISTINCT b.auction_id) > 0 
          THEN (COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id)::NUMERIC / COUNT(DISTINCT b.auction_id) * 100)
          ELSE 0
        END as win_rate,
        COALESCE(vp.total_spent, 0) as total_spent,
        CASE 
          WHEN COUNT(b.id) > 0 
          THEN AVG(CAST(b.amount AS NUMERIC))
          ELSE 0
        END as avg_bid,
        COUNT(b.id) as total_bids
      FROM vendors v
      LEFT JOIN bids b ON v.id = b.vendor_id 
        AND b.created_at >= ${startDate}
        AND b.created_at <= ${endDate}
      LEFT JOIN auctions a ON b.auction_id = a.id AND a.current_bidder = v.id
      LEFT JOIN vendor_payments vp ON v.id = vp.vendor_id
      GROUP BY v.id, v.business_name, v.tier, vp.total_spent, vp.paid_auctions
      HAVING COUNT(DISTINCT b.auction_id) > 0
      ORDER BY total_spent DESC, auctions_won DESC
      LIMIT 50
    `);

    // Get total auctions for participation rate
    const totalAuctionsResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM auctions
      WHERE created_at >= ${startDate} AND created_at <= ${endDate}
    `);

    const totalAuctionCount = parseInt((totalAuctionsResult[0] as any)?.count || '0');

    return (results as any[]).map(row => ({
      vendorId: row.vendor_id,
      vendorName: row.vendor_name || 'Unknown',
      tier: row.tier || 'bronze',
      totalBids: parseInt(row.total_bids || '0'),
      totalWins: parseInt(row.auctions_won || '0'),
      winRate: Math.round(parseFloat(row.win_rate || '0') * 100) / 100,
      averageBidAmount: Math.round(parseFloat(row.avg_bid || '0') * 100) / 100,
      totalSpent: Math.round(parseFloat(row.total_spent || '0') * 100) / 100,
      participationRate: totalAuctionCount > 0 
        ? Math.round((parseInt(row.auctions_participated || '0') / totalAuctionCount * 100) * 100) / 100
        : 0,
    }));
  }
}
