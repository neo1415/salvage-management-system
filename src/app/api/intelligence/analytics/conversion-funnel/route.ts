/**
 * Conversion Funnel Analytics API Endpoint
 * 
 * GET /api/intelligence/analytics/conversion-funnel
 * 
 * Returns conversion funnel metrics (view → bid → win rates).
 * Task 7.4.7: Create GET /api/intelligence/analytics/conversion-funnel route
 * 
 * @module api/intelligence/analytics/conversion-funnel
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { BehavioralAnalyticsService } from '@/features/intelligence/services/behavioral-analytics.service';
import { z } from 'zod';

const querySchema = z.object({
  assetType: z.string().optional(),
  vendorSegment: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
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
      assetType: searchParams.get('assetType') || undefined,
      vendorSegment: searchParams.get('vendorSegment') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    if (!queryParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryParams.error.issues },
        { status: 400 }
      );
    }

    const { assetType, vendorSegment, startDate, endDate } = queryParams.data;

    const behavioralAnalyticsService = new BehavioralAnalyticsService();
    const funnel = await behavioralAnalyticsService.getConversionFunnel({
      assetType,
      vendorSegment,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    // Handle null case (no data)
    if (!funnel) {
      return NextResponse.json({
        success: true,
        data: null,
        meta: {
          filters: { assetType, vendorSegment, startDate, endDate },
        },
      });
    }

    // Transform data to ensure rate fields are numbers not strings
    const transformedData = {
      ...funnel,
      viewToWatchRate: Number(funnel.viewToWatchRate),
      watchToBidRate: Number(funnel.watchToBidRate),
      bidToWinRate: Number(funnel.bidToWinRate),
      overallConversionRate: Number(funnel.overallConversionRate),
    };

    return NextResponse.json({
      success: true,
      data: transformedData,
      meta: {
        filters: { assetType, vendorSegment, startDate, endDate },
      },
    });

  } catch (error) {
    console.error('[Conversion Funnel API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
