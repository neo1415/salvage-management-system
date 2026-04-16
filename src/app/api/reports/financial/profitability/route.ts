/**
 * Profitability Report API
 * GET /api/reports/financial/profitability
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { ReportService } from '@/features/reports/services/report.service';
import { ProfitabilityService } from '@/features/reports/financial/services/profitability.service';
import { ReportFilters } from '@/features/reports/types';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ status: 'error', error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    if (!ReportService.hasPermission(session.user.role, 'profitability')) {
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
      assetTypes: searchParams.get('assetTypes')?.split(',').filter(Boolean),
    };

    const result = await ReportService.generateReport(
      { type: 'profitability', filters, includeCharts: true },
      session.user.id,
      session.user.role,
      async (filters) => await ProfitabilityService.generateReport(filters),
      { useCache: true, ipAddress: request.headers.get('x-forwarded-for') || undefined }
    );

    return NextResponse.json({ status: 'success', data: result.data, metadata: result.metadata });
  } catch (error) {
    console.error('Profitability error:', error);
    return NextResponse.json(
      { status: 'error', error: { code: 'INTERNAL_SERVER_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 500 }
    );
  }
}
