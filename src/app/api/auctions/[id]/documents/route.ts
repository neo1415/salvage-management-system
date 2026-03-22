/**
 * List Documents API
 * GET /api/auctions/[id]/documents
 * 
 * Lists all documents for an auction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { getAuctionDocuments } from '@/features/documents/services/document.service';

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

    const { id: auctionId } = await params;

    // Get vendor ID from session
    const vendorId = session.user.vendorId;
    if (!vendorId) {
      return NextResponse.json(
        { status: 'error', message: 'Vendor profile not found' },
        { status: 403 }
      );
    }

    // Fetch documents
    const documents = await getAuctionDocuments(auctionId, vendorId);

    // Group documents by status
    const grouped = {
      pending: documents.filter((doc) => doc.status === 'pending'),
      signed: documents.filter((doc) => doc.status === 'signed'),
      voided: documents.filter((doc) => doc.status === 'voided'),
      expired: documents.filter((doc) => doc.status === 'expired'),
    };

    return NextResponse.json({
      status: 'success',
      data: {
        documents,
        grouped,
        counts: {
          total: documents.length,
          pending: grouped.pending.length,
          signed: grouped.signed.length,
          voided: grouped.voided.length,
          expired: grouped.expired.length,
        },
      },
    });
  } catch (error) {
    console.error('List documents error:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to fetch documents',
      },
      { status: 500 }
    );
  }
}
