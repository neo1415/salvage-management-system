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
import { resolveReportIsoDateRange } from '../../utils/report-date-range';

export interface CaseProcessingData {
  caseId: string;
  claimReference: string;
  assetType: string;
  branchName: string;
  status: string;
  createdAt: Date;
  approvedAt: Date | null;
  processingTimeHours: number | null;
  adjusterId: string;
  adjusterName: string;
  marketValue: string;
  estimatedSalvageValue: string | null;
  reservePrice: string | null;
  possessingVendorId: string | null;
  possessingVendorName: string | null;
  pickedUpAt: Date | null;
}

export interface AuctionPerformanceData {
  auctionId: string;
  caseId: string;
  claimReference: string;
  assetType: string;
  branchName: string;
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
  pickupStatus: string;
  pickedUpAt: Date | null;
  pickupVendorId: string | null;
  pickupVendorName: string | null;
  paymentVerifiedAt: Date | null;
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
  completedPickups: number;
  pendingPickups: number;
  onTimePickupRate: number;
  averagePickupHours: number;
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
   * FIX: Exclude draft cases and TEST cases, determine correct status from auction state
   */
  static async getCaseProcessingData(filters: ReportFilters): Promise<CaseProcessingData[]> {
    const { startDate, endDate } = resolveReportIsoDateRange(filters.startDate, filters.endDate);
    const branchFilter = filters.branches && filters.branches.length > 0
      ? sql`AND COALESCE(sc.branch_name, 'Unassigned') IN (${sql.join(filters.branches.map(branch => sql`${branch}`), sql`, `)})`
      : sql``;
    const assetTypeFilter = filters.assetTypes && filters.assetTypes.length > 0
      ? sql`AND sc.asset_type IN (${sql.join(filters.assetTypes.map(assetType => sql`${assetType}`), sql`, `)})`
      : sql``;

    // Use raw SQL to get correct status by joining with auctions and payments
    const results = await db.execute(sql`
      SELECT 
        sc.id as case_id,
        sc.claim_reference,
        sc.asset_type,
        COALESCE(sc.branch_name, 'Unassigned') as branch_name,
        sc.status as case_status,
        sc.created_at,
        sc.approved_at,
        sc.created_by as adjuster_id,
        u.full_name as adjuster_name,
        sc.market_value,
        sc.estimated_salvage_value,
        sc.reserve_price,
        a.id as auction_id,
        a.status as auction_status,
        a.end_time as auction_end_time,
        p.id as payment_id,
        p.status as payment_status,
        a.pickup_confirmed_admin,
        a.pickup_confirmed_admin_at,
        a.current_bidder as possessing_vendor_id,
        COALESCE(v.business_name, vu.full_name) as possessing_vendor_name
      FROM salvage_cases sc
      LEFT JOIN users u ON sc.created_by = u.id
      LEFT JOIN auctions a ON a.case_id = sc.id
      LEFT JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
      LEFT JOIN vendors v ON v.id = a.current_bidder
      LEFT JOIN users vu ON vu.id = v.user_id
      WHERE sc.created_at >= ${startDate}::timestamp
        AND sc.created_at <= ${endDate}::timestamp
        AND sc.status != 'draft'
        AND sc.claim_reference NOT LIKE 'TEST%'
        ${branchFilter}
        ${assetTypeFilter}
      ORDER BY sc.created_at DESC
    `) as any[];

    return results.map((row: any) => {
      // Determine correct display status based on auction and payment state
      let displayStatus = row.case_status;
      
      if (row.auction_id) {
        // Case has an auction
        if (row.payment_id && row.payment_status === 'verified') {
          // Auction has verified payment = SOLD
          displayStatus = 'sold';
        } else if (row.auction_status === 'closed' || row.auction_status === 'awaiting_payment') {
          // Auction closed but no verified payment yet = AWAITING PAYMENT
          displayStatus = 'awaiting_payment';
        } else if (
          (row.auction_status === 'active' || row.auction_status === 'extended') &&
          row.auction_end_time &&
          new Date(row.auction_end_time) > new Date()
        ) {
          // Auction is live (active/extended, not past end) = ACTIVE AUCTION
          displayStatus = 'active_auction';
        } else if (
          (row.auction_status === 'active' || row.auction_status === 'extended') &&
          row.auction_end_time &&
          new Date(row.auction_end_time) <= new Date()
        ) {
          // Auction ended but not closed yet = AWAITING PAYMENT (system will close it)
          displayStatus = 'awaiting_payment';
        } else if (row.case_status === 'approved' && !row.payment_id) {
          // Case approved but auction hasn't started or no payment = APPROVED
          displayStatus = 'approved';
        }
      }

      // Calculate processing time in HOURS
      let processingTimeHours: number | null = null;
      if (row.approved_at && row.created_at) {
        const diffMs = new Date(row.approved_at).getTime() - new Date(row.created_at).getTime();
        processingTimeHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }

      return {
        caseId: row.case_id,
        claimReference: row.claim_reference,
        assetType: row.asset_type,
        branchName: row.branch_name || 'Unassigned',
        status: displayStatus,
        createdAt: new Date(row.created_at),
        approvedAt: row.approved_at ? new Date(row.approved_at) : null,
        processingTimeHours,
        adjusterId: row.adjuster_id,
        adjusterName: row.adjuster_name || 'Unknown',
        marketValue: row.market_value || '0',
        estimatedSalvageValue: row.estimated_salvage_value,
        reservePrice: row.reserve_price,
        possessingVendorId: row.pickup_confirmed_admin ? row.possessing_vendor_id : null,
        possessingVendorName: row.pickup_confirmed_admin ? row.possessing_vendor_name : null,
        pickedUpAt: row.pickup_confirmed_admin_at ? new Date(row.pickup_confirmed_admin_at) : null,
      };
    });
  }

  /**
   * Get auction performance data with comprehensive metrics
   * FIX: Match Master Report - filter by auction end_time (when auction closed)
   * Use DISTINCT ON to avoid duplicate auctions (in case of multiple payments per auction)
   * CRITICAL: Get the LATEST payment per auction to handle duplicate payments correctly
   * FIX: Filter TEST auctions and determine correct status (sold vs closed)
   */
  static async getAuctionPerformanceData(filters: ReportFilters): Promise<AuctionPerformanceData[]> {
    const { startDate, endDate } = resolveReportIsoDateRange(filters.startDate, filters.endDate);
    const branchFilter = filters.branches && filters.branches.length > 0
      ? sql`AND COALESCE(sc.branch_name, 'Unassigned') IN (${sql.join(filters.branches.map(branch => sql`${branch}`), sql`, `)})`
      : sql``;
    const assetTypeFilter = filters.assetTypes && filters.assetTypes.length > 0
      ? sql`AND sc.asset_type IN (${sql.join(filters.assetTypes.map(assetType => sql`${assetType}`), sql`, `)})`
      : sql``;

    // FIX: Use raw SQL with proper DISTINCT ON to handle duplicate payments
    // Get the LATEST payment per auction (highest created_at)
    // Filter by auction end_time to match the date range selector
    // Filter TEST auctions with sc.claim_reference NOT LIKE 'TEST%'
    const auctionResults = await db.execute(sql`
      SELECT DISTINCT ON (a.id)
        a.id as auction_id,
        a.case_id,
        sc.claim_reference,
        sc.asset_type,
        COALESCE(sc.branch_name, 'Unassigned') as branch_name,
        a.status as auction_status,
        a.current_bid,
        sc.reserve_price,
        a.start_time,
        a.end_time,
        a.updated_at as closed_at,
        a.current_bidder,
        p.amount as winning_bid,
        p.id as payment_id,
        p.status as payment_status,
        p.verified_at as payment_verified_at,
        a.pickup_confirmed_vendor,
        a.pickup_confirmed_vendor_at,
        a.pickup_confirmed_admin,
        a.pickup_confirmed_admin_at,
        a.current_bidder as pickup_vendor_id,
        COALESCE(v.business_name, vu.full_name) as pickup_vendor_name,
        rf.id as pickup_auth_document_id
      FROM auctions a
      LEFT JOIN salvage_cases sc ON a.case_id = sc.id
      LEFT JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
      LEFT JOIN vendors v ON v.id = a.current_bidder
      LEFT JOIN users vu ON vu.id = v.user_id
      LEFT JOIN release_forms rf ON rf.auction_id = a.id
        AND rf.vendor_id = a.current_bidder
        AND rf.document_type = 'pickup_authorization'
        AND rf.status != 'voided'
      WHERE a.end_time >= ${startDate}::timestamp
        AND a.end_time <= ${endDate}::timestamp
        AND a.status IN ('active', 'closed', 'awaiting_payment')
        AND sc.status != 'draft'
        AND sc.claim_reference NOT LIKE 'TEST%'
        ${branchFilter}
        ${assetTypeFilter}
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

      // FIX: Determine correct display status
      // sold = auction closed AND payment verified
      // awaiting_payment = auction closed but NO payment verified yet
      // active = auction still running (end_time not reached)
      let displayStatus = row.auction_status;
      
      if (row.payment_id && row.payment_status === 'verified') {
        // Payment verified = SOLD
        displayStatus = 'sold';
      } else if (row.auction_status === 'closed' || row.auction_status === 'awaiting_payment') {
        // Auction closed but no verified payment = AWAITING_PAYMENT
        displayStatus = 'awaiting_payment';
      } else if (row.auction_status === 'active' && new Date(row.end_time) > new Date()) {
        // Auction is active and hasn't ended yet = ACTIVE
        displayStatus = 'active';
      } else if (row.auction_status === 'active' && new Date(row.end_time) <= new Date()) {
        // Auction ended but not closed yet = AWAITING_PAYMENT (system will close it)
        displayStatus = 'awaiting_payment';
      }

      const pickupStatus = row.pickup_confirmed_admin
        ? 'staff_confirmed'
        : row.pickup_confirmed_vendor
          ? 'vendor_confirmed'
          : row.payment_id && row.pickup_auth_document_id
            ? 'ready_for_pickup'
            : 'not_ready';

      return {
        auctionId: row.auction_id,
        caseId: row.case_id,
        claimReference: row.claim_reference || 'Unknown',
        assetType: row.asset_type || 'unknown',
        branchName: row.branch_name || 'Unassigned',
        status: displayStatus,
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
        pickupStatus,
        pickedUpAt: row.pickup_confirmed_admin_at ? new Date(row.pickup_confirmed_admin_at) : null,
        pickupVendorId: row.pickup_vendor_id,
        pickupVendorName: row.pickup_vendor_name,
        paymentVerifiedAt: row.payment_verified_at ? new Date(row.payment_verified_at) : null,
      };
    });
  }

  /**
   * Get vendor performance data
   * FIX: Match Master Report logic - use verified payments for totalSpent, fix win rate calculation
   */
  static async getVendorPerformanceData(filters: ReportFilters): Promise<VendorPerformanceData[]> {
    // Use raw SQL to match Master Report logic exactly
    const { startDate, endDate } = resolveReportIsoDateRange(filters.startDate, filters.endDate);

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
      ),
      vendor_pickups AS (
        SELECT
          v.id as vendor_id,
          COUNT(DISTINCT a.id) FILTER (WHERE a.pickup_confirmed_admin = true) as completed_pickups,
          COUNT(DISTINCT a.id) FILTER (WHERE p.status = 'verified' AND a.pickup_confirmed_admin = false) as pending_pickups,
          AVG(EXTRACT(EPOCH FROM (a.pickup_confirmed_admin_at - p.verified_at)) / 3600)
            FILTER (WHERE a.pickup_confirmed_admin = true AND p.verified_at IS NOT NULL) as avg_pickup_hours,
          COUNT(DISTINCT a.id)
            FILTER (
              WHERE a.pickup_confirmed_admin = true
              AND p.verified_at IS NOT NULL
              AND a.pickup_confirmed_admin_at <= p.verified_at + INTERVAL '48 hours'
            ) as on_time_pickups
        FROM vendors v
        LEFT JOIN auctions a ON a.current_bidder = v.id
        LEFT JOIN payments p ON p.auction_id = a.id AND p.vendor_id = v.id AND p.status = 'verified'
        WHERE COALESCE(p.verified_at, a.updated_at) >= ${startDate}
          AND COALESCE(p.verified_at, a.updated_at) <= ${endDate}
        GROUP BY v.id
      )
      SELECT 
        v.id as vendor_id,
        COALESCE(v.business_name, u.full_name, 'Unknown') as vendor_name,
        v.tier,
        COUNT(DISTINCT b.auction_id) as auctions_participated,
        COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id) as auctions_won,
        CASE 
          WHEN COUNT(DISTINCT b.auction_id) > 0 
          THEN (COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id)::NUMERIC / COUNT(DISTINCT b.auction_id) * 100)
          ELSE 0
        END as win_rate,
        COALESCE(vp.total_spent, 0) as total_spent,
        COALESCE(vpu.completed_pickups, 0) as completed_pickups,
        COALESCE(vpu.pending_pickups, 0) as pending_pickups,
        COALESCE(vpu.avg_pickup_hours, 0) as avg_pickup_hours,
        COALESCE(vpu.on_time_pickups, 0) as on_time_pickups,
        CASE 
          WHEN COUNT(b.id) > 0 
          THEN AVG(CAST(b.amount AS NUMERIC))
          ELSE 0
        END as avg_bid,
        COUNT(b.id) as total_bids
      FROM vendors v
      LEFT JOIN users u ON v.user_id = u.id
      LEFT JOIN bids b ON v.id = b.vendor_id 
        AND b.created_at >= ${startDate}
        AND b.created_at <= ${endDate}
      LEFT JOIN auctions a ON b.auction_id = a.id AND a.current_bidder = v.id
      LEFT JOIN vendor_payments vp ON v.id = vp.vendor_id
      LEFT JOIN vendor_pickups vpu ON v.id = vpu.vendor_id
      GROUP BY v.id, v.business_name, u.full_name, v.tier, vp.total_spent, vp.paid_auctions, vpu.completed_pickups, vpu.pending_pickups, vpu.avg_pickup_hours, vpu.on_time_pickups
      ORDER BY total_spent DESC, auctions_won DESC, total_bids DESC
      LIMIT 50
    `);

    // Get total auctions for participation rate
    const totalAuctionsResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM auctions
      WHERE created_at >= ${startDate} AND created_at <= ${endDate}
    `);

    const totalAuctionCount = parseInt((totalAuctionsResult[0] as any)?.count || '0');

    return (results as any[]).map(row => {
      const completedPickups = parseInt(row.completed_pickups || '0');
      const onTimePickups = parseInt(row.on_time_pickups || '0');

      return {
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
        completedPickups,
        pendingPickups: parseInt(row.pending_pickups || '0'),
        onTimePickupRate: completedPickups > 0 ? Math.round((onTimePickups / completedPickups) * 10000) / 100 : 0,
        averagePickupHours: Math.round(parseFloat(row.avg_pickup_hours || '0') * 100) / 100,
      };
    });
  }
}
