import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { depositEvents } from '@/lib/db/schema/auction-deposit';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, desc } from 'drizzle-orm';

const auctionIds = process.argv.slice(2);

if (auctionIds.length === 0) {
  console.log('Usage: npx tsx scripts/check-auction-payment-state.ts <auction-id-1> [auction-id-2] ...');
  process.exit(1);
}

async function checkAuction(auctionId: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`Auction: ${auctionId}`);
  console.log('='.repeat(60));
  
  // Check auction
  const [auction] = await db.select().from(auctions).where(eq(auctions.id, auctionId)).limit(1);
  if (!auction) {
    console.log('❌ Auction not found');
    return;
  }
  console.log(`Status: ${auction.status}`);
  console.log(`Winner: ${auction.currentBidder || 'None'}`);
  console.log(`Current Bid: ₦${auction.currentBid || '0'}`);
  
  // Check payments
  const paymentRecords = await db.select().from(payments).where(eq(payments.auctionId, auctionId)).orderBy(desc(payments.createdAt));
  console.log(`\nPayments: ${paymentRecords.length}`);
  paymentRecords.forEach(p => {
    console.log(`  - ${p.id.substring(0, 8)}... | ${p.status} | ${p.paymentMethod} | ₦${parseFloat(p.amount).toLocaleString()} | ${p.paymentReference || 'No ref'}`);
  });
  
  // Check deposit events
  const events = await db.select().from(depositEvents).where(eq(depositEvents.auctionId, auctionId)).orderBy(desc(depositEvents.createdAt));
  console.log(`\nDeposit Events: ${events.length}`);
  events.forEach(e => {
    console.log(`  - ${e.eventType} | ₦${parseFloat(e.amount).toLocaleString()} | ${e.description}`);
    if (e.balanceBefore) console.log(`    Balance: ₦${parseFloat(e.balanceBefore).toLocaleString()} → ₦${parseFloat(e.balanceAfter).toLocaleString()}`);
    if (e.frozenBefore) console.log(`    Frozen: ₦${parseFloat(e.frozenBefore).toLocaleString()} → ₦${parseFloat(e.frozenAfter).toLocaleString()}`);
  });
}

(async () => {
  for (const auctionId of auctionIds) {
    await checkAuction(auctionId);
  }
  process.exit(0);
})();
