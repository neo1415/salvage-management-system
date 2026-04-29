/**
 * Auction Performance Report API
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuctionPerformanceService } from '@/features/reports/operational/services';
import { ReportFilters } from '@/features/reports/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const filters: ReportFilters = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };

    const report = await AuctionPerformanceService.generateReport(filters);

    return NextResponse.json({
      status: 'success',
      data: report,
    });
  } catch (error: any) {
    console.error('Auction Performance Report Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Failed to generate auction performance report',
      },
      { status: 500 }
    );
  }
}
