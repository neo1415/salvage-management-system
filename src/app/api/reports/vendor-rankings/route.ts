import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { vendors, bids, auctions, payments, users } from '@/lib/db/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';

/**
 * GET /api/reports/vendor-rankings
 * Generate vendor rankings report with date range filtering
 * 
 * Query Parameters:
 * - startDate: ISO date string (required)
 * - endDate: ISO date string (required)
 * - limit: number of vendors to return (default: 50)
 * 
 * Returns:
 * - rankings: array of vendors with performance metrics
 *   - rank, vendorId, businessName, tier, totalBids, totalWins, totalSpent, winRate, avgPaymentTime, onTimePickupRate, rating
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !['salvage_manager', 'system_admin'].includes(session.user.role)) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Only Salvage Managers and Admins can access reports',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!startDate || !endDate) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'VALIDATION_ERROR',
            message: 'startDate and endDate are required',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid date format. Use ISO date strings',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }

    // Get all vendors with their bids and payments in date range
    const vendorData = await db
      .select({
        vendorId: vendors.id,
        userId: vendors.userId,
        businessName: vendors.businessName,
        tier: vendors.tier,
        rating: vendors.rating,
        performanceStats: vendors.performanceStats,
        fullName: users.fullName,
        bidId: bids.id,
        bidAmount: bids.amount,
        bidCreatedAt: bids.createdAt,
        auctionId: auctions.id,
        currentBidder: auctions.currentBidder,
        auctionStatus: auctions.status,
        paymentId: payments.id,
        paymentAmount: payments.amount,
        paymentCreatedAt: payments.createdAt,
        paymentVerifiedAt: payments.verifiedAt,
      })
      .from(vendors)
      .innerJoin(users, eq(vendors.userId, users.id))
      .leftJoin(bids, eq(vendors.id, bids.vendorId))
      .leftJoin(auctions, eq(bids.auctionId, auctions.id))
      .leftJoin(payments, and(eq(auctions.id, payments.auctionId), eq(vendors.id, payments.vendorId)))
      .where(
        and(
          eq(vendors.status, 'approved'),
          gte(bids.createdAt, start),
          lte(bids.createdAt, end)
        )
      );

    // Aggregate vendor statistics
    const vendorStats = new Map<
      string,
      {
        vendorId: string;
        businessName: string | null;
        fullName: string;
        tier: string;
        rating: string;
        totalBids: number;
        totalWins: number;
        totalSpent: number;
        paymentTimes: number[];
        performanceStats: {
          totalBids: number;
          totalWins: number;
          winRate: number;
          avgPaymentTimeHours: number;
          onTimePickupRate: number;
          fraudFlags: number;
        };
      }
    >();

    for (const row of vendorData) {
      if (!vendorStats.has(row.vendorId)) {
        vendorStats.set(row.vendorId, {
          vendorId: row.vendorId,
          businessName: row.businessName,
          fullName: row.fullName,
          tier: row.tier,
          rating: row.rating,
          totalBids: 0,
          totalWins: 0,
          totalSpent: 0,
          paymentTimes: [],
          performanceStats: row.performanceStats,
        });
      }

      const stats = vendorStats.get(row.vendorId)!;

      // Count bids
      if (row.bidId) {
        stats.totalBids++;
      }

      // Count wins (vendor is current bidder and auction is closed)
      if (row.currentBidder === row.vendorId && row.auctionStatus === 'closed') {
        stats.totalWins++;
      }

      // Sum total spent
      if (row.paymentAmount) {
        stats.totalSpent += parseFloat(row.paymentAmount);
      }

      // Calculate payment time (hours from auction close to payment verification)
      if (row.paymentCreatedAt && row.paymentVerifiedAt) {
        const paymentTimeHours =
          (row.paymentVerifiedAt.getTime() - row.paymentCreatedAt.getTime()) / (1000 * 60 * 60);
        stats.paymentTimes.push(paymentTimeHours);
      }
    }

    // Calculate final metrics and rank vendors
    const rankings = Array.from(vendorStats.values())
      .map((stats) => {
        const winRate = stats.totalBids > 0 ? (stats.totalWins / stats.totalBids) * 100 : 0;
        const avgPaymentTime =
          stats.paymentTimes.length > 0
            ? stats.paymentTimes.reduce((sum, time) => sum + time, 0) / stats.paymentTimes.length
            : 0;
        const onTimePickupRate =
          typeof stats.performanceStats === 'object' && stats.performanceStats !== null
            ? stats.performanceStats.onTimePickupRate || 0
            : 0;

        return {
          vendorId: stats.vendorId,
          businessName: stats.businessName || stats.fullName,
          tier: stats.tier,
          totalBids: stats.totalBids,
          totalWins: stats.totalWins,
          totalSpent: Math.round(stats.totalSpent * 100) / 100,
          winRate: Math.round(winRate * 100) / 100,
          avgPaymentTime: Math.round(avgPaymentTime * 100) / 100,
          onTimePickupRate: Math.round(onTimePickupRate * 100) / 100,
          rating: parseFloat(stats.rating),
        };
      })
      .sort((a, b) => {
        // Primary sort: total spent (descending)
        if (b.totalSpent !== a.totalSpent) {
          return b.totalSpent - a.totalSpent;
        }
        // Secondary sort: win rate (descending)
        if (b.winRate !== a.winRate) {
          return b.winRate - a.winRate;
        }
        // Tertiary sort: rating (descending)
        return b.rating - a.rating;
      })
      .slice(0, limit)
      .map((vendor, index) => ({
        rank: index + 1,
        ...vendor,
      }));

    return NextResponse.json({
      status: 'success',
      data: {
        rankings,
        dateRange: {
          start: startDate,
          end: endDate,
        },
        totalVendors: rankings.length,
      },
    });
  } catch (error) {
    console.error('Vendor rankings report error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate vendor rankings report',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
