/**
 * Find Missing Auctions in Auction Management
 * 
 * Investigates why recent auctions with verified payments
 * aren't showing up in the auction management page
 */

import { db } from '@/lib/db/drizzle';
import { auctions, salvageCases, vendors, users, payments } from '@/lib/db/schema';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { eq, desc } from 'drizzle-orm';

async function findMissingAuctions() {
  console.log('🔍 Investigating missing auctions...\n');

  try {
    // Find payments for STA-3832 and PHI-2728
    const targetReferences = ['PAY_e5239150_1774375232997', 'PAY_5a14f878_1774367122767'];
    
    console.log('Looking for payments with references:');
    console.log(`  - ${targetReferences[0]} (STA-3832, ₦300,000)`);
    console.log(`  - ${targetReferences[1]} (PHI-2728, ₦90,000)`);
    console.log('');

    // Get all payments
    const allPayments = await db
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt))
      .limit(20);

    console.log(`📊 Found ${allPayments.length} recent payments\n`);

    // Find the specific payments
    const targetPayments = allPayments.filter(p => 
      p.paymentReference && targetReferences.includes(p.paymentReference)
    );

    if (targetPayments.length === 0) {
      console.log('❌ Could not find the target payments!');
      console.log('');
      console.log('Recent payment references:');
      for (const p of allPayments.slice(0, 5)) {
        console.log(`  - ${p.paymentReference} (${p.status})`);
      }
      return;
    }

    console.log(`✅ Found ${targetPayments.length} target payment(s)\n`);

    // For each payment, get the auction details
    for (const payment of targetPayments) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Payment Reference: ${payment.paymentReference}`);
      console.log(`Payment Status: ${payment.status}`);
      console.log(`Payment Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
      console.log(`Auction ID: ${payment.auctionId}`);
      console.log('');

      // Get auction details
      const [auction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, payment.auctionId))
        .limit(1);

      if (!auction) {
        console.log('❌ PROBLEM: Auction not found in database!');
        console.log('');
        continue;
      }

      console.log(`Auction Status: ${auction.status}`);
      console.log(`Auction End Time: ${auction.endTime}`);
      console.log(`Current Bid: ₦${auction.currentBid ? parseFloat(auction.currentBid).toLocaleString() : '0'}`);
      console.log(`Current Bidder: ${auction.currentBidder || 'None'}`);
      console.log('');

      // Get case details
      const [caseData] = await db
        .select()
        .from(salvageCases)
        .where(eq(salvageCases.id, auction.caseId))
        .limit(1);

      if (caseData) {
        console.log(`Claim Reference: ${caseData.claimReference}`);
        console.log(`Asset Type: ${caseData.assetType}`);
        console.log('');
      }

      // Get vendor details
      if (auction.currentBidder) {
        const [vendor] = await db
          .select()
          .from(vendors)
          .where(eq(vendors.id, auction.currentBidder))
          .limit(1);

        if (vendor) {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, vendor.userId))
            .limit(1);

          if (user) {
            console.log(`Winner: ${user.fullName} (${vendor.businessName})`);
            console.log(`Winner Email: ${user.email}`);
            console.log('');
          }
        }
      }

      // Get documents
      const documents = await db
        .select()
        .from(releaseForms)
        .where(eq(releaseForms.auctionId, auction.id));

      console.log(`Documents: ${documents.length} generated`);
      if (documents.length > 0) {
        for (const doc of documents) {
          console.log(`  - ${doc.documentType} (${doc.status})`);
        }
      }
      console.log('');

      // Diagnose the issue
      console.log('🔍 DIAGNOSIS:');
      if (auction.status !== 'closed') {
        console.log(`  ❌ ISSUE: Auction status is "${auction.status}" instead of "closed"`);
        console.log(`     The auction management page only shows auctions with status="closed"`);
      } else {
        console.log(`  ✅ Auction status is "closed" (correct)`);
      }

      if (!auction.currentBidder) {
        console.log(`  ❌ ISSUE: No current bidder set on auction`);
      } else {
        console.log(`  ✅ Current bidder is set (correct)`);
      }

      if (!auction.currentBid || parseFloat(auction.currentBid) === 0) {
        console.log(`  ❌ ISSUE: Current bid is ₦0 or null`);
      } else {
        console.log(`  ✅ Current bid is set (correct)`);
      }

      console.log('');
    }

    // Also check if there are any other recent closed auctions with winners
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Checking all recent closed auctions with winners...\n');

    const recentClosedWithWinners = await db
      .select({
        auction: auctions,
        case: salvageCases,
        payment: payments,
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .leftJoin(payments, eq(payments.auctionId, auctions.id))
      .where(eq(auctions.status, 'closed'))
      .orderBy(desc(auctions.endTime))
      .limit(10);

    const withWinners = recentClosedWithWinners.filter(r => r.auction.currentBidder);
    
    console.log(`Found ${withWinners.length} closed auctions with winners:\n`);
    for (const row of withWinners) {
      console.log(`  - ${row.case.claimReference}: ₦${row.auction.currentBid ? parseFloat(row.auction.currentBid).toLocaleString() : '0'} (${row.payment?.status || 'no payment'})`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the investigation
findMissingAuctions()
  .then(() => {
    console.log('\n✅ Investigation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Investigation failed:', error);
    process.exit(1);
  });
