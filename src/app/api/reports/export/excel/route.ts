/**
 * Excel Export API
 * 
 * POST /api/reports/export/excel
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';

interface ExcelReportData {
  totalRevenue?: number;
  recoveryRate?: number;
  byAssetType?: Array<{ assetType: string; count: number; revenue: number }>;
  trends?: Array<{ period: string; revenue: number; recoveryRate: number }>;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { reportType, data } = body as { reportType: string; data: ExcelReportData };

    // Generate CSV (Excel-compatible)
    const csv = generateCSV(reportType, data);
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'application/vnd.ms-excel',
        'Content-Disposition': `attachment; filename="${reportType}-${new Date().toISOString().split('T')[0]}.xls"`,
      },
    });
  } catch (error) {
    console.error('Excel export error:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}

function generateCSV(reportType: string, data: ExcelReportData): string {
  let csv = `${reportType.replace(/-/g, ' ').toUpperCase()} Report\n`;
  csv += `Generated: ${new Date().toLocaleString()}\n\n`;
  
  // Summary section
  csv += 'Summary\n';
  csv += 'Metric,Value\n';
  csv += `Total Revenue,${data?.totalRevenue || 0}\n`;
  csv += `Recovery Rate,${data?.recoveryRate || 0}%\n\n`;
  
  // Asset type breakdown
  if (data?.byAssetType && data.byAssetType.length > 0) {
    csv += 'Asset Type Breakdown\n';
    csv += 'Asset Type,Count,Revenue\n';
    data.byAssetType.forEach((asset) => {
      csv += `${asset.assetType},${asset.count},${asset.revenue}\n`;
    });
    csv += '\n';
  }
  
  // Trends
  if (data?.trends && data.trends.length > 0) {
    csv += 'Revenue Trends\n';
    csv += 'Period,Revenue,Recovery Rate\n';
    data.trends.forEach((trend) => {
      csv += `${trend.period},${trend.revenue},${trend.recoveryRate}%\n`;
    });
  }
  
  return csv;
}
