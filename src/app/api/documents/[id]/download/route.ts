/**
 * Document Download API
 * GET /api/documents/[id]/download
 * 
 * Downloads a signed document PDF
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { downloadDocument } from '@/features/documents/services/document.service';
import { getIpAddress, getDeviceTypeFromUserAgent } from '@/lib/utils/audit-logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: 'error', message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: documentId } = await params;

    // Get vendor ID from session
    const vendorId = session.user.vendorId;
    if (!vendorId) {
      return NextResponse.json(
        { status: 'error', message: 'Vendor profile not found' },
        { status: 403 }
      );
    }

    // Extract request metadata
    const ipAddress = getIpAddress(request.headers);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = getDeviceTypeFromUserAgent(userAgent);

    // Download document (logs the download)
    const document = await downloadDocument(
      documentId,
      vendorId,
      'browser',
      ipAddress,
      deviceType,
      userAgent
    );

    // Fetch the PDF from Cloudinary
    const pdfResponse = await fetch(document.pdfUrl);
    
    if (!pdfResponse.ok) {
      throw new Error('Failed to fetch PDF from storage');
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    // Return PDF with appropriate headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${document.title}.pdf"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Document download error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to download document',
      },
      { status: 500 }
    );
  }
}
