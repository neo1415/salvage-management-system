import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { MasterReportService } from '@/features/reports/executive/services/master-report.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only system_admin and salvage_manager can access master report
    if (!['system_admin', 'salvage_manager'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const report = await MasterReportService.generateComprehensiveReport({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('Master Report API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate master report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
