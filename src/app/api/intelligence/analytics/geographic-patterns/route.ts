/**
 * Geographic Patterns Analytics API Endpoint
 * 
 * GET /api/intelligence/analytics/geographic-patterns
 * 
 * Returns geographic pattern metrics (regional price variance, demand).
 * Task 7.4.4: Create GET /api/intelligence/analytics/geographic-patterns route
 * 
 * @module api/intelligence/analytics/geographic-patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { GeographicAnalyticsService } from '@/features/intelligence/services/geographic-analytics.service';
import { z } from 'zod';

const querySchema = z.object({
  assetType: z.string().optional(),
  region: z.string().optional(),
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
    const allowedRoles = ['system_admin', 'salvage_manager', 'finance_officer', 'vendor'];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const queryParams = querySchema.safeParse({
      assetType: searchParams.get('assetType') || undefined,
      region: searchParams.get('region') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    if (!queryParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryParams.error.issues },
        { status: 400 }
      );
    }

    const { assetType, region, startDate, endDate } = queryParams.data;

    const geoAnalyticsService = new GeographicAnalyticsService();
    const patterns = await geoAnalyticsService.getGeographicPatterns({
      assetType,
      region,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    // Transform data to match UI expectations
    const transformedData = patterns.map(item => ({
      ...item,
      avgPrice: item.avgFinalPrice,
      vendorCount: item.avgVendorCount,
    }));

    return NextResponse.json({
      success: true,
      data: transformedData,
      meta: {
        count: transformedData.length,
        filters: { assetType, region, startDate, endDate },
      },
    });

  } catch (error) {
    console.error('[Geographic Patterns API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
