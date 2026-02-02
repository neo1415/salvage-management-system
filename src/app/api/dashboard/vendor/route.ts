import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions, bids, payments, vendors } from '@/lib/db/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';

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

    // Try to get cached data
    const cacheKey = `dashboard:vendor:${vendor.id}`;
    try {
      const cachedData = await cache.get<VendorDashboardData>(cacheKey);

      if (cachedData) {
        console.log('[Dashboard API] Returning cached data');
        return NextResponse.json(cachedData);
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

    const dashboardData: VendorDashboardData = {
      performanceStats,
      badges,
      comparisons,
      lastUpdated: new Date().toISOString(),
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

  // Get total wins (auctions where vendor is current bidder and status is closed)
  const totalWinsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auctions)
    .where(
      and(
        eq(auctions.currentBidder, vendorId),
        eq(auctions.status, 'closed')
      )
    );

  const totalWins = totalWinsResult[0]?.count || 0;

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

  let avgPaymentTimeHours = 0;
  if (paymentTimesResult.length > 0) {
    const totalPaymentTime = paymentTimesResult.reduce((sum, item) => {
      if (item.auctionEndTime && item.paymentVerifiedTime) {
        const endTime = new Date(item.auctionEndTime).getTime();
        const verifiedTime = new Date(item.paymentVerifiedTime).getTime();
        const diffHours = (verifiedTime - endTime) / (1000 * 60 * 60);
        return sum + diffHours;
      }
      return sum;
    }, 0);
    avgPaymentTimeHours = totalPaymentTime / paymentTimesResult.length;
  }

  // Calculate on-time pickup rate (assuming pickup is within 48 hours of payment)
  // For now, we'll use payment verification as a proxy for pickup
  const onTimePaymentsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .innerJoin(auctions, eq(payments.auctionId, auctions.id))
    .where(
      and(
        eq(payments.vendorId, vendorId),
        eq(payments.status, 'verified'),
        sql`${payments.verifiedAt} <= ${auctions.endTime} + INTERVAL '48 hours'`
      )
    );

  const onTimePayments = onTimePaymentsResult[0]?.count || 0;
  const totalVerifiedPayments = paymentTimesResult.length;
  const onTimePickupRate = totalVerifiedPayments > 0 ? (onTimePayments / totalVerifiedPayments) * 100 : 0;

  // Get vendor rating
  const vendorRecord = await db
    .select({ rating: vendors.rating })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  const rating = parseFloat(vendorRecord[0]?.rating || '0');

  // Calculate leaderboard position
  // Get all vendors ordered by total wins
  const allVendorsResult = await db
    .select({
      vendorId: vendors.id,
      totalWins: sql<number>`count(CASE WHEN ${auctions.currentBidder} = ${vendors.id} AND ${auctions.status} = 'closed' THEN 1 END)::int`,
    })
    .from(vendors)
    .leftJoin(auctions, eq(auctions.currentBidder, vendors.id))
    .groupBy(vendors.id)
    .orderBy(desc(sql`count(CASE WHEN ${auctions.currentBidder} = ${vendors.id} AND ${auctions.status} = 'closed' THEN 1 END)`));

  const totalVendors = allVendorsResult.length;
  const leaderboardPosition = allVendorsResult.findIndex(v => v.vendorId === vendorId) + 1;

  return {
    winRate: Math.round(winRate * 100) / 100,
    avgPaymentTimeHours: Math.round(avgPaymentTimeHours * 100) / 100,
    onTimePickupRate: Math.round(onTimePickupRate * 100) / 100,
    rating: Math.round(rating * 100) / 100,
    leaderboardPosition: leaderboardPosition > 0 ? leaderboardPosition : totalVendors,
    totalVendors,
    totalBids,
    totalWins,
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

  // Get last month's total wins
  const lastMonthWinsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auctions)
    .where(
      and(
        eq(auctions.currentBidder, vendorId),
        eq(auctions.status, 'closed'),
        gte(auctions.updatedAt, lastMonthStart),
        lte(auctions.updatedAt, lastMonthEnd)
      )
    );

  const lastMonthWins = lastMonthWinsResult[0]?.count || 0;

  // Calculate last month's win rate
  const lastMonthWinRate = lastMonthBids > 0 ? (lastMonthWins / lastMonthBids) * 100 : 0;

  // Get last month's payment times
  const lastMonthPaymentTimesResult = await db
    .select({
      auctionEndTime: auctions.endTime,
      paymentVerifiedTime: payments.verifiedAt,
    })
    .from(payments)
    .innerJoin(auctions, eq(payments.auctionId, auctions.id))
    .where(
      and(
        eq(payments.vendorId, vendorId),
        eq(payments.status, 'verified'),
        gte(payments.verifiedAt, lastMonthStart),
        lte(payments.verifiedAt, lastMonthEnd)
      )
    );

  let lastMonthAvgPaymentTime = 0;
  if (lastMonthPaymentTimesResult.length > 0) {
    const totalPaymentTime = lastMonthPaymentTimesResult.reduce((sum, item) => {
      if (item.auctionEndTime && item.paymentVerifiedTime) {
        const endTime = new Date(item.auctionEndTime).getTime();
        const verifiedTime = new Date(item.paymentVerifiedTime).getTime();
        const diffHours = (verifiedTime - endTime) / (1000 * 60 * 60);
        return sum + diffHours;
      }
      return sum;
    }, 0);
    lastMonthAvgPaymentTime = totalPaymentTime / lastMonthPaymentTimesResult.length;
  }

  // Calculate comparisons
  const comparisons: Comparison[] = [
    {
      metric: 'Win Rate',
      currentValue: currentStats.winRate,
      previousValue: Math.round(lastMonthWinRate * 100) / 100,
      change: Math.round((currentStats.winRate - lastMonthWinRate) * 100) / 100,
      trend: currentStats.winRate > lastMonthWinRate ? 'up' : currentStats.winRate < lastMonthWinRate ? 'down' : 'neutral',
    },
    {
      metric: 'Average Payment Time',
      currentValue: currentStats.avgPaymentTimeHours,
      previousValue: Math.round(lastMonthAvgPaymentTime * 100) / 100,
      change: Math.round((currentStats.avgPaymentTimeHours - lastMonthAvgPaymentTime) * 100) / 100,
      trend: currentStats.avgPaymentTimeHours < lastMonthAvgPaymentTime ? 'up' : currentStats.avgPaymentTimeHours > lastMonthAvgPaymentTime ? 'down' : 'neutral',
    },
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
