/**
 * Check Auction Winner Record
 * Diagnose why payment calculation returns 404
 */

import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { auctions, auctionWinners, vendors } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

const AUCTION_ID = 'b81c4c7a-fd3b-4572-852b-35fbfdc14e5c';

async function checkWinnerRecord() {
  console.log('🔍 Checking auction winner record...\n');

  // 1. Check auction
  const auction = await db.query.auctions.findFirst({
    where: eq(auctions.id, AUCTION_ID),
  });

  if (!auction) {
    console.log('❌ Auction not found');
    return;
  }

  console.log('✅ Auction found:');
  console.log(`   - ID: ${auction.id}`);
  console.log(`   - Status: ${auction.status}`);
  console.log(`   - Current Bid: ₦${auction.currentBid?.toLocaleString()}`);
  console.log(`   - Winner ID: ${auction.winnerId || 'null'}`);
  console.log('');

  // 2. Check auction_winners table
  const winners = await db.query.auctionWinners.findMany({
    where: eq(auctionWinners.auctionId, AUCTION_ID),
  });

  console.log(`📊 Auction Winners Records: ${winners.length}`);
  if (winners.length === 0) {
    console.log('❌ NO WINNER RECORDS FOUND - This is the problem!');
    console.log('');
    console.log('💡 The auction was closed but no winner record was created in auction_winners table');
    console.log('   This is why the payment calculation API returns 404');
  } else {
    winners.forEach((winner, index) => {
      console.log(`\n   Winner ${index + 1}:`);
      console.log(`   - ID: ${winner.id}`);
      console.log(`   - Vendor ID: ${winner.vendorId}`);
      console.log(`   - Bid Amount: ₦${parseFloat(winner.bidAmount).toLocaleString()}`);
      console.log(`   - Deposit Amount: ₦${parseFloat(winner.depositAmount).toLocaleString()}`);
      console.log(`   - Status: ${winner.status}`);
      console.log(`   - Created: ${winner.createdAt}`);
    });
  }

  // 3. Check if vendor exists
  if (auction.winnerId) {
    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.id, auction.winnerId),
    });

    console.log('\n👤 Winner Vendor:');
    if (vendor) {
      console.log(`   - ID: ${vendor.id}`);
      console.log(`   - User ID: ${vendor.userId}`);
      console.log(`   - Business Name: ${vendor.businessName || 'N/A'}`);
    } else {
      console.log('   ❌ Vendor not found');
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSIS:');
  console.log('='.repeat(80));
  
  if (winners.length === 0) {
    console.log('❌ PROBLEM: No winner record in auction_winners table');
    console.log('');
    console.log('ROOT CAUSE:');
    console.log('The auction closure process created a payment record but did NOT create');
    console.log('a winner record in the auction_winners table.');
    console.log('');
    console.log('SOLUTION:');
    console.log('The auction closure service needs to create a winner record when closing');
    console.log('an auction with a winner.');
  } else {
    const activeWinner = winners.find(w => w.status === 'active');
    if (!activeWinner) {
      console.log('❌ PROBLEM: Winner record exists but status is not "active"');
      console.log(`   Current status: ${winners[0].status}`);
    } else {
      console.log('✅ Winner record exists and is active');
      console.log('   The payment calculation API should work');
    }
  }
}

checkWinnerRecord()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
