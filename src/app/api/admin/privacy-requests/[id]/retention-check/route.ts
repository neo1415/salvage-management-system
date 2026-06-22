import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import {
  auditLogs,
  auctionWinners,
  auctions,
  bids,
  dataRightRequests,
  depositEvents,
  payments,
  providerVerificationRecords,
  users,
  vendors,
  walletTransactions,
} from '@/lib/db/schema';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  AuditActionType,
  AuditEntityType,
  createAuditLogData,
  logAction,
} from '@/lib/utils/audit-logger';

const ALLOWED_ROLES = ['system_admin', 'salvage_manager'] as const;

async function countRows(query: Promise<Array<{ count: number }>>) {
  const [row] = await query;
  return row?.count ?? 0;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ALLOWED_ROLES.includes(session.user.role as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const [privacyRequest] = await db
      .select({
        id: dataRightRequests.id,
        type: dataRightRequests.type,
        status: dataRightRequests.status,
        userId: dataRightRequests.userId,
        userStatus: users.status,
        userRole: users.role,
      })
      .from(dataRightRequests)
      .innerJoin(users, eq(dataRightRequests.userId, users.id))
      .where(eq(dataRightRequests.id, id))
      .limit(1);

    if (!privacyRequest) {
      return NextResponse.json({ error: 'Privacy request not found' }, { status: 404 });
    }

    const [vendor] = await db
      .select({ id: vendors.id, status: vendors.status, tier: vendors.tier })
      .from(vendors)
      .where(eq(vendors.userId, privacyRequest.userId))
      .limit(1);

    const vendorId = vendor?.id;

    const [
      pendingPaymentCount,
      activeWinnerCount,
      pendingDocumentCount,
      activeAuctionCount,
      bidCount,
      depositEventCount,
      walletTransactionCount,
      providerVerificationCount,
      auditLogCount,
    ] = await Promise.all([
      vendorId
        ? countRows(
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(payments)
              .where(and(eq(payments.vendorId, vendorId), inArray(payments.status, ['pending', 'overdue'])))
          )
        : 0,
      vendorId
        ? countRows(
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(auctionWinners)
              .where(and(eq(auctionWinners.vendorId, vendorId), eq(auctionWinners.status, 'active')))
          )
        : 0,
      vendorId
        ? countRows(
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(releaseForms)
              .where(and(eq(releaseForms.vendorId, vendorId), eq(releaseForms.status, 'pending')))
          )
        : 0,
      vendorId
        ? countRows(
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(auctions)
              .where(
                and(
                  eq(auctions.currentBidder, vendorId),
                  inArray(auctions.status, ['scheduled', 'active', 'extended', 'awaiting_payment'])
                )
              )
          )
        : 0,
      vendorId
        ? countRows(
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(bids)
              .where(eq(bids.vendorId, vendorId))
          )
        : 0,
      vendorId
        ? countRows(
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(depositEvents)
              .where(eq(depositEvents.vendorId, vendorId))
          )
        : 0,
      vendorId
        ? countRows(
            db
              .select({ count: sql<number>`count(*)::int` })
              .from(walletTransactions)
              .where(sql`${walletTransactions.reference} ilike ${`%${vendorId}%`}`)
          )
        : 0,
      countRows(
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(providerVerificationRecords)
          .where(eq(providerVerificationRecords.userId, privacyRequest.userId))
      ),
      countRows(
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(auditLogs)
          .where(eq(auditLogs.userId, privacyRequest.userId))
      ),
    ]);

    const blockers = [
      pendingPaymentCount > 0 && {
        code: 'pending_payments',
        message: 'Open payment records must be resolved before deletion/anonymization.',
        count: pendingPaymentCount,
      },
      activeWinnerCount > 0 && {
        code: 'active_winner_records',
        message: 'Active winner or fallback-bidder records must be resolved first.',
        count: activeWinnerCount,
      },
      pendingDocumentCount > 0 && {
        code: 'pending_documents',
        message: 'Pending auction documents must be signed, voided, or expired first.',
        count: pendingDocumentCount,
      },
      activeAuctionCount > 0 && {
        code: 'active_auction_participation',
        message: 'Active, scheduled, extended, or awaiting-payment auctions block fulfilment.',
        count: activeAuctionCount,
      },
    ].filter(Boolean);

    const retentionEvidence = {
      bids: bidCount,
      depositEvents: depositEventCount,
      walletTransactions: walletTransactionCount,
      providerVerificationRecords: providerVerificationCount,
      auditLogs: auditLogCount,
    };

    const result = {
      requestId: privacyRequest.id,
      requestType: privacyRequest.type,
      requestStatus: privacyRequest.status,
      userId: privacyRequest.userId,
      userRole: privacyRequest.userRole,
      userStatus: privacyRequest.userStatus,
      vendor: vendor ?? null,
      dryRunOnly: true,
      canProceed: blockers.length === 0,
      blockers,
      retentionEvidence,
      recommendedNextAction:
        blockers.length > 0
          ? 'Resolve blockers before completing this privacy request.'
          : 'No operational blockers found. Complete legal, audit, and retention review before fulfilment.',
    };

    await logAction(
      createAuditLogData(
        request,
        session.user.id,
        AuditActionType.PRIVACY_RETENTION_REVIEWED,
        AuditEntityType.PRIVACY_REQUEST,
        id,
        undefined,
        {
          requestType: privacyRequest.type,
          canProceed: result.canProceed,
          blockers: blockers.map((blocker) => blocker && blocker.code),
          dryRunOnly: true,
        }
      )
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/admin/privacy-requests/[id]/retention-check:', error);
    return NextResponse.json({ error: 'Failed to run retention check' }, { status: 500 });
  }
}
