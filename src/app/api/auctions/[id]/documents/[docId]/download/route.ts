/**
 * Download Document API
 * GET /api/auctions/[id]/documents/[docId]/download
 * 
 * Downloads a document PDF with audit logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { downloadDocument } from '@/features/documents/services/document.service';
import {
  logAction,
  AuditActionType,
  AuditEntityType,
  createAuditLogData,
  getDeviceTypeFromUserAgent,
} from '@/lib/utils/audit-logger';

function createDocumentFilename(title: string): string {
  const safeTitle = title
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return `${safeTitle || 'document'}.pdf`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
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

    const { id: auctionId, docId } = await params;

    // Get vendor ID from session
    const vendorId = session.user.vendorId;
    if (!vendorId) {
      return NextResponse.json(
        { status: 'error', message: 'Vendor profile not found' },
        { status: 403 }
      );
    }

    // Extract request metadata
    const headers = request.headers;
    const ipAddress = headers.get('x-forwarded-for')?.split(',')[0] || headers.get('x-real-ip') || 'unknown';
    const userAgent = headers.get('user-agent') || 'unknown';
    const deviceType = getDeviceTypeFromUserAgent(userAgent);

    // Download document (with audit logging)
    const document = await downloadDocument(
      docId,
      vendorId,
      'portal',
      ipAddress,
      deviceType,
      userAgent
    );

    // Audit log
    await logAction(
      createAuditLogData(
        request,
        session.user.id,
        AuditActionType.DOCUMENT_DOWNLOADED,
        AuditEntityType.DOCUMENT,
        docId,
        undefined,
        {
          action: 'download',
          method: 'portal',
          auctionId,
          documentType: document.documentType,
          title: document.title,
        }
      )
    );

    const pdfResponse = await fetch(document.pdfUrl);

    if (!pdfResponse.ok) {
      throw new Error('Failed to fetch PDF from storage');
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${createDocumentFilename(document.title)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Download document error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to download document',
      },
      { status: 500 }
    );
  }
}
