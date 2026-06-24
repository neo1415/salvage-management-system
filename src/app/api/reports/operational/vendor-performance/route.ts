/**
 * Vendor Performance Report API
 * GET /api/reports/operational/vendor-performance
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { ReportService } from '@/features/reports/services/report.service';
import { VendorPerformanceService } from '@/features/reports/operational/services';
import { parseReportFiltersFromSearchParams } from '@/features/reports/utils/parse-report-filters';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ status: 'error', error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    if (!ReportService.hasPermission(session.user.role, 'vendor-performance')) {
      return NextResponse.json({ status: 'error', error: { code: 'FORBIDDEN' } }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filters = parseReportFiltersFromSearchParams(searchParams, { validateDates: true });

    const result = await ReportService.generateReport(
      { type: 'vendor-performance', filters, includeCharts: true },
      session.user.id,
      session.user.role,
      async (filters) => await VendorPerformanceService.generateReport(filters),
      { useCache: true, ipAddress: request.headers.get('x-forwarded-for') || undefined }
    );

    return NextResponse.json({ status: 'success', data: result.data, metadata: result.metadata });
  } catch (error) {
    console.error('Vendor performance error:', error);
    return NextResponse.json(
      { status: 'error', error: { code: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}
