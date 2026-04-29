/**
 * PDF Export API - Puppeteer-based PDF Generation
 * 
 * POST /api/reports/export/pdf
 * 
 * Generates high-quality PDFs by rendering actual HTML pages with full CSS and chart support.
 * Uses Puppeteer to capture the rendered page exactly as it appears in the browser.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { generatePDFFilename } from '@/lib/pdf/pdf-generator';
import { getPDFGenerator } from '@/lib/pdf/puppeteer-pdf-generator';
import { cookies } from 'next/headers';

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
    const { reportType, reportUrl, filters } = body;

    if (!reportType || !reportUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: reportType and reportUrl' },
        { status: 400 }
      );
    }

    // Get session token for authentication
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('authjs.session-token')?.value;
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Session token not found' },
        { status: 401 }
      );
    }

    // Get the domain and protocol from the request
    const requestUrl = new URL(request.url);
    const domain = requestUrl.hostname;
    const protocol = requestUrl.protocol;

    // Convert regular report URL to PDF-optimized version
    // Example: /reports/executive/kpi-dashboard -> /reports/executive/kpi-dashboard/pdf
    let pdfUrl = reportUrl;
    if (!reportUrl.includes('/pdf')) {
      // Add /pdf to the end of the path
      pdfUrl = reportUrl.endsWith('/') ? `${reportUrl}pdf` : `${reportUrl}/pdf`;
    }

    // Add filters as query parameters
    const urlParams = new URLSearchParams();
    if (filters?.startDate) {
      urlParams.append('startDate', filters.startDate);
    }
    if (filters?.endDate) {
      urlParams.append('endDate', filters.endDate);
    }
    if (filters?.assetTypes && filters.assetTypes.length > 0) {
      urlParams.append('assetTypes', filters.assetTypes.join(','));
    }
    if (filters?.regions && filters.regions.length > 0) {
      urlParams.append('regions', filters.regions.join(','));
    }

    // Build the full URL for the PDF-optimized report page
    const queryString = urlParams.toString();
    const fullReportUrl = pdfUrl.startsWith('http') 
      ? `${pdfUrl}${queryString ? '?' + queryString : ''}`
      : `${protocol}//${requestUrl.host}${pdfUrl}${queryString ? '?' + queryString : ''}`;

    console.log('Generating PDF for URL:', fullReportUrl);

    // Generate PDF using Puppeteer
    const generator = getPDFGenerator();
    const pdfBuffer = await generator.generateFromURL({
      url: fullReportUrl,
      cookies: [
        {
          name: 'authjs.session-token',
          value: sessionToken,
          domain,
        },
      ],
      waitForSelector: '[data-report-ready="true"]', // Wait for report to signal it's ready
      waitForTimeout: 3000, // Additional wait for charts to render
    });

    // Generate filename
    const filename = generatePDFFilename(reportType, filters);

    console.log('PDF generated successfully:', filename);

    // Return PDF with proper headers for download
    // Convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('PDF export error:', error);
    return NextResponse.json(
      { 
        error: 'Export failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
