/**
 * KPI Dashboard Service
 * Executive-level key performance indicators
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import { ReportFilters } from '../../types';
import { resolveReportIsoDateRange } from '../../utils/report-date-range';
import { formatCaseChannelDisplay, resolveCaseChannelLabel } from '../../utils/case-channel-label';

export interface KPIDashboardReport {
  financial: {
    totalRevenue: number;
    averageRecoveryRate: number;
    profitMargin: number;
    revenueGrowth: number;
  };
  operational: {
    totalCases: number;
    caseProcessingTime: number;
    auctionSuccessRate: number;
    vendorParticipationRate: number;
  };
  performance: {
    topAdjusterPerformance: number;
    averageAdjusterPerformance: number;
    paymentVerificationRate: number;
    documentCompletionRate: number;
  };
  trends: {
    revenueByMonth: Array<{ month: string; revenue: number }>;
    casesByMonth: Array<{ month: string; cases: number }>;
    successRateByMonth: Array<{ month: string; rate: number }>;
  };
  breakdowns: {
    cases: Array<{
      id: string;
      claimReference: string;
      policyNumber: string | null;
      channelLabel: string;
      adjusterName: string;
      assetType: string;
      branchName: string;
      marketValue: string;
      processingTime: number;
      revenue: string;
      status: string;
    }>;
    auctions: Array<{
      id: string;
      caseReference: string;
      uniqueBidders: number;
      totalBids: number;
      startingBid: string;
      winningBid: string;
      winnerName: string | null;
      status: string;
    }>;
    adjusters: Array<{
      id: string;
      name: string;
      totalCases: number;
      approved: number;
      rejected: number;
      approvalRate: number;
      avgProcessingTime: number;
      revenue: number;
      qualityScore: number;
    }>;
    vendors: Array<{
      id: string;
      businessName: string;
      tier: number;
      auctionsParticipated: number;
      auctionsWon: number;
      winRate: number;
      totalSpent: number;
      avgBid: number;
      paymentRate: number;
    }>;
    branches: Array<{
      branchName: string;
      totalCases: number;
      soldCases: number;
      claimsValue: number;
      verifiedRecovery: number;
      recoveryRate: number;
    }>;
  };
}

export class KPIDashboardService {
  private static buildCaseScopeFilters(filters: ReportFilters) {
    const branchFilter =
      filters.branches && filters.branches.length > 0
        ? sql`AND COALESCE(sc.branch_name, 'Unassigned') IN (${sql.join(
            filters.branches.map((branch) => sql`${branch}`),
            sql`, `
          )})`
        : sql``;
    const brokerFilter =
      filters.brokers && filters.brokers.length > 0
        ? sql`AND sc.broker_name IN (${sql.join(
            filters.brokers.map((broker) => sql`${broker}`),
            sql`, `
          )})`
        : sql``;
    const assetFilter =
      filters.assetTypes && filters.assetTypes.length > 0
        ? sql`AND sc.asset_type IN (${sql.join(
            filters.assetTypes.map((assetType) => sql`${assetType}`),
            sql`, `
          )})`
        : sql``;
    const hasCaseScope =
      (filters.branches?.length ?? 0) > 0 ||
      (filters.brokers?.length ?? 0) > 0 ||
      (filters.assetTypes?.length ?? 0) > 0;
    const registrationFeeGate = hasCaseScope ? sql`AND FALSE` : sql``;
    const scopedPaymentMatch = hasCaseScope
      ? sql`AND p.auction_id IS NOT NULL AND sc.id IS NOT NULL AND sc.claim_reference NOT LIKE 'TEST%' ${branchFilter} ${brokerFilter} ${assetFilter}`
      : sql``;

    return {
      branchFilter,
      brokerFilter,
      assetFilter,
      hasCaseScope,
      registrationFeeGate,
      scopedPaymentMatch,
    };
  }

  static async generateReport(filters: ReportFilters): Promise<KPIDashboardReport> {
    const [financial, operational, performance, trends, breakdowns] = await Promise.all([
      this.getFinancialKPIs(filters),
      this.getOperationalKPIs(filters),
      this.getPerformanceKPIs(filters),
      this.getTrendData(filters),
      this.getDetailedBreakdowns(filters),
    ]);

    return { financial, operational, performance, trends, breakdowns };
  }

  private static async getFinancialKPIs(filters: ReportFilters) {
    const { startDate, endDate } = resolveReportIsoDateRange(filters.startDate, filters.endDate);
    const { branchFilter, brokerFilter, assetFilter, registrationFeeGate } =
      this.buildCaseScopeFilters(filters);

    const result = await db.execute(sql`
      WITH revenue_data AS (
        WITH latest_auction_payments AS (
          SELECT DISTINCT ON (sc.id)
            p.amount,
            p.created_at
          FROM payments p
          INNER JOIN auctions a ON p.auction_id = a.id
          INNER JOIN salvage_cases sc ON a.case_id = sc.id
          WHERE p.status = 'verified'
            AND p.auction_id IS NOT NULL
            AND p.vendor_id = a.current_bidder
            AND p.created_at >= ${startDate}
            AND p.created_at <= ${endDate}
            AND sc.status != 'draft'
            AND sc.claim_reference NOT LIKE 'TEST%'
            ${branchFilter}
            ${brokerFilter}
            ${assetFilter}
          ORDER BY sc.id, p.verified_at DESC NULLS LAST, p.created_at DESC
        ),
        registration_fees AS (
          SELECT amount, created_at
          FROM payments
          WHERE status = 'verified'
            AND auction_id IS NULL
            AND payment_reference LIKE 'REG-%'
            AND created_at >= ${startDate}
            AND created_at <= ${endDate}
            ${registrationFeeGate}
        )
        SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as total_revenue
        FROM (
          SELECT amount FROM latest_auction_payments
          UNION ALL
          SELECT amount FROM registration_fees
        ) revenue
      ),
      recovery_data AS (
        WITH latest_auction_payments AS (
          SELECT DISTINCT ON (sc.id)
            p.amount,
            sc.market_value,
            p.created_at
          FROM payments p
          INNER JOIN auctions a ON p.auction_id = a.id
          INNER JOIN salvage_cases sc ON a.case_id = sc.id
          WHERE p.status = 'verified'
            AND p.auction_id IS NOT NULL
            AND p.vendor_id = a.current_bidder
            AND p.created_at >= ${startDate}
            AND p.created_at <= ${endDate}
            AND sc.status != 'draft'
            AND sc.claim_reference NOT LIKE 'TEST%'
            ${branchFilter}
            ${brokerFilter}
            ${assetFilter}
          ORDER BY sc.id, p.verified_at DESC NULLS LAST, p.created_at DESC
        )
        SELECT
          COALESCE(SUM(CAST(amount AS NUMERIC)) / NULLIF(SUM(CAST(market_value AS NUMERIC)), 0) * 100, 0) as avg_recovery_rate,
          COUNT(*) as payment_count
        FROM latest_auction_payments
      ),
      previous_revenue AS (
        WITH latest_auction_payments AS (
          SELECT DISTINCT ON (sc.id)
            p.amount,
            p.created_at
          FROM payments p
          INNER JOIN auctions a ON p.auction_id = a.id
          INNER JOIN salvage_cases sc ON a.case_id = sc.id
          WHERE p.status = 'verified'
            AND p.auction_id IS NOT NULL
            AND p.vendor_id = a.current_bidder
            AND p.created_at >= ${startDate}::timestamp - INTERVAL '30 days'
            AND p.created_at < ${startDate}
            AND sc.status != 'draft'
            AND sc.claim_reference NOT LIKE 'TEST%'
            ${branchFilter}
            ${brokerFilter}
            ${assetFilter}
          ORDER BY sc.id, p.verified_at DESC NULLS LAST, p.created_at DESC
        ),
        registration_fees AS (
          SELECT amount, created_at
          FROM payments
          WHERE status = 'verified'
            AND auction_id IS NULL
            AND payment_reference LIKE 'REG-%'
            AND created_at >= ${startDate}::timestamp - INTERVAL '30 days'
            AND created_at < ${startDate}
            ${registrationFeeGate}
        )
        SELECT COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as prev_revenue
        FROM (
          SELECT amount FROM latest_auction_payments
          UNION ALL
          SELECT amount FROM registration_fees
        ) revenue
      )
      SELECT 
        r.total_revenue,
        rd.avg_recovery_rate,
        CASE 
          WHEN r.total_revenue > 0 THEN ((r.total_revenue - (r.total_revenue * 0.15)) / r.total_revenue * 100)
          ELSE 0 
        END as profit_margin,
        CASE 
          WHEN p.prev_revenue > 0 THEN ((r.total_revenue - p.prev_revenue) / p.prev_revenue * 100)
          ELSE 0 
        END as revenue_growth
      FROM revenue_data r, recovery_data rd, previous_revenue p
    `);

    const row = result[0] as any;
    return {
      totalRevenue: Math.round(parseFloat(row?.total_revenue || '0') * 100) / 100,
      averageRecoveryRate: Math.round(parseFloat(row?.avg_recovery_rate || '0') * 100) / 100,
      profitMargin: Math.round(parseFloat(row?.profit_margin || '0') * 100) / 100,
      revenueGrowth: Math.round(parseFloat(row?.revenue_growth || '0') * 100) / 100,
    };
  }

  private static async getOperationalKPIs(filters: ReportFilters) {
    const { startDate, endDate } = resolveReportIsoDateRange(filters.startDate, filters.endDate);
    const { branchFilter, brokerFilter, assetFilter } = this.buildCaseScopeFilters(filters);

    const result = await db.execute(sql`
      WITH case_data AS (
        SELECT 
          COUNT(*) as total_cases,
          AVG(EXTRACT(EPOCH FROM (sc.approved_at - sc.created_at)) / 3600) as avg_processing_hours
        FROM salvage_cases sc
        WHERE sc.status != 'draft' 
          AND sc.created_at >= ${startDate}
          AND sc.created_at <= ${endDate}
          AND sc.claim_reference NOT LIKE 'TEST%'
          ${branchFilter}
          ${brokerFilter}
          ${assetFilter}
      ),
      auction_data AS (
        SELECT 
          COUNT(DISTINCT a.id) as total_auctions,
          COUNT(DISTINCT a.id) FILTER (WHERE p.id IS NOT NULL) as successful_auctions
        FROM auctions a
        INNER JOIN salvage_cases sc ON a.case_id = sc.id
        LEFT JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
        WHERE a.created_at >= ${startDate}
          AND a.created_at <= ${endDate}
          AND sc.status != 'draft'
          AND sc.claim_reference NOT LIKE 'TEST%'
          ${branchFilter}
          ${brokerFilter}
          ${assetFilter}
      ),
      vendor_data AS (
        SELECT 
          COUNT(DISTINCT b.vendor_id) as active_vendors,
          COUNT(DISTINCT b.auction_id) as auctions_with_bids
        FROM bids b
        INNER JOIN auctions a ON b.auction_id = a.id
        INNER JOIN salvage_cases sc ON a.case_id = sc.id
        WHERE b.created_at >= ${startDate}
          AND b.created_at <= ${endDate}
          AND sc.status != 'draft'
          AND sc.claim_reference NOT LIKE 'TEST%'
          ${branchFilter}
          ${brokerFilter}
          ${assetFilter}
      )
      SELECT 
        c.total_cases,
        COALESCE(c.avg_processing_hours, 0) as avg_processing_hours,
        CASE 
          WHEN a.total_auctions > 0 THEN (a.successful_auctions::NUMERIC / a.total_auctions * 100)
          ELSE 0 
        END as auction_success_rate,
        CASE 
          WHEN a.total_auctions > 0 THEN (v.auctions_with_bids::NUMERIC / a.total_auctions * 100)
          ELSE 0 
        END as vendor_participation_rate
      FROM case_data c, auction_data a, vendor_data v
    `);

    const row = result[0] as any;
    return {
      totalCases: parseInt(row?.total_cases || '0'),
      caseProcessingTime: Math.round(parseFloat(row?.avg_processing_hours || '0') * 100) / 100,
      auctionSuccessRate: Math.round(parseFloat(row?.auction_success_rate || '0') * 100) / 100,
      vendorParticipationRate: Math.round(parseFloat(row?.vendor_participation_rate || '0') * 100) / 100,
    };
  }

  private static async getPerformanceKPIs(filters: ReportFilters) {
    const { startDate, endDate } = resolveReportIsoDateRange(filters.startDate, filters.endDate);
    const { branchFilter, brokerFilter, assetFilter, scopedPaymentMatch } =
      this.buildCaseScopeFilters(filters);

    const result = await db.execute(sql`
      WITH adjuster_performance AS (
        SELECT 
          sc.created_by,
          COUNT(*) as cases_processed,
          AVG(EXTRACT(EPOCH FROM (sc.approved_at - sc.created_at)) / 3600) as avg_time
        FROM salvage_cases sc
        WHERE sc.status != 'draft' 
          AND sc.created_at >= ${startDate}
          AND sc.created_at <= ${endDate}
          AND sc.claim_reference NOT LIKE 'TEST%'
          ${branchFilter}
          ${brokerFilter}
          ${assetFilter}
        GROUP BY sc.created_by
      ),
      payment_data AS (
        SELECT 
          COUNT(*) as total_payments,
          COUNT(*) FILTER (WHERE p.status = 'verified') as verified_payments
        FROM payments p
        LEFT JOIN auctions a ON p.auction_id = a.id
        LEFT JOIN salvage_cases sc ON a.case_id = sc.id
        WHERE p.created_at >= ${startDate}
          AND p.created_at <= ${endDate}
          ${scopedPaymentMatch}
      ),
      adjuster_stats AS (
        SELECT 
          COALESCE(MAX(cases_processed), 0) as top_adjuster_cases,
          COALESCE(AVG(cases_processed), 0) as avg_adjuster_cases
        FROM adjuster_performance
      )
      SELECT 
        ast.top_adjuster_cases,
        ast.avg_adjuster_cases,
        CASE 
          WHEN pd.total_payments > 0 THEN (pd.verified_payments::NUMERIC / pd.total_payments * 100)
          ELSE 0 
        END as payment_verification_rate,
        85.0 as document_completion_rate
      FROM adjuster_stats ast
      CROSS JOIN payment_data pd
    `);

    const row = result[0] as any;
    return {
      topAdjusterPerformance: Math.round(parseFloat(row?.top_adjuster_cases || '0')),
      averageAdjusterPerformance: Math.round(parseFloat(row?.avg_adjuster_cases || '0') * 100) / 100,
      paymentVerificationRate: Math.round(parseFloat(row?.payment_verification_rate || '0') * 100) / 100,
      documentCompletionRate: Math.round(parseFloat(row?.document_completion_rate || '0') * 100) / 100,
    };
  }

  private static async getTrendData(filters: ReportFilters) {
    const { startDate, endDate } = resolveReportIsoDateRange(filters.startDate, filters.endDate);
    const { branchFilter, brokerFilter, assetFilter, registrationFeeGate } =
      this.buildCaseScopeFilters(filters);

    const revenueByMonth = await db.execute(sql`
      WITH latest_auction_payments AS (
        SELECT DISTINCT ON (sc.id)
          p.amount,
          p.created_at
        FROM payments p
        INNER JOIN auctions a ON p.auction_id = a.id
        INNER JOIN salvage_cases sc ON a.case_id = sc.id
        WHERE p.status = 'verified'
          AND p.auction_id IS NOT NULL
          AND p.vendor_id = a.current_bidder
          AND p.created_at >= ${startDate}
          AND p.created_at <= ${endDate}
          AND sc.status != 'draft'
          AND sc.claim_reference NOT LIKE 'TEST%'
          ${branchFilter}
          ${brokerFilter}
          ${assetFilter}
        ORDER BY sc.id, p.verified_at DESC NULLS LAST, p.created_at DESC
      ),
      registration_fees AS (
        SELECT amount, created_at
        FROM payments
        WHERE status = 'verified'
          AND auction_id IS NULL
          AND payment_reference LIKE 'REG-%'
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
          ${registrationFeeGate}
      ),
      report_revenue AS (
        SELECT amount, created_at FROM latest_auction_payments
        UNION ALL
        SELECT amount, created_at FROM registration_fees
      )
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as revenue
      FROM report_revenue
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `);

    const casesByMonth = await db.execute(sql`
      SELECT 
        TO_CHAR(sc.created_at, 'YYYY-MM') as month,
        COUNT(*) as cases
      FROM salvage_cases sc
      WHERE sc.status != 'draft' 
        AND sc.created_at >= ${startDate}
        AND sc.created_at <= ${endDate}
        AND sc.claim_reference NOT LIKE 'TEST%'
        ${branchFilter}
        ${brokerFilter}
        ${assetFilter}
      GROUP BY TO_CHAR(sc.created_at, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `);

    const successRateByMonth = await db.execute(sql`
      SELECT 
        TO_CHAR(a.created_at, 'YYYY-MM') as month,
        CASE 
          WHEN COUNT(DISTINCT a.id) > 0 THEN (COUNT(DISTINCT a.id) FILTER (WHERE p.id IS NOT NULL)::NUMERIC / COUNT(DISTINCT a.id) * 100)
          ELSE 0 
        END as rate
      FROM auctions a
      INNER JOIN salvage_cases sc ON a.case_id = sc.id
      LEFT JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
      WHERE a.created_at >= ${startDate}
        AND a.created_at <= ${endDate}
        AND sc.status != 'draft'
        AND sc.claim_reference NOT LIKE 'TEST%'
        ${branchFilter}
        ${brokerFilter}
        ${assetFilter}
      GROUP BY TO_CHAR(a.created_at, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT 12
    `);

    return {
      revenueByMonth: (revenueByMonth as any[]).map(r => ({
        month: r.month,
        revenue: Math.round(parseFloat(r.revenue) * 100) / 100,
      })).reverse(),
      casesByMonth: (casesByMonth as any[]).map(c => ({
        month: c.month,
        cases: parseInt(c.cases),
      })).reverse(),
      successRateByMonth: (successRateByMonth as any[]).map(s => ({
        month: s.month,
        rate: Math.round(parseFloat(s.rate) * 100) / 100,
      })).reverse(),
    };
  }

  private static async getDetailedBreakdowns(filters: ReportFilters) {
    const { startDate, endDate } = resolveReportIsoDateRange(filters.startDate, filters.endDate);
    const { branchFilter, brokerFilter, assetFilter } = this.buildCaseScopeFilters(filters);

    // Cases breakdown - use DISTINCT ON to prevent duplicates
    const casesResult = await db.execute(sql`
      SELECT *
      FROM (
        SELECT DISTINCT ON (sc.id)
          sc.id,
          sc.claim_reference,
          sc.policy_number,
          sc.broker_name,
          sc.agency_name,
          u.full_name as adjuster_name,
          sc.asset_type,
          COALESCE(sc.branch_name, 'Unassigned') as branch_name,
          sc.market_value,
          EXTRACT(EPOCH FROM (sc.approved_at - sc.created_at)) / 86400 as processing_days,
          COALESCE(
            (SELECT p.amount
             FROM payments p
             JOIN auctions a ON p.auction_id = a.id
             WHERE a.case_id = sc.id AND p.status = 'verified'
             ORDER BY p.created_at DESC
             LIMIT 1),
            '0'
          ) as revenue,
          sc.status,
          sc.created_at
        FROM salvage_cases sc
        LEFT JOIN users u ON sc.created_by = u.id
        WHERE sc.created_at >= ${startDate}
          AND sc.created_at <= ${endDate}
          ${branchFilter}
          ${brokerFilter}
          ${assetFilter}
        ORDER BY sc.id, sc.created_at DESC
      ) latest_cases
      ORDER BY created_at DESC
      LIMIT 100
    `);

    // Auctions breakdown
    const auctionsResult = await db.execute(sql`
      SELECT 
        a.id,
        sc.claim_reference as case_reference,
        COUNT(DISTINCT b.vendor_id) as unique_bidders,
        COUNT(b.id) as total_bids,
        sc.market_value as starting_bid,
        COALESCE(p.amount, '0') as winning_bid,
        COALESCE(v.business_name, winner.full_name) as winner_name,
        CASE WHEN p.id IS NOT NULL THEN 'sold' ELSE a.status::text END as status
      FROM auctions a
      JOIN salvage_cases sc ON a.case_id = sc.id
      LEFT JOIN bids b ON a.id = b.auction_id
      LEFT JOIN vendors v ON a.current_bidder = v.id
      LEFT JOIN users winner ON v.user_id = winner.id
      LEFT JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
      WHERE a.created_at >= ${startDate}
        AND a.created_at <= ${endDate}
        ${branchFilter}
        ${brokerFilter}
        ${assetFilter}
      GROUP BY a.id, sc.claim_reference, sc.market_value, p.id, p.amount, v.business_name, winner.full_name, a.status
      ORDER BY a.created_at DESC
      LIMIT 100
    `);

    const branchesResult = await db.execute(sql`
      WITH branch_cases AS (
        SELECT
          sc.id,
          COALESCE(sc.branch_name, 'Unassigned') as branch_name,
          COALESCE(CAST(sc.market_value AS NUMERIC), 0) as market_value,
          COALESCE((
            SELECT p.amount
            FROM payments p
            JOIN auctions a ON p.auction_id = a.id
            WHERE a.case_id = sc.id
              AND p.status = 'verified'
              AND p.vendor_id = a.current_bidder
            ORDER BY p.verified_at DESC NULLS LAST, p.created_at DESC
            LIMIT 1
          ), 0) as verified_recovery
        FROM salvage_cases sc
        WHERE sc.created_at >= ${startDate}
          AND sc.created_at <= ${endDate}
          AND sc.status != 'draft'
          AND sc.claim_reference NOT LIKE 'TEST%'
          ${branchFilter}
          ${brokerFilter}
          ${assetFilter}
      )
      SELECT
        branch_name,
        COUNT(*) as total_cases,
        COUNT(*) FILTER (WHERE verified_recovery > 0) as sold_cases,
        COALESCE(SUM(market_value), 0) as claims_value,
        COALESCE(SUM(verified_recovery), 0) as verified_recovery
      FROM branch_cases
      GROUP BY branch_name
      ORDER BY verified_recovery DESC, claims_value DESC
      LIMIT 50
    `);

    // Adjusters breakdown with quality score
    const adjustersResult = await db.execute(sql`
      SELECT 
        u.id,
        u.full_name as name,
        COUNT(sc.id) as total_cases,
        COUNT(*) FILTER (WHERE sc.status IN ('approved', 'active_auction', 'sold')) as approved,
        COUNT(*) FILTER (WHERE sc.status = 'draft' AND sc.approved_at IS NOT NULL) as rejected,
        CASE 
          WHEN COUNT(*) FILTER (WHERE sc.status IN ('approved', 'active_auction', 'sold', 'draft') AND sc.approved_at IS NOT NULL) > 0
          THEN (COUNT(*) FILTER (WHERE sc.status IN ('approved', 'active_auction', 'sold'))::NUMERIC / 
                COUNT(*) FILTER (WHERE sc.status IN ('approved', 'active_auction', 'sold', 'draft') AND sc.approved_at IS NOT NULL) * 100)
          ELSE 0
        END as approval_rate,
        AVG(EXTRACT(EPOCH FROM (sc.approved_at - sc.created_at)) / 86400) as avg_processing_days,
        COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) as revenue
      FROM users u
      LEFT JOIN salvage_cases sc ON u.id = sc.created_by 
        AND sc.created_at >= ${startDate}
        AND sc.created_at <= ${endDate}
        ${branchFilter}
        ${brokerFilter}
        ${assetFilter}
      LEFT JOIN auctions a ON sc.id = a.case_id
      LEFT JOIN payments p ON a.id = p.auction_id AND p.status = 'verified'
      WHERE u.role = 'claims_adjuster'
      GROUP BY u.id, u.full_name
      HAVING COUNT(sc.id) > 0
      ORDER BY revenue DESC
      LIMIT 50
    `);

    // Vendors breakdown
    const vendorsResult = await db.execute(sql`
      SELECT 
        v.id,
        COALESCE(v.business_name, u.full_name, 'Unknown') as business_name,
        v.tier,
        COUNT(DISTINCT b.auction_id) as auctions_participated,
        COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id) as auctions_won,
        CASE 
          WHEN COUNT(DISTINCT b.auction_id) > 0 
          THEN (COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id)::NUMERIC / COUNT(DISTINCT b.auction_id) * 100)
          ELSE 0
        END as win_rate,
        COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) as total_spent,
        CASE 
          WHEN COUNT(b.id) > 0 
          THEN AVG(CAST(b.amount AS NUMERIC))
          ELSE 0
        END as avg_bid,
        CASE 
          WHEN COUNT(p.id) > 0 
          THEN (COUNT(*) FILTER (WHERE p.status = 'verified')::NUMERIC / COUNT(p.id) * 100)
          ELSE 0
        END as payment_rate
      FROM vendors v
      LEFT JOIN users u ON v.user_id = u.id
      LEFT JOIN bids b ON v.id = b.vendor_id 
        AND b.created_at >= ${startDate}
        AND b.created_at <= ${endDate}
      LEFT JOIN auctions a ON b.auction_id = a.id AND a.current_bidder = v.id
      LEFT JOIN payments p ON a.id = p.auction_id AND p.vendor_id = v.id
      GROUP BY v.id, v.business_name, u.full_name, v.tier
      HAVING COUNT(DISTINCT b.auction_id) > 0
      ORDER BY total_spent DESC
      LIMIT 50
    `);

    // Calculate quality scores for adjusters
    const adjusters = (adjustersResult as any[]).map(adj => {
      const approvalRate = parseFloat(adj.approval_rate || '0');
      const rejectionRate = 100 - approvalRate;
      const avgTime = parseFloat(adj.avg_processing_days || '0');
      
      // Processing efficiency: assume target is 2 days
      const targetDays = 2;
      const processingEfficiency = avgTime > 0 ? Math.max(0, 100 - ((avgTime / targetDays) * 100)) : 0;
      
      // Quality Score = Approval Rate (40%) + Low Rejection Rate (30%) + Processing Efficiency (30%)
      const qualityScore = (approvalRate * 0.4) + ((100 - rejectionRate) * 0.3) + (processingEfficiency * 0.3);

      return {
        id: adj.id,
        name: adj.name,
        totalCases: parseInt(adj.total_cases),
        approved: parseInt(adj.approved),
        rejected: parseInt(adj.rejected),
        approvalRate: Math.round(approvalRate * 100) / 100,
        avgProcessingTime: Math.round(avgTime * 100) / 100,
        revenue: Math.round(parseFloat(adj.revenue) * 100) / 100,
        qualityScore: Math.round(qualityScore * 100) / 100,
      };
    });

    return {
      cases: (casesResult as any[]).map(c => {
        const channel = resolveCaseChannelLabel(c.broker_name, c.agency_name);
        return {
          id: c.id,
          claimReference: c.claim_reference || 'N/A',
          policyNumber: c.policy_number?.trim() || null,
          channelLabel: formatCaseChannelDisplay(channel),
          adjusterName: c.adjuster_name || 'Unknown',
          assetType: c.asset_type,
          branchName: c.branch_name || 'Unassigned',
          marketValue: c.market_value || '0',
          processingTime: Math.round(parseFloat(c.processing_days || '0') * 100) / 100,
          revenue: c.revenue || '0',
          status: c.status,
        };
      }),
      auctions: (auctionsResult as any[]).map(a => ({
        id: a.id,
        caseReference: a.case_reference || 'N/A',
        uniqueBidders: parseInt(a.unique_bidders || '0'),
        totalBids: parseInt(a.total_bids || '0'),
        startingBid: a.starting_bid || '0',
        winningBid: a.winning_bid || '0',
        winnerName: a.winner_name,
        status: a.status,
      })),
      adjusters,
      vendors: (vendorsResult as any[]).map(v => ({
        id: v.id,
        businessName: v.business_name,
        tier: vendorTierToNumber(v.tier),
        auctionsParticipated: parseInt(v.auctions_participated),
        auctionsWon: parseInt(v.auctions_won),
        winRate: Math.round(parseFloat(v.win_rate) * 100) / 100,
        totalSpent: Math.round(parseFloat(v.total_spent) * 100) / 100,
        avgBid: Math.round(parseFloat(v.avg_bid) * 100) / 100,
        paymentRate: Math.round(parseFloat(v.payment_rate) * 100) / 100,
      })),
      branches: (branchesResult as any[]).map(branch => {
        const claimsValue = parseFloat(branch.claims_value || '0');
        const verifiedRecovery = parseFloat(branch.verified_recovery || '0');
        return {
          branchName: branch.branch_name || 'Unassigned',
          totalCases: parseInt(branch.total_cases || '0'),
          soldCases: parseInt(branch.sold_cases || '0'),
          claimsValue: Math.round(claimsValue * 100) / 100,
          verifiedRecovery: Math.round(verifiedRecovery * 100) / 100,
          recoveryRate: claimsValue > 0 ? Math.round((verifiedRecovery / claimsValue) * 10000) / 100 : 0,
        };
      }),
    };
  }
}

function vendorTierToNumber(tier: unknown): number {
  const value = String(tier ?? '').toLowerCase();
  if (value.includes('2')) return 2;
  if (value.includes('1')) return 1;
  return 0;
}
