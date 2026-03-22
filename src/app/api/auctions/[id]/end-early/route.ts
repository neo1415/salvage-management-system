import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auctionClosureService } from '@/features/auctions/services/closure.service';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';

/**
 * Manual Auction End API
 * POST /api/auctions/[id]/end-early
 * 
 * Allows Salvage Manager to manually end an active auction early.
 * Uses the same closure logic as automatic cron job to ensure consistency.
 * 
 * FIXED: Now calls auctionClosureService.closeAuction() to ensure:
 * - Documents are generated automatically (bill of sale, liability waiver, pickup authorization)
 * - Payment record is created
 * - Winner notifications are sent (SMS, email, push)
 * - Audit logs are created
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only salvage managers can end auctions early
    if (session.user.role !== 'salvage_manager') {
      return NextResponse.json(
        { error: 'Only salvage managers can end auctions early' },
        { status: 403 }
      );
    }

    const { id: auctionId } = await params;

    // Get auction details
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Check if auction can be ended early
    if (auction.status !== 'active' && auction.status !== 'extended') {
      return NextResponse.json(
        { error: 'Only active or extended auctions can be ended early' },
        { status: 400 }
      );
    }

    // Check if there are any bids
    if (!auction.currentBid || !auction.currentBidder) {
      return NextResponse.json(
        { error: 'Cannot end auction early without any bids' },
        { status: 400 }
      );
    }

    console.log(`🔴 Manual auction end requested by ${session.user.name} (${session.user.role})`);
    console.log(`   - Auction ID: ${auctionId}`);
    console.log(`   - Current Status: ${auction.status}`);
    console.log(`   - Current Bid: ₦${parseFloat(auction.currentBid).toLocaleString()}`);
    console.log(`   - Winner: ${auction.currentBidder}`);

    // Log the manual end request
    await logAction({
      userId: session.user.id,
      actionType: AuditActionType.AUCTION_CLOSED,
      entityType: AuditEntityType.AUCTION,
      entityId: auctionId,
      ipAddress: request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown',
      deviceType: DeviceType.DESKTOP,
      userAgent: request.headers.get('user-agent') || 'unknown',
      beforeState: {
        status: auction.status,
        endTime: auction.endTime,
      },
      afterState: {
        status: 'closed',
        endTime: new Date(),
        endedBy: session.user.name,
        endedByRole: session.user.role,
        manualEnd: true,
      },
    });

    // FIXED: Use auctionClosureService to ensure consistent behavior
    // This will:
    // 1. Update auction status to 'closed'
    // 2. Create payment record
    // 3. Generate 3 documents (bill of sale, liability waiver, pickup authorization)
    // 4. Send winner notifications (SMS, email, push)
    // 5. Create audit logs
    const result = await auctionClosureService.closeAuction(auctionId);

    if (!result.success) {
      console.error(`❌ Failed to close auction ${auctionId}:`, result.error);
      return NextResponse.json(
        { error: result.error || 'Failed to end auction' },
        { status: 500 }
      );
    }

    console.log(`✅ Auction ${auctionId} ended successfully by ${session.user.name}`);
    console.log(`   - Winner: ${result.winnerId}`);
    console.log(`   - Winning Bid: ₦${result.winningBid?.toLocaleString()}`);
    console.log(`   - Payment ID: ${result.paymentId}`);
    console.log(`   - Documents: Generated automatically`);
    console.log(`   - Notifications: Sent to winner`);

    return NextResponse.json({
      success: true,
      message: 'Auction ended successfully. Documents generated and winner notified.',
      auction: {
        id: auctionId,
        status: 'closed',
        endTime: new Date(),
        winner: {
          vendorId: result.winnerId,
          finalBid: result.winningBid,
        },
        paymentId: result.paymentId,
      },
    });

  } catch (error) {
    console.error('Error ending auction early:', error);
    return NextResponse.json(
      { error: 'Failed to end auction early' },
      { status: 500 }
    );
  }
}