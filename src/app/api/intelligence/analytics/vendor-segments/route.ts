/**
 * Vendor Segments Analytics API Endpoint
 * 
 * GET /api/intelligence/analytics/vendor-segments
 * 
 * Returns vendor segmentation data (Bargain Hunters, Premium Buyers, etc.).
 * Task 7.4.5: Create GET /api/intelligence/analytics/vendor-segments route
 * 
 * @module api/intelligence/analytics/vendor-segments
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { BehavioralAnalyticsService } from '@/features/intelligence/services/behavioral-analytics.service';
import { z } from 'zod';

const querySchema = z.object({
  segment: z.enum(['bargain_hunter', 'premium_buyer', 'specialist', 'opportunist', 'inactive']).optional(),
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
      segment: searchParams.get('segment') || undefined,
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

    const { segment, startDate, endDate, limit } = queryParams.data;

    const behavioralAnalyticsService = new BehavioralAnalyticsService();
    
    // If user is a vendor, only return their own segment data
    if (session.user.role === 'vendor') {
      const segments = await behavioralAnalyticsService.getVendorSegments({
        segment,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        limit,
      });
      
      // Filter to only the current vendor's data
      const vendorSegment = segments.filter(s => s.vendorId === session.user.id);
      
      // Transform data to match UI expectations
      const transformedData = vendorSegment.map(item => ({
        ...item,
        bidToValueRatio: item.avgBidToValueRatio,
        assetTypes: item.preferredAssetTypes,
        priceRange: item.preferredPriceRange,
      }));

      return NextResponse.json({
        success: true,
        data: transformedData,
        meta: {
          count: transformedData.length,
          filters: { segment, startDate, endDate },
          vendorFiltered: true,
        },
      });
    }

    // Admin/Manager: return all segments
    const segments = await behavioralAnalyticsService.getVendorSegments({
      segment,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
    });

    // Transform data to match UI expectations
    const transformedData = segments.map(item => ({
      ...item,
      bidToValueRatio: item.avgBidToValueRatio,
      assetTypes: item.preferredAssetTypes,
      priceRange: item.preferredPriceRange,
    }));

    return NextResponse.json({
      success: true,
      data: transformedData,
      meta: {
        count: transformedData.length,
        filters: { segment, startDate, endDate },
      },
    });

  } catch (error) {
    console.error('[Vendor Segments API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
