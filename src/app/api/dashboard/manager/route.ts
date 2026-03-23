import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions, salvageCases, bids, payments, vendors } from '@/lib/db/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';

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

interface DashboardData {
  kpis: DashboardKPIs;
  charts: {
    recoveryRateTrend: RecoveryRateTrend[];
    topVendors: TopVendor[];
    paymentStatusBreakdown: PaymentStatusBreakdown[];
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

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const dateRange = searchParams.get('dateRange') || '30'; // Default 30 days
    const assetType = searchParams.get('assetType'); // Optional filter

    // Try to get cached data
    const cacheKey = `dashboard:manager:${dateRange}:${assetType || 'all'}`;
    const cachedData = await cache.get<DashboardData>(cacheKey);

    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Calculate KPIs
    const kpis = await calculateKPIs(assetType);

    // Generate charts data
    const recoveryRateTrend = await calculateRecoveryRateTrend(parseInt(dateRange), assetType);
    const topVendors = await getTopVendors(assetType);
    const paymentStatusBreakdown = await getPaymentStatusBreakdown(assetType);

    const dashboardData: DashboardData = {
      kpis,
      charts: {
        recoveryRateTrend,
        topVendors,
        paymentStatusBreakdown,
      },
      lastUpdated: new Date().toISOString(),
    };

    // Cache the data for 5 minutes (300 seconds)
    await cache.set(cacheKey, dashboardData, 300);

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
async function calculateKPIs(assetType: string | null): Promise<DashboardKPIs> {
  // Active auctions count
  let activeAuctionsQuery;
  
  if (assetType) {
    activeAuctionsQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(
        and(
          eq(auctions.status, 'active'),
          eq(salvageCases.assetType, assetType as any)
        )
      );
  } else {
    activeAuctionsQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(auctions)
      .where(eq(auctions.status, 'active'));
  }

  const activeAuctionsResult = await activeAuctionsQuery;
  const activeAuctions = activeAuctionsResult[0]?.count || 0;

  // Total bids today
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalBidsTodayResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bids)
    .where(gte(bids.createdAt, today));

  const totalBidsToday = totalBidsTodayResult[0]?.count || 0;

  // Average recovery rate (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let recoveryRateQuery;
  
  if (assetType) {
    recoveryRateQuery = db
      .select({
        marketValue: salvageCases.marketValue,
        soldPrice: auctions.currentBid,
      })
      .from(salvageCases)
      .innerJoin(auctions, eq(salvageCases.id, auctions.caseId))
      .where(
        and(
          eq(auctions.status, 'closed'),
          gte(auctions.updatedAt, thirtyDaysAgo),
          eq(salvageCases.assetType, assetType as any)
        )
      );
  } else {
    recoveryRateQuery = db
      .select({
        marketValue: salvageCases.marketValue,
        soldPrice: auctions.currentBid,
      })
      .from(salvageCases)
      .innerJoin(auctions, eq(salvageCases.id, auctions.caseId))
      .where(
        and(
          eq(auctions.status, 'closed'),
          gte(auctions.updatedAt, thirtyDaysAgo)
        )
      );
  }

  const recoveryRateData = await recoveryRateQuery;

  let averageRecoveryRate = 0;
  if (recoveryRateData.length > 0) {
    const totalRecoveryRate = recoveryRateData.reduce((sum, item) => {
      const marketValue = parseFloat(item.marketValue || '0');
      const soldPrice = parseFloat(item.soldPrice || '0');
      if (marketValue > 0) {
        return sum + (soldPrice / marketValue) * 100;
      }
      return sum;
    }, 0);
    averageRecoveryRate = totalRecoveryRate / recoveryRateData.length;
  }

  // Cases pending approval count
  let casesPendingQuery;
  
  if (assetType) {
    casesPendingQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(salvageCases)
      .where(
        and(
          eq(salvageCases.status, 'pending_approval'),
          eq(salvageCases.assetType, assetType as any)
        )
      );
  } else {
    casesPendingQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(salvageCases)
      .where(eq(salvageCases.status, 'pending_approval'));
  }

  const casesPendingResult = await casesPendingQuery;
  const casesPendingApproval = casesPendingResult[0]?.count || 0;

  return {
    activeAuctions,
    totalBidsToday,
    averageRecoveryRate: Math.round(averageRecoveryRate * 100) / 100,
    casesPendingApproval,
  };
}

/**
 * Calculate recovery rate trend for last N days
 */
async function calculateRecoveryRateTrend(
  days: number,
  assetType: string | null
): Promise<RecoveryRateTrend[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get closed auctions with their case data
  let query;
  
  if (assetType) {
    query = db
      .select({
        date: sql<string>`DATE(${auctions.updatedAt})`,
        marketValue: salvageCases.marketValue,
        soldPrice: auctions.currentBid,
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(
        and(
          eq(auctions.status, 'closed'),
          gte(auctions.updatedAt, startDate),
          eq(salvageCases.assetType, assetType as any)
        )
      );
  } else {
    query = db
      .select({
        date: sql<string>`DATE(${auctions.updatedAt})`,
        marketValue: salvageCases.marketValue,
        soldPrice: auctions.currentBid,
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(
        and(
          eq(auctions.status, 'closed'),
          gte(auctions.updatedAt, startDate)
        )
      );
  }

  const data = await query;

  // Group by date and calculate recovery rate
  const groupedData = data.reduce((acc, item) => {
    const date = item.date;
    if (!acc[date]) {
      acc[date] = {
        totalRecoveryRate: 0,
        count: 0,
      };
    }

    const marketValue = parseFloat(item.marketValue || '0');
    const soldPrice = parseFloat(item.soldPrice || '0');
    
    if (marketValue > 0) {
      const recoveryRate = (soldPrice / marketValue) * 100;
      acc[date].totalRecoveryRate += recoveryRate;
      acc[date].count += 1;
    }

    return acc;
  }, {} as Record<string, { totalRecoveryRate: number; count: number }>);

  // Convert to array and calculate averages
  const trend: RecoveryRateTrend[] = Object.entries(groupedData).map(([date, data]) => ({
    date,
    recoveryRate: Math.round((data.totalRecoveryRate / data.count) * 100) / 100,
    totalCases: data.count,
  }));

  // Sort by date
  trend.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return trend;
}

/**
 * Get top 5 vendors by volume
 */
async function getTopVendors(assetType: string | null): Promise<TopVendor[]> {
  // Get vendor bid statistics
  let query;
  
  if (assetType) {
    query = db
      .select({
        vendorId: bids.vendorId,
        vendorName: vendors.businessName,
        totalBids: sql<number>`count(*)::int`,
        totalWins: sql<number>`count(CASE WHEN ${auctions.currentBidder} = ${bids.vendorId} AND ${auctions.status} = 'closed' THEN 1 END)::int`,
        totalSpent: sql<number>`sum(CASE WHEN ${auctions.currentBidder} = ${bids.vendorId} AND ${auctions.status} = 'closed' THEN ${auctions.currentBid}::numeric ELSE 0 END)::numeric`,
      })
      .from(bids)
      .innerJoin(auctions, eq(bids.auctionId, auctions.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .innerJoin(vendors, eq(bids.vendorId, vendors.id))
      .where(eq(salvageCases.assetType, assetType as any))
      .groupBy(bids.vendorId, vendors.businessName)
      .orderBy(desc(sql`count(*)`))
      .limit(5);
  } else {
    query = db
      .select({
        vendorId: bids.vendorId,
        vendorName: vendors.businessName,
        totalBids: sql<number>`count(*)::int`,
        totalWins: sql<number>`count(CASE WHEN ${auctions.currentBidder} = ${bids.vendorId} AND ${auctions.status} = 'closed' THEN 1 END)::int`,
        totalSpent: sql<number>`sum(CASE WHEN ${auctions.currentBidder} = ${bids.vendorId} AND ${auctions.status} = 'closed' THEN ${auctions.currentBid}::numeric ELSE 0 END)::numeric`,
      })
      .from(bids)
      .innerJoin(auctions, eq(bids.auctionId, auctions.id))
      .innerJoin(vendors, eq(bids.vendorId, vendors.id))
      .groupBy(bids.vendorId, vendors.businessName)
      .orderBy(desc(sql`count(*)`))
      .limit(5);
  }

  const vendorStats = await query;

  // Map to TopVendor interface
  const topVendors: TopVendor[] = vendorStats.map((stat) => ({
    vendorId: stat.vendorId,
    vendorName: stat.vendorName || 'Unknown Vendor',
    totalBids: stat.totalBids || 0,
    totalWins: stat.totalWins || 0,
    totalSpent: parseFloat(stat.totalSpent?.toString() || '0'),
  }));

  return topVendors;
}

/**
 * Get payment status breakdown
 */
async function getPaymentStatusBreakdown(
  assetType: string | null
): Promise<PaymentStatusBreakdown[]> {
  let query;
  
  if (assetType) {
    query = db
      .select({
        status: payments.status,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(eq(salvageCases.assetType, assetType as any))
      .groupBy(payments.status);
  } else {
    query = db
      .select({
        status: payments.status,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .groupBy(payments.status);
  }

  const statusData = await query;

  // Calculate total for percentages
  const total = statusData.reduce((sum, item) => sum + (item.count || 0), 0);

  const breakdown: PaymentStatusBreakdown[] = statusData.map((item) => ({
    status: item.status,
    count: item.count || 0,
    percentage: total > 0 ? Math.round(((item.count || 0) / total) * 10000) / 100 : 0,
  }));

  return breakdown;
}
