import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctionEarlyCloseRequests } from '@/lib/db/schema/auction-early-close';
import {
  getActiveManagingDirectors,
  notifyManagingDirectorsOfEarlyClose,
} from '@/features/auctions/services/early-close-approval.service';
import { AuditActionType, AuditEntityType, getDeviceTypeFromUserAgent, getIpAddress, logAction } from '@/lib/utils/audit-logger';

const requestSchema = z.object({
  reason: z.string().trim().min(20, 'Give a clear reason of at least 20 characters').max(2000),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'salvage_manager') {
    return NextResponse.json({ error: 'Only salvage managers can request early closure' }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'A reason is required' }, { status: 400 });
  }

  const { id: auctionId } = await params;
  const [auction] = await db.select({
    id: auctions.id,
    status: auctions.status,
    currentBid: auctions.currentBid,
    currentBidder: auctions.currentBidder,
    endTime: auctions.endTime,
    claimReference: salvageCases.claimReference,
  }).from(auctions).innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
    .where(eq(auctions.id, auctionId)).limit(1);

  if (!auction) return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
  if (!['active', 'extended'].includes(auction.status)) {
    return NextResponse.json({ error: 'Only an active auction can be submitted for early closure' }, { status: 409 });
  }
  if (!auction.currentBid || !auction.currentBidder) {
    return NextResponse.json({ error: 'An auction without bids cannot be closed early' }, { status: 409 });
  }

  const managingDirectors = await getActiveManagingDirectors();
  if (managingDirectors.length === 0) {
    return NextResponse.json({ error: 'No active Managing Director is available to review this request' }, { status: 409 });
  }

  try {
    const [created] = await db.insert(auctionEarlyCloseRequests).values({
      auctionId,
      requestedBy: session.user.id,
      reason: parsed.data.reason,
    }).returning();

    const userAgent = request.headers.get('user-agent') || 'unknown';
    await logAction({
      userId: session.user.id,
      actionType: AuditActionType.AUCTION_EARLY_CLOSE_REQUESTED,
      entityType: AuditEntityType.AUCTION,
      entityId: auctionId,
      ipAddress: getIpAddress(request.headers),
      userAgent,
      deviceType: getDeviceTypeFromUserAgent(userAgent),
      beforeState: { status: auction.status, endTime: auction.endTime },
      afterState: { requestId: created.id, status: created.status, reason: parsed.data.reason },
    });

    void notifyManagingDirectorsOfEarlyClose({
      recipients: managingDirectors,
      requestId: created.id,
      auctionId,
      claimReference: auction.claimReference,
      requesterName: session.user.name || 'A salvage manager',
      reason: parsed.data.reason,
    }).catch((error) => console.error('[Early Close] Failed to deliver approval notifications', error));

    return NextResponse.json({ success: true, request: created, message: 'Approval request sent to the Managing Director.' }, { status: 202 });
  } catch (error) {
    const databaseError = error as { code?: string; cause?: { code?: string } };
    if ((databaseError.code ?? databaseError.cause?.code) === '23505') {
      return NextResponse.json({ error: 'An early closure request is already awaiting a decision' }, { status: 409 });
    }
    console.error('[Early Close] Failed to create request', error);
    return NextResponse.json({ error: 'Unable to submit the early closure request' }, { status: 500 });
  }
}
