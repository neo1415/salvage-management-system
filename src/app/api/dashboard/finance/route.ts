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
    const cacheKey = 'dashboard:finance';
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

  // Total amount (sum of payments EXCLUDING frozen escrow)
  // CRITICAL FIX: Don't count frozen escrow funds that are waiting for document signing
  // These funds haven't been released yet and shouldn't appear in finance dashboard
  const totalAmountResult = await db
    .select({ 
      total: sql<number>`COALESCE(SUM(${payments.amount}::numeric), 0)::numeric` 
    })
    .from(payments)
    .where(
      or(
        ne(payments.paymentMethod, 'escrow_wallet'),
        ne(payments.escrowStatus, 'frozen')
      )
    );

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

  return {
    totalPayments,
    pendingVerification,
    verified,
    rejected,
    totalAmount,
    escrowWalletPayments,
    escrowWalletPercentage,
    paymentMethodBreakdown,
  };
}
