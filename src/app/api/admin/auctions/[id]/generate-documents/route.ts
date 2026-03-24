import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateDocument } from '@/features/documents/services/document.service';

/**
 * Admin Manual Document Generation API
 * 
 * POST /api/admin/auctions/[id]/generate-documents
 * 
 * Manually trigger document generation for a closed auction
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or finance
    if (session.user.role !== 'admin' && session.user.role !== 'finance_officer') {
      return NextResponse.json(
        { error: 'Forbidden - Admin or Finance access required' },
        { status: 403 }
      );
    }

    const { id: auctionId } = await params;

    // Get auction details
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    if (auction.status !== 'closed') {
      return NextResponse.json(
        { error: 'Auction must be closed to generate documents' },
        { status: 400 }
      );
    }

    if (!auction.currentBidder) {
      return NextResponse.json(
        { error: 'No winner for this auction' },
        { status: 400 }
      );
    }

    // Get vendor details
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, auction.currentBidder))
      .limit(1);

    if (!vendor) {
      return NextResponse.json({ error: 'Winner vendor not found' }, { status: 404 });
    }

    const results = {
      billOfSale: { success: false, error: '' },
      liabilityWaiver: { success: false, error: '' },
      pickupAuthorization: { success: false, error: '' },
    };

    // Generate Bill of Sale
    try {
      await generateDocument(auctionId, vendor.id, 'bill_of_sale', session.user.id);
      results.billOfSale.success = true;
    } catch (error) {
      results.billOfSale.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Generate Liability Waiver
    try {
      await generateDocument(auctionId, vendor.id, 'liability_waiver', session.user.id);
      results.liabilityWaiver.success = true;
    } catch (error) {
      results.liabilityWaiver.error = error instanceof Error ? error.message : 'Unknown error';
    }

    // Generate Pickup Authorization
    // WARNING: Pickup authorization should normally only be generated AFTER payment is complete.
    // This manual generation is for admin override purposes only (e.g., fixing data issues).
    try {
      await generateDocument(auctionId, vendor.id, 'pickup_authorization', session.user.id);
      results.pickupAuthorization.success = true;
    } catch (error) {
      results.pickupAuthorization.error =
        error instanceof Error ? error.message : 'Unknown error';
    }

    const successCount = Object.values(results).filter((r) => r.success).length;
    const totalCount = Object.keys(results).length;

    if (successCount === 0) {
      return NextResponse.json(
        {
          error: 'Failed to generate any documents',
          details: results,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${successCount}/${totalCount} documents successfully`,
      results,
    });
  } catch (error) {
    console.error('Admin generate documents API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate documents' },
      { status: 500 }
    );
  }
}
