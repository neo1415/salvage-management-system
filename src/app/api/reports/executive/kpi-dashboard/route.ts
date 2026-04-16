import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { KPIDashboardService } from '@/features/reports/executive/services/kpi-dashboard.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const report = await KPIDashboardService.generateReport({
      startDate,
      endDate,
    });

    return NextResponse.json({
      status: 'success',
      data: report,
    });
  } catch (error: any) {
    console.error('KPI Dashboard API error:', error);
    return NextResponse.json(
      { status: 'error', message: error.message },
      { status: 500 }
    );
  }
}
