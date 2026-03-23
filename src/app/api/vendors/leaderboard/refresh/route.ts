import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';

/**
 * Vendor Leaderboard Refresh API
 * 
 * POST /api/vendors/leaderboard/refresh
 * 
 * Manually refresh the leaderboard (admin only)
 * This would typically be called by a cron job every Monday
 * 
 * Requirements: 23, Enterprise Standards Section 6
 */

const LEADERBOARD_CACHE_KEY = 'leaderboard:monthly';
const LEADERBOARD_CACHE_TTL = 7 * 24 * 60 * 60; // 7 days (weekly update)

interface LeaderboardEntry {
  rank: number;
  vendorId: string;
  vendorName: string;
  businessName: string | null;
  tier: string;
  totalBids: number;
  wins: number;
  totalSpent: string;
  onTimePickupRate: number;
  rating: string;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  lastUpdated: string;
  nextUpdate: string;
}

/**
 * Calculate leaderboard data from database
 */
async function calculateLeaderboard(): Promise<LeaderboardEntry[]> {
  // Get the start of the current month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Query vendors with their performance stats
  const vendorData = await db
    .select({
      vendorId: vendors.id,
      userId: vendors.userId,
      businessName: vendors.businessName,
      tier: vendors.tier,
      performanceStats: vendors.performanceStats,
      rating: vendors.rating,
      userName: users.fullName,
    })
    .from(vendors)
    .innerJoin(users, eq(vendors.userId, users.id))
    .where(eq(vendors.status, 'approved'))
    .orderBy(desc(sql`(${vendors.performanceStats}->>'totalWins')::int`))
    .limit(10);

  // For each vendor, calculate total spent this month
  const leaderboardEntries: LeaderboardEntry[] = [];

  for (let i = 0; i < vendorData.length; i++) {
    const vendor = vendorData[i];
    
    // Calculate total spent this month from closed auctions where vendor won
    const totalSpentResult = await db
      .select({
        totalSpent: sql<string>`COALESCE(SUM(${auctions.currentBid}), 0)`,
      })
      .from(auctions)
      .where(
        and(
          eq(auctions.currentBidder, vendor.vendorId),
          eq(auctions.status, 'closed'),
          gte(auctions.updatedAt, startOfMonth)
        )
      );

    const totalSpent = totalSpentResult[0]?.totalSpent || '0';

    // Get performance stats
    const stats = vendor.performanceStats as {
      totalBids: number;
      totalWins: number;
      winRate: number;
      avgPaymentTimeHours: number;
      onTimePickupRate: number;
      fraudFlags: number;
    };

    leaderboardEntries.push({
      rank: i + 1,
      vendorId: vendor.vendorId,
      vendorName: vendor.userName,
      businessName: vendor.businessName,
      tier: vendor.tier,
      totalBids: stats.totalBids || 0,
      wins: stats.totalWins || 0,
      totalSpent: totalSpent,
      onTimePickupRate: stats.onTimePickupRate || 0,
      rating: vendor.rating || '0.00',
    });
  }

  return leaderboardEntries;
}

/**
 * Get next Monday at midnight
 */
function getNextMonday(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  
  return nextMonday;
}

/**
 * POST /api/vendors/leaderboard/refresh
 * 
 * Manually refresh the leaderboard
 */
export async function POST() {
  try {
    // Authentication check for admin role
    // Note: This endpoint should be restricted to admin/cron jobs in production
    // Consider adding API key authentication or restricting to internal network

    // Invalidate cache
    await cache.del(LEADERBOARD_CACHE_KEY);

    // Recalculate leaderboard
    const leaderboard = await calculateLeaderboard();

    // Prepare response
    const now = new Date();
    const nextMonday = getNextMonday();
    
    const response: LeaderboardResponse = {
      leaderboard,
      lastUpdated: now.toISOString(),
      nextUpdate: nextMonday.toISOString(),
    };

    // Cache the leaderboard
    await cache.set(LEADERBOARD_CACHE_KEY, response, LEADERBOARD_CACHE_TTL);

    return NextResponse.json(
      {
        message: 'Leaderboard refreshed successfully',
        ...response,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error refreshing leaderboard:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to refresh leaderboard',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
