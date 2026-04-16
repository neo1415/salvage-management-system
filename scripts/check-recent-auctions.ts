import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { depositEvents } from '@/lib/db/schema/auction-deposit';
import { eq, desc } from 'drizzle-orm';

async function checkRecentAuctions() {
  // Get 5 most recent auctions
  const recentAuctions = await db
    .select()
    .from(auctions)
    .orderBy(desc(auctions.createdAt))
    .limit(5);

  for (const auction of recentAuctions) {
    console.log('\n' + '='.repeat(60));
    console.log(`Auction: ${auction.id.substring(0, 8)}...`);
    console.log(`Full ID: ${auction.id}`);
    console.log('='.repeat(60));
    console.log(`Status: ${auction.status}`);
    console.log(`Winner: ${auction.currentBidder?.substring(0, 8) || 'None'}...`);
    console.log(`Current Bid: ₦${auction.currentBid ? parseFloat(auction.currentBid).toLocaleString() : '0'}`);
    console.log(`Created: ${auction.createdAt.toLocaleString()}`);
    
    // Check payments
    const paymentRecords = await db
      .select()
      .from(payments)
      .where(eq(payments.auctionId, auction.id))
      .orderBy(desc(payments.createdAt));
    
    console.log(`\nPayments: ${paymentRecords.length}`);
    paymentRecords.forEach(p => {
      console.log(`  - ${p.status} | ${p.paymentMethod} | ₦${parseFloat(p.amount).toLocaleString()}`);
      if (p.paymentReference) console.log(`    Ref: ${p.paymentReference.substring(0, 30)}...`);
    });
    
    // Check deposit events
    const events = await db
      .select()
      .from(depositEvents)
      .where(eq(depositEvents.auctionId, auction.id))
      .orderBy(desc(depositEvents.createdAt));
    
    console.log(`\nDeposit Events: ${events.length}`);
    events.forEach(e => {
      console.log(`  - ${e.eventType} | ₦${parseFloat(e.amount).toLocaleString()}`);
      console.log(`    ${e.description}`);
      if (e.frozenBefore) {
        console.log(`    Frozen: ₦${parseFloat(e.frozenBefore).toLocaleString()} → ₦${parseFloat(e.frozenAfter).toLocaleString()}`);
      }
    });
  }
}

checkRecentAuctions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
