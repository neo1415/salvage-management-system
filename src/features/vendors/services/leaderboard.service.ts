import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
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

export async function calculateLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const rows = await db.execute(sql`
    WITH bid_stats AS (
      SELECT
        vendor_id,
        COUNT(*)::int AS total_bids,
        COUNT(DISTINCT auction_id)::int AS auctions_participated
      FROM bids
      GROUP BY vendor_id
    ),
    payment_stats AS (
      SELECT
        vendor_id,
        COUNT(DISTINCT auction_id)::int AS wins,
        COALESCE(SUM(amount::numeric), 0)::numeric AS total_spent,
        COUNT(*) FILTER (
          WHERE verified_at IS NOT NULL
          AND payment_deadline IS NOT NULL
          AND verified_at <= payment_deadline
        )::int AS on_time_payments,
        COUNT(*)::int AS verified_payments
      FROM payments
      WHERE status = 'verified'
      AND auction_id IS NOT NULL
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
      COALESCE(ps.wins, 0)::int AS wins,
      COALESCE(ps.total_spent, 0)::numeric AS total_spent,
      COALESCE(ps.on_time_payments, 0)::int AS on_time_payments,
      COALESCE(ps.verified_payments, 0)::int AS verified_payments
    FROM vendors v
    INNER JOIN users u ON v.user_id = u.id
    LEFT JOIN bid_stats bs ON bs.vendor_id = v.id
    LEFT JOIN payment_stats ps ON ps.vendor_id = v.id
    WHERE v.status = 'approved'
      AND u.email NOT ILIKE '%test%'
      AND u.email NOT ILIKE '%demo%'
      AND u.email NOT ILIKE '%uat%'
      AND u.full_name NOT ILIKE '%test%'
      AND u.full_name NOT ILIKE '%demo%'
      AND u.full_name NOT ILIKE '%uat%'
    ORDER BY COALESCE(ps.wins, 0) DESC, COALESCE(ps.total_spent, 0) DESC, COALESCE(bs.total_bids, 0) DESC
    LIMIT ${limit}
  `);

  const records = Array.isArray(rows) ? (rows as any[]) : [];
  const leaderboard: LeaderboardEntry[] = [];

  for (const [index, vendor] of records.entries()) {
    const totalBids = Number(vendor.total_bids || 0);
    const auctionsParticipated = Number(vendor.auctions_participated || 0);
    const wins = Number(vendor.wins || 0);
    const verifiedPayments = Number(vendor.verified_payments || 0);
    const onTimePayments = Number(vendor.on_time_payments || 0);
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
      winRate: auctionsParticipated > 0 ? Math.round((wins / auctionsParticipated) * 10000) / 100 : 0,
      onTimePickupRate: verifiedPayments > 0 ? Math.round((onTimePayments / verifiedPayments) * 10000) / 100 : 0,
      rating: rating.value.toFixed(2),
      ratingLabel: rating.label,
      ratingSource: rating.source,
      profilePictureUrl: vendor.profile_picture_url || null,
    });
  }

  return leaderboard;
}
