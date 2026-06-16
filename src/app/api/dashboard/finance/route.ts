import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema';
import { eq, sql, and, or, ne } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';

/**
 * Finance Dashboard API
 * 
 * GET /api/dashboard/finance
 * 
 * Returns real-time payment statistics for Finance Officer dashboard
 * 
 * Requirements:
 * - Calculate KPIs: total payments, pending verification, verified, rejected, total amount
 * - Cache dashboard data in Redis (5-minute TTL)
 */

interface DashboardStats {
  totalPayments: number;
  pendingVerification: number;
  verified: number;
  rejected: number;
  totalAmount: number;
  escrowWalletPayments: number;
  escrowWalletPercentage: number;
  paymentMethodBreakdown: {
    paystack: number;
    bank_transfer: number;
    escrow_wallet: number;
  };
  settlementControl: {
    verifiedRecovery: number;
    pendingFinanceReview: number;
    paidAwaitingPickup: number;
    overdueSignedUnpaid: number;
    frozenEscrowPayments: number;
    averageDaysToPayment: number | null;
  };
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

    // Check if user is Finance Officer
    if (session.user.role !== 'finance_officer') {
      return NextResponse.json(
        { error: 'Forbidden - Finance Officer access required' },
        { status: 403 }
      );
    }

    // Check if cache should be bypassed (for debugging)
    const { searchParams } = new URL(request.url);
    const bypassCache = searchParams.get('bypass') === 'true';

    // Try to get cached data (unless bypassed)
    const cacheKey = 'dashboard:finance:v3';
    if (!bypassCache) {
      const cachedData = await cache.get<DashboardStats>(cacheKey);

      if (cachedData) {
        console.log('Finance dashboard: Returning cached data');
        return NextResponse.json(cachedData);
      }
    }

    // Calculate dashboard stats
    console.log('Finance dashboard: Calculating fresh stats');
    const stats = await calculateFinanceStats();

    // Log stats for debugging
    console.log('Finance dashboard stats:', stats);

    // Cache the data for 5 minutes (300 seconds)
    await cache.set(cacheKey, stats, 300);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Finance dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

/**
 * Calculate finance dashboard statistics
 */
async function calculateFinanceStats(): Promise<DashboardStats> {
  // Total payments count
  const totalPaymentsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments);

  const totalPayments = totalPaymentsResult[0]?.count || 0;

  // Pending verification count
  // CRITICAL FIX: Exclude escrow_wallet payments with frozen status
  // These are waiting for vendor to sign documents and shouldn't show in finance dashboard yet
  const pendingVerificationResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(
      and(
        eq(payments.status, 'pending'),
        // Exclude escrow wallet payments that are waiting for document signing
        or(
          ne(payments.paymentMethod, 'escrow_wallet'),
          ne(payments.escrowStatus, 'frozen')
        )
      )
    );

  const pendingVerification = pendingVerificationResult[0]?.count || 0;

  // Verified count
  const verifiedResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(eq(payments.status, 'verified'));

  const verified = verifiedResult[0]?.count || 0;

  // Rejected count
  const rejectedResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(eq(payments.status, 'rejected'));

  const rejected = rejectedResult[0]?.count || 0;

  // Total amount (sum of VERIFIED payments only)
  // CRITICAL: Only count verified payments to prevent double-counting
  // Pending payments should NOT appear in total until verified
  const totalAmountResult = await db
    .select({ 
      total: sql<number>`COALESCE(SUM(${payments.amount}::numeric), 0)::numeric` 
    })
    .from(payments)
    .where(eq(payments.status, 'verified'));

  const totalAmount = parseFloat(totalAmountResult[0]?.total?.toString() || '0');

  // Escrow wallet payments count
  const escrowWalletResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(eq(payments.paymentMethod, 'escrow_wallet'));

  const escrowWalletPayments = escrowWalletResult[0]?.count || 0;

  // Calculate escrow wallet percentage
  const escrowWalletPercentage = totalPayments > 0 
    ? Math.round((escrowWalletPayments / totalPayments) * 100) 
    : 0;

  // Payment method breakdown
  const paystackResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(eq(payments.paymentMethod, 'paystack'));

  const bankTransferResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(eq(payments.paymentMethod, 'bank_transfer'));

  const paymentMethodBreakdown = {
    paystack: paystackResult[0]?.count || 0,
    bank_transfer: bankTransferResult[0]?.count || 0,
    escrow_wallet: escrowWalletPayments,
  };

  const [settlementRow] = (await db.execute(sql`
    WITH verified_winner_payments AS (
      SELECT DISTINCT ON (p.auction_id)
        p.id,
        p.auction_id,
        p.vendor_id,
        p.amount,
        p.verified_at,
        p.created_at
      FROM payments p
      INNER JOIN auctions a ON a.id = p.auction_id
      WHERE p.status = 'verified'
        AND p.auction_id IS NOT NULL
        AND p.vendor_id = a.current_bidder
      ORDER BY p.auction_id, p.verified_at DESC NULLS LAST, p.created_at DESC
    ),
    pending_finance_review AS (
      SELECT id
      FROM payments
      WHERE status = 'pending'
        AND (
          payment_method IS DISTINCT FROM 'escrow_wallet'
          OR escrow_status IS DISTINCT FROM 'frozen'
        )
    ),
    paid_awaiting_pickup AS (
      SELECT DISTINCT a.id
      FROM auctions a
      INNER JOIN verified_winner_payments p ON p.auction_id = a.id
      WHERE COALESCE(a.pickup_confirmed_admin, false) = false
    ),
    overdue_signed_unpaid AS (
      SELECT DISTINCT rf.auction_id
      FROM release_forms rf
      LEFT JOIN verified_winner_payments p ON p.auction_id = rf.auction_id AND p.vendor_id = rf.vendor_id
      WHERE rf.status = 'signed'
        AND rf.payment_deadline IS NOT NULL
        AND rf.payment_deadline < NOW()
        AND COALESCE(rf.disabled, false) = false
        AND p.id IS NULL
    ),
    payment_cycles AS (
      SELECT EXTRACT(EPOCH FROM (p.verified_at - a.end_time)) / 86400.0 AS days_to_payment
      FROM verified_winner_payments p
      INNER JOIN auctions a ON a.id = p.auction_id
      WHERE p.verified_at IS NOT NULL
        AND p.verified_at >= a.end_time
    )
    SELECT
      (SELECT COALESCE(SUM(amount::numeric), 0)::numeric FROM verified_winner_payments) AS verified_recovery,
      (SELECT COUNT(*)::int FROM pending_finance_review) AS pending_finance_review,
      (SELECT COUNT(*)::int FROM paid_awaiting_pickup) AS paid_awaiting_pickup,
      (SELECT COUNT(*)::int FROM overdue_signed_unpaid) AS overdue_signed_unpaid,
      (SELECT COUNT(*)::int FROM payments WHERE payment_method = 'escrow_wallet' AND escrow_status = 'frozen') AS frozen_escrow_payments,
      (SELECT AVG(days_to_payment)::numeric FROM payment_cycles) AS average_days_to_payment
  `)) as any[];

  const settlementControl = {
    verifiedRecovery: numberFrom(settlementRow?.verified_recovery),
    pendingFinanceReview: numberFrom(settlementRow?.pending_finance_review),
    paidAwaitingPickup: numberFrom(settlementRow?.paid_awaiting_pickup),
    overdueSignedUnpaid: numberFrom(settlementRow?.overdue_signed_unpaid),
    frozenEscrowPayments: numberFrom(settlementRow?.frozen_escrow_payments),
    averageDaysToPayment: nullableNumberFrom(settlementRow?.average_days_to_payment),
  };

  return {
    totalPayments,
    pendingVerification,
    verified,
    rejected,
    totalAmount,
    escrowWalletPayments,
    escrowWalletPercentage,
    paymentMethodBreakdown,
    settlementControl,
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
