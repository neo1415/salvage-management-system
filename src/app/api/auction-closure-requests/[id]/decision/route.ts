import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/drizzle';
import { redis } from '@/lib/redis/client';
import { auctionEarlyCloseRequests } from '@/lib/db/schema/auction-early-close';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { users } from '@/lib/db/schema/users';
import { isManagingDirector } from '@/features/departments/department-access';
import { auctionClosureService } from '@/features/auctions/services/closure.service';
import { notifyEarlyCloseRequester } from '@/features/auctions/services/early-close-approval.service';
import { AuditActionType, AuditEntityType, getDeviceTypeFromUserAgent, getIpAddress, logAction } from '@/lib/utils/audit-logger';

const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reviewNote: z.string().trim().max(2000).optional(),
}).superRefine((value, context) => {
  if (value.decision === 'reject' && (!value.reviewNote || value.reviewNote.length < 10)) {
    context.addIssue({ code: 'custom', path: ['reviewNote'], message: 'Give a rejection reason of at least 10 characters' });
  }
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!await isManagingDirector(session.user.id)) return NextResponse.json({ error: 'Only the Managing Director can decide this request' }, { status: 403 });
  const parsed = decisionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid decision' }, { status: 400 });
  const { id } = await params;
  const now = new Date();

  const [claimed] = await db.update(auctionEarlyCloseRequests).set({
    status: 'processing', reviewedBy: session.user.id, reviewNote: parsed.data.reviewNote || null,
    reviewedAt: now, updatedAt: now,
  }).where(and(eq(auctionEarlyCloseRequests.id, id), eq(auctionEarlyCloseRequests.status, 'pending'))).returning();
  if (!claimed) return NextResponse.json({ error: 'This request has already been decided or is being processed' }, { status: 409 });

  const [context] = await db.select({
    auctionStatus: auctions.status,
    claimReference: salvageCases.claimReference,
    requesterId: users.id,
    requesterEmail: users.email,
    requesterName: users.fullName,
  }).from(auctionEarlyCloseRequests)
    .innerJoin(auctions, eq(auctionEarlyCloseRequests.auctionId, auctions.id))
    .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
    .innerJoin(users, eq(auctionEarlyCloseRequests.requestedBy, users.id))
    .where(eq(auctionEarlyCloseRequests.id, id)).limit(1);

  if (!context) {
    await db.update(auctionEarlyCloseRequests).set({ status: 'failed', failureReason: 'Request context unavailable', updatedAt: new Date() }).where(eq(auctionEarlyCloseRequests.id, id));
    return NextResponse.json({ error: 'Request context is unavailable' }, { status: 500 });
  }

  if (parsed.data.decision === 'reject') {
    await db.update(auctionEarlyCloseRequests).set({ status: 'rejected', updatedAt: new Date() }).where(eq(auctionEarlyCloseRequests.id, id));
    await finishDecisionAuditAndNotify(request, session.user.id, claimed.auctionId, id, context, false, parsed.data.reviewNote);
    return NextResponse.json({ success: true, status: 'rejected' });
  }

  if (!['active', 'extended'].includes(context.auctionStatus)) {
    await db.update(auctionEarlyCloseRequests).set({ status: 'failed', failureReason: 'Auction is no longer active', updatedAt: new Date() }).where(eq(auctionEarlyCloseRequests.id, id));
    return NextResponse.json({ error: 'The auction is no longer active and cannot be closed by this approval' }, { status: 409 });
  }

  const lockKey = `auction:close:${claimed.auctionId}`;
  const lockValue = `md:${session.user.id}:${Date.now()}`;
  let lockAcquired: string | null;
  try {
    lockAcquired = await redis.set(lockKey, lockValue, { nx: true, ex: 90 });
  } catch (error) {
    console.error('[Early Close] Closure lock is unavailable', error);
    await db.update(auctionEarlyCloseRequests).set({
      status: 'pending', reviewedBy: null, reviewedAt: null, updatedAt: new Date(),
    }).where(eq(auctionEarlyCloseRequests.id, id));
    return NextResponse.json({ error: 'The approval service is temporarily unavailable. Try again shortly.' }, { status: 503 });
  }
  if (!lockAcquired) {
    await db.update(auctionEarlyCloseRequests).set({ status: 'pending', reviewedBy: null, reviewedAt: null, updatedAt: new Date() }).where(eq(auctionEarlyCloseRequests.id, id));
    return NextResponse.json({ error: 'Auction closure is already in progress. Try the decision again shortly.' }, { status: 409 });
  }

  try {
    const result = await auctionClosureService.closeAuction(claimed.auctionId);
    if (!result.success) throw new Error(result.error || 'Auction closure failed');
    await db.update(auctionEarlyCloseRequests).set({ status: 'approved', executedAt: new Date(), updatedAt: new Date() }).where(eq(auctionEarlyCloseRequests.id, id));
    await finishDecisionAuditAndNotify(request, session.user.id, claimed.auctionId, id, context, true, parsed.data.reviewNote);
    return NextResponse.json({ success: true, status: 'approved', auctionStatus: 'closed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Auction closure failed';
    const [latestAuction] = await db.select({ status: auctions.status })
      .from(auctions)
      .where(eq(auctions.id, claimed.auctionId))
      .limit(1)
      .catch(() => []);

    // The closure service is authoritative. If it completed before a later
    // persistence call failed, reconcile the approval instead of reporting a
    // false failed state or inviting a duplicate closure attempt.
    if (latestAuction?.status === 'closed') {
      await db.update(auctionEarlyCloseRequests).set({
        status: 'approved', executedAt: new Date(), failureReason: null, updatedAt: new Date(),
      }).where(eq(auctionEarlyCloseRequests.id, id));
      await finishDecisionAuditAndNotify(request, session.user.id, claimed.auctionId, id, context, true, parsed.data.reviewNote);
      return NextResponse.json({ success: true, status: 'approved', auctionStatus: 'closed', reconciled: true });
    }

    await db.update(auctionEarlyCloseRequests).set({ status: 'failed', failureReason: message, updatedAt: new Date() }).where(eq(auctionEarlyCloseRequests.id, id));
    return NextResponse.json({ error: 'Approval was recorded, but the auction could not be closed. Operations staff must review it.' }, { status: 500 });
  } finally {
    const currentLock = await redis.get<string>(lockKey).catch(() => null);
    if (currentLock === lockValue) await redis.del(lockKey).catch(() => undefined);
  }
}

async function finishDecisionAuditAndNotify(
  request: NextRequest,
  reviewerId: string,
  auctionId: string,
  requestId: string,
  context: { claimReference: string; requesterId: string; requesterEmail: string; requesterName: string },
  approved: boolean,
  reviewNote?: string
) {
  const userAgent = request.headers.get('user-agent') || 'unknown';
  try {
    await logAction({
      userId: reviewerId,
      actionType: AuditActionType.AUCTION_EARLY_CLOSE_REVIEWED,
      entityType: AuditEntityType.AUCTION,
      entityId: auctionId,
      ipAddress: getIpAddress(request.headers), userAgent, deviceType: getDeviceTypeFromUserAgent(userAgent),
      beforeState: { requestId, status: 'pending' },
      afterState: { requestId, status: approved ? 'approved' : 'rejected', reviewNote: reviewNote || null },
    });
  } catch (error) {
    console.error('[Early Close] Failed to write decision audit event', error);
  }
  void notifyEarlyCloseRequester({
    requester: { id: context.requesterId, email: context.requesterEmail, fullName: context.requesterName },
    auctionId, claimReference: context.claimReference, approved, reviewNote,
  }).catch((error) => console.error('[Early Close] Failed to notify requester', error));
}
