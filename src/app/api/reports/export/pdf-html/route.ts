/**
 * HTML to PDF Export API - Full Layout PDF Generation
 * 
 * POST /api/reports/export/pdf-html
 * 
 * Generates PDF from the actual rendered page using Puppeteer
 * Captures full page layout including charts, tables, and styling
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { getHtmlToPdfService } from '@/lib/pdf/html-to-pdf.service';

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
    const { reportType, filters } = body;

    if (!reportType) {
      return NextResponse.json(
        { error: 'Missing required field: reportType' },
        { status: 400 }
      );
    }

    // Build the URL to the actual report page
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const reportPath = getReportPath(reportType);
    
    // Build query parameters from filters
    const params = new URLSearchParams();
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.assetTypes?.length) params.append('assetTypes', filters.assetTypes.join(','));
    if (filters?.regions?.length) params.append('regions', filters.regions.join(','));
    if (filters?.groupBy) params.append('groupBy', filters.groupBy);
    
    const url = `${baseUrl}${reportPath}${params.toString() ? '?' + params.toString() : ''}`;

    // Get session cookies for authentication
    const cookies = request.cookies.getAll().map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: new URL(baseUrl).hostname,
    }));

    // Generate filename
    const reportName = (reportType || 'report')
      .split('-')
      .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
      .join('_');
    
    let filename: string;
    if (filters?.startDate && filters?.endDate) {
      const start = new Date(filters.startDate).toISOString().split('T')[0];
      const end = new Date(filters.endDate).toISOString().split('T')[0];
      filename = `${reportName}_${start}_to_${end}.pdf`;
    } else {
      const date = new Date().toISOString().split('T')[0];
      filename = `${reportName}_${date}.pdf`;
    }

    // Generate PDF using Puppeteer with URL navigation
    const htmlToPdfService = getHtmlToPdfService();
    const pdfBuffer = await htmlToPdfService.generatePdfFromUrl(
      url,
      {
        format: 'A4',
        printBackground: true,
        landscape: false,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
      },
      cookies
    );

    // Return PDF with proper headers for download
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('PDF export error:', error);
    return NextResponse.json(
      { 
        error: 'Export failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * Map report type to URL path
 */
function getReportPath(reportType: string): string {
  const pathMap: Record<string, string> = {
    'revenue-analysis': '/reports/financial/revenue-analysis',
    'profitability': '/reports/financial/profitability',
    'payment-analytics': '/reports/financial/payment-analytics',
    'vendor-spending': '/reports/financial/vendor-spending',
    'case-processing': '/reports/operational/case-processing',
    'auction-performance': '/reports/operational/auction-performance',
    'vendor-performance': '/reports/operational/vendor-performance',
    'document-management': '/reports/operational/document-management',
    'my-performance': '/reports/user-performance/my-performance',
    'adjusters': '/reports/user-performance/adjusters',
    'managers': '/reports/user-performance/managers',
    'finance': '/reports/user-performance/finance',
    'team-performance': '/reports/user-performance/team-performance',
    'kpi-dashboard': '/reports/executive/kpi-dashboard',
    'master-report': '/reports/executive/master-report',
  };

  return pathMap[reportType] || '/reports';
}
