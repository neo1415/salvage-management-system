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
import { vendors, auctionWinners, users, auctions, escrowWallets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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

    // Get auction details
    const auction = await db.query.auctions.findFirst({
      where: eq(auctions.id, auctionId),
    });

    if (!auction) {
      return NextResponse.json(
        { success: false, error: 'Auction not found' },
        { status: 404 }
      );
    }

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

    // Get escrow wallet for balance information
    const escrowWallet = await db.query.escrowWallets.findFirst({
      where: eq(escrowWallets.vendorId, vendor.id),
    });

    if (!escrowWallet) {
      return NextResponse.json(
        { success: false, error: 'Escrow wallet not found' },
        { status: 404 }
      );
    }

    // Calculate payment breakdown directly (no HTTP call needed)
    const finalBid = parseFloat(winner.bidAmount);
    const depositAmount = parseFloat(winner.depositAmount);
    const remainingAmount = finalBid - depositAmount;
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
    const result = await paymentService.processHybridPayment({
      auctionId,
      vendorId: vendor.id,
      finalBid,
      depositAmount,
      idempotencyKey: paymentReference,
      vendorEmail: vendorUser.email,
    });

    console.log('[Hybrid Payment] Payment processed successfully:', result);

    return NextResponse.json({
      success: true,
      walletAmount: result.walletAmount,
      paystackAmount: result.paystackAmount,
      authorization_url: result.authorizationUrl,
      access_code: result.accessCode,
      reference: result.paystackReference,
      message: `Wallet portion (₦${result.walletAmount?.toLocaleString()}) deducted. Complete payment via Paystack (₦${result.paystackAmount?.toLocaleString()}). If Paystack fails, wallet amount will be refunded automatically.`,
    });
  } catch (error) {
    console.error('Hybrid payment error:', error);
    
    // Extract meaningful error message
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Failed to process hybrid payment. Please try again.';
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        message: errorMessage
      },
      { status: 500 }
    );
  }
}
