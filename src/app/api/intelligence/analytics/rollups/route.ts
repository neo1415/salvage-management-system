/**
 * Analytics Rollups API Endpoint
 * 
 * GET /api/intelligence/analytics/rollups
 * 
 * Returns pre-aggregated analytics rollups (hourly/daily/weekly/monthly).
 * Task 7.4.8: Create GET /api/intelligence/analytics/rollups route
 * 
 * @module api/intelligence/analytics/rollups
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { AnalyticsAggregationService } from '@/features/intelligence/services/analytics-aggregation.service';
import { z } from 'zod';

const querySchema = z.object({
  rollupType: z.enum(['hourly', 'daily', 'weekly', 'monthly']),
  metricType: z.enum(['asset_performance', 'vendor_activity', 'market_conditions']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional().default(100),
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
      rollupType: searchParams.get('rollupType'),
      metricType: searchParams.get('metricType'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      limit: searchParams.get('limit'),
    });

    if (!queryParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryParams.error.issues },
        { status: 400 }
      );
    }

    const { rollupType, metricType, startDate, endDate, limit } = queryParams.data;

    const aggregationService = new AnalyticsAggregationService();
    const rollups = await aggregationService.getRollups({
      rollupType,
      metricType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: rollups,
      meta: {
        count: rollups.length,
        filters: { rollupType, metricType, startDate, endDate },
      },
    });

  } catch (error) {
    console.error('[Analytics Rollups API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
