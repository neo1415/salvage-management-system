/**
 * Auction Performance Report API
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { AuctionPerformanceService } from '@/features/reports/operational/services';
import { parseReportFiltersFromSearchParams } from '@/features/reports/utils/parse-report-filters';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ status: 'error', message: 'Unauthorized' }, { status: 401 });
    }

    if (!['system_admin', 'salvage_manager', 'finance_officer'].includes(session.user.role)) {
      return NextResponse.json({ status: 'error', message: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filters = parseReportFiltersFromSearchParams(searchParams);

    const report = await AuctionPerformanceService.generateReport(filters);

    return NextResponse.json({
      status: 'success',
      data: report,
    });
  } catch (error: unknown) {
    console.error('Auction Performance Report Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate auction performance report',
      },
      { status: 500 }
    );
  }
}
