import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function checkWinnerRecord() {
  try {
    const auctionId = 'b81c4c7a-fd3b-4572-852b-35fbfdc14e5c';
    
    console.log(`🔍 Checking winner record for auction ${auctionId}...\n`);
    
    // Check auction_winners table directly
    const winnerResult = await db.execute(sql`
      SELECT * FROM auction_winners 
      WHERE auction_id = ${auctionId}
    `);
    
    console.log('Winner records found:', winnerResult.rowCount);
    console.log('Winner data:', JSON.stringify(winnerResult.rows, null, 2));
    
    // Check auction status
    const auctionResult = await db.execute(sql`
      SELECT id, status, current_bidder, current_bid 
      FROM auctions 
      WHERE id = ${auctionId}
    `);
    
    console.log('\n📊 Auction status:');
    console.log(JSON.stringify(auctionResult.rows, null, 2));
    
    // Check payment record
    const paymentResult = await db.execute(sql`
      SELECT id, status, amount, vendor_id, auction_id
      FROM payments 
      WHERE auction_id = ${auctionId}
    `);
    
    console.log('\n💰 Payment records:');
    console.log(JSON.stringify(paymentResult.rows, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkWinnerRecord();
