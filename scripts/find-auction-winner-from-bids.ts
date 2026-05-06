import { db } from '../src/lib/db/drizzle';
import { auctions, bids, vendors } from '../src/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

const auctionId = '94dc28fd-8a53-4fda-aebe-d2ba192efc42';

async function findWinner() {
  console.log('🔍 Finding auction winner from bids...\n');

  // Get auction
  const auction = await db.query.auctions.findFirst({
    where: eq(auctions.id, auctionId),
  });

  if (!auction) {
    console.log('❌ Auction not found');
    process.exit(1);
  }

  console.log('📋 Auction Details:');
  console.log(`- Status: ${auction.status}`);
  console.log(`- Current Bid: ₦${auction.currentBid}`);
  console.log(`- Current Bidder ID: ${auction.currentBidderId || 'NONE'}`);
  console.log(`- Ends At: ${auction.endsAt}\n`);

  // Get all bids for this auction
  const allBids = await db.query.bids.findMany({
    where: eq(bids.auctionId, auctionId),
    orderBy: [desc(bids.amount), desc(bids.createdAt)],
  });

  console.log(`📊 Found ${allBids.length} bid(s):\n`);

  if (allBids.length === 0) {
    console.log('❌ No bids found - auction should not be in awaiting_payment status');
    process.exit(1);
  }

  // Show top 5 bids
  const topBids = allBids.slice(0, 5);
  for (let i = 0; i < topBids.length; i++) {
    const bid = topBids[i];
    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.id, bid.vendorId),
    });

    console.log(`Bid ${i + 1}:`);
    console.log(`- Amount: ₦${bid.amount}`);
    console.log(`- Vendor ID: ${bid.vendorId}`);
    console.log(`- Vendor User ID: ${vendor?.userId || 'N/A'}`);
    console.log(`- Created At: ${bid.createdAt}`);
    console.log(`- Status: ${bid.status}\n`);
  }

  const winningBid = allBids[0];
  console.log('🏆 Winning Bid (Highest):');
  console.log(`- Amount: ₦${winningBid.amount}`);
  console.log(`- Vendor ID: ${winningBid.vendorId}`);
  console.log(`- Created At: ${winningBid.createdAt}\n`);

  console.log('💡 To fix this auction, run:');
  console.log(`   npx tsx scripts/create-winner-record-manual.ts ${auctionId} ${winningBid.vendorId} ${winningBid.amount}`);

  process.exit(0);
}

findWinner().catch(console.error);
