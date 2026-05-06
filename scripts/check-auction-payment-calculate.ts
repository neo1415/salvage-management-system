import { db } from '../src/lib/db/drizzle';
import { auctions, auctionWinners } from '../src/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const auctionId = '94dc28fd-8a53-4fda-aebe-d2ba192efc42';

async function checkAuction() {
  console.log('🔍 Checking auction payment calculate endpoint requirements...\n');

  const auction = await db.query.auctions.findFirst({
    where: eq(auctions.id, auctionId),
  });

  if (!auction) {
    console.log('❌ Auction not found');
    process.exit(1);
  }

  console.log('📋 Auction Details:');
  console.log(`- ID: ${auction.id}`);
  console.log(`- Status: ${auction.status}`);
  console.log(`- Current Bidder: ${auction.currentBidderId}`);
  console.log(`- Current Bid: ₦${auction.currentBid}\n`);

  const winner = await db.query.auctionWinners.findFirst({
    where: and(
      eq(auctionWinners.auctionId, auctionId),
      eq(auctionWinners.status, 'active')
    ),
  });

  console.log('🏆 Winner Record:');
  if (winner) {
    console.log(`- Vendor ID: ${winner.vendorId}`);
    console.log(`- Bid Amount: ₦${winner.bidAmount}`);
    console.log(`- Deposit Amount: ₦${winner.depositAmount}`);
    console.log(`- Status: ${winner.status}\n`);
  } else {
    console.log('❌ No active winner record found\n');
  }

  // Check if status allows payment
  const validStatuses = ['awaiting_payment', 'documents_signed'];
  const statusValid = validStatuses.includes(auction.status);

  console.log('✅ Payment Calculate Endpoint Requirements:');
  console.log(`- Auction exists: ✅`);
  console.log(`- Status allows payment (${auction.status}): ${statusValid ? '✅' : '❌'}`);
  console.log(`- Active winner exists: ${winner ? '✅' : '❌'}`);

  if (!statusValid) {
    console.log(`\n⚠️  Auction status "${auction.status}" is not in valid statuses: ${validStatuses.join(', ')}`);
  }

  if (!winner) {
    console.log('\n⚠️  No active winner record - this will cause 404 error');
  }

  process.exit(0);
}

checkAuction().catch(console.error);
