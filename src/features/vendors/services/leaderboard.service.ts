import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import { businessPolicyService } from '@/features/business-policy/business-policy.service';
import { calculateAutoRating } from './auto-rating.service';
import { formatRatingLabel } from '@/lib/metrics/dashboard-status';

export interface LeaderboardEntry {
  rank: number;
  vendorId: string;
  vendorName: string;
  businessName: string | null;
  tier: string;
  totalBids: number;
  wins: number;
  totalSpent: string;
  winRate: number;
  onTimePickupRate: number;
  rating: string;
  ratingLabel: string;
  ratingSource: 'stored' | 'auto' | 'insufficient';
  profilePictureUrl: string | null;
}

export async function calculateLeaderboard(limit = 25): Promise<LeaderboardEntry[]> {
  const policy = await businessPolicyService.getEffectivePolicy();
  const requireFullVerificationForLeaderboard = policy.onboarding.requireTier2ForUnlimitedBidding;
  const rows = await db.execute(sql`
    WITH bid_stats AS (
      SELECT
        vendor_id,
        COUNT(*)::int AS total_bids,
        COUNT(DISTINCT auction_id)::int AS auctions_participated
      FROM bids
      GROUP BY vendor_id
    ),
    win_events AS (
      SELECT current_bidder AS vendor_id, id AS auction_id
      FROM auctions
      WHERE current_bidder IS NOT NULL
        AND status IN ('closed', 'awaiting_payment')
      UNION
      SELECT vendor_id, auction_id
      FROM auction_winners
      WHERE rank = 1
      UNION
      SELECT p.vendor_id, p.auction_id
      FROM payments p
      INNER JOIN auctions a ON a.id = p.auction_id
      WHERE p.status = 'verified'
        AND p.auction_id IS NOT NULL
        AND p.vendor_id = a.current_bidder
    ),
    verified_winner_payments AS (
      SELECT DISTINCT ON (p.auction_id)
        p.vendor_id,
        p.auction_id,
        p.amount,
        p.verified_at
      FROM payments p
      INNER JOIN auctions a ON a.id = p.auction_id
      WHERE p.status = 'verified'
        AND p.auction_id IS NOT NULL
        AND p.vendor_id = a.current_bidder
      ORDER BY p.auction_id, p.verified_at DESC NULLS LAST, p.created_at DESC
    ),
    pickup_stats AS (
      SELECT
        p.vendor_id,
        COUNT(*) FILTER (
          WHERE a.pickup_confirmed_admin_at IS NOT NULL
          AND a.pickup_confirmed_admin_at >= p.verified_at
        )::int AS completed_pickups,
        COUNT(*) FILTER (
          WHERE a.pickup_confirmed_admin_at IS NOT NULL
          AND a.pickup_confirmed_admin_at >= p.verified_at
          AND a.pickup_confirmed_admin_at <= p.verified_at + INTERVAL '48 hours'
        )::int AS on_time_pickups
      FROM verified_winner_payments p
      INNER JOIN auctions a ON a.id = p.auction_id
      GROUP BY p.vendor_id
    ),
    payment_stats AS (
      SELECT
        vendor_id,
        COALESCE(SUM(amount::numeric), 0)::numeric AS total_spent,
        COUNT(*)::int AS verified_payments
      FROM verified_winner_payments
      GROUP BY vendor_id
    ),
    win_stats AS (
      SELECT
        vendor_id,
        COUNT(DISTINCT auction_id)::int AS wins
      FROM win_events
      GROUP BY vendor_id
    )
    SELECT
      v.id,
      v.business_name,
      u.full_name AS vendor_name,
      u.email AS vendor_email,
      u.profile_picture_url,
      v.tier,
      v.rating,
      COALESCE(bs.total_bids, 0)::int AS total_bids,
      COALESCE(bs.auctions_participated, 0)::int AS auctions_participated,
      COALESCE(ws.wins, 0)::int AS wins,
      COALESCE(ps.total_spent, 0)::numeric AS total_spent,
      COALESCE(pus.on_time_pickups, 0)::int AS on_time_pickups,
      COALESCE(pus.completed_pickups, 0)::int AS completed_pickups,
      COALESCE(ps.verified_payments, 0)::int AS verified_payments
    FROM vendors v
    INNER JOIN users u ON v.user_id = u.id
    LEFT JOIN bid_stats bs ON bs.vendor_id = v.id
    LEFT JOIN win_stats ws ON ws.vendor_id = v.id
    LEFT JOIN payment_stats ps ON ps.vendor_id = v.id
    LEFT JOIN pickup_stats pus ON pus.vendor_id = v.id
    WHERE (
      v.status = 'approved'
      OR COALESCE(ws.wins, 0) > 0
      OR COALESCE(bs.total_bids, 0) > 0
    )
      ${requireFullVerificationForLeaderboard ? sql`AND v.tier = 'tier2_full'` : sql``}
      AND u.email NOT ILIKE '%@example.com'
      AND u.email NOT ILIKE '%test-bid-%'
      AND u.email NOT ILIKE '%demo%@'
      AND u.email NOT ILIKE '%uat%@'
    ORDER BY COALESCE(ws.wins, 0) DESC, COALESCE(ps.total_spent, 0) DESC, COALESCE(bs.total_bids, 0) DESC
    LIMIT ${limit}
  `);

  const records = Array.isArray(rows) ? (rows as any[]) : [];
  const leaderboard: LeaderboardEntry[] = [];

  for (const [index, vendor] of records.entries()) {
    const totalBids = Number(vendor.total_bids || 0);
    const wins = Number(vendor.wins || 0);
    const completedPickups = Number(vendor.completed_pickups || 0);
    const onTimePickups = Number(vendor.on_time_pickups || 0);
    const verifiedPayments = Number(vendor.verified_payments || 0);
    const activityCount = totalBids + verifiedPayments;
    const autoRating = await calculateAutoRating(vendor.id);
    const rating = formatRatingLabel(vendor.rating, autoRating, activityCount);

    leaderboard.push({
      rank: index + 1,
      vendorId: vendor.id,
      vendorName: vendor.vendor_name || vendor.business_name || 'Unknown vendor',
      businessName: vendor.business_name || null,
      tier: vendor.tier || 'tier1_bvn',
      totalBids,
      wins,
      totalSpent: String(vendor.total_spent || '0'),
      winRate: totalBids > 0 ? Math.round((wins / totalBids) * 10000) / 100 : 0,
      onTimePickupRate: completedPickups > 0 ? Math.round((onTimePickups / completedPickups) * 10000) / 100 : 0,
      rating: rating.value.toFixed(2),
      ratingLabel: rating.label,
      ratingSource: rating.source,
      profilePictureUrl: vendor.profile_picture_url || null,
    });
  }

  return leaderboard;
}
