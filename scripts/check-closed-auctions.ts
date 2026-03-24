/**
 * Diagnostic Script: Check Closed Auctions
 * 
 * Checks the database for closed auctions and their details
 * to diagnose why they're not showing up in auction management
 */

import { db } from '@/lib/db/drizzle';
import { auctions, salvageCases, vendors, users, payments } from '@/lib/db/schema';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { eq, desc } from 'drizzle-orm';

async function checkClosedAuctions() {
  console.log('🔍 Checking closed auctions in database...\n');

  try {
    // Get all auctions (not just closed)
    const allAuctions = await db
      .select()
      .from(auctions)
      .orderBy(desc(auctions.endTime));

    console.log(`📊 Total auctions in database: ${allAuctions.length}\n`);

    // Group by status
    const statusCounts: Record<string, number> = {};
    for (const auction of allAuctions) {
      statusCounts[auction.status] = (statusCounts[auction.status] || 0) + 1;
    }

    console.log('📈 Auctions by status:');
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`   - ${status}: ${count}`);
    }
    console.log('');

    // Get closed auctions with details
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
      .where(eq(auctions.status, 'closed'))
      .orderBy(desc(auctions.endTime));

    console.log(`🎯 Closed auctions with details: ${closedAuctions.length}\n`);

    if (closedAuctions.length === 0) {
      console.log('⚠️  No closed auctions found!');
      console.log('');
      console.log('Possible reasons:');
      console.log('1. Auctions haven\'t been closed yet (status is still "active")');
      console.log('2. Auction closure cron job hasn\'t run');
      console.log('3. Auctions ended but closeAuction() failed');
      console.log('');
      
      // Check for active auctions that should be closed
      const now = new Date();
      const expiredActive = allAuctions.filter(
        a => a.status === 'active' && new Date(a.endTime) < now
      );
      
      if (expiredActive.length > 0) {
        console.log(`⏰ Found ${expiredActive.length} active auction(s) that should be closed:\n`);
        for (const auction of expiredActive) {
          console.log(`   Auction ID: ${auction.id}`);
          console.log(`   End Time: ${auction.endTime}`);
          console.log(`   Current Bid: ₦${auction.currentBid ? parseFloat(auction.currentBid).toLocaleString() : '0'}`);
          console.log(`   Current Bidder: ${auction.currentBidder || 'None'}`);
          console.log('');
        }
        
        console.log('💡 Solution: Run the auction closure cron job:');
        console.log('   curl -X POST http://localhost:3000/api/cron/close-auctions \\');
        console.log('     -H "Authorization: Bearer YOUR_CRON_SECRET"');
      }
    } else {
      console.log('✅ Closed auctions found! Details:\n');
      
      for (const row of closedAuctions) {
        const { auction, case: caseData, vendor, vendorUser, payment } = row;
        
        // Get documents
        const documents = await db
          .select()
          .from(releaseForms)
          .where(eq(releaseForms.auctionId, auction.id));
        
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Auction ID: ${auction.id}`);
        console.log(`Claim Reference: ${caseData.claimReference}`);
        console.log(`Status: ${auction.status}`);
        console.log(`End Time: ${auction.endTime}`);
        console.log(`Winning Bid: ₦${auction.currentBid ? parseFloat(auction.currentBid).toLocaleString() : '0'}`);
        
        if (vendor && vendorUser) {
          console.log(`Winner: ${vendorUser.fullName} (${vendor.businessName})`);
          console.log(`Winner Email: ${vendorUser.email}`);
          console.log(`Winner Phone: ${vendorUser.phone}`);
        } else {
          console.log(`Winner: No winner`);
        }
        
        if (payment) {
          console.log(`Payment Status: ${payment.status}`);
          console.log(`Payment Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
        } else {
          console.log(`Payment: No payment record`);
        }
        
        console.log(`Documents: ${documents.length} generated`);
        if (documents.length > 0) {
          for (const doc of documents) {
            console.log(`   - ${doc.documentType} (${doc.status})`);
          }
        }
        console.log('');
      }
    }

  } catch (error) {
    console.error('❌ Error checking closed auctions:', error);
    throw error;
  }
}

// Run the check
checkClosedAuctions()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
