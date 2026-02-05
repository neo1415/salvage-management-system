import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users, vendors, auditLogs } from '@/lib/db/schema';
import { eq, and, gte, lt, sql, desc } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';

/**
 * Admin Dashboard API
 * 
 * GET /api/dashboard/admin
 * 
 * Returns real-time KPIs and system health data for Admin dashboard
 * 
 * Requirements:
 * - Calculate KPIs: total users count, active vendors count, pending fraud alerts, today's audit logs
 * - Calculate user growth percentage (month-over-month)
 * - Determine system health status
 * - Cache dashboard data in Redis (5-minute TTL)
 */

interface DashboardStats {
  totalUsers: number;
  activeVendors: number;
  pendingFraudAlerts: number;
  todayAuditLogs: number;
  userGrowth: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
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

    // Check if user is Admin
    if (session.user.role !== 'system_admin' && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Try to get cached data
    const cacheKey = 'dashboard:admin';
    const cachedData = await cache.get<DashboardStats>(cacheKey);

    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Calculate dashboard stats
    const stats = await calculateAdminStats();

    // Cache the data for 5 minutes (300 seconds)
    await cache.set(cacheKey, stats, 300);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Admin dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}

/**
 * Calculate admin dashboard statistics
 */
async function calculateAdminStats(): Promise<DashboardStats> {
  // Total users count
  const totalUsersResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);

  const totalUsers = totalUsersResult[0]?.count || 0;

  // Active vendors count (verified_tier_1 or verified_tier_2)
  const activeVendorsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(
      sql`${users.status} IN ('verified_tier_1', 'verified_tier_2')`
    );

  const activeVendors = activeVendorsResult[0]?.count || 0;

  // Pending fraud alerts count
  // Note: Fraud alerts are stored in a separate table, but for now we'll check for suspended vendors
  const pendingFraudAlertsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vendors)
    .where(eq(vendors.status, 'suspended'));

  const pendingFraudAlerts = pendingFraudAlertsResult[0]?.count || 0;

  // Today's audit logs count
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayAuditLogsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(gte(auditLogs.createdAt, today));

  const todayAuditLogs = todayAuditLogsResult[0]?.count || 0;

  // User growth (month-over-month)
  const userGrowth = await calculateUserGrowth();

  // System health (based on fraud alerts and system activity)
  let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
  
  if (pendingFraudAlerts > 10) {
    systemHealth = 'critical';
  } else if (pendingFraudAlerts > 5) {
    systemHealth = 'warning';
  }

  return {
    totalUsers,
    activeVendors,
    pendingFraudAlerts,
    todayAuditLogs,
    userGrowth,
    systemHealth,
  };
}

/**
 * Calculate user growth percentage (month-over-month)
 */
async function calculateUserGrowth(): Promise<number> {
  // Get current month start date
  const currentMonthStart = new Date();
  currentMonthStart.setDate(1);
  currentMonthStart.setHours(0, 0, 0, 0);

  // Get last month start date
  const lastMonthStart = new Date(currentMonthStart);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

  // Count users created this month
  const currentMonthUsersResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(gte(users.createdAt, currentMonthStart));

  const currentMonthUsers = currentMonthUsersResult[0]?.count || 0;

  // Count users created last month
  const lastMonthUsersResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(
      and(
        gte(users.createdAt, lastMonthStart),
        lt(users.createdAt, currentMonthStart)
      )
    );

  const lastMonthUsers = lastMonthUsersResult[0]?.count || 0;

  // Calculate growth percentage
  if (lastMonthUsers === 0) {
    return currentMonthUsers > 0 ? 100 : 0;
  }

  const growth = ((currentMonthUsers - lastMonthUsers) / lastMonthUsers) * 100;
  return Math.round(growth * 100) / 100;
}
