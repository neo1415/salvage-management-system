/**
 * Hybrid Payment API Route
 * Processes payment using wallet + Paystack combination
 * 
 * Requirements:
 * - Requirement 16: Hybrid Payment Processing
 * 
 * SECURITY: IDOR protection, winner verification, rollback on failure
 * FINANCIAL: Two-phase commit, automatic rollback, idempotency
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { paymentService } from '@/features/auction-deposit/services/payment.service';
import { db } from '@/lib/db/drizzle';
import { vendors, users, releaseForms } from '@/lib/db/schema';
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
 * POST /api/auctions/[id]/payment/hybrid
 * Process hybrid payment (wallet + Paystack)
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
    const paymentMethodDecision = resolveAuctionPaymentMethodAccess(policy, 'hybrid');
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
        source: 'api/auctions/[id]/payment/hybrid',
        runtimeMode: getBusinessPolicyRuntimeMode(),
        vendorId: vendor.id,
      },
    }).catch((error) => {
      console.warn('[BusinessPolicy] Failed to audit hybrid payment method decision', {
        auctionId,
        vendorId: vendor.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    if (!paymentMethodDecision.allowed && isBusinessPolicyEnforcementEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Hybrid wallet and Paystack payment is not enabled for this deployment.' },
        { status: 403 }
      );
    }

    const rateLimitResult = await rateLimit(request, {
      identifier: `auction-hybrid-payment:${vendor.id}:${auctionId}`,
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

    if (remainingAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'The auction deposit covers the full winning bid. Complete payment from the deposit instead.' },
        { status: 400 }
      );
    }
    const availableBalance = parseFloat(escrowWallet.availableBalance);
    const canPayWithWallet = availableBalance >= remainingAmount;

    console.log('[Hybrid Payment] Payment breakdown:', {
      finalBid,
      depositAmount,
      remainingAmount,
      availableBalance,
      canPayWithWallet,
    });

    // Verify hybrid payment is valid
    if (canPayWithWallet) {
      return NextResponse.json(
        { success: false, error: 'You have sufficient wallet balance. Please use wallet-only payment.' },
        { status: 400 }
      );
    }

    if (availableBalance <= 0) {
      return NextResponse.json(
        { success: false, error: 'No wallet balance available. Please use Paystack-only payment.' },
        { status: 400 }
      );
    }

    // Generate idempotency key
    const paymentReference = `hybrid_${auctionId}_${vendor.id}_${Date.now()}`;

    // Get vendor email
    const vendorUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    if (!vendorUser?.email) {
      return NextResponse.json(
        { success: false, error: 'Vendor email not found' },
        { status: 404 }
      );
    }

    console.log('[Hybrid Payment] Processing payment with reference:', paymentReference);

    // Process hybrid payment
    const result = await paymentService.processHybridAuctionPayment({
      auctionId,
      vendorId: vendor.id,
      finalBid,
      depositAmount,
      idempotencyKey: paymentReference,
      vendorEmail: vendorUser.email,
    });

    console.log('[Hybrid Payment] Payment processed successfully:', result);

    if (result.authorizationUrl === 'ALREADY_PENDING') {
      return NextResponse.json({
        success: true,
        walletAmount: result.walletAmount,
        paystackAmount: result.paystackAmount,
        authorization_url: 'ALREADY_PENDING',
        access_code: 'ALREADY_PENDING',
        reference: result.paystackReference,
        message: 'A payment is already being processed. Please retry the payment check or refresh this auction shortly.',
      });
    }

    return NextResponse.json({
      success: true,
      walletAmount: result.walletAmount,
      paystackAmount: result.paystackAmount,
      authorization_url: result.authorizationUrl,
      access_code: result.accessCode,
      reference: result.paystackReference,
      message: `Wallet portion reserved. Complete online checkout for ₦${result.paystackAmount?.toLocaleString()}. If checkout fails, only that reserved wallet portion is released back to your wallet.`,
    });
  } catch (error) {
    console.error('Hybrid payment error:', error);

    if (error instanceof PaymentReadinessError) {
      return NextResponse.json(
        { success: false, error: error.message, message: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process hybrid payment. Please try again.',
        message: 'Failed to process hybrid payment. Please try again.',
      },
      { status: 500 }
    );
  }
}
