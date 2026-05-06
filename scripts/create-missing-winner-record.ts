import { db } from '@/lib/db/drizzle';
import { auctionWinners } from '@/lib/db/schema/auction-deposit';
import { auctions } from '@/lib/db/schema/auctions';
import { eq } from 'drizzle-orm';

async function createWinnerRecord() {
  try {
    const auctionId = 'b81c4c7a-fd3b-4572-852b-35fbfdc14e5c';
    
    console.log(`🔧 Creating missing winner record for auction ${auctionId}...\n`);
    
    // Get auction details
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId));
    
    if (!auction) {
      console.error('❌ Auction not found');
      process.exit(1);
    }
    
    console.log('📊 Auction details:');
    console.log(`   - Status: ${auction.status}`);
    console.log(`   - Winner: ${auction.currentBidder}`);
    console.log(`   - Winning Bid: ₦${auction.currentBid ? parseFloat(auction.currentBid).toLocaleString() : 'N/A'}`);
    
    if (!auction.currentBidder || !auction.currentBid) {
      console.error('❌ No winner found for this auction');
      process.exit(1);
    }
    
    // Check if winner record already exists
    const existingWinners = await db
      .select()
      .from(auctionWinners)
      .where(eq(auctionWinners.auctionId, auctionId));
    
    if (existingWinners.length > 0) {
      console.log('\n✅ Winner record already exists:');
      console.log(JSON.stringify(existingWinners, null, 2));
      process.exit(0);
    }
    
    // Create winner record
    const bidAmount = parseFloat(auction.currentBid);
    const depositAmount = bidAmount * 0.10; // 10% deposit (adjust if needed)
    
    console.log('\n🔧 Creating winner record...');
    console.log(`   - Vendor ID: ${auction.currentBidder}`);
    console.log(`   - Bid Amount: ₦${bidAmount.toLocaleString()}`);
    console.log(`   - Deposit Amount: ₦${depositAmount.toLocaleString()}`);
    console.log(`   - Rank: 1 (winner)`);
    console.log(`   - Status: active`);
    
    const [winnerRecord] = await db
      .insert(auctionWinners)
      .values({
        auctionId,
        vendorId: auction.currentBidder,
        bidAmount: bidAmount.toFixed(2),
        depositAmount: depositAmount.toFixed(2),
        rank: 1,
        status: 'active',
      })
      .returning();
    
    console.log('\n✅ Winner record created successfully!');
    console.log(`   - Record ID: ${winnerRecord.id}`);
    console.log(`   - Auction ID: ${winnerRecord.auctionId}`);
    console.log(`   - Vendor ID: ${winnerRecord.vendorId}`);
    console.log(`   - Bid Amount: ₦${parseFloat(winnerRecord.bidAmount).toLocaleString()}`);
    console.log(`   - Deposit Amount: ₦${parseFloat(winnerRecord.depositAmount).toLocaleString()}`);
    console.log(`   - Rank: ${winnerRecord.rank}`);
    console.log(`   - Status: ${winnerRecord.status}`);
    
    console.log('\n🎯 Now try accessing the payment calculation endpoint again!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

createWinnerRecord();
