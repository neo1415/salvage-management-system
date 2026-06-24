import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions, salvageCases, bids, payments } from '@/lib/db/schema';
import { eq, and, gte, gt, sql, inArray } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';
import { ACTIVE_AUCTION_STATUSES, PENDING_CASE_STATUSES, VERIFIED_PAYMENT_STATUS } from '@/lib/metrics/dashboard-status';
import {
  buildManagerDashboardCacheKey,
  caseScopeConditions,
  caseScopeDrizzle,
  parseManagerDashboardFilters,
  type ManagerDashboardFilters,
} from '@/lib/metrics/manager-dashboard-filters';
import { countAwaitingPickupConfirmations } from '@/lib/metrics/pickup-awaiting-metrics';

/**
 * Manager Dashboard API
 * 
 * GET /api/dashboard/manager
 * 
 * Returns real-time KPIs and charts data for Salvage Manager dashboard
 * 
 * Requirements: 31
 * - Calculate KPIs: active auctions count, total bids today, average recovery rate, cases pending approval count
 * - Generate charts data: recovery rate trend (last 30 days), top 5 vendors by volume, payment status breakdown
 * - Cache dashboard data in Redis (5-minute TTL)
 * - Auto-refresh every 30 seconds
 */

interface DashboardKPIs {
  activeAuctions: number;
  totalBidsToday: number;
  averageRecoveryRate: number;
  casesPendingApproval: number;
}

interface RecoveryRateTrend {
  date: string;
  recoveryRate: number;
  totalCases: number;
}

interface TopVendor {
  vendorId: string;
  vendorName: string;
  totalBids: number;
  totalWins: number;
  totalSpent: number;
}

interface PaymentStatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

interface ControlTowerException {
  key: string;
  label: string;
  count: number;
  severity: 'low' | 'medium' | 'high';
}

interface RecoveryControlTower {
  claimsValue: number;
  expectedRecovery: number;
  verifiedRecovery: number;
  recoveryRate: number;
  expectedRecoveryGap: number;
  awaitingPickup: number;
  averageDaysToAssessment: number | null;
  averageDaysToPayment: number | null;
  averageDaysToPickup: number | null;
  exceptions: ControlTowerException[];
}

interface DashboardData {
  kpis: DashboardKPIs;
  controlTower: RecoveryControlTower;
  charts: {
    recoveryRateTrend: RecoveryRateTrend[];
    topVendors: TopVendor[];
    paymentStatusBreakdown: PaymentStatusBreakdown[];
  };
  filterOptions: {
    branches: string[];
    brokers: string[];
  };
  lastUpdated: string;
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is Salvage Manager
    if (session.user.role !== 'salvage_manager') {
      return NextResponse.json(
        { error: 'Forbidden - Salvage Manager access required' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const dateRangeParam = searchParams.get('dateRange') || '30';
    const filters = parseManagerDashboardFilters(searchParams);

    const cacheKey = buildManagerDashboardCacheKey(filters, dateRangeParam);
    const cachedData = await cache.get<DashboardData>(cacheKey);

    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const kpis = await calculateKPIs(filters);
    const controlTower = await calculateRecoveryControlTower(filters);
    const recoveryRateTrend = await calculateRecoveryRateTrend(filters);
    const topVendors = await getTopVendors(filters);
    const paymentStatusBreakdown = await getPaymentStatusBreakdown(filters);
    const filterOptions = await getDashboardFilterOptions();

    const dashboardData: DashboardData = {
      kpis,
      controlTower,
      charts: {
        recoveryRateTrend,
        topVendors,
        paymentStatusBreakdown,
      },
      filterOptions,
      lastUpdated: new Date().toISOString(),
    };

    // Cache briefly so approval and auction counts do not lag behind live demo actions.
    await cache.set(cacheKey, dashboardData, 30);

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Manager dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

/**
 * Calculate KPIs for dashboard
 */
async function calculateKPIs(filters: ManagerDashboardFilters): Promise<DashboardKPIs> {
  const now = new Date();
  const caseScope = caseScopeDrizzle(filters);

  const activeAuctionsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auctions)
    .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
    .where(
      and(
        inArray(auctions.status, [...ACTIVE_AUCTION_STATUSES]),
        gt(auctions.endTime, now),
        caseScope ?? sql`TRUE`
      )
    );

  const activeAuctions = activeAuctionsResult[0]?.count || 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalBidsTodayResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bids)
    .where(gte(bids.createdAt, today));

  const totalBidsToday = totalBidsTodayResult[0]?.count || 0;

  const recoveryStart =
    filters.startDate ??
    (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      return d;
    })();
  const recoveryStartISO = recoveryStart.toISOString();
  const caseScopeSql = caseScopeConditions('sc', filters);

  const [recoveryRateRow] = (await db.execute(sql`
    WITH verified_winner_payments AS (
      SELECT DISTINCT ON (p.auction_id)
        p.auction_id,
        p.amount,
        p.verified_at
      FROM payments p
      INNER JOIN auctions a ON a.id = p.auction_id
      INNER JOIN salvage_cases sc ON sc.id = a.case_id
      WHERE p.status = ${VERIFIED_PAYMENT_STATUS}
        AND p.auction_id IS NOT NULL
        AND p.vendor_id = a.current_bidder
        AND p.verified_at >= ${recoveryStartISO}::timestamptz
        AND ${caseScopeSql}
      ORDER BY p.auction_id, p.verified_at DESC NULLS LAST, p.created_at DESC
    )
    SELECT
      COALESCE(SUM(p.amount::numeric), 0)::numeric AS recovered,
      COALESCE(SUM(sc.market_value::numeric), 0)::numeric AS claims_value
    FROM verified_winner_payments p
    INNER JOIN auctions a ON a.id = p.auction_id
    INNER JOIN salvage_cases sc ON sc.id = a.case_id
  `)) as Array<{ recovered?: unknown; claims_value?: unknown }>;

  const recovered = numberFrom(recoveryRateRow?.recovered);
  const recoveryClaimsValue = numberFrom(recoveryRateRow?.claims_value);
  const averageRecoveryRate =
    recoveryClaimsValue > 0 ? (recovered / recoveryClaimsValue) * 100 : 0;

  const casesPendingResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(salvageCases)
    .where(
      and(
        inArray(salvageCases.status, [...PENDING_CASE_STATUSES]),
        caseScope ?? sql`TRUE`
      )
    );

  const casesPendingApproval = casesPendingResult[0]?.count || 0;

  return {
    activeAuctions,
    totalBidsToday,
    averageRecoveryRate: Math.round(averageRecoveryRate * 100) / 100,
    casesPendingApproval,
  };
}

async function calculateRecoveryControlTower(
  filters: ManagerDashboardFilters
): Promise<RecoveryControlTower> {
  const caseScopeSql = caseScopeConditions('sc', filters);
  const dateScopeSql =
    filters.startDate
      ? sql`sc.created_at >= ${filters.startDate.toISOString()}::timestamptz`
      : sql`TRUE`;
  const endScopeSql =
    filters.endDate
      ? sql`sc.created_at <= ${filters.endDate.toISOString()}::timestamptz`
      : sql`TRUE`;

  const [valueRow] = (await db.execute(sql`
    WITH case_scope AS (
      SELECT
        sc.id,
        sc.market_value,
        COALESCE(sc.reserve_price::numeric, sc.estimated_salvage_value::numeric, 0) AS expected_recovery,
        sc.created_at,
        sc.approved_at
      FROM salvage_cases sc
      WHERE ${dateScopeSql}
        AND ${endScopeSql}
        AND ${caseScopeSql}
    ),
    verified_winner_payments AS (
      SELECT DISTINCT ON (p.auction_id)
        p.auction_id,
        p.amount,
        p.verified_at
      FROM payments p
      INNER JOIN auctions a ON a.id = p.auction_id
      WHERE p.status = ${VERIFIED_PAYMENT_STATUS}
        AND p.auction_id IS NOT NULL
        AND p.vendor_id = a.current_bidder
      ORDER BY p.auction_id, p.verified_at DESC NULLS LAST, p.created_at DESC
    ),
    payment_scope AS (
      SELECT
        a.id AS auction_id,
        a.case_id,
        a.end_time,
        a.pickup_confirmed_admin,
        a.pickup_confirmed_admin_at,
        p.amount,
        p.verified_at
      FROM auctions a
      INNER JOIN case_scope cs ON cs.id = a.case_id
      LEFT JOIN verified_winner_payments p ON p.auction_id = a.id
    )
    SELECT
      (SELECT COALESCE(SUM(market_value::numeric), 0)::numeric FROM case_scope) AS claims_value,
      (SELECT COALESCE(SUM(expected_recovery::numeric), 0)::numeric FROM case_scope) AS expected_recovery,
      COALESCE(SUM(CASE WHEN ps.amount IS NOT NULL THEN ps.amount::numeric ELSE 0 END), 0)::numeric AS verified_recovery,
      COUNT(DISTINCT CASE WHEN ps.amount IS NOT NULL AND COALESCE(ps.pickup_confirmed_admin, false) = false THEN ps.auction_id END)::int AS awaiting_pickup,
      (SELECT AVG(EXTRACT(EPOCH FROM (approved_at - created_at)) / 86400.0) FILTER (WHERE approved_at IS NOT NULL)::numeric FROM case_scope) AS avg_days_to_assessment,
      AVG(EXTRACT(EPOCH FROM (ps.verified_at - ps.end_time)) / 86400.0) FILTER (
        WHERE ps.verified_at IS NOT NULL
        AND ps.verified_at >= ps.end_time
      )::numeric AS avg_days_to_payment,
      AVG(EXTRACT(EPOCH FROM (ps.pickup_confirmed_admin_at - ps.verified_at)) / 86400.0) FILTER (
        WHERE ps.verified_at IS NOT NULL
        AND ps.pickup_confirmed_admin_at IS NOT NULL
        AND ps.pickup_confirmed_admin_at >= ps.verified_at
      )::numeric AS avg_days_to_pickup
    FROM payment_scope ps
  `)) as Array<Record<string, unknown>>;

  const [exceptionRow] = (await db.execute(sql`
    WITH auction_scope AS (
      SELECT a.id, a.status, a.end_time, a.pickup_confirmed_admin, sc.asset_type
      FROM auctions a
      INNER JOIN salvage_cases sc ON sc.id = a.case_id
      WHERE ${caseScopeSql}
    ),
    verified_payments AS (
      SELECT DISTINCT p.auction_id
      FROM payments p
      INNER JOIN auctions a ON a.id = p.auction_id
      WHERE p.status = ${VERIFIED_PAYMENT_STATUS}
        AND p.vendor_id = a.current_bidder
    )
    SELECT
      COUNT(DISTINCT CASE WHEN a.status IN ('active', 'extended') AND a.end_time < NOW() THEN a.id END)::int AS stalled_auctions,
      COUNT(DISTINCT CASE
        WHEN p.auction_id IS NOT NULL
          AND pa.auction_id IS NOT NULL
          AND COALESCE(a.pickup_confirmed_admin, false) = false
        THEN a.id
      END)::int AS awaiting_pickup,
      COUNT(DISTINCT CASE WHEN rf.status = 'signed' AND rf.payment_deadline IS NOT NULL AND rf.payment_deadline < NOW() AND p.auction_id IS NULL THEN rf.auction_id END)::int AS overdue_payments
    FROM auction_scope a
    LEFT JOIN release_forms rf ON rf.auction_id = a.id AND COALESCE(rf.disabled, false) = false
    LEFT JOIN release_forms pa ON pa.auction_id = a.id
      AND pa.document_type = 'pickup_authorization'
      AND COALESCE(pa.disabled, false) = false
    LEFT JOIN verified_payments p ON p.auction_id = a.id
  `)) as Array<Record<string, unknown>>;

  const claimsValue = numberFrom(valueRow?.claims_value);
  const expectedRecovery = numberFrom(valueRow?.expected_recovery);
  const verifiedRecovery = numberFrom(valueRow?.verified_recovery);
  const recoveryRate = claimsValue > 0 ? (verifiedRecovery / claimsValue) * 100 : 0;
  const expectedRecoveryGap = Math.max(0, expectedRecovery - verifiedRecovery);

  const awaitingPickup = await countAwaitingPickupConfirmations(filters);

  const exceptions: ControlTowerException[] = [
    {
      key: 'stalled_auctions',
      label: 'Auctions ended but still active',
      count: numberFrom(exceptionRow?.stalled_auctions),
      severity: 'high',
    },
    {
      key: 'overdue_payments',
      label: 'Signed documents with overdue payment',
      count: numberFrom(exceptionRow?.overdue_payments),
      severity: 'high',
    },
    {
      key: 'awaiting_pickup',
      label: 'Paid assets awaiting pickup confirmation',
      count: awaitingPickup,
      severity: 'medium',
    },
  ];

  return {
    claimsValue,
    expectedRecovery,
    verifiedRecovery,
    recoveryRate: Math.round(recoveryRate * 100) / 100,
    expectedRecoveryGap,
    awaitingPickup,
    averageDaysToAssessment: nullableNumberFrom(valueRow?.avg_days_to_assessment),
    averageDaysToPayment: nullableNumberFrom(valueRow?.avg_days_to_payment),
    averageDaysToPickup: nullableNumberFrom(valueRow?.avg_days_to_pickup),
    exceptions,
  };
}

function numberFrom(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumberFrom(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) / 1000 : null;
}

/**
 * Calculate recovery rate trend for last N days
 */
async function calculateRecoveryRateTrend(
  filters: ManagerDashboardFilters
): Promise<RecoveryRateTrend[]> {
  const trendStart =
    filters.startDate ??
    (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      d.setHours(0, 0, 0, 0);
      return d;
    })();
  const startDateISO = trendStart.toISOString();
  const caseScopeSql = caseScopeConditions('sc', filters);
  const verifiedEndSql =
    filters.endDate
      ? sql`AND p.verified_at <= ${filters.endDate.toISOString()}::timestamptz`
      : sql``;

  const rows = (await db.execute(sql`
    WITH verified_winner_payments AS (
      SELECT DISTINCT ON (p.auction_id)
        p.auction_id,
        p.amount,
        p.verified_at
      FROM payments p
      INNER JOIN auctions a ON a.id = p.auction_id
      INNER JOIN salvage_cases sc ON sc.id = a.case_id
      WHERE p.status = ${VERIFIED_PAYMENT_STATUS}
        AND p.auction_id IS NOT NULL
        AND p.vendor_id = a.current_bidder
        AND p.verified_at >= ${startDateISO}::timestamptz
        ${verifiedEndSql}
        AND ${caseScopeSql}
      ORDER BY p.auction_id, p.verified_at DESC NULLS LAST, p.created_at DESC
    )
    SELECT
      DATE(p.verified_at) AS date,
      COUNT(*)::int AS total_cases,
      COALESCE(SUM(p.amount::numeric), 0)::numeric AS recovered,
      COALESCE(SUM(sc.market_value::numeric), 0)::numeric AS claims_value
    FROM verified_winner_payments p
    INNER JOIN auctions a ON a.id = p.auction_id
    INNER JOIN salvage_cases sc ON sc.id = a.case_id
    GROUP BY DATE(p.verified_at)
    ORDER BY DATE(p.verified_at)
  `)) as Array<Record<string, unknown>>;

  return rows.map((row) => {
    const recovered = numberFrom(row.recovered);
    const claimsValue = numberFrom(row.claims_value);
    return {
      date: String(row.date),
      recoveryRate: claimsValue > 0 ? Math.round((recovered / claimsValue) * 10000) / 100 : 0,
      totalCases: numberFrom(row.total_cases),
    };
  });
}

/**
 * Get top 5 vendors by volume
 */
async function getTopVendors(filters: ManagerDashboardFilters): Promise<TopVendor[]> {
  const caseScopeSql = caseScopeConditions('sc', filters);

  const rows = await db.execute(sql`
    WITH bid_stats AS (
      SELECT
        b.vendor_id,
        COUNT(*)::int AS total_bids
      FROM bids b
      INNER JOIN auctions a ON a.id = b.auction_id
      INNER JOIN salvage_cases sc ON sc.id = a.case_id
      WHERE ${caseScopeSql}
      GROUP BY b.vendor_id
    ),
    payment_stats AS (
      SELECT
        winner.vendor_id,
        COUNT(*)::int AS total_wins,
        COALESCE(SUM(winner.amount::numeric), 0)::numeric AS total_spent
      FROM (
        SELECT DISTINCT ON (p.auction_id)
          p.auction_id,
          p.vendor_id,
          p.amount,
          p.verified_at,
          p.created_at
        FROM payments p
        INNER JOIN auctions a ON a.id = p.auction_id
        INNER JOIN salvage_cases sc ON sc.id = a.case_id
        WHERE p.status = ${VERIFIED_PAYMENT_STATUS}
          AND p.auction_id IS NOT NULL
          AND p.vendor_id = a.current_bidder
          AND ${caseScopeSql}
        ORDER BY p.auction_id, p.verified_at DESC NULLS LAST, p.created_at DESC
      ) winner
      GROUP BY winner.vendor_id
    )
    SELECT
      v.id AS vendor_id,
      COALESCE(v.business_name, u.full_name, 'Unknown Vendor') AS vendor_name,
      COALESCE(bs.total_bids, 0)::int AS total_bids,
      COALESCE(ps.total_wins, 0)::int AS total_wins,
      COALESCE(ps.total_spent, 0)::numeric AS total_spent
    FROM vendors v
    LEFT JOIN users u ON u.id = v.user_id
    LEFT JOIN bid_stats bs ON bs.vendor_id = v.id
    LEFT JOIN payment_stats ps ON ps.vendor_id = v.id
    WHERE COALESCE(bs.total_bids, 0) > 0 OR COALESCE(ps.total_wins, 0) > 0
    ORDER BY COALESCE(ps.total_wins, 0) DESC, COALESCE(ps.total_spent, 0) DESC, COALESCE(bs.total_bids, 0) DESC
    LIMIT 5
  `);

  return (Array.isArray(rows) ? rows : []).map((stat) => ({
    vendorId: String(stat.vendor_id),
    vendorName: String(stat.vendor_name || 'Unknown Vendor'),
    totalBids: Number(stat.total_bids || 0),
    totalWins: Number(stat.total_wins || 0),
    totalSpent: parseFloat(String(stat.total_spent ?? '0')),
  }));
}

async function getPaymentStatusBreakdown(
  filters: ManagerDashboardFilters
): Promise<PaymentStatusBreakdown[]> {
  const caseScope = caseScopeDrizzle(filters);

  const statusData = await db
    .select({
      status: payments.status,
      count: sql<number>`count(*)::int`,
    })
    .from(payments)
    .innerJoin(auctions, eq(payments.auctionId, auctions.id))
    .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
    .where(caseScope ?? sql`TRUE`)
    .groupBy(payments.status);

  // Calculate total for percentages
  const total = statusData.reduce((sum, item) => sum + (item.count || 0), 0);

  const breakdown: PaymentStatusBreakdown[] = statusData.map((item) => ({
    status: item.status,
    count: item.count || 0,
    percentage: total > 0 ? Math.round(((item.count || 0) / total) * 10000) / 100 : 0,
  }));

  return breakdown;
}

async function getDashboardFilterOptions(): Promise<{ branches: string[]; brokers: string[] }> {
  const branchRows = (await db.execute(sql`
    SELECT DISTINCT COALESCE(NULLIF(TRIM(branch_name), ''), 'Unassigned') AS name
    FROM salvage_cases
    ORDER BY name
  `)) as Array<{ name?: string }>;

  const brokerRows = (await db.execute(sql`
    SELECT DISTINCT broker_name AS name
    FROM salvage_cases
    WHERE broker_name IS NOT NULL AND TRIM(broker_name) != ''
    ORDER BY broker_name
  `)) as Array<{ name?: string }>;

  return {
    branches: branchRows.map((row) => row.name).filter((name): name is string => Boolean(name)),
    brokers: brokerRows.map((row) => row.name).filter((name): name is string => Boolean(name)),
  };
}
