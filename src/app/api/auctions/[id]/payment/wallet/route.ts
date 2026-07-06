/**
 * Wallet-Only Payment API Route
 * Processes payment entirely from vendor wallet
 * 
 * Requirements:
 * - Requirement 14: Wallet-Only Payment Processing
 * 
 * SECURITY: IDOR protection, winner verification, idempotency
 * FINANCIAL: Atomic transactions, wallet invariant verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { paymentService } from '@/features/auction-deposit/services/payment.service';
import { db } from '@/lib/db/drizzle';
import { vendors, releaseForms } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, createRateLimitHeaders } from '@/lib/utils/rate-limit';
import { ensurePaymentReadinessContext, PaymentReadinessError } from '@/features/auction-deposit/services/payment-readiness.service';
import {
  businessPolicyService,
  getBusinessPolicyRuntimeMode,
  isBusinessPolicyEnforcementEnabled,
  logPolicyDecision,
  resolveAuctionPaymentMethodAccess,
} from '@/features/business-policy';
import { AuditEntityType, getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';
import { calculateAuctionPaymentAllocation } from '@/features/auction-deposit/services/payment-allocation';

/**
 * POST /api/auctions/[id]/payment/wallet
 * Process wallet-only payment
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

    const policy = await businessPolicyService.getEffectivePolicy();
    const paymentMethodDecision = resolveAuctionPaymentMethodAccess(policy, 'wallet');
    const ipAddress = getIpAddress(request.headers);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logPolicyDecision({
      userId: session.user.id,
      entityType: AuditEntityType.PAYMENT,
      entityId: auctionId,
      ipAddress,
      userAgent,
      deviceType: getDeviceTypeFromUserAgent(userAgent),
      decision: paymentMethodDecision.decision,
      context: {
        source: 'api/auctions/[id]/payment/wallet',
        runtimeMode: getBusinessPolicyRuntimeMode(),
        vendorId: vendor.id,
      },
    }).catch((error) => {
      console.warn('[BusinessPolicy] Failed to audit wallet payment method decision', {
        auctionId,
        vendorId: vendor.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    if (!paymentMethodDecision.allowed && isBusinessPolicyEnforcementEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Wallet payment is not enabled for this deployment.' },
        { status: 403 }
      );
    }

    const rateLimitResult = await rateLimit(request, {
      identifier: `auction-wallet-payment:${vendor.id}:${auctionId}`,
      limit: 10,
      window: 60,
    });
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: 'Too many wallet payment attempts. Please wait and try again.' },
        { status: 429, headers: rateLimitHeaders }
      );
    }

    const { auction, winner, escrowWallet } = await ensurePaymentReadinessContext(auctionId, vendor.id);

    // Verify auction status allows payment
    const validStatuses = ['awaiting_payment', 'documents_signed'];
    if (!validStatuses.includes(auction.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Payment not available for auction status: ${auction.status}`,
        },
        { status: 400 }
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
        { status: 400 }
      );
    }

    if (!escrowWallet) {
      return NextResponse.json(
        { success: false, error: 'Escrow wallet not found' },
        { status: 404 }
      );
    }

    // Calculate payment breakdown directly (no HTTP call needed)
    const finalBid = parseFloat(winner.bidAmount);
    const depositAmount = parseFloat(winner.depositAmount);
    const { remainingAmount } = calculateAuctionPaymentAllocation(finalBid, depositAmount);
    const availableBalance = parseFloat(escrowWallet.availableBalance);
    const canPayWithWallet = availableBalance >= remainingAmount;

    console.log('[Wallet Payment] Payment breakdown:', {
      finalBid,
      depositAmount,
      remainingAmount,
      availableBalance,
      canPayWithWallet,
    });

    if (!canPayWithWallet) {
      return NextResponse.json(
        { success: false, error: 'Insufficient wallet balance for full payment' },
        { status: 400 }
      );
    }

    // Generate idempotency key
    const paymentReference = `wallet_${auctionId}_${vendor.id}_${Date.now()}`;
    console.log('[Wallet Payment] Processing payment with reference:', paymentReference);

    // Process wallet payment
    const result = await paymentService.processWalletAuctionPayment({
      auctionId,
      vendorId: vendor.id,
      finalBid,
      depositAmount,
      idempotencyKey: paymentReference,
    });

    console.log('[Wallet Payment] Payment processed successfully:', result);

    return NextResponse.json(
      {
        success: true,
        payment: result,
        message: 'Payment processed successfully from wallet',
      },
      { headers: rateLimitHeaders }
    );
  } catch (error) {
    console.error('Wallet payment error:', error);

    if (error instanceof PaymentReadinessError) {
      return NextResponse.json(
        { success: false, error: error.message, message: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process wallet payment. Please try again.',
        message: 'Failed to process wallet payment. Please try again.',
      },
      { status: 500 }
    );
  }
}
