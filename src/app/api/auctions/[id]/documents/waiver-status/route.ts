/**
 * GET /api/auctions/[id]/documents/waiver-status
 * Check if vendor has signed liability waiver for auction
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { hasSignedLiabilityWaiver } from '@/features/documents/services/document.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await params;
    
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get vendorId from query params or session
    const { searchParams } = new URL(request.url);
    const vendorId = searchParams.get('vendorId') || session.user.vendorId;

    if (!vendorId) {
      return NextResponse.json(
        { error: 'Vendor ID required' },
        { status: 400 }
      );
    }

    // Check if waiver is signed
    const signed = await hasSignedLiabilityWaiver(auctionId, vendorId);

    return NextResponse.json({
      signed,
      auctionId,
      vendorId,
    });
  } catch (error) {
    console.error('Error checking waiver status:', error);
    return NextResponse.json(
      { error: 'Failed to check waiver status' },
      { status: 500 }
    );
  }
}
