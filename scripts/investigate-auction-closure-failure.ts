import { db } from '@/lib/db/drizzle';
import { auctions, bids, auctionWinners, depositEvents } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

const auctionId = '94dc28fd-8a53-4fda-aebe-d2ba192efc42';

async function investigate() {
  console.log('🔍 Investigating auction closure failure...\n');
  
  // 1. Check auction details
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .limit(1);
    
  console.log('📋 Auction Details:');
  console.log(`   - ID: ${auction.id}`);
  console.log(`   - Status: ${auction.status}`);
  console.log(`   - Current Bid: ₦${auction.currentBid}`);
  console.log(`   - Current Bidder: ${auction.currentBidderId || 'NONE'}`);
  console.log(`   - Created: ${auction.createdAt}`);
  console.log(`   - Updated: ${auction.updatedAt}`);
  console.log(`   - Ends At: ${auction.endsAt}`);
  console.log('');
  
  // 2. Check all bids
  const allBids = await db
    .select()
    .from(bids)
    .where(eq(bids.auctionId, auctionId))
    .orderBy(desc(bids.amount));
    
  console.log(`📊 Bids (${allBids.length} total):`);
  for (const bid of allBids) {
    console.log(`   - ₦${bid.amount} by ${bid.vendorId} (${bid.vendorUserId})`);
    console.log(`     Status: ${bid.status}, Created: ${bid.createdAt}`);
  }
  console.log('');
  
  // 3. Check winner records
  const winners = await db
    .select()
    .from(auctionWinners)
    .where(eq(auctionWinners.auctionId, auctionId));
    
  console.log(`🏆 Winner Records (${winners.length} total):`);
  if (winners.length === 0) {
    console.log('   ❌ NO WINNER RECORDS FOUND');
  } else {
    for (const winner of winners) {
      console.log(`   - Rank ${winner.rank}: ${winner.vendorId}`);
      console.log(`     Bid: ₦${winner.bidAmount}, Deposit: ₦${winner.depositAmount}`);
      console.log(`     Status: ${winner.status}`);
    }
  }
  console.log('');
  
  // 4. Check deposit events for this auction
  const events = await db
    .select()
    .from(depositEvents)
    .where(eq(depositEvents.auctionId, auctionId))
    .orderBy(desc(depositEvents.createdAt));
    
  console.log(`💰 Deposit Events (${events.length} total):`);
  for (const event of events) {
    console.log(`   - ${event.eventType}: ₦${event.amount} for ${event.vendorId}`);
    console.log(`     Reason: ${event.reason}`);
    console.log(`     Created: ${event.createdAt}`);
  }
  console.log('');
  
  // 5. Try to simulate the closure process
  console.log('🔄 Simulating closure process...\n');
  
  // Check if auction can be closed
  if (auction.status !== 'active' && auction.status !== 'extended') {
    console.log(`❌ PROBLEM: Auction status is "${auction.status}", not "active" or "extended"`);
    console.log('   The closure service checks for active/extended status');
    console.log('   If status was changed before closure ran, it would fail');
  } else {
    console.log(`✅ Auction status is "${auction.status}" - OK for closure`);
  }
  
  if (allBids.length === 0) {
    console.log('❌ PROBLEM: No bids found');
    console.log('   The closure service would close without winner');
  } else {
    console.log(`✅ Found ${allBids.length} bids - OK for closure`);
  }
  
  // Check if highest bidder exists
  const highestBid = allBids[0];
  if (highestBid) {
    console.log(`✅ Highest bidder: ${highestBid.vendorId} with ₦${highestBid.amount}`);
    
    // Check if this vendor has frozen deposits
    const freezeEvents = await db
      .select()
      .from(depositEvents)
      .where(eq(depositEvents.vendorId, highestBid.vendorId))
      .orderBy(desc(depositEvents.createdAt));
      
    console.log(`\n💰 Deposit history for winner ${highestBid.vendorId}:`);
    for (const event of freezeEvents) {
      console.log(`   - ${event.eventType}: ₦${event.amount}`);
      console.log(`     Reason: ${event.reason}`);
      console.log(`     Auction: ${event.auctionId || 'N/A'}`);
    }
  }
  
  console.log('\n📝 Summary:');
  console.log(`   - Auction Status: ${auction.status}`);
  console.log(`   - Has Bids: ${allBids.length > 0 ? 'YES' : 'NO'}`);
  console.log(`   - Winner Records: ${winners.length}`);
  console.log(`   - Deposit Events: ${events.length}`);
  
  if (winners.length === 0 && allBids.length > 0 && auction.status === 'awaiting_payment') {
    console.log('\n❌ CRITICAL ISSUE DETECTED:');
    console.log('   - Auction has bids');
    console.log('   - Auction status is "awaiting_payment"');
    console.log('   - But NO winner records exist');
    console.log('   - This means the closure transaction ROLLED BACK');
    console.log('\n🔍 Possible causes:');
    console.log('   1. Database constraint violation when inserting winner record');
    console.log('   2. Deposit unfreeze operation failed');
    console.log('   3. Watching service import/reset failed');
    console.log('   4. Case status update failed');
    console.log('   5. Transaction timeout');
  }
  
  process.exit(0);
}

investigate().catch(console.error);
