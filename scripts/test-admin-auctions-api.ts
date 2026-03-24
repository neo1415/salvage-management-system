/**
 * Test Admin Auctions API Response
 * 
 * Simulates what the frontend receives
 */

import { db } from '@/lib/db/drizzle';
import { auctions, salvageCases, vendors, users, payments } from '@/lib/db/schema';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq, desc, and, inArray } from 'drizzle-orm';

async function testAdminAuctionsAPI() {
  console.log('🔍 Testing Admin Auctions API...\n');

  try {
    const statusParam = 'closed';

    // Fetch closed auctions with all related data (EXACT API QUERY)
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

    console.log(`📊 Query returned ${closedAuctions.length} rows\n`);

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

    // Batch fetch all documents
    const allDocuments = auctionIds.length > 0
      ? await db
          .select()
          .from(releaseForms)
          .where(inArray(releaseForms.auctionId, auctionIds))
          .orderBy(desc(releaseForms.createdAt))
      : [];

    // Create a map of documents by auction ID for fast lookup
    const documentsMap = new Map<string, typeof allDocuments>();
    for (const doc of allDocuments) {
      const existing = documentsMap.get(doc.auctionId) || [];
      existing.push(doc);
      documentsMap.set(doc.auctionId, existing);
    }

    // Build auction details without additional queries
    const auctionsWithDetails = closedAuctions.map((row) => {
      const { auction, case: caseData, vendor, vendorUser, payment } = row;

      // Get documents from map (no query needed)
      const documents = documentsMap.get(auction.id) || [];

      // Check if notification was sent by looking at audit logs
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
    });

    console.log(`✅ Built ${auctionsWithDetails.length} auction details\n`);

    // Check for the missing auctions
    const targetClaims = ['STA-3832', 'PHI-2728', 'TRA-7382', 'CLM-1774276174225'];
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Checking for target auctions in results:\n');

    for (const claim of targetClaims) {
      const found = auctionsWithDetails.find(a => a.case.claimReference === claim);
      if (found) {
        console.log(`✅ ${claim}:`);
        console.log(`   Vendor: ${found.vendor?.businessName || 'NO VENDOR'}`);
        console.log(`   Payment: ${found.payment?.status || 'NO PAYMENT'}`);
        console.log(`   Documents: ${found.documents.length}`);
        console.log(`   Notification Sent: ${found.notificationSent}`);
      } else {
        console.log(`❌ ${claim}: NOT FOUND`);
      }
      console.log('');
    }

    // Show auctions WITH winners
    const withWinners = auctionsWithDetails.filter(a => a.vendor !== null);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Auctions with winners: ${withWinners.length} / ${auctionsWithDetails.length}\n`);

    console.log('First 10 auctions with winners:');
    for (const auction of withWinners.slice(0, 10)) {
      console.log(`  - ${auction.case.claimReference}: ₦${auction.currentBid ? parseFloat(auction.currentBid).toLocaleString() : '0'} (${auction.vendor?.businessName})`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

testAdminAuctionsAPI()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
