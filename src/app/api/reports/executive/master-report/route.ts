import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { MasterReportService } from '@/features/reports/executive/services/master-report.service';
import { ReportCacheService } from '@/features/reports/services/report-cache.service';
import { resolveReportIsoDateRange } from '@/features/reports/utils/report-date-range';

const MASTER_REPORT_CACHE_TYPE = 'master-report';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['system_admin', 'salvage_manager'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const { startDate, endDate } = resolveReportIsoDateRange(
      searchParams.get('startDate'),
      searchParams.get('endDate')
    );
    const filters = { startDate, endDate };

    const cached = await ReportCacheService.getCachedReport(MASTER_REPORT_CACHE_TYPE, filters);
    if (cached) {
      return NextResponse.json({ success: true, data: cached, metadata: { cached: true } });
    }

    const report = await MasterReportService.generateComprehensiveReport(filters);

    await ReportCacheService.cacheReport(MASTER_REPORT_CACHE_TYPE, filters, report);

    return NextResponse.json({ success: true, data: report, metadata: { cached: false } });
  } catch (error) {
    console.error('Master Report API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate master report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
