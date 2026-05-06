/**
 * Fix Missing Winner Record
 * Creates the missing winner record for auction b81c4c7a-fd3b-4572-852b-35fbfdc14e5c
 */

import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { auctions, auctionWinners, bids } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

const AUCTION_ID = 'b81c4c7a-fd3b-4572-852b-35fbfdc14e5c';

async function fixMissingWinnerRecord() {
  console.log('🔧 Fixing missing winner record...\n');

  // 1. Get auction details
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
  console.log(`   - Winner ID: ${auction.currentBidder || 'null'}`);
  console.log('');

  if (!auction.currentBidder || !auction.currentBid) {
    console.log('❌ No winner found for this auction');
    return;
  }

  // 2. Get the winning bid details
  const winningBid = await db.query.bids.findFirst({
    where: eq(bids.auctionId, AUCTION_ID),
    orderBy: [desc(bids.amount)],
  });

  if (!winningBid) {
    console.log('❌ No bids found for this auction');
    return;
  }

  console.log('✅ Winning bid found:');
  console.log(`   - Vendor ID: ${winningBid.vendorId}`);
  console.log(`   - Bid Amount: ₦${parseFloat(winningBid.amount).toLocaleString()}`);
  console.log(`   - Deposit Amount: ₦${parseFloat(winningBid.depositAmount).toLocaleString()}`);
  console.log('');

  // 3. Check if winner record already exists
  const existingWinner = await db.query.auctionWinners.findFirst({
    where: eq(auctionWinners.auctionId, AUCTION_ID),
  });

  if (existingWinner) {
    console.log('✅ Winner record already exists:');
    console.log(`   - ID: ${existingWinner.id}`);
    console.log(`   - Vendor ID: ${existingWinner.vendorId}`);
    console.log(`   - Status: ${existingWinner.status}`);
    console.log(`   - Rank: ${existingWinner.rank}`);
    console.log('');
    console.log('✅ No fix needed - winner record exists');
    return;
  }

  // 4. Create the missing winner record
  console.log('🔧 Creating missing winner record...');
  
  const [newWinner] = await db
    .insert(auctionWinners)
    .values({
      auctionId: AUCTION_ID,
      vendorId: winningBid.vendorId,
      bidAmount: winningBid.amount,
      depositAmount: winningBid.depositAmount,
      rank: 1,
      status: 'active',
    })
    .returning();

  console.log('✅ Winner record created:');
  console.log(`   - ID: ${newWinner.id}`);
  console.log(`   - Vendor ID: ${newWinner.vendorId}`);
  console.log(`   - Bid Amount: ₦${parseFloat(newWinner.bidAmount).toLocaleString()}`);
  console.log(`   - Deposit Amount: ₦${parseFloat(newWinner.depositAmount).toLocaleString()}`);
  console.log(`   - Rank: ${newWinner.rank}`);
  console.log(`   - Status: ${newWinner.status}`);
  console.log('');

  console.log('✅ Fix complete! The payment calculation API should now work.');
  console.log('');
  console.log('📋 Next steps:');
  console.log('   1. Refresh the auction page in your browser');
  console.log('   2. The "Failed to load payment information" error should be gone');
  console.log('   3. You should see the payment options');
}

fixMissingWinnerRecord()
  .then(() => {
    console.log('\n✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
