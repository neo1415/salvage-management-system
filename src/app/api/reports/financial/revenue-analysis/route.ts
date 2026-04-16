/**
 * Revenue Analysis Report API
 * 
 * GET /api/reports/financial/revenue-analysis
 * Task 9: Financial Reports API Endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { ReportService } from '@/features/reports/services/report.service';
import { RevenueAnalysisService } from '@/features/reports/financial/services/revenue-analysis.service';
import { ReportFilters } from '@/features/reports/types';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Authentication
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    // Authorization - check if user can view financial reports
    if (!ReportService.hasPermission(session.user.role, 'revenue-analysis')) {
      return NextResponse.json(
        {
          status: 'error',
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to access financial reports',
            timestamp: new Date().toISOString(),
          },
        },
        { status: 403 }
      );
    }

    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const assetTypes = searchParams.get('assetTypes')?.split(',').filter(Boolean);

    // Validate date range
    const { start, end } = ReportService.validateDateRange(startDate, endDate);

    // Build filters
    const filters: ReportFilters = {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      assetTypes,
    };

    // Generate report with caching
    const result = await ReportService.generateReport(
      {
        type: 'revenue-analysis',
        filters,
        includeCharts: true,
      },
      session.user.id,
      session.user.role,
      async (filters) => {
        const reportData = await RevenueAnalysisService.generateReport(filters);
        
        // Transform to match component expectations
        return {
          totalRevenue: reportData.summary.totalSalvageRecovered,
          recoveryRate: reportData.summary.averageRecoveryRate,
          trends: reportData.trend.map(t => ({
            period: t.date,
            revenue: t.salvageRecovered,
            recoveryRate: t.recoveryRate,
          })),
          byAssetType: reportData.byAssetType.map(a => ({
            assetType: a.assetType,
            revenue: a.salvageRecovered,
            count: a.count,
          })),
          byRegion: reportData.byRegion?.map(r => ({
            region: r.region,
            revenue: r.salvageRecovered,
            count: r.count,
          })) || [],
        };
      },
      {
        useCache: true,
        cacheTTL: 15,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      }
    );

    const executionTime = Date.now() - startTime;

    return NextResponse.json({
      status: 'success',
      data: result.data,
      metadata: {
        ...result.metadata,
        executionTimeMs: executionTime,
      },
    });
  } catch (error) {
    console.error('Revenue analysis report error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      {
        status: 'error',
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: errorMessage,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
