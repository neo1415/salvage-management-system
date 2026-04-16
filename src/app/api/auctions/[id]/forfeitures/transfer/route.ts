/**
 * Forfeiture Transfer API Route
 * Allows Finance Officers to transfer forfeited funds to platform account
 * 
 * Requirements:
 * - Requirement 12: Forfeited Funds Transfer by Finance Officer
 * 
 * SECURITY: Role-based access control (Finance Officer only)
 * FINANCIAL: Atomic transfer, wallet invariant verification, audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { transferService } from '@/features/auction-deposit/services/transfer.service';
import { db } from '@/lib/db/drizzle';
import { auctions, depositForfeitures } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * POST /api/auctions/[id]/forfeitures/transfer
 * Transfer forfeited funds to platform account
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

    // RBAC: Verify user is Finance Officer
    const authorizedRoles = ['finance_officer', 'manager', 'admin'];
    if (!authorizedRoles.includes(session.user.role || '')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden - Finance Officer role required' 
        },
        { status: 403 }
      );
    }

    // Verify auction exists and has forfeited deposit
    const auction = await db.query.auctions.findFirst({
      where: eq(auctions.id, auctionId),
    });

    if (!auction) {
      return NextResponse.json(
        { success: false, error: 'Auction not found' },
        { status: 404 }
      );
    }

    // Verify auction status is deposit_forfeited
    if (auction.status !== 'deposit_forfeited') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot transfer funds. Auction status is ${auction.status}, expected deposit_forfeited`,
        },
        { status: 400 }
      );
    }

    // Get forfeiture record
    const forfeiture = await db.query.depositForfeitures.findFirst({
      where: and(
        eq(depositForfeitures.auctionId, auctionId),
        eq(depositForfeitures.transferred, false)
      ),
    });

    if (!forfeiture) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No pending forfeiture found for this auction' 
        },
        { status: 404 }
      );
    }

    // Transfer forfeited funds
    const result = await transferService.transferForfeitedFunds(
      auctionId,
      session.user.id
    );

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transfer: result.transfer,
      message: `Successfully transferred ₦${result.transfer?.amount.toLocaleString()} to platform account`,
    });
  } catch (error) {
    console.error('Forfeiture transfer error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to transfer forfeited funds. Please try again.'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auctions/[id]/forfeitures/transfer
 * Get forfeiture transfer status
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

    // RBAC: Verify user is authorized
    const authorizedRoles = ['finance_officer', 'manager', 'admin'];
    if (!authorizedRoles.includes(session.user.role || '')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Forbidden' 
        },
        { status: 403 }
      );
    }

    // Get forfeiture record
    const forfeiture = await db.query.depositForfeitures.findFirst({
      where: eq(depositForfeitures.auctionId, auctionId),
    });

    if (!forfeiture) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No forfeiture found for this auction' 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      forfeiture: {
        id: forfeiture.id,
        auctionId: forfeiture.auctionId,
        vendorId: forfeiture.vendorId,
        depositAmount: parseFloat(forfeiture.depositAmount),
        forfeitedAmount: parseFloat(forfeiture.forfeitedAmount),
        transferred: forfeiture.transferred,
        transferredAt: forfeiture.transferredAt,
        transferredBy: forfeiture.transferredBy,
        createdAt: forfeiture.createdAt,
      },
    });
  } catch (error) {
    console.error('Get forfeiture error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve forfeiture information. Please try again.'
      },
      { status: 500 }
    );
  }
}
