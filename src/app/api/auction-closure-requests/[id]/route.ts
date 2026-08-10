import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/drizzle';
import { auctionEarlyCloseRequests } from '@/lib/db/schema/auction-early-close';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { isManagingDirector } from '@/features/departments/department-access';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!await isManagingDirector(session.user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const requester = alias(users, 'early_close_requester');
  const reviewer = alias(users, 'early_close_reviewer');
  const [row] = await db.select({
    id: auctionEarlyCloseRequests.id,
    auctionId: auctionEarlyCloseRequests.auctionId,
    reason: auctionEarlyCloseRequests.reason,
    status: auctionEarlyCloseRequests.status,
    reviewNote: auctionEarlyCloseRequests.reviewNote,
    requestedAt: auctionEarlyCloseRequests.requestedAt,
    reviewedAt: auctionEarlyCloseRequests.reviewedAt,
    executedAt: auctionEarlyCloseRequests.executedAt,
    failureReason: auctionEarlyCloseRequests.failureReason,
    requesterId: requester.id,
    requesterName: requester.fullName,
    requesterEmail: requester.email,
    reviewerName: reviewer.fullName,
    claimReference: salvageCases.claimReference,
    assetType: salvageCases.assetType,
    auctionStatus: auctions.status,
    currentBid: auctions.currentBid,
    endTime: auctions.endTime,
  }).from(auctionEarlyCloseRequests)
    .innerJoin(auctions, eq(auctionEarlyCloseRequests.auctionId, auctions.id))
    .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
    .innerJoin(requester, eq(auctionEarlyCloseRequests.requestedBy, requester.id))
    .leftJoin(reviewer, eq(auctionEarlyCloseRequests.reviewedBy, reviewer.id))
    .where(eq(auctionEarlyCloseRequests.id, id)).limit(1);
  return row
    ? NextResponse.json({ success: true, request: row })
    : NextResponse.json({ error: 'Request not found' }, { status: 404 });
}
