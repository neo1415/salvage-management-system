/**
 * Vendor Spending Report API
 * GET /api/reports/financial/vendor-spending
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { ReportService } from '@/features/reports/services/report.service';
import { VendorSpendingService } from '@/features/reports/financial/services/vendor-spending.service';
import { ReportFilters } from '@/features/reports/types';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ status: 'error', error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    if (!ReportService.hasPermission(session.user.role, 'vendor-spending')) {
      return NextResponse.json({ status: 'error', error: { code: 'FORBIDDEN' } }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const { start, end } = ReportService.validateDateRange(
      searchParams.get('startDate'),
      searchParams.get('endDate')
    );

    const filters: ReportFilters = {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      vendorIds: searchParams.get('vendorIds')?.split(',').filter(Boolean),
    };

    const result = await ReportService.generateReport(
      { type: 'vendor-spending', filters, includeCharts: true },
      session.user.id,
      session.user.role,
      async (filters) => await VendorSpendingService.generateReport(filters),
      { useCache: true, ipAddress: request.headers.get('x-forwarded-for') || undefined }
    );

    return NextResponse.json({ status: 'success', data: result.data, metadata: result.metadata });
  } catch (error) {
    console.error('Vendor spending error:', error);
    return NextResponse.json(
      { status: 'error', error: { code: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}
