import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { auctionWinners } from '@/lib/db/schema/auction-deposit';
import { eq, desc } from 'drizzle-orm';

async function diagnose() {
  try {
    console.log('🔍 Diagnosing early-end vs natural-end auction behavior...\n');
    
    // Get the early-end auction (the one that failed)
    const earlyEndAuctionId = 'b81c4c7a-fd3b-4572-852b-35fbfdc14e5c';
    
    const [earlyEndAuction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, earlyEndAuctionId));
    
    console.log('📊 Early-End Auction (the one that failed):');
    console.log(`   - ID: ${earlyEndAuctionId}`);
    console.log(`   - Status: ${earlyEndAuction?.status}`);
    console.log(`   - End Time: ${earlyEndAuction?.endTime}`);
    console.log(`   - Created At: ${earlyEndAuction?.createdAt}`);
    
    // Get bids for early-end auction
    const earlyEndBids = await db
      .select()
      .from(bids)
      .where(eq(bids.auctionId, earlyEndAuctionId))
      .orderBy(desc(bids.amount));
    
    console.log(`   - Total Bids: ${earlyEndBids.length}`);
    if (earlyEndBids.length > 0) {
      console.log(`   - Highest Bid: ₦${parseFloat(earlyEndBids[0].amount).toLocaleString()}`);
      console.log(`   - Is Legacy: ${earlyEndBids[0].isLegacy}`);
    }
    
    // Get winner record for early-end auction
    const earlyEndWinners = await db
      .select()
      .from(auctionWinners)
      .where(eq(auctionWinners.auctionId, earlyEndAuctionId));
    
    console.log(`   - Winner Records: ${earlyEndWinners.length}`);
    
    // Now find a recent auction that ended naturally and worked
    console.log('\n📊 Finding recent auctions that ended naturally...\n');
    
    const recentAuctions = await db
      .select()
      .from(auctions)
      .where(eq(auctions.status, 'closed'))
      .orderBy(desc(auctions.updatedAt))
      .limit(5);
    
    for (const auction of recentAuctions) {
      const auctionBids = await db
        .select()
        .from(bids)
        .where(eq(bids.auctionId, auction.id))
        .orderBy(desc(bids.amount));
      
      const winners = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, auction.id));
      
      console.log(`Auction ${auction.id}:`);
      console.log(`   - Status: ${auction.status}`);
      console.log(`   - End Time: ${auction.endTime}`);
      console.log(`   - Updated At: ${auction.updatedAt}`);
      console.log(`   - Total Bids: ${auctionBids.length}`);
      if (auctionBids.length > 0) {
        console.log(`   - Is Legacy: ${auctionBids[0].isLegacy}`);
      }
      console.log(`   - Winner Records: ${winners.length}`);
      console.log('');
    }
    
    console.log('\n💡 Analysis:');
    console.log('   Compare the "Is Legacy" field between early-end and natural-end auctions.');
    console.log('   If early-end auction has isLegacy=true but natural-end has isLegacy=false,');
    console.log('   that could explain why winner records are created differently.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

diagnose();
