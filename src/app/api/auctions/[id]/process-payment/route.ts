/**
 * Process Payment API Endpoint
 * 
 * Manually trigger payment processing for auctions where all documents are signed
 * but payment wasn't processed (retroactive processing for backward compatibility).
 * 
 * POST /api/auctions/[id]/process-payment
 * 
 * Features:
 * - Verify auction exists and is closed
 * - Verify user is the winner
 * - Check if all 3 documents are signed
 * - Check if payment already processed (duplicate prevention)
 * - Trigger fund release and payment verification
 * - Return success/error response
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { eq } from 'drizzle-orm';
import { checkAllDocumentsSigned, triggerFundReleaseOnDocumentCompletion } from '@/features/documents/services/document.service';
import { checkPaymentProcessed } from '@/features/payments/utils/payment-status-checker';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 1: Authenticate user
    const session = await auth();
    if (!session?.user?.vendorId) {
      console.error('❌ Unauthorized: No vendor ID in session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: auctionId } = await params;
    console.log(`🔄 Processing retroactive payment for auction ${auctionId}...`);

    // Step 2: Verify auction exists and is closed
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      console.error(`❌ Auction not found: ${auctionId}`);
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    if (auction.status !== 'closed') {
      console.error(`❌ Auction not closed: ${auctionId} (status: ${auction.status})`);
      return NextResponse.json({ error: 'Auction not closed' }, { status: 400 });
    }

    // Step 3: Verify user is winner
    if (auction.currentBidder !== session.user.vendorId) {
      console.error(`❌ User is not winner: ${session.user.vendorId} (winner: ${auction.currentBidder})`);
      return NextResponse.json({ error: 'You are not the winner of this auction' }, { status: 403 });
    }

    // Step 4: Check if all documents signed
    const allSigned = await checkAllDocumentsSigned(auctionId, session.user.vendorId);
    if (!allSigned) {
      console.error(`❌ Not all documents signed for auction ${auctionId}`);
      return NextResponse.json({ error: 'Not all documents are signed' }, { status: 400 });
    }

    console.log(`✅ All documents signed for auction ${auctionId}`);

    // Step 5: Check if payment already processed (DUPLICATE PREVENTION)
    const paymentProcessed = await checkPaymentProcessed(auctionId, session.user.vendorId);
    if (paymentProcessed) {
      console.log(`⏸️  Payment already processed for auction ${auctionId}. Skipping.`);
      return NextResponse.json({
        success: true,
        message: 'Payment already processed',
        alreadyProcessed: true,
      });
    }

    // Step 6: Trigger payment processing
    console.log(`🔄 Triggering retroactive payment processing for auction ${auctionId}...`);
    await triggerFundReleaseOnDocumentCompletion(
      auctionId,
      session.user.vendorId,
      session.user.id
    );

    console.log(`✅ Retroactive payment processing completed for auction ${auctionId}`);

    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully',
      alreadyProcessed: false,
    });
  } catch (error) {
    console.error('❌ Error processing payment:', error);
    return NextResponse.json(
      {
        error: 'Failed to process payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
