/**
 * CSV Export API
 * 
 * POST /api/reports/export/csv
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';

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
    const { reportType, data, filters } = body;

    // Generate CSV
    const csv = generateCSV(reportType, data);
    
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${reportType}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('CSV export error:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}

function generateCSV(reportType: string, data: any): string {
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
    data.byAssetType.forEach((asset: any) => {
      csv += `${asset.assetType},${asset.count},${asset.revenue}\n`;
    });
    csv += '\n';
  }
  
  // Region breakdown
  if (data?.byRegion && data.byRegion.length > 0) {
    csv += 'Regional Breakdown\n';
    csv += 'Region,Count,Revenue\n';
    data.byRegion.forEach((region: any) => {
      csv += `${region.region},${region.count},${region.revenue}\n`;
    });
    csv += '\n';
  }
  
  // Trends
  if (data?.trends && data.trends.length > 0) {
    csv += 'Revenue Trends\n';
    csv += 'Period,Revenue,Recovery Rate\n';
    data.trends.forEach((trend: any) => {
      csv += `${trend.period},${trend.revenue},${trend.recoveryRate}%\n`;
    });
  }
  
  return csv;
}
