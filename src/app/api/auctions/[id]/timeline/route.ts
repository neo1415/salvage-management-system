/**
 * Auction Timeline API Route
 * Returns complete event timeline for an auction
 * 
 * Requirements:
 * - Requirement 17.5, 17.6: Auction Timeline Display
 * 
 * SECURITY: Role-based access control
 * PERFORMANCE: Batch queries, efficient joins
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { 
  auctions, 
  bids, 
  depositEvents, 
  graceExtensions, 
  depositForfeitures,
  auctionWinners,
  releaseFormDocuments,
  vendors
} from '@/lib/db/schema';
import { eq, desc, or } from 'drizzle-orm';

interface TimelineEvent {
  id: string;
  type: 'bid' | 'deposit' | 'winner' | 'document' | 'extension' | 'forfeiture' | 'payment';
  timestamp: Date;
  description: string;
  actor?: string;
  details: any;
}

/**
 * GET /api/auctions/[id]/timeline
 * Get complete event timeline for auction
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
    const isAuthorized = authorizedRoles.includes(session.user.role || '');

    // If vendor, verify they participated in auction
    if (!isAuthorized && session.user.role === 'vendor') {
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.userId, session.user.id),
      });

      if (!vendor) {
        return NextResponse.json(
          { success: false, error: 'Vendor profile not found' },
          { status: 404 }
        );
      }

      // Check if vendor has bids in this auction
      const vendorBid = await db.query.bids.findFirst({
        where: eq(bids.auctionId, auctionId),
      });

      if (!vendorBid) {
        return NextResponse.json(
          { success: false, error: 'Forbidden - You did not participate in this auction' },
          { status: 403 }
        );
      }
    }

    // Verify auction exists
    const auction = await db.query.auctions.findFirst({
      where: eq(auctions.id, auctionId),
    });

    if (!auction) {
      return NextResponse.json(
        { success: false, error: 'Auction not found' },
        { status: 404 }
      );
    }

    const timeline: TimelineEvent[] = [];

    // 1. Get all bids
    const auctionBids = await db
      .select({
        bid: bids,
        vendor: vendors,
      })
      .from(bids)
      .leftJoin(vendors, eq(bids.vendorId, vendors.id))
      .where(eq(bids.auctionId, auctionId))
      .orderBy(desc(bids.createdAt));

    auctionBids.forEach(({ bid, vendor }) => {
      timeline.push({
        id: bid.id,
        type: 'bid',
        timestamp: bid.createdAt,
        description: `Bid placed: ₦${parseFloat(bid.amount).toLocaleString()}`,
        actor: vendor?.businessName || 'Unknown Vendor',
        details: {
          amount: parseFloat(bid.amount),
          vendorId: bid.vendorId,
          otpVerified: bid.otpVerified,
        },
      });
    });

    // 2. Get deposit events
    const deposits = await db
      .select({
        event: depositEvents,
        vendor: vendors,
      })
      .from(depositEvents)
      .leftJoin(vendors, eq(depositEvents.vendorId, vendors.id))
      .where(eq(depositEvents.auctionId, auctionId))
      .orderBy(desc(depositEvents.createdAt));

    deposits.forEach(({ event, vendor }) => {
      const eventTypeMap: Record<string, string> = {
        freeze: 'Deposit frozen',
        unfreeze: 'Deposit unfrozen',
        forfeit: 'Deposit forfeited',
      };

      timeline.push({
        id: event.id,
        type: 'deposit',
        timestamp: event.createdAt,
        description: `${eventTypeMap[event.eventType] || event.eventType}: ₦${parseFloat(event.amount).toLocaleString()}`,
        actor: vendor?.businessName || 'Unknown Vendor',
        details: {
          eventType: event.eventType,
          amount: parseFloat(event.amount),
          balanceBefore: parseFloat(event.balanceBefore),
          balanceAfter: parseFloat(event.balanceAfter),
          frozenBefore: parseFloat(event.frozenBefore),
          frozenAfter: parseFloat(event.frozenAfter),
        },
      });
    });

    // 3. Get winner records
    const winners = await db
      .select({
        winner: auctionWinners,
        vendor: vendors,
      })
      .from(auctionWinners)
      .leftJoin(vendors, eq(auctionWinners.vendorId, vendors.id))
      .where(eq(auctionWinners.auctionId, auctionId))
      .orderBy(desc(auctionWinners.createdAt));

    winners.forEach(({ winner, vendor }) => {
      timeline.push({
        id: winner.id,
        type: 'winner',
        timestamp: winner.createdAt,
        description: `Winner declared (Rank ${winner.rank}): ₦${parseFloat(winner.bidAmount).toLocaleString()}`,
        actor: vendor?.businessName || 'Unknown Vendor',
        details: {
          rank: winner.rank,
          bidAmount: parseFloat(winner.bidAmount),
          depositAmount: parseFloat(winner.depositAmount),
          status: winner.status,
        },
      });

      if (winner.documentsSignedAt) {
        timeline.push({
          id: `${winner.id}-docs`,
          type: 'document',
          timestamp: winner.documentsSignedAt,
          description: 'Documents signed',
          actor: vendor?.businessName || 'Unknown Vendor',
          details: {
            paymentDeadline: winner.paymentDeadline,
          },
        });
      }
    });

    // 4. Get grace extensions
    const extensions = await db
      .select()
      .from(graceExtensions)
      .where(eq(graceExtensions.auctionId, auctionId))
      .orderBy(desc(graceExtensions.createdAt));

    extensions.forEach((extension) => {
      timeline.push({
        id: extension.id,
        type: 'extension',
        timestamp: extension.createdAt,
        description: `Grace extension granted: ${extension.reason}`,
        actor: 'Finance Officer',
        details: {
          reason: extension.reason,
          previousDeadline: extension.previousDeadline,
          newDeadline: extension.newDeadline,
          grantedBy: extension.grantedBy,
        },
      });
    });

    // 5. Get forfeitures
    const forfeitures = await db
      .select({
        forfeiture: depositForfeitures,
        vendor: vendors,
      })
      .from(depositForfeitures)
      .leftJoin(vendors, eq(depositForfeitures.vendorId, vendors.id))
      .where(eq(depositForfeitures.auctionId, auctionId))
      .orderBy(desc(depositForfeitures.createdAt));

    forfeitures.forEach(({ forfeiture, vendor }) => {
      timeline.push({
        id: forfeiture.id,
        type: 'forfeiture',
        timestamp: forfeiture.createdAt,
        description: `Deposit forfeited: ₦${parseFloat(forfeiture.forfeitedAmount).toLocaleString()}`,
        actor: vendor?.businessName || 'Unknown Vendor',
        details: {
          depositAmount: parseFloat(forfeiture.depositAmount),
          forfeitedAmount: parseFloat(forfeiture.forfeitedAmount),
          transferred: forfeiture.transferred,
          transferredAt: forfeiture.transferredAt,
        },
      });

      if (forfeiture.transferred && forfeiture.transferredAt) {
        timeline.push({
          id: `${forfeiture.id}-transfer`,
          type: 'payment',
          timestamp: forfeiture.transferredAt,
          description: `Forfeited funds transferred to platform`,
          actor: 'Finance Officer',
          details: {
            amount: parseFloat(forfeiture.forfeitedAmount),
            transferredBy: forfeiture.transferredBy,
          },
        });
      }
    });

    // Sort timeline by timestamp (most recent first)
    timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return NextResponse.json({
      success: true,
      auction: {
        id: auction.id,
        assetName: auction.assetName,
        status: auction.status,
        currentBid: parseFloat(auction.currentBid || '0'),
        createdAt: auction.createdAt,
        updatedAt: auction.updatedAt,
      },
      timeline,
      summary: {
        totalEvents: timeline.length,
        bids: timeline.filter(e => e.type === 'bid').length,
        deposits: timeline.filter(e => e.type === 'deposit').length,
        winners: timeline.filter(e => e.type === 'winner').length,
        documents: timeline.filter(e => e.type === 'document').length,
        extensions: timeline.filter(e => e.type === 'extension').length,
        forfeitures: timeline.filter(e => e.type === 'forfeiture').length,
        payments: timeline.filter(e => e.type === 'payment').length,
      },
    });
  } catch (error) {
    console.error('Get timeline error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve auction timeline. Please try again.'
      },
      { status: 500 }
    );
  }
}
