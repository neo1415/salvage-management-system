import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { KPIDashboardService } from '@/features/reports/executive/services/kpi-dashboard.service';
import { parseReportFiltersFromSearchParams } from '@/features/reports/utils/parse-report-filters';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filters = parseReportFiltersFromSearchParams(searchParams);

    const report = await KPIDashboardService.generateReport(filters);

    return NextResponse.json({
      status: 'success',
      data: report,
    });
  } catch (error: unknown) {
    console.error('KPI Dashboard API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { status: 'error', message },
      { status: 500 }
    );
  }
}
