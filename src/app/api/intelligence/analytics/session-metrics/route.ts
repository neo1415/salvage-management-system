/**
 * Session Metrics Analytics API Endpoint
 * 
 * GET /api/intelligence/analytics/session-metrics
 * 
 * Returns session analytics metrics (time on site, pages viewed, bounce rate).
 * Task 7.4.6: Create GET /api/intelligence/analytics/session-metrics route
 * 
 * @module api/intelligence/analytics/session-metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { BehavioralAnalyticsService } from '@/features/intelligence/services/behavioral-analytics.service';
import { z } from 'zod';

const querySchema = z.object({
  vendorId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Allow system_admin, salvage_manager, and finance_officer roles
    const allowedRoles = ['system_admin', 'salvage_manager', 'finance_officer'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const queryParams = querySchema.safeParse({
      vendorId: searchParams.get('vendorId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    if (!queryParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryParams.error.issues },
        { status: 400 }
      );
    }

    let { vendorId, startDate, endDate, limit } = queryParams.data;

    // If user is a vendor, force filter to their own ID
    if (session.user.role === 'vendor') {
      vendorId = session.user.id;
    }

    const behavioralAnalyticsService = new BehavioralAnalyticsService();
    const result = await behavioralAnalyticsService.getSessionMetrics({
      vendorId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
    });

    // Transform trends data to match UI expectations
    const transformedTrends = result.trends.map(item => ({
      ...item,
      duration: item.durationSeconds ? Math.round(item.durationSeconds / 60) : 0, // Convert seconds to minutes
      pagesViewed: item.auctionsViewed || 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        metrics: result.metrics,
        trends: transformedTrends,
      },
      meta: {
        count: transformedTrends.length,
        filters: { vendorId, startDate, endDate },
      },
    });

  } catch (error) {
    console.error('[Session Metrics API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
