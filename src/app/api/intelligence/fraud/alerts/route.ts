/**
 * Fraud Alerts API Endpoint
 * 
 * GET /api/intelligence/fraud/alerts
 * 
 * Returns fraud alerts with filtering and pagination
 * Handles query params: status (pending/confirmed/dismissed), limit (default 10)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fraudAlerts } from '@/lib/db/schema/intelligence';
import { eq, desc, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Allow both system_admin and admin roles
    if (session.user.role !== 'system_admin' && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as 'pending' | 'confirmed' | 'dismissed' | null;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Validate status parameter
    if (status && !['pending', 'confirmed', 'dismissed', 'reviewed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: pending, confirmed, dismissed, or reviewed' },
        { status: 400 }
      );
    }

    // Build query conditions
    const conditions = [];
    if (status) {
      conditions.push(eq(fraudAlerts.status, status));
    }

    // Fetch fraud alerts
    const alerts = await db
      .select()
      .from(fraudAlerts)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(fraudAlerts.riskScore), desc(fraudAlerts.createdAt))
      .limit(limit);

    return NextResponse.json({
      success: true,
      data: alerts,
      meta: {
        count: alerts.length,
        limit,
        status: status || 'all',
      },
    });

  } catch (error) {
    console.error('[Fraud Alerts API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
