/**
 * Test Documents Page Navigation
 * 
 * This script helps diagnose the documents page navigation issue
 * by checking if documents exist for a specific auction.
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { auctionDocuments } from '@/lib/db/schema/auction-deposit';
import { payments } from '@/lib/db/schema/payments';
import { eq, and, or } from 'drizzle-orm';

async function testDocumentsNavigation() {
  console.log('🔍 Testing Documents Page Navigation...\n');

  try {
    // Find a recent closed auction with a winner
    const recentAuctions = await db
      .select({
        id: auctions.id,
        status: auctions.status,
        currentBidder: auctions.currentBidder,
        endTime: auctions.endTime,
      })
      .from(auctions)
      .where(
        and(
          or(
            eq(auctions.status, 'closed'),
            eq(auctions.status, 'awaiting_payment')
          )
        )
      )
      .orderBy(auctions.endTime)
      .limit(5);

    console.log(`Found ${recentAuctions.length} recent closed/awaiting_payment auctions\n`);

    for (const auction of recentAuctions) {
      console.log(`\n📋 Auction: ${auction.id}`);
      console.log(`   Status: ${auction.status}`);
      console.log(`   Winner: ${auction.currentBidder || 'None'}`);
      console.log(`   End Time: ${auction.endTime}`);

      // Check for documents
      const auctionDocs = await db
        .select()
        .from(auctionDocuments)
        .where(eq(auctionDocuments.auctionId, auction.id));

      console.log(`   Documents: ${auctionDocs.length}`);
      
      if (auctionDocs.length > 0) {
        auctionDocs.forEach(doc => {
          console.log(`     - ${doc.type}: ${doc.status}`);
        });
      }

      // Check for payment
      const auctionPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.auctionId, auction.id));

      console.log(`   Payments: ${auctionPayments.length}`);
      
      if (auctionPayments.length > 0) {
        auctionPayments.forEach(payment => {
          console.log(`     - ${payment.paymentMethod}: ${payment.status} (₦${payment.amount})`);
        });
      }
    }

    // Test the won-auctions API endpoint logic
    console.log('\n\n🔍 Testing Won Auctions API Logic...\n');
    
    const wonAuctions = await db
      .select({
        id: auctions.id,
        status: auctions.status,
        currentBidder: auctions.currentBidder,
      })
      .from(auctions)
      .where(
        and(
          or(
            eq(auctions.status, 'closed'),
            eq(auctions.status, 'awaiting_payment')
          )
        )
      )
      .limit(10);

    console.log(`Found ${wonAuctions.length} auctions with status 'closed' or 'awaiting_payment'`);
    
    const auctionsWithWinners = wonAuctions.filter(a => a.currentBidder !== null);
    console.log(`${auctionsWithWinners.length} have winners\n`);

    // Show sample auction for testing
    if (auctionsWithWinners.length > 0) {
      const sample = auctionsWithWinners[0];
      console.log('📌 Sample Auction for Testing:');
      console.log(`   Auction ID: ${sample.id}`);
      console.log(`   Winner ID: ${sample.currentBidder}`);
      console.log(`   Status: ${sample.status}`);
      console.log(`\n   Test URL: /vendor/documents#auction-${sample.id}`);
    }

    console.log('\n✅ Diagnostic complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

testDocumentsNavigation()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
