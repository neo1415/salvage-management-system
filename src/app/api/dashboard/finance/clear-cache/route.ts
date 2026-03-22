import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { cache } from '@/lib/redis/client';

/**
 * Clear Finance Dashboard Cache
 * 
 * POST /api/dashboard/finance/clear-cache
 * 
 * Clears the cached finance dashboard data to force a fresh calculation
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is Finance Officer or Admin
    if (session.user.role !== 'finance_officer' && session.user.role !== 'system_admin') {
      return NextResponse.json(
        { error: 'Forbidden - Finance Officer or Admin access required' },
        { status: 403 }
      );
    }

    // Clear the cache
    const cacheKey = 'dashboard:finance';
    await cache.del(cacheKey);

    console.log('Finance dashboard cache cleared by:', session.user.email);

    return NextResponse.json({
      success: true,
      message: 'Finance dashboard cache cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing finance dashboard cache:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
