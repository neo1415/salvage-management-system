/**
 * Generate Document API
 * POST /api/auctions/[id]/documents/generate
 * 
 * Generates a legal document (bill of sale, liability waiver, etc.) for an auction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { generateDocument } from '@/features/documents/services/document.service';
import { logAction, AuditActionType, AuditEntityType, createAuditLogData } from '@/lib/utils/audit-logger';
import { type DocumentType } from '@/lib/db/schema/release-forms';

export async function POST(
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

    const { id: auctionId } = await params;

    // Parse request body
    const body = await request.json();
    const { documentType } = body as { documentType: DocumentType };

    // Validate document type
    const validTypes: DocumentType[] = ['bill_of_sale', 'liability_waiver', 'pickup_authorization', 'salvage_certificate'];
    if (!documentType || !validTypes.includes(documentType)) {
      return NextResponse.json(
        { status: 'error', message: 'Invalid document type' },
        { status: 400 }
      );
    }

    // Get vendor ID from session
    const vendorId = session.user.vendorId;
    if (!vendorId) {
      return NextResponse.json(
        { status: 'error', message: 'Vendor profile not found' },
        { status: 403 }
      );
    }

    // Generate document
    const document = await generateDocument(
      auctionId,
      vendorId,
      documentType,
      session.user.id
    );

    // Audit log
    await logAction(
      createAuditLogData(
        request,
        session.user.id,
        AuditActionType.CASE_CREATED, // TODO: Add DOCUMENT_GENERATED action type
        AuditEntityType.CASE,
        document.id,
        undefined,
        {
          documentType,
          auctionId,
          vendorId,
        }
      )
    );

    return NextResponse.json({
      status: 'success',
      data: { document },
    });
  } catch (error) {
    console.error('Generate document error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate document',
      },
      { status: 500 }
    );
  }
}
