/**
 * Payment Calculation API Route
 * Calculates payment breakdown for auction winner
 * 
 * Requirements:
 * - Requirement 13: Hybrid Payment Calculation
 * 
 * SECURITY: IDOR protection, winner verification
 * FINANCIAL: Precise calculation, no rounding errors
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { releaseForms, payments, vendors } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { businessPolicyService, resolveAuctionPaymentMethodAccess } from '@/features/business-policy';
import {
  ensurePaymentReadinessContext,
  PaymentReadinessError,
} from '@/features/auction-deposit/services/payment-readiness.service';

/**
 * GET /api/auctions/[id]/payment/calculate
 * Calculate payment breakdown for winner
 */
export async function GET(
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

    const {
      auction,
      winner,
      escrowWallet,
      repairedWinnerRecord,
      repairedAuctionStatus,
    } = await ensurePaymentReadinessContext(auctionId, vendor.id);

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

    const [expiredPaymentWindow] = await db
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

    if (expiredPaymentWindow?.paymentDeadline && expiredPaymentWindow.paymentDeadline < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Payment deadline has passed' },
        { status: 400 }
      );
    }

    // Calculate payment breakdown
    const finalBid = parseFloat(winner.bidAmount);
    const depositAmount = parseFloat(winner.depositAmount);
    const remainingAmount = finalBid - depositAmount;
    const availableBalance = escrowWallet ? parseFloat(escrowWallet.availableBalance) : 0;

    // Determine payment options
    const canPayWithWalletOnly = availableBalance >= remainingAmount;
    const walletPortion = Math.min(availableBalance, remainingAmount);
    const paystackPortion = Math.max(0, remainingAmount - availableBalance);
    const policy = await businessPolicyService.getEffectivePolicy();
    const paymentMethods = {
      paystack: resolveAuctionPaymentMethodAccess(policy, 'paystack').allowed,
      wallet: resolveAuctionPaymentMethodAccess(policy, 'wallet').allowed,
      hybrid: resolveAuctionPaymentMethodAccess(policy, 'hybrid').allowed,
    };

    const [pendingPaystackPayment] = await db
      .select({
        id: payments.id,
        paymentMethod: payments.paymentMethod,
        paymentReference: payments.paymentReference,
        createdAt: payments.createdAt,
        updatedAt: payments.updatedAt,
      })
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.vendorId, vendor.id),
          eq(payments.status, 'pending'),
          eq(payments.paymentMethod, 'paystack')
        )
      )
      .orderBy(desc(payments.createdAt))
      .limit(1);

    const retryDelayMs = 10 * 60 * 1000;
    const retryAvailableAt = pendingPaystackPayment
      ? new Date(pendingPaystackPayment.createdAt.getTime() + retryDelayMs)
      : null;
    const waitMs = retryAvailableAt
      ? Math.max(0, retryAvailableAt.getTime() - Date.now())
      : 0;

    return NextResponse.json({
      success: true,
      breakdown: {
        finalBid,
        depositAmount,
        remainingAmount,
        walletBalance: availableBalance, // Frontend expects walletBalance
        canPayWithWallet: canPayWithWalletOnly,
        walletPortion,
        paystackPortion,
        methods: paymentMethods,
        pendingPayment: pendingPaystackPayment
          ? {
              method: pendingPaystackPayment.paymentMethod,
              createdAt: pendingPaystackPayment.createdAt.toISOString(),
              retryAvailableAt: retryAvailableAt?.toISOString(),
              canRetry: waitMs <= 0,
              waitMinutes: Math.ceil(waitMs / 60000),
            }
          : null,
        repairedWinnerRecord,
        repairedAuctionStatus,
      },
      paymentOptions: {
        walletOnly: {
          available: paymentMethods.wallet && canPayWithWalletOnly,
          amount: remainingAmount,
        },
        paystackOnly: {
          available: paymentMethods.paystack,
          amount: remainingAmount,
        },
        hybrid: {
          available: paymentMethods.hybrid && availableBalance > 0 && remainingAmount > availableBalance,
          walletPortion,
          paystackPortion,
        },
      },
    });
  } catch (error) {
    console.error('Payment calculation error:', error);

    if (error instanceof PaymentReadinessError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    const message =
      error instanceof Error ? error.message : 'Failed to calculate payment. Please try again.';

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
