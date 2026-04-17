import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import { subDays } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get vendor performance data for the last 30 days
    const startDate = subDays(new Date(), 30).toISOString();
    const endDate = new Date().toISOString();

    // Use the same query as KPI dashboard for vendor data
    const vendorsResult = await db.execute(sql`
      SELECT 
        v.id,
        v.business_name,
        u.full_name as vendor_name,
        u.profile_picture_url,
        v.tier,
        v.rating,
        COUNT(DISTINCT b.auction_id) as auctions_participated,
        COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id) as auctions_won,
        CASE 
          WHEN COUNT(DISTINCT b.auction_id) > 0 
          THEN (COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id)::NUMERIC / COUNT(DISTINCT b.auction_id) * 100)
          ELSE 0
        END as win_rate,
        COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) as total_spent,
        COUNT(b.id) as total_bids
      FROM vendors v
      LEFT JOIN users u ON v.user_id = u.id
      LEFT JOIN bids b ON v.id = b.vendor_id 
        AND b.created_at >= ${startDate}
        AND b.created_at <= ${endDate}
      LEFT JOIN auctions a ON b.auction_id = a.id AND a.current_bidder = v.id
      LEFT JOIN payments p ON a.id = p.auction_id AND p.vendor_id = v.id AND p.status = 'verified'
      GROUP BY v.id, v.business_name, u.full_name, u.profile_picture_url, v.tier, v.rating
      HAVING COUNT(DISTINCT b.auction_id) > 0
      ORDER BY auctions_won DESC, total_spent DESC
      LIMIT 10
    `);

    // Map to leaderboard format
    const leaderboard = (vendorsResult as any[]).map((vendor, index) => ({
      rank: index + 1,
      vendorId: vendor.id,
      vendorName: vendor.vendor_name || vendor.business_name || 'Unknown',
      businessName: vendor.business_name,
      profilePictureUrl: vendor.profile_picture_url,
      tier: vendor.tier || 'tier1_bvn',
      totalBids: parseInt(vendor.total_bids || '0'),
      wins: parseInt(vendor.auctions_won || '0'),
      totalSpent: vendor.total_spent.toString(),
      winRate: Math.round(parseFloat(vendor.win_rate || '0') * 100) / 100,
      participationRate: 0,
      onTimePickupRate: 0,
      rating: vendor.rating || '0',
    }));

    return NextResponse.json(
      {
        leaderboard,
        lastUpdated: new Date().toISOString(),
        nextUpdate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
