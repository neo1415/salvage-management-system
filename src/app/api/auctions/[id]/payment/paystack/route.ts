/**
 * Paystack-Only Payment API Route
 * Initializes Paystack payment for remaining amount
 * 
 * Requirements:
 * - Requirement 15: Paystack-Only Payment Processing
 * 
 * SECURITY: IDOR protection, winner verification, fixed amount
 * FINANCIAL: Non-modifiable amount, idempotency
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { paymentService } from '@/features/auction-deposit/services/payment.service';
import { db } from '@/lib/db/drizzle';
import { vendors, auctionWinners } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/auctions/[id]/payment/paystack
 * Initialize Paystack payment
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get vendor
    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, session.user.id),
    });

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: 'Vendor profile not found' },
        { status: 404 }
      );
    }

    // Get winner record
    const winner = await db.query.auctionWinners.findFirst({
      where: and(
        eq(auctionWinners.auctionId, auctionId),
        eq(auctionWinners.status, 'active')
      ),
    });

    if (!winner) {
      return NextResponse.json(
        { success: false, error: 'No active winner for this auction' },
        { status: 404 }
      );
    }

    // IDOR Protection: Verify user is the winner
    if (winner.vendorId !== vendor.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - You are not the winner of this auction' },
        { status: 403 }
      );
    }

    // Generate payment reference
    const paymentReference = `PAY-${auctionId}-${Date.now()}`;

    // Get finalBid and depositAmount from winner record
    const finalBid = parseFloat(winner.bidAmount);
    const depositAmount = parseFloat(winner.depositAmount);

    // Initialize Paystack payment
    const result = await paymentService.initializePaystackPayment({
      auctionId,
      vendorId: vendor.id,
      finalBid,
      depositAmount,
      idempotencyKey: paymentReference,
    });

    return NextResponse.json({
      success: true,
      authorization_url: result.authorizationUrl,
      access_code: result.accessCode,
      reference: result.paystackReference,
      amount: result.amount,
      message: 'Paystack payment initialized. Amount is fixed and cannot be modified.',
    });
  } catch (error) {
    console.error('Paystack initialization error:', error);
    
    // Extract detailed error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Detailed error message:', errorMessage);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
