/**
 * Download Document API
 * GET /api/auctions/[id]/documents/[docId]/download
 * 
 * Downloads a document PDF with audit logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { downloadDocument } from '@/features/documents/services/document.service';
import { logAction, AuditActionType, AuditEntityType, createAuditLogData, getDeviceTypeFromUserAgent } from '@/lib/utils/audit-logger';

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
    const { pdfUrl, title } = await downloadDocument(
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
        AuditActionType.CASE_UPDATED, // TODO: Add DOCUMENT_DOWNLOADED action type
        AuditEntityType.CASE,
        docId,
        undefined,
        { action: 'download', method: 'portal' }
      )
    );

    // Redirect to Cloudinary URL
    return NextResponse.redirect(pdfUrl);
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
