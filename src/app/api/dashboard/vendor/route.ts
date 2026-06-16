import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions, bids, payments, vendors, salvageCases, releaseForms } from '@/lib/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';
import { calculateAutoRating } from '@/features/vendors/services/auto-rating.service';
import { formatRatingLabel } from '@/lib/metrics/dashboard-status';
import { businessPolicyService, resolveVendorBidLimit } from '@/features/business-policy';

/**
 * Vendor Dashboard API
 * 
 * GET /api/dashboard/vendor
 * 
 * Returns performance stats, badges, and comparison data for vendor dashboard
 * 
 * Requirements: 32
 * - Calculate performance stats: win rate, average payment time, on-time pickup rate, 5-star rating, leaderboard position
 * - Calculate badges: '10 Wins', 'Top Bidder', 'Fast Payer' (avg <6 hours)
 * - Calculate comparison to last month
 */

interface PerformanceStats {
  winRate: number;
  avgPaymentTimeHours: number;
  onTimePickupRate: number;
  rating: number;
  ratingLabel: string;
  ratingSource: 'stored' | 'auto' | 'insufficient';
  leaderboardPosition: number;
  totalVendors: number;
  totalBids: number;
  totalWins: number;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
}

interface Comparison {
  metric: string;
  currentValue: number;
  previousValue: number;
  change: number;
  trend: 'up' | 'down' | 'neutral';
}

interface VendorDashboardData {
  performanceStats: PerformanceStats;
  badges: Badge[];
  comparisons: Comparison[];
  lastUpdated: string;
  vendorTier: 'tier1_bvn' | 'tier2_full';
  bidLimit?: number;
  pendingPickupConfirmations: PendingPickupConfirmation[];
  operationsControl: VendorOperationsControl;
}

interface PendingPickupConfirmation {
  auctionId: string;
  pickupConfirmedVendor: boolean;
  pickupConfirmedAdmin: boolean;
  case: {
    claimReference: string;
    assetType: string;
    assetDetails: Record<string, unknown>;
  };
}

interface VendorOperationsControl {
  bidLimit?: number;
  wonAwaitingPayment: number;
  signedAwaitingPayment: number;
  paidAwaitingPickup: number;
  averagePaymentTimeHours: number | null;
  averagePickupTimeHours: number | null;
}

export async function GET() {
  try {
    // Authenticate user
    console.log('[Dashboard API] Authenticating user...');
    const session = await auth();

    if (!session?.user) {
      console.log('[Dashboard API] No session found');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[Dashboard API] User authenticated:', session.user.id, session.user.role);

    // Check if user is a vendor
    if (session.user.role !== 'vendor') {
      console.log('[Dashboard API] User is not a vendor:', session.user.role);
      return NextResponse.json(
        { error: 'Forbidden - Vendor access required' },
        { status: 403 }
      );
    }

    // Get vendor record
    console.log('[Dashboard API] Fetching vendor record for user:', session.user.id);
    const vendorRecord = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1);

    if (!vendorRecord || vendorRecord.length === 0) {
      console.log('[Dashboard API] No vendor profile found for user:', session.user.id);
      return NextResponse.json(
        { error: 'Vendor profile not found' },
        { status: 404 }
      );
    }

    const vendor = vendorRecord[0];
    console.log('[Dashboard API] Vendor found:', vendor.id);

    const policy = await businessPolicyService.getEffectivePolicy();
    const bidLimitDecision = resolveVendorBidLimit(policy, {
      tier: vendor.tier as 'tier0' | 'tier1_bvn' | 'tier2_full',
    });

    // Try to get cached data. Include policy version so display-only policy changes
    // do not keep stale bid limits in the vendor dashboard cache.
    const cacheKey = `dashboard:vendor:v2:${vendor.id}`;
    try {
      const cachedData = await cache.get<VendorDashboardData>(cacheKey);

      if (cachedData) {
        console.log('[Dashboard API] Returning cached data');
        // Backward compatibility: older cache entries won't have this field.
        return NextResponse.json({
          ...cachedData,
          pendingPickupConfirmations: cachedData.pendingPickupConfirmations ?? [],
          operationsControl: cachedData.operationsControl ?? {
            bidLimit: typeof bidLimitDecision.value === 'number' ? bidLimitDecision.value : undefined,
            wonAwaitingPayment: 0,
            signedAwaitingPayment: 0,
            paidAwaitingPickup: cachedData.pendingPickupConfirmations?.length ?? 0,
            averagePaymentTimeHours: null,
            averagePickupTimeHours: null,
          },
        });
      }
    } catch (cacheError) {
      console.warn('[Dashboard API] Cache read error (continuing without cache):', cacheError);
    }

    console.log('[Dashboard API] Calculating performance stats...');
    // Calculate performance stats
    const performanceStats = await calculatePerformanceStats(vendor.id);

    console.log('[Dashboard API] Calculating badges...');
    // Calculate badges
    const badges = calculateBadges(performanceStats, vendor);

    console.log('[Dashboard API] Calculating comparisons...');
    // Calculate comparison to last month
    const comparisons = await calculateComparisons(vendor.id, performanceStats);

    console.log('[Dashboard API] Fetching pending pickup confirmations...');
    // Pending means payment is verified and a pickup authorization exists, but
    // staff have not completed the physical handoff yet.
    const pendingPickupConfirmations = await db
      .select({
        auctionId: auctions.id,
        pickupConfirmedVendor: auctions.pickupConfirmedVendor,
        pickupConfirmedAdmin: auctions.pickupConfirmedAdmin,
        case: {
          claimReference: salvageCases.claimReference,
          assetType: salvageCases.assetType,
          assetDetails: salvageCases.assetDetails,
        },
      })
      .from(auctions)
      .innerJoin(
        payments,
        and(
          eq(payments.auctionId, auctions.id),
          eq(payments.vendorId, vendor.id),
          eq(payments.status, 'verified')
        )
      )
      .innerJoin(
        releaseForms,
        and(
          eq(releaseForms.auctionId, auctions.id),
          eq(releaseForms.vendorId, vendor.id),
          eq(releaseForms.documentType, 'pickup_authorization')
        )
      )
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(
        and(
          eq(auctions.currentBidder, vendor.id),
          eq(auctions.pickupConfirmedAdmin, false)
        )
      );

    // Ensure one entry per auction (join duplication guard).
    const pendingPickupConfirmationsUnique = Array.from(
      new Map(pendingPickupConfirmations.map((p) => [p.auctionId, p])).values()
    ).map((confirmation) => ({
      ...confirmation,
      pickupConfirmedVendor: confirmation.pickupConfirmedVendor ?? false,
      pickupConfirmedAdmin: confirmation.pickupConfirmedAdmin ?? false,
    }));

    const operationsControl = await calculateVendorOperationsControl(
      vendor.id,
      pendingPickupConfirmationsUnique.length,
      typeof bidLimitDecision.value === 'number' ? bidLimitDecision.value : undefined
    );

    const dashboardData: VendorDashboardData = {
      performanceStats,
      badges,
      comparisons,
      lastUpdated: new Date().toISOString(),
      vendorTier: vendor.tier as 'tier1_bvn' | 'tier2_full',
      bidLimit: typeof bidLimitDecision.value === 'number' ? bidLimitDecision.value : undefined,
      pendingPickupConfirmations: pendingPickupConfirmationsUnique,
      operationsControl,
    };

    // Cache the data for 5 minutes (300 seconds)
    try {
      await cache.set(cacheKey, dashboardData, 300);
      console.log('[Dashboard API] Data cached successfully');
    } catch (cacheError) {
      console.warn('[Dashboard API] Cache write error (continuing without cache):', cacheError);
    }

    console.log('[Dashboard API] Returning dashboard data');
    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    if (error instanceof Error) {
      console.error('[Dashboard API] Error message:', error.message);
      console.error('[Dashboard API] Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Calculate performance stats for vendor
 */
async function calculatePerformanceStats(vendorId: string): Promise<PerformanceStats> {
  // Get total bids
  const totalBidsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bids)
    .where(eq(bids.vendorId, vendorId));

  const totalBids = totalBidsResult[0]?.count || 0;

  const [winsRow] = (await db.execute(sql`
    WITH win_events AS (
      SELECT id AS auction_id
      FROM auctions
      WHERE current_bidder = ${vendorId}
        AND status IN ('closed', 'awaiting_payment')
      UNION
      SELECT auction_id
      FROM auction_winners
      WHERE vendor_id = ${vendorId}
        AND rank = 1
    )
    SELECT COUNT(DISTINCT auction_id)::int AS total_wins
    FROM win_events
  `)) as any[];

  const totalWins = numberFrom(winsRow?.total_wins);

  // Calculate win rate
  const winRate = totalBids > 0 ? (totalWins / totalBids) * 100 : 0;

  // Calculate average payment time (hours)
  const paymentTimesResult = await db
    .select({
      auctionEndTime: auctions.endTime,
      paymentVerifiedTime: payments.verifiedAt,
    })
    .from(payments)
    .innerJoin(auctions, eq(payments.auctionId, auctions.id))
    .where(
      and(
        eq(payments.vendorId, vendorId),
        eq(payments.status, 'verified')
      )
    );

  const cleanPaymentTimes = paymentTimesResult.filter((item) => {
    if (!item.auctionEndTime || !item.paymentVerifiedTime) return false;
    return new Date(item.paymentVerifiedTime).getTime() >= new Date(item.auctionEndTime).getTime();
  });
  const totalVerifiedPayments = cleanPaymentTimes.length;
  let avgPaymentTimeHours = 0;
  if (cleanPaymentTimes.length > 0) {
    const totalPaymentTime = cleanPaymentTimes.reduce((sum, item) => {
      const endTime = new Date(item.auctionEndTime!).getTime();
      const verifiedTime = new Date(item.paymentVerifiedTime!).getTime();
      return sum + ((verifiedTime - endTime) / (1000 * 60 * 60));
    }, 0);
    avgPaymentTimeHours = totalPaymentTime / cleanPaymentTimes.length;
  }

  // Calculate on-time pickup rate using staff-confirmed pickup, not payment as a proxy.
  const pickupTimingResult = await db
    .select({
      paymentVerifiedTime: payments.verifiedAt,
      pickupConfirmedAt: auctions.pickupConfirmedAdminAt,
    })
    .from(payments)
    .innerJoin(auctions, eq(payments.auctionId, auctions.id))
    .where(
      and(
        eq(payments.vendorId, vendorId),
        eq(payments.status, 'verified'),
        eq(auctions.pickupConfirmedAdmin, true)
      )
    );

  const pickupDeadlineHours = 48;
  const completedPickups = pickupTimingResult.filter(
    (item) =>
      item.paymentVerifiedTime
      && item.pickupConfirmedAt
      && new Date(item.pickupConfirmedAt).getTime() >= new Date(item.paymentVerifiedTime).getTime()
  );
  const onTimePickups = completedPickups.filter((item) => {
    const verifiedAt = new Date(item.paymentVerifiedTime!).getTime();
    const pickedAt = new Date(item.pickupConfirmedAt!).getTime();
    return pickedAt - verifiedAt <= pickupDeadlineHours * 60 * 60 * 1000;
  }).length;
  const onTimePickupRate = completedPickups.length > 0 ? (onTimePickups / completedPickups.length) * 100 : 0;

  // Get vendor rating
  const vendorRecord = await db
    .select({ rating: vendors.rating })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  const storedRating = vendorRecord[0]?.rating || '0';
  const autoRating = await calculateAutoRating(vendorId);
  const rating = formatRatingLabel(storedRating, autoRating, totalBids + totalVerifiedPayments);

  const allVendorsResult = (await db.execute(sql`
    WITH win_events AS (
      SELECT current_bidder AS vendor_id, id AS auction_id
      FROM auctions
      WHERE current_bidder IS NOT NULL
        AND status IN ('closed', 'awaiting_payment')
      UNION
      SELECT vendor_id, auction_id
      FROM auction_winners
      WHERE rank = 1
    )
    SELECT
      v.id AS vendor_id,
      COUNT(DISTINCT we.auction_id)::int AS total_wins
    FROM vendors v
    LEFT JOIN win_events we ON we.vendor_id = v.id
    GROUP BY v.id
    ORDER BY COUNT(DISTINCT we.auction_id) DESC, v.created_at ASC
  `)) as any[];

  const vendorsWithTotalWins = allVendorsResult.map(v => ({
    vendorId: v.vendor_id,
    totalWins: numberFrom(v.total_wins),
  }));

  const totalVendors = vendorsWithTotalWins.length;
  const leaderboardPosition = vendorsWithTotalWins.findIndex(v => v.vendorId === vendorId) + 1;

  return {
    winRate: Math.round(winRate * 100) / 100,
    avgPaymentTimeHours: Math.round(avgPaymentTimeHours * 100) / 100,
    onTimePickupRate: Math.round(onTimePickupRate * 100) / 100,
    rating: rating.value,
    ratingLabel: rating.label,
    ratingSource: rating.source,
    leaderboardPosition: leaderboardPosition > 0 ? leaderboardPosition : totalVendors,
    totalVendors,
    totalBids,
    totalWins,
  };
}

async function calculateVendorOperationsControl(
  vendorId: string,
  paidAwaitingPickup: number,
  bidLimit?: number
): Promise<VendorOperationsControl> {
  const [row] = (await db.execute(sql`
    WITH verified_payments AS (
      SELECT DISTINCT auction_id, vendor_id
      FROM payments
      WHERE status = 'verified'
    )
    SELECT
      COUNT(DISTINCT CASE
        WHEN a.current_bidder = ${vendorId}
        AND a.status IN ('closed', 'awaiting_payment')
        AND vp.auction_id IS NULL
        THEN a.id
      END)::int AS won_awaiting_payment,
      COUNT(DISTINCT CASE
        WHEN rf.vendor_id = ${vendorId}
        AND rf.status = 'signed'
        AND COALESCE(rf.disabled, false) = false
        AND vp.auction_id IS NULL
        THEN rf.auction_id
      END)::int AS signed_awaiting_payment,
      AVG(EXTRACT(EPOCH FROM (p.verified_at - a.end_time)) / 3600.0) FILTER (
        WHERE p.status = 'verified'
        AND p.vendor_id = ${vendorId}
        AND p.verified_at IS NOT NULL
        AND p.verified_at >= a.end_time
      )::numeric AS avg_payment_hours,
      AVG(EXTRACT(EPOCH FROM (a.pickup_confirmed_admin_at - p.verified_at)) / 3600.0) FILTER (
        WHERE p.status = 'verified'
        AND p.vendor_id = ${vendorId}
        AND p.verified_at IS NOT NULL
        AND a.pickup_confirmed_admin_at IS NOT NULL
        AND a.pickup_confirmed_admin_at >= p.verified_at
      )::numeric AS avg_pickup_hours
    FROM auctions a
    LEFT JOIN verified_payments vp
      ON vp.auction_id = a.id
      AND vp.vendor_id = ${vendorId}
    LEFT JOIN payments p
      ON p.auction_id = a.id
      AND p.vendor_id = ${vendorId}
    LEFT JOIN release_forms rf
      ON rf.auction_id = a.id
      AND rf.vendor_id = ${vendorId}
  `)) as any[];

  return {
    bidLimit,
    wonAwaitingPayment: numberFrom(row?.won_awaiting_payment),
    signedAwaitingPayment: numberFrom(row?.signed_awaiting_payment),
    paidAwaitingPickup,
    averagePaymentTimeHours: nullableNumberFrom(row?.avg_payment_hours),
    averagePickupTimeHours: nullableNumberFrom(row?.avg_pickup_hours),
  };
}

/**
 * Calculate badges earned by vendor
 */
function calculateBadges(
  stats: PerformanceStats,
  vendor: {
    tier: string;
    [key: string]: unknown;
  }
): Badge[] {
  const badges: Badge[] = [
    {
      id: '10_wins',
      name: '10 Wins',
      description: 'Won 10 or more auctions',
      icon: '🏆',
      earned: stats.totalWins >= 10,
    },
    {
      id: 'top_bidder',
      name: 'Top Bidder',
      description: 'In top 10 on leaderboard',
      icon: '⭐',
      earned: stats.leaderboardPosition <= 10,
    },
    {
      id: 'fast_payer',
      name: 'Fast Payer',
      description: 'Average payment time under 6 hours',
      icon: '⚡',
      earned: stats.avgPaymentTimeHours < 6 && stats.avgPaymentTimeHours > 0,
    },
    {
      id: 'verified_bvn',
      name: 'Verified BVN',
      description: 'Identity verified via BVN',
      icon: '✓',
      earned: vendor.tier === 'tier1_bvn' || vendor.tier === 'tier2_full',
    },
    {
      id: 'verified_business',
      name: 'Verified Business',
      description: 'Full business documentation verified',
      icon: '🏢',
      earned: vendor.tier === 'tier2_full',
    },
    {
      id: 'top_rated',
      name: 'Top Rated',
      description: 'Rating of 4.5 stars or higher',
      icon: '⭐⭐⭐⭐⭐',
      earned: stats.rating >= 4.5,
    },
  ];

  return badges;
}

/**
 * Calculate comparison to last month
 */
async function calculateComparisons(
  vendorId: string,
  currentStats: PerformanceStats
): Promise<Comparison[]> {
  // Calculate date ranges
  const now = new Date();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Get last month's total bids
  const lastMonthBidsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bids)
    .where(
      and(
        eq(bids.vendorId, vendorId),
        gte(bids.createdAt, lastMonthStart),
        lte(bids.createdAt, lastMonthEnd)
      )
    );

  const lastMonthBids = lastMonthBidsResult[0]?.count || 0;

  const [lastMonthWinsRow] = (await db.execute(sql`
    WITH win_events AS (
      SELECT id AS auction_id
      FROM auctions
      WHERE current_bidder = ${vendorId}
        AND status IN ('closed', 'awaiting_payment')
        AND updated_at >= ${lastMonthStart.toISOString()}::timestamptz
        AND updated_at <= ${lastMonthEnd.toISOString()}::timestamptz
      UNION
      SELECT auction_id
      FROM auction_winners
      WHERE vendor_id = ${vendorId}
        AND rank = 1
        AND created_at >= ${lastMonthStart.toISOString()}::timestamptz
        AND created_at <= ${lastMonthEnd.toISOString()}::timestamptz
    )
    SELECT COUNT(DISTINCT auction_id)::int AS total_wins
    FROM win_events
  `)) as any[];

  const lastMonthWins = numberFrom(lastMonthWinsRow?.total_wins);

  // Calculate last month's win rate
  const lastMonthWinRate = lastMonthBids > 0 ? (lastMonthWins / lastMonthBids) * 100 : 0;

  // Calculate comparisons (excluding Average Payment Time for vendor view)
  const comparisons: Comparison[] = [
    {
      metric: 'Win Rate',
      currentValue: currentStats.winRate,
      previousValue: Math.round(lastMonthWinRate * 100) / 100,
      change: Math.round((currentStats.winRate - lastMonthWinRate) * 100) / 100,
      trend: currentStats.winRate > lastMonthWinRate ? 'up' : currentStats.winRate < lastMonthWinRate ? 'down' : 'neutral',
    },
    // Average Payment Time removed - admin/manager only metric
    {
      metric: 'Total Bids',
      currentValue: currentStats.totalBids,
      previousValue: lastMonthBids,
      change: currentStats.totalBids - lastMonthBids,
      trend: currentStats.totalBids > lastMonthBids ? 'up' : currentStats.totalBids < lastMonthBids ? 'down' : 'neutral',
    },
    {
      metric: 'Total Wins',
      currentValue: currentStats.totalWins,
      previousValue: lastMonthWins,
      change: currentStats.totalWins - lastMonthWins,
      trend: currentStats.totalWins > lastMonthWins ? 'up' : currentStats.totalWins < lastMonthWins ? 'down' : 'neutral',
    },
  ];

  return comparisons;
}

function numberFrom(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumberFrom(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 10) / 10 : null;
}
