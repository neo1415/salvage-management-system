/**
 * Attribute Performance Analytics API Endpoint
 * 
 * GET /api/intelligence/analytics/attribute-performance
 * 
 * Returns attribute performance metrics (color/trim/storage analysis).
 * Task 7.4.2: Create GET /api/intelligence/analytics/attribute-performance route
 * 
 * @module api/intelligence/analytics/attribute-performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { AssetAnalyticsService } from '@/features/intelligence/services/asset-analytics.service';
import { z } from 'zod';

const querySchema = z.object({
  assetType: z.string().optional(),
  attributeType: z.enum(['color', 'trim', 'storage', 'condition']).optional(),
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
      assetType: searchParams.get('assetType') || undefined,
      attributeType: searchParams.get('attributeType') || undefined,
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

    const { assetType, attributeType, startDate, endDate, limit } = queryParams.data;

    const assetAnalyticsService = new AssetAnalyticsService();
    
    // If no specific attribute type is requested, fetch all and group by type
    if (!attributeType) {
      const allPerformance = await assetAnalyticsService.getAttributePerformance({
        assetType,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit: limit * 3, // Get more records since we're grouping
      });

      // Transform and group by attribute type
      const transformedPerformance = allPerformance.map(item => ({
        ...item,
        pricePremium: item.avgPricePremium,
        bidCount: item.avgBidCount,
      }));

      const grouped = {
        color: transformedPerformance.filter(p => p.attributeType === 'color'),
        trim: transformedPerformance.filter(p => p.attributeType === 'trim'),
        storage: transformedPerformance.filter(p => p.attributeType === 'storage'),
      };

      return NextResponse.json({
        success: true,
        data: grouped,
        meta: {
          counts: {
            color: grouped.color.length,
            trim: grouped.trim.length,
            storage: grouped.storage.length,
          },
          filters: { assetType, startDate, endDate },
        },
      });
    }

    // If specific attribute type is requested, return just that
    const performance = await assetAnalyticsService.getAttributePerformance({
      assetType,
      attributeType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
    });

    // Transform data to match UI expectations
    const transformedData = performance.map(item => ({
      ...item,
      pricePremium: item.avgPricePremium,
      bidCount: item.avgBidCount,
    }));

    return NextResponse.json({
      success: true,
      data: transformedData,
      meta: {
        count: transformedData.length,
        filters: { assetType, attributeType, startDate, endDate },
      },
    });

  } catch (error) {
    console.error('[Attribute Performance API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
