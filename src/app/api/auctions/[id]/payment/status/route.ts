/**
 * Payment Status API
 * GET /api/auctions/[id]/payment/status
 * 
 * Checks if a verified payment exists for an auction
 * Used to determine UI state (show "Pay Now" vs "Payment Complete")
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { eq, and, inArray } from 'drizzle-orm';
import { calculateAuctionPaymentProgress } from '@/features/auction-deposit/services/payment-progress';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await params;
    
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { hasVerifiedPayment: false },
        { status: 401 }
      );
    }

    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, session.user.id),
    });
    const auction = await db.query.auctions.findFirst({
      where: eq(auctions.id, auctionId),
    });
    if (!vendor || !auction || auction.currentBidder !== vendor.id) {
      return NextResponse.json({ hasVerifiedPayment: false }, { status: 403 });
    }

    const confirmedPayments = await db
      .select({ id: payments.id, amount: payments.amount })
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.vendorId, vendor.id),
          inArray(payments.status, ['partially_verified', 'verified'])
        )
      );
    const progress = calculateAuctionPaymentProgress(
      Number(auction.currentBid || 0),
      confirmedPayments.map((payment) => Number(payment.amount))
    );

    return NextResponse.json({
      hasVerifiedPayment: progress.isComplete,
      paymentId: confirmedPayments.at(-1)?.id,
      verifiedAmount: progress.confirmedAmount,
      outstandingAmount: progress.outstandingAmount,
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    return NextResponse.json(
      { hasVerifiedPayment: false },
      { status: 500 }
    );
  }
}
