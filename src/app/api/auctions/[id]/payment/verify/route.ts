/**
 * Manual Payment Verification API
 * POST /api/auctions/[id]/payment/verify
 * 
 * Allows vendors to manually trigger payment verification if webhook is delayed.
 * This is a fallback mechanism for cases where Paystack webhook delivery is slow
 * or fails, causing the UI to show "Payment Required" for extended periods.
 * 
 * Flow:
 * 1. Vendor makes payment via Paystack
 * 2. Webhook should process payment within seconds
 * 3. If webhook is delayed > 2 minutes, vendor can click "Verify Payment"
 * 4. This endpoint queries Paystack API directly to verify payment status
 * 5. If payment is successful, manually triggers payment processing
 * 
 * Security:
 * - Requires authentication
 * - Only vendor who owns the auction can verify
 * - Verifies payment with Paystack API (not just database)
 * - Idempotent - safe to call multiple times
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db, withRetry } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { auctionWinners } from '@/lib/db/schema/auction-deposit';
import { walletTransactions } from '@/lib/db/schema/escrow';
import { eq, and } from 'drizzle-orm';
import { paymentService } from '@/features/auction-deposit/services/payment.service';

const MANUAL_RETRY_DELAY_MS = 10 * 60 * 1000;

type VerifyBody = {
  source?: 'manual_retry' | 'paystack_return';
  reference?: string | null;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const verificationStartTime = Date.now();
  
  try {
    const { id: auctionId } = await params;
    const body = (await request.json().catch(() => ({}))) as VerifyBody;
    
    console.log('🔍 Manual payment verification requested');
    console.log(`   - Auction ID: ${auctionId}`);
    console.log(`   - Timestamp: ${new Date().toISOString()}`);
    
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Get vendor ID
    const [vendor] = await withRetry(() => db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, session.user.id))
      .limit(1), 2, 500);
    
    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }
    
    console.log(`   - Vendor ID: ${vendor.id}`);
    
    // Verify auction exists and vendor is the winner
    const [auction] = await withRetry(() => db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1), 2, 500);
    
    if (!auction) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }
    
    if (auction.currentBidder !== vendor.id) {
      return NextResponse.json(
        { error: 'You are not the winner of this auction' },
        { status: 403 }
      );
    }
    
    console.log(`   - Auction status: ${auction.status}`);
    
    // Check if payment already verified
    const [existingVerifiedPayment] = await withRetry(() => db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.vendorId, vendor.id),
          eq(payments.status, 'verified')
        )
      )
      .limit(1), 2, 500);
    
    if (existingVerifiedPayment) {
      console.log(`✅ Payment already verified: ${existingVerifiedPayment.id}`);
      return NextResponse.json({
        success: true,
        message: 'Payment already verified',
        paymentId: existingVerifiedPayment.id,
        verifiedAt: existingVerifiedPayment.verifiedAt,
      });
    }
    
    // Find pending payment
    const [payment] = await withRetry(() => db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.vendorId, vendor.id),
          eq(payments.status, 'pending')
        )
      )
      .limit(1), 2, 500);
    
    if (!payment) {
      return NextResponse.json(
        { 
          error: 'No pending payment found',
          message: 'Please make a payment first before verifying',
        },
        { status: 404 }
      );
    }
    
    console.log(`   - Found pending payment: ${payment.id}`);
    console.log(`   - Payment reference: ${payment.paymentReference}`);
    console.log(`   - Payment method: ${payment.paymentMethod}`);
    
    // Only verify Paystack payments (wallet payments are instant)
    if (payment.paymentMethod !== 'paystack') {
      return NextResponse.json(
        { 
          error: 'Manual verification only available for Paystack payments',
          message: 'Wallet payments are processed instantly',
        },
        { status: 400 }
      );
    }
    
    if (!payment.paymentReference) {
      return NextResponse.json(
        {
          error: 'Payment reference missing',
          message: 'This payment cannot be verified automatically. Please contact support.',
        },
        { status: 400 }
      );
    }
    const paymentReference = payment.paymentReference;

    const isTrustedPaystackReturn =
      body.source === 'paystack_return' &&
      typeof body.reference === 'string' &&
      body.reference === paymentReference;

    if (!isTrustedPaystackReturn) {
      const retryAvailableAt = new Date(payment.createdAt.getTime() + MANUAL_RETRY_DELAY_MS);
      const waitMs = retryAvailableAt.getTime() - Date.now();

      if (waitMs > 0) {
        const waitMinutes = Math.ceil(waitMs / 60000);
        return NextResponse.json(
          {
            success: false,
            code: 'PAYMENT_STILL_PROCESSING',
            message: `Payment is still being confirmed. Please wait ${waitMinutes} minute(s), then retry if it has not updated.`,
            retryAvailableAt: retryAvailableAt.toISOString(),
            waitMinutes,
          },
          { status: 409 }
        );
      }
    }

    // Verify payment with Paystack API
    console.log('🔍 Verifying payment with Paystack API...');
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
    
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY not configured');
    }
    
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${paymentReference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );
    
    if (!paystackResponse.ok) {
      console.error('❌ Paystack API error:', paystackResponse.status);
      return NextResponse.json(
        { 
          error: 'Failed to verify payment with Paystack',
          message: 'Please try again later or contact support',
        },
        { status: 500 }
      );
    }
    
    const paystackData = await paystackResponse.json();
    console.log('✅ Paystack API response:', {
      status: paystackData.data.status,
      amount: paystackData.data.amount,
      reference: paystackData.data.reference,
    });
    if (paystackData.data.reference !== paymentReference) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment reference mismatch',
          message: 'This payment could not be matched to the current auction.',
        },
        { status: 409 }
      );
    }

    const metadata = paystackData.data.metadata || {};
    if (
      (metadata.auctionId && metadata.auctionId !== auctionId) ||
      (metadata.vendorId && metadata.vendorId !== vendor.id) ||
      (metadata.paymentId && metadata.paymentId !== payment.id)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment metadata mismatch',
          message: 'This payment could not be matched to the current auction.',
        },
        { status: 409 }
      );
    }

    const [winner] = await withRetry(() => db
      .select()
      .from(auctionWinners)
      .where(
        and(
          eq(auctionWinners.auctionId, auctionId),
          eq(auctionWinners.vendorId, vendor.id),
          eq(auctionWinners.status, 'active')
        )
      )
      .limit(1), 2, 500);

    if (!winner) {
      return NextResponse.json(
        {
          success: false,
          error: 'Winner record not found',
          message: 'This auction payment cannot be confirmed automatically. Please contact support.',
        },
        { status: 409 }
      );
    }

    const [hybridFreeze] = await withRetry(() => db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.reference, `HYBRID_FREEZE_${payment.id}`))
      .limit(1), 2, 500);

    const finalBid = parseFloat(winner.bidAmount);
    const depositAmount = parseFloat(winner.depositAmount);
    const hybridWalletAmount = hybridFreeze ? parseFloat(hybridFreeze.amount) : 0;
    const expectedPaystackAmount = Math.max(0, finalBid - depositAmount - hybridWalletAmount);
    const receivedPaystackAmount = Number(paystackData.data.amount || 0) / 100;

    if (Math.abs(receivedPaystackAmount - expectedPaystackAmount) > 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment amount mismatch',
          message: 'This payment amount does not match the current auction balance. Please contact support.',
        },
        { status: 409 }
      );
    }
    
    // Check payment status
    if (paystackData.data.status !== 'success') {
      return NextResponse.json({
        success: false,
        message: `Payment status: ${paystackData.data.status}`,
        status: paystackData.data.status,
        details: 'Payment has not been completed successfully',
      });
    }
    
    // Payment is successful - process it manually
    console.log('✅ Payment verified with Paystack - processing manually...');
    const processingStartTime = Date.now();
    
    await withRetry(() => paymentService.handlePaystackWebhook(paymentReference, true), 2, 750);
    
    const processingDuration = Date.now() - processingStartTime;
    const totalDuration = Date.now() - verificationStartTime;
    
    console.log('✅ Payment processed successfully');
    console.log(`   - Processing time: ${processingDuration}ms`);
    console.log(`   - Total verification time: ${totalDuration}ms`);
    
    return NextResponse.json({
      success: true,
      message: 'Payment verified and processed successfully',
      paymentId: payment.id,
      processingTime: processingDuration,
      totalTime: totalDuration,
    });
  } catch (error) {
    const totalDuration = Date.now() - verificationStartTime;
    console.error('❌ Manual verification error:', error);
    console.error(`   - Failed after: ${totalDuration}ms`);
    
    return NextResponse.json(
      {
        error: 'Payment verification failed',
        message: 'We could not confirm this payment yet. If Paystack debited you, please retry verification in a moment or contact support.',
        failedAfter: totalDuration,
      },
      { status: 500 }
    );
  }
}
