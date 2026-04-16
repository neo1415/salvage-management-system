/**
 * Auction Timer Extension API
 * 
 * Allows salvage managers to extend active auction end times.
 * 
 * POST /api/auctions/[id]/extend
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, createAuditLogData } from '@/lib/utils/audit-logger';

interface ExtendRequest {
  extensionMinutes: number;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is Salvage Manager
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user || user.role !== 'salvage_manager') {
      return NextResponse.json(
        { error: 'Forbidden: Only Salvage Managers can extend auctions' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: ExtendRequest = await request.json();

    // Validate extension minutes
    if (!body.extensionMinutes || body.extensionMinutes <= 0) {
      return NextResponse.json(
        { error: 'Extension minutes must be greater than 0' },
        { status: 400 }
      );
    }

    if (body.extensionMinutes > 10080) { // Max 1 week (7 days * 24 hours * 60 minutes)
      return NextResponse.json(
        { error: 'Extension cannot exceed 1 week (10080 minutes)' },
        { status: 400 }
      );
    }

    // Get auction
    const auctionId = params.id;
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 }
      );
    }

    // Validate auction is active
    if (auction.status !== 'active') {
      return NextResponse.json(
        { error: `Cannot extend auction with status: ${auction.status}. Only active auctions can be extended.` },
        { status: 400 }
      );
    }

    // Calculate new end time
    const currentEndTime = new Date(auction.endTime);
    const newEndTime = new Date(currentEndTime.getTime() + body.extensionMinutes * 60 * 1000);
    const newExtensionCount = auction.extensionCount + 1;

    // Update auction
    const [updatedAuction] = await db
      .update(auctions)
      .set({
        endTime: newEndTime,
        extensionCount: newExtensionCount,
        updatedAt: new Date(),
      })
      .where(eq(auctions.id, auctionId))
      .returning();

    // Log audit trail
    await logAction(
      createAuditLogData(
        request,
        session.user.id,
        AuditActionType.AUCTION_EXTENDED,
        AuditEntityType.AUCTION,
        auctionId,
        {
          endTime: currentEndTime.toISOString(),
          extensionCount: auction.extensionCount,
        },
        {
          endTime: newEndTime.toISOString(),
          extensionCount: newExtensionCount,
          extensionMinutes: body.extensionMinutes,
          extendedBy: session.user.id,
        }
      )
    );

    // TODO: Broadcast update via Socket.IO if available
    // This would notify all connected clients about the time extension
    try {
      const { broadcastAuctionUpdate } = await import('@/lib/socket/server');
      await broadcastAuctionUpdate(auctionId, {
        type: 'auction_extended',
        endTime: newEndTime.toISOString(),
        extensionCount: newExtensionCount,
        extensionMinutes: body.extensionMinutes,
      });
    } catch (error) {
      console.warn('Socket.IO broadcast failed (non-critical):', error);
    }

    return NextResponse.json({
      success: true,
      message: `Auction extended by ${body.extensionMinutes} minutes`,
      data: {
        auction: {
          id: updatedAuction.id,
          endTime: updatedAuction.endTime,
          extensionCount: updatedAuction.extensionCount,
        },
        extension: {
          minutes: body.extensionMinutes,
          previousEndTime: currentEndTime.toISOString(),
          newEndTime: newEndTime.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Auction extension error:', error);
    return NextResponse.json(
      {
        error: 'Failed to extend auction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
