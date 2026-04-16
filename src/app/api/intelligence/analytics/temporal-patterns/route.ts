/**
 * Temporal Patterns Analytics API Endpoint
 * 
 * GET /api/intelligence/analytics/temporal-patterns
 * 
 * Returns temporal pattern metrics (hourly/daily/seasonal analysis).
 * Task 7.4.3: Create GET /api/intelligence/analytics/temporal-patterns route
 * 
 * @module api/intelligence/analytics/temporal-patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { TemporalAnalyticsService } from '@/features/intelligence/services/temporal-analytics.service';
import { z } from 'zod';

const querySchema = z.object({
  assetType: z.string().optional(),
  patternType: z.enum(['hourly', 'daily', 'weekly', 'monthly']).optional(),
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
      patternType: searchParams.get('patternType') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    if (!queryParams.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: queryParams.error.issues },
        { status: 400 }
      );
    }

    const { assetType, patternType, startDate, endDate } = queryParams.data;

    const temporalAnalyticsService = new TemporalAnalyticsService();
    const patterns = await temporalAnalyticsService.getTemporalPatterns({
      assetType,
      patternType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    // Calculate min/max for normalization
    const activityScores = patterns.map(p => Number(p.peakActivityScore) || 0);
    const minActivity = Math.min(...activityScores);
    const maxActivity = Math.max(...activityScores);
    const activityRange = maxActivity - minActivity || 1; // Avoid division by zero

    // Transform data to match UI expectations
    const transformedData = patterns.map(item => {
      const rawActivity = Number(item.peakActivityScore) || 0;
      // Normalize activity score to 0-1 range
      const normalizedActivity = (rawActivity - minActivity) / activityRange;

      return {
        ...item,
        bidCount: item.avgBidCount,
        avgPrice: item.avgFinalPrice,
        vendorActivity: item.avgVendorActivity,
        // Map for heatmap component
        hour: item.hourOfDay,
        dayOfWeek: item.dayOfWeek,
        activityScore: item.peakActivityScore,
        avgBids: Number(item.avgBidCount),
        totalAuctions: 0, // Will be populated if available in service
        // Add competitionLevel for Market Intelligence based on normalized score
        competitionLevel: (() => {
          if (normalizedActivity < 0.33) return 'low';
          if (normalizedActivity < 0.67) return 'medium';
          return 'high';
        })() as 'low' | 'medium' | 'high',
      };
    });

    return NextResponse.json({
      success: true,
      data: transformedData,
      meta: {
        count: transformedData.length,
        filters: { assetType, patternType, startDate, endDate },
      },
    });

  } catch (error) {
    console.error('[Temporal Patterns API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
