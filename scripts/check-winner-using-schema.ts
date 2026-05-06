import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { auctionWinners } from '@/lib/db/schema/auction-deposit';
import { eq } from 'drizzle-orm';

async function checkWinnerRecord() {
  try {
    const auctionId = 'b81c4c7a-fd3b-4572-852b-35fbfdc14e5c';
    
    console.log(`🔍 Checking winner record for auction ${auctionId}...\n`);
    
    // Check auction_winners table
    const winners = await db
      .select()
      .from(auctionWinners)
      .where(eq(auctionWinners.auctionId, auctionId));
    
    console.log(`📊 Winner records found: ${winners.length}`);
    if (winners.length > 0) {
      console.log(JSON.stringify(winners, null, 2));
    } else {
      console.log('❌ NO WINNER RECORDS FOUND');
    }
    
    // Check auction status
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId));
    
    console.log('\n📊 Auction status:');
    console.log(`   - Status: ${auction?.status}`);
    console.log(`   - Current Bidder: ${auction?.currentBidder}`);
    console.log(`   - Current Bid: ₦${auction?.currentBid ? parseFloat(auction.currentBid).toLocaleString() : 'N/A'}`);
    
    // Check payment record
    const paymentRecords = await db
      .select()
      .from(payments)
      .where(eq(payments.auctionId, auctionId));
    
    console.log('\n💰 Payment records found:', paymentRecords.length);
    if (paymentRecords.length > 0) {
      paymentRecords.forEach(p => {
        console.log(`   - ID: ${p.id}`);
        console.log(`   - Status: ${p.status}`);
        console.log(`   - Amount: ₦${parseFloat(p.amount).toLocaleString()}`);
        console.log(`   - Vendor: ${p.vendorId}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkWinnerRecord();
