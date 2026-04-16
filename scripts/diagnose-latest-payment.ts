import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { vendorWallets, depositEvents } from '@/lib/db/schema/auction-deposit';
import { eq, desc } from 'drizzle-orm';

async function diagnoseLatestPayment() {
  try {
    console.log('🔍 Diagnosing latest payment...\n');

    // Get the most recent payment
    const latestPayments = await db
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt))
      .limit(5);

    console.log(`📋 Latest 5 payments:`);
    for (const payment of latestPayments) {
      console.log(`\n  Payment ID: ${payment.id}`);
      console.log(`  Reference: ${payment.paymentReference || 'N/A'}`);
      console.log(`  Auction ID: ${payment.auctionId}`);
      console.log(`  Amount: ₦${Number(payment.amount).toLocaleString()}`);
      console.log(`  Status: ${payment.status}`);
      console.log(`  Method: ${payment.paymentMethod}`);
      console.log(`  Created: ${payment.createdAt}`);
      console.log(`  Updated: ${payment.updatedAt}`);
    }

    // Get the auction for the latest payment
    const latestPayment = latestPayments[0];
    if (latestPayment) {
      console.log(`\n\n🎯 Checking auction ${latestPayment.auctionId}...`);
      
      const [auction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, latestPayment.auctionId))
        .limit(1);

      if (auction) {
        console.log(`  Status: ${auction.status}`);
        console.log(`  Winner: ${auction.currentBidder}`);
        console.log(`  Winning Bid: ₦${Number(auction.currentBid || 0).toLocaleString()}`);
      }

      // Check vendor wallet
      if (auction?.currentBidder) {
        console.log(`\n\n💰 Checking vendor wallet ${auction.currentBidder}...`);
        
        const [wallet] = await db
          .select()
          .from(vendorWallets)
          .where(eq(vendorWallets.vendorId, auction.currentBidder))
          .limit(1);

        if (wallet) {
          console.log(`  Balance: ₦${Number(wallet.balance).toLocaleString()}`);
          console.log(`  Frozen: ₦${Number(wallet.frozenAmount).toLocaleString()}`);
          console.log(`  Available: ₦${(Number(wallet.balance) - Number(wallet.frozenAmount)).toLocaleString()}`);
        }

        // Check recent deposit events
        console.log(`\n\n📊 Recent deposit events for vendor ${auction.currentBidder}:`);
        
        const events = await db
          .select()
          .from(depositEvents)
          .where(eq(depositEvents.vendorId, auction.currentBidder))
          .orderBy(desc(depositEvents.createdAt))
          .limit(10);

        for (const event of events) {
          console.log(`\n  ${event.createdAt?.toISOString()}`);
          console.log(`  Type: ${event.eventType}`);
          console.log(`  Amount: ₦${Number(event.amount).toLocaleString()}`);
          console.log(`  Auction: ${event.auctionId || 'N/A'}`);
          console.log(`  Balance: ${event.balanceBefore || 'N/A'} → ${event.balanceAfter || 'N/A'}`);
          console.log(`  Frozen: ${event.frozenBefore || 'N/A'} → ${event.frozenAfter || 'N/A'}`);
        }
      }
    }

    console.log('\n\n✅ Diagnosis complete');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

diagnoseLatestPayment();
