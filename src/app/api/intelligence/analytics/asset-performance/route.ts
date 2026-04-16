/**
 * Asset Performance Analytics API Endpoint
 * 
 * GET /api/intelligence/analytics/asset-performance
 * 
 * Returns asset performance metrics (make/model/year analysis).
 * Task 7.4.1: Create GET /api/intelligence/analytics/asset-performance route
 * 
 * @module api/intelligence/analytics/asset-performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { AssetAnalyticsService } from '@/features/intelligence/services/asset-analytics.service';
import { z } from 'zod';

const querySchema = z.object({
  assetType: z.string().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
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
      make: searchParams.get('make') || undefined,
      model: searchParams.get('model') || undefined,
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

    const { assetType, make, model, startDate, endDate, limit } = queryParams.data;

    const assetAnalyticsService = new AssetAnalyticsService();
    const performance = await assetAnalyticsService.getAssetPerformance({
      assetType,
      make,
      model,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
    });

    // Transform data to match UI expectations
    const transformedData = performance.map(item => ({
      ...item,
      assetType: item.assetType, // Include asset type for proper name formatting
      avgPrice: item.avgFinalPrice,
      auctionCount: item.totalAuctions, // Add auctionCount field for Market Intelligence
      sellThroughRate: (Number(item.avgSellThroughRate) || 0) * 100, // Convert 0-1 to 0-100 percentage
      avgDaysToSell: Math.round(Number(item.avgTimeToSell) / 24), // Convert hours to days
      trend: 0, // No price change tracking yet - always 0
      demandScore: Number(item.demandScore) || 0, // Add demandScore for Market Intelligence
    }));

    return NextResponse.json({
      success: true,
      data: transformedData,
      meta: {
        count: transformedData.length,
        filters: { assetType, make, model, startDate, endDate },
      },
    });

  } catch (error) {
    console.error('[Asset Performance API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
