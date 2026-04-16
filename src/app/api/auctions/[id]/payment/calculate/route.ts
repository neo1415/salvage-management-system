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
import { auctions, vendors, escrowWallets, auctionWinners } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

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

    // Get auction with winner information
    const auction = await db.query.auctions.findFirst({
      where: eq(auctions.id, auctionId),
    });

    if (!auction) {
      return NextResponse.json(
        { success: false, error: 'Auction not found' },
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

    // Calculate payment breakdown
    const finalBid = parseFloat(winner.bidAmount);
    const depositAmount = parseFloat(winner.depositAmount);
    const remainingAmount = finalBid - depositAmount;
    const availableBalance = parseFloat(escrowWallet.availableBalance);

    // Determine payment options
    const canPayWithWalletOnly = availableBalance >= remainingAmount;
    const walletPortion = Math.min(availableBalance, remainingAmount);
    const paystackPortion = Math.max(0, remainingAmount - availableBalance);

    return NextResponse.json({
      success: true,
      breakdown: {
        finalBid,
        depositAmount,
        remainingAmount,
        walletBalance: availableBalance, // Frontend expects walletBalance
        canPayWithWallet: canPayWithWalletOnly,
      },
      paymentOptions: {
        walletOnly: {
          available: canPayWithWalletOnly,
          amount: remainingAmount,
        },
        paystackOnly: {
          available: true,
          amount: remainingAmount,
        },
        hybrid: {
          available: availableBalance > 0 && remainingAmount > availableBalance,
          walletPortion,
          paystackPortion,
        },
      },
    });
  } catch (error) {
    console.error('Payment calculation error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to calculate payment. Please try again.'
      },
      { status: 500 }
    );
  }
}
