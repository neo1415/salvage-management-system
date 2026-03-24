import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, desc, sql, and, gte, not, ilike } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';

/**
 * Vendor Leaderboard API
 * 
 * GET /api/vendors/leaderboard
 * 
 * Returns Top 10 vendors monthly by:
 * - Total bids
 * - Wins
 * - Total spent
 * - On-time pickup rate
 * 
 * Leaderboard is updated weekly (every Monday) and cached in Redis
 * Excludes test users based on email, name, and vendorId patterns
 * 
 * Requirements: 22.1, 22.2, 22.3, 22.6, 22.7, Enterprise Standards Section 6
 */

const LEADERBOARD_CACHE_KEY = 'leaderboard:monthly';
const LEADERBOARD_CACHE_TTL = 5 * 60; // 5 minutes (300 seconds)

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
  profilePictureUrl: string | null;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  lastUpdated: string;
  nextUpdate: string;
}

/**
 * Check if a vendor should be excluded as a test user
 * 
 * Exclusion criteria:
 * - Email contains: test, demo, uat (case-insensitive)
 * - Name contains: Test, Demo, UAT (case-insensitive)
 * - VendorId matches patterns: test-, demo-, uat-
 */
function isTestUser(email: string, name: string, vendorId: string): boolean {
  const emailLower = email.toLowerCase();
  const nameLower = name.toLowerCase();
  const vendorIdLower = vendorId.toLowerCase();
  
  // Check email patterns
  if (emailLower.includes('test') || emailLower.includes('demo') || emailLower.includes('uat')) {
    return true;
  }
  
  // Check name patterns
  if (nameLower.includes('test') || nameLower.includes('demo') || nameLower.includes('uat')) {
    return true;
  }
  
  // Check vendorId patterns
  if (vendorIdLower.startsWith('test-') || vendorIdLower.startsWith('demo-') || vendorIdLower.startsWith('uat-')) {
    return true;
  }
  
  return false;
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
  // We'll use the performanceStats JSONB field which tracks:
  // - totalBids
  // - totalWins
  // - onTimePickupRate
  // And calculate total spent from closed auctions
  // 
  // Exclude test users using database-level filtering for performance
  const vendorData = await db
    .select({
      vendorId: vendors.id,
      userId: vendors.userId,
      businessName: vendors.businessName,
      tier: vendors.tier,
      performanceStats: vendors.performanceStats,
      rating: vendors.rating,
      userName: users.fullName,
      userEmail: users.email,
      profilePictureUrl: users.profilePictureUrl,
    })
    .from(vendors)
    .innerJoin(users, eq(vendors.userId, users.id))
    .where(
      and(
        eq(vendors.status, 'approved'),
        // Exclude test users by email patterns (case-insensitive)
        not(ilike(users.email, '%test%')),
        not(ilike(users.email, '%demo%')),
        not(ilike(users.email, '%uat%')),
        // Exclude test users by name patterns (case-insensitive)
        not(ilike(users.fullName, '%test%')),
        not(ilike(users.fullName, '%demo%')),
        not(ilike(users.fullName, '%uat%')),
        // Exclude test users by vendorId patterns (cast UUID to text for pattern matching)
        not(ilike(sql`${vendors.id}::text`, 'test-%')),
        not(ilike(sql`${vendors.id}::text`, 'demo-%')),
        not(ilike(sql`${vendors.id}::text`, 'uat-%'))
      )
    )
    .orderBy(desc(sql`COALESCE((${vendors.performanceStats}->>'totalWins')::int, 0)`))
    .limit(10);

  // For each vendor, calculate total spent this month
  const leaderboardEntries: LeaderboardEntry[] = [];

  for (let i = 0; i < vendorData.length; i++) {
    const vendor = vendorData[i];
    
    // Double-check test user filtering (defense in depth)
    if (isTestUser(vendor.userEmail, vendor.userName, vendor.vendorId)) {
      continue;
    }
    
    // Calculate total spent this month from closed auctions where vendor won
    const totalSpentResult = await db
      .select({
        totalSpent: sql<string>`COALESCE(SUM(CAST(${auctions.currentBid} AS NUMERIC)), 0)`,
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

    // Get performance stats with safe defaults
    const stats = (vendor.performanceStats as {
      totalBids?: number;
      totalWins?: number;
      winRate?: number;
      avgPaymentTimeHours?: number;
      onTimePickupRate?: number;
      fraudFlags?: number;
    }) || {};

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
      profilePictureUrl: vendor.profilePictureUrl,
    });
  }

  return leaderboardEntries;
}

/**
 * Get next cache refresh time (5 minutes from now)
 */
function getNextRefreshTime(): Date {
  const now = new Date();
  const nextRefresh = new Date(now.getTime() + LEADERBOARD_CACHE_TTL * 1000);
  return nextRefresh;
}

/**
 * GET /api/vendors/leaderboard
 * 
 * Returns the vendor leaderboard
 */
export async function GET() {
  try {
    // Check if we have cached leaderboard
    const cached = await cache.get<LeaderboardResponse>(LEADERBOARD_CACHE_KEY);
    
    if (cached) {
      return NextResponse.json(cached, { status: 200 });
    }

    // Calculate leaderboard
    const leaderboard = await calculateLeaderboard();

    // Prepare response
    const now = new Date();
    const nextRefresh = getNextRefreshTime();
    
    const response: LeaderboardResponse = {
      leaderboard,
      lastUpdated: now.toISOString(),
      nextUpdate: nextRefresh.toISOString(),
    };

    // Cache the leaderboard for 5 minutes
    await cache.set(LEADERBOARD_CACHE_KEY, response, LEADERBOARD_CACHE_TTL);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to fetch leaderboard',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
