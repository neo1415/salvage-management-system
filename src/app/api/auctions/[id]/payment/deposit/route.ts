import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { releaseForms, vendors } from '@/lib/db/schema';
import { paymentService } from '@/features/auction-deposit/services/payment.service';
import {
  ensurePaymentReadinessContext,
  PaymentReadinessError,
} from '@/features/auction-deposit/services/payment-readiness.service';
import { calculateAuctionPaymentAllocation } from '@/features/auction-deposit/services/payment-allocation';
import { createRateLimitHeaders, rateLimit } from '@/lib/utils/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auctionId } = await params;
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, session.user.id),
    });

    if (!vendor) {
      return NextResponse.json({ success: false, error: 'Vendor profile not found' }, { status: 404 });
    }

    const rateLimitResult = await rateLimit(request, {
      identifier: `auction-deposit-payment:${vendor.id}:${auctionId}`,
      limit: 10,
      window: 60,
    });
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many payment attempts. Please wait and try again.' },
        { status: 429, headers: rateLimitHeaders }
      );
    }

    const { auction, winner } = await ensurePaymentReadinessContext(auctionId, vendor.id);
    if (!['awaiting_payment', 'documents_signed'].includes(auction.status)) {
      return NextResponse.json(
        { success: false, error: `Payment not available for auction status: ${auction.status}` },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const [signedDocument] = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, auctionId),
          eq(releaseForms.vendorId, vendor.id),
          eq(releaseForms.status, 'signed')
        )
      )
      .limit(1);

    if (signedDocument?.paymentDeadline && signedDocument.paymentDeadline < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Payment deadline has passed' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const finalBid = parseFloat(winner.bidAmount);
    const depositAmount = parseFloat(winner.depositAmount);
    const allocation = calculateAuctionPaymentAllocation(finalBid, depositAmount);

    if (allocation.remainingAmount > 0) {
      return NextResponse.json(
        { success: false, error: 'The auction deposit does not cover the full winning bid.' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const result = await paymentService.processWalletAuctionPayment({
      auctionId,
      vendorId: vendor.id,
      finalBid,
      depositAmount,
      idempotencyKey: `deposit_${auctionId}_${vendor.id}`,
    });

    return NextResponse.json(
      {
        success: true,
        payment: result,
        allocation,
        message: 'Purchase completed from the auction deposit.',
      },
      { headers: rateLimitHeaders }
    );
  } catch (error) {
    console.error('Deposit-covered payment error:', error);

    if (error instanceof PaymentReadinessError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to complete payment from the auction deposit. Please try again.' },
      { status: 500 }
    );
  }
}
