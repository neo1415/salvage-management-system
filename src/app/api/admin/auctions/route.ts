import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { auctions, salvageCases, vendors, users, payments } from '@/lib/db/schema';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq, desc, and, inArray } from 'drizzle-orm';

/**
 * Admin Auctions API
 * 
 * GET /api/admin/auctions?status=closed
 * 
 * Returns closed auctions with winner details, document status, and notification status
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or finance
    if (session.user.role !== 'admin' && session.user.role !== 'finance_officer') {
      return NextResponse.json(
        { error: 'Forbidden - Admin or Finance access required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status') || 'closed';

    // Fetch closed auctions with all related data
    const closedAuctions = await db
      .select({
        auction: auctions,
        case: salvageCases,
        vendor: vendors,
        vendorUser: users,
        payment: payments,
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .leftJoin(vendors, eq(auctions.currentBidder, vendors.id))
      .leftJoin(users, eq(vendors.userId, users.id))
      .leftJoin(payments, eq(payments.auctionId, auctions.id))
      .where(eq(auctions.status, statusParam as 'closed'))
      .orderBy(desc(auctions.endTime));

    // Get all auction IDs for failure lookup
    const auctionIds = closedAuctions.map((row) => row.auction.id);

    // Query audit logs for notification sent events and failures
    const notificationLogs = auctionIds.length > 0
      ? await db
          .select()
          .from(auditLogs)
          .where(
            and(
              inArray(auditLogs.entityId, auctionIds),
              inArray(auditLogs.actionType, ['notification_sent', 'notification_failed', 'document_generation_failed'])
            )
          )
      : [];

    // Create maps for notification status and failures by auction ID
    const notificationStatusMap = new Map<string, { sent: boolean; failed: boolean }>();
    const failureMap = new Map<string, { notificationFailed: boolean; documentFailed: boolean }>();
    
    for (const log of notificationLogs) {
      // Track notification sent status
      if (log.actionType === 'notification_sent') {
        const existing = notificationStatusMap.get(log.entityId) || { sent: false, failed: false };
        existing.sent = true;
        notificationStatusMap.set(log.entityId, existing);
      }
      
      // Track failures
      const existingFailure = failureMap.get(log.entityId) || { notificationFailed: false, documentFailed: false };
      if (log.actionType === 'notification_failed') {
        existingFailure.notificationFailed = true;
        const notifStatus = notificationStatusMap.get(log.entityId) || { sent: false, failed: false };
        notifStatus.failed = true;
        notificationStatusMap.set(log.entityId, notifStatus);
      }
      if (log.actionType === 'document_generation_failed') {
        existingFailure.documentFailed = true;
      }
      failureMap.set(log.entityId, existingFailure);
    }

    // Fetch documents for each auction
    const auctionsWithDetails = await Promise.all(
      closedAuctions.map(async (row) => {
        const { auction, case: caseData, vendor, vendorUser, payment } = row;

        // Get documents for this auction
        const documents = vendor
          ? await db
              .select()
              .from(releaseForms)
              .where(eq(releaseForms.auctionId, auction.id))
              .orderBy(desc(releaseForms.createdAt))
          : [];

        // Check if notification was sent by looking at audit logs
        // If notification_sent event exists, it was sent successfully
        // If notification_failed event exists without notification_sent, it failed
        const notificationStatus = notificationStatusMap.get(auction.id) || { sent: false, failed: false };
        const notificationSent = notificationStatus.sent;

        // Get failure status from audit logs
        const failures = failureMap.get(auction.id) || { notificationFailed: false, documentFailed: false };

        return {
          id: auction.id,
          caseId: auction.caseId,
          status: auction.status,
          currentBid: auction.currentBid,
          currentBidder: auction.currentBidder,
          endTime: auction.endTime,
          createdAt: auction.createdAt,
          case: {
            claimReference: caseData.claimReference,
            assetType: caseData.assetType,
            assetDetails: caseData.assetDetails,
          },
          vendor: vendor && vendorUser
            ? {
                id: vendor.id,
                businessName: vendor.businessName,
                user: {
                  fullName: vendorUser.fullName,
                  email: vendorUser.email,
                  phone: vendorUser.phone,
                },
              }
            : null,
          payment: payment
            ? {
                id: payment.id,
                status: payment.status,
                amount: payment.amount,
              }
            : null,
          documents: documents.map((doc) => ({
            id: doc.id,
            documentType: doc.documentType,
            status: doc.status,
            createdAt: doc.createdAt,
          })),
          notificationSent,
          notificationFailed: failures.notificationFailed,
          documentGenerationFailed: failures.documentFailed,
        };
      })
    );

    return NextResponse.json({
      auctions: auctionsWithDetails,
      total: auctionsWithDetails.length,
    });
  } catch (error) {
    console.error('Admin auctions API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch auctions' },
      { status: 500 }
    );
  }
}
