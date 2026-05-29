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
import { vendors, auctionWinners, auctions, releaseForms } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { rateLimit, createRateLimitHeaders } from '@/lib/utils/rate-limit';
import {
  businessPolicyService,
  getBusinessPolicyRuntimeMode,
  isBusinessPolicyEnforcementEnabled,
  logPolicyDecision,
  resolveAuctionPaymentMethodAccess,
} from '@/features/business-policy';
import { AuditEntityType, getDeviceTypeFromUserAgent, getIpAddress } from '@/lib/utils/audit-logger';

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

    const policy = await businessPolicyService.getEffectivePolicy();
    const paymentMethodDecision = resolveAuctionPaymentMethodAccess(policy, 'paystack');
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
        source: 'api/auctions/[id]/payment/paystack',
        runtimeMode: getBusinessPolicyRuntimeMode(),
        vendorId: vendor.id,
      },
    }).catch((error) => {
      console.warn('[BusinessPolicy] Failed to audit Paystack payment method decision', {
        auctionId,
        vendorId: vendor.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    if (!paymentMethodDecision.allowed && isBusinessPolicyEnforcementEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Paystack payment is not enabled for this deployment.' },
        { status: 403 }
      );
    }

    const rateLimitResult = await rateLimit(request, {
      identifier: `auction-paystack:${vendor.id}:${auctionId}`,
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

    const auction = await db.query.auctions.findFirst({
      where: eq(auctions.id, auctionId),
    });

    if (!auction) {
      return NextResponse.json(
        { success: false, error: 'Auction not found' },
        { status: 404 }
      );
    }

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

    return NextResponse.json(
      {
        success: true,
        authorization_url: result.authorizationUrl,
        access_code: result.accessCode,
        reference: result.paystackReference,
        amount: result.amount,
        message: 'Paystack payment initialized. Amount is fixed and cannot be modified.',
      },
      { headers: rateLimitHeaders }
    );
  } catch (error) {
    console.error('Paystack initialization error:', error);

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to initialize payment. Please try again.',
      },
      { status: 500 }
    );
  }
}
