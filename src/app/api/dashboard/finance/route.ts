import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
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

    // Try to get cached data
    const cacheKey = 'dashboard:finance';
    const cachedData = await cache.get<DashboardStats>(cacheKey);

    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Calculate dashboard stats
    const stats = await calculateFinanceStats();

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
  const pendingVerificationResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments)
    .where(eq(payments.status, 'pending'));

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

  // Total amount (sum of all verified payments)
  const totalAmountResult = await db
    .select({ 
      total: sql<number>`COALESCE(SUM(${payments.amount}::numeric), 0)::numeric` 
    })
    .from(payments)
    .where(eq(payments.status, 'verified'));

  const totalAmount = parseFloat(totalAmountResult[0]?.total?.toString() || '0');

  return {
    totalPayments,
    pendingVerification,
    verified,
    rejected,
    totalAmount,
  };
}
