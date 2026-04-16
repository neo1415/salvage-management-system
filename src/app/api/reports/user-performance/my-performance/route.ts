/**
 * My Performance Report API
 * GET /api/reports/user-performance/my-performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { ReportService } from '@/features/reports/services/report.service';
import { MyPerformanceService } from '@/features/reports/user-performance/services';
import { ReportFilters } from '@/features/reports/types';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ status: 'error', error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const { start, end } = ReportService.validateDateRange(
      searchParams.get('startDate') || undefined,
      searchParams.get('endDate') || undefined
    );

    const filters: ReportFilters = {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      userIds: [session.user.id], // Only show current user's data
    };

    const result = await ReportService.generateReport(
      { type: 'my-performance', filters, includeCharts: true },
      session.user.id,
      session.user.role as any,
      async (filters) => await MyPerformanceService.generateReport(filters, session.user.id, session.user.role),
      { useCache: true, ipAddress: request.headers.get('x-forwarded-for') || undefined }
    );

    return NextResponse.json({ status: 'success', data: result.data, metadata: result.metadata });
  } catch (error) {
    console.error('My performance error:', error);
    return NextResponse.json(
      { status: 'error', error: { code: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}
