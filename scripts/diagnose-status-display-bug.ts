import { db } from '@/lib/db';
import { auctions, bids, payments, walletTransactions, vendors } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const auctionId = process.argv[2];

if (!auctionId) {
  console.error('Usage: npx tsx scripts/diagnose-status-display-bug.ts <auction-id>');
  process.exit(1);
}

async function diagnose() {
  console.log(`\n🔍 Diagnosing auction: ${auctionId}\n`);

  // 1. Get auction details
  const auction = await db.query.auctions.findFirst({
    where: eq(auctions.id, auctionId),
  });

  if (!auction) {
    console.error('❌ Auction not found');
    return;
  }

  console.log('📊 AUCTION STATE:');
  console.log(`- Status: ${auction.status}`);
  console.log(`- Current Bidder: ${auction.currentBidderId}`);
  console.log(`- Current Bid: ₦${auction.currentBid?.toLocaleString()}`);
  console.log(`- End Time: ${auction.endTime}`);

  // 2. Get all bids
  const allBids = await db.query.bids.findMany({
    where: eq(bids.auctionId, auctionId),
    orderBy: [desc(bids.amount)],
  });

  console.log(`\n💰 BIDS (${allBids.length} total):`);
  allBids.forEach((bid, i) => {
    console.log(`${i + 1}. ₦${bid.amount.toLocaleString()} by ${bid.bidderId} at ${bid.createdAt}`);
  });

  console.log(`\n⚠️  CRITICAL ISSUE DETECTED:`);
  console.log(`- Auction currentBidderId: ${auction.currentBidderId || 'NULL'}`);
  console.log(`- Highest bid bidderId: ${allBids[0]?.bidderId || 'NULL'}`);
  if (!auction.currentBidderId && allBids.length > 0) {
    console.log(`\n❌ BUG FOUND: Auction lost track of winning bidder!`);
    console.log(`   The auction should have currentBidderId = ${allBids[0].bidderId}`);
  }

  // 3. Get payments
  const auctionPayments = await db.query.payments.findMany({
    where: eq(payments.auctionId, auctionId),
    orderBy: [desc(payments.createdAt)],
  });

  console.log(`\n💳 PAYMENTS (${auctionPayments.length} total):`);
  auctionPayments.forEach((payment, i) => {
    console.log(`${i + 1}. ${payment.type} - ${payment.status} - ₦${payment.amount.toLocaleString()}`);
    console.log(`   ID: ${payment.id}`);
    console.log(`   User: ${payment.userId}`);
    console.log(`   Created: ${payment.createdAt}`);
    console.log(`   Updated: ${payment.updatedAt}`);
  });

  // 4. Get wallet transactions for current bidder
  if (auction.currentBidderId) {
    const transactions = await db.query.walletTransactions.findMany({
      where: and(
        eq(walletTransactions.userId, auction.currentBidderId),
        eq(walletTransactions.auctionId, auctionId)
      ),
      orderBy: [desc(walletTransactions.createdAt)],
    });

    console.log(`\n💼 WALLET TRANSACTIONS for current bidder (${transactions.length} total):`);
    transactions.forEach((tx, i) => {
      console.log(`${i + 1}. ${tx.type} - ₦${tx.amount.toLocaleString()}`);
      console.log(`   Description: ${tx.description}`);
      console.log(`   Created: ${tx.createdAt}`);
    });

    // 5. Get vendor wallet state
    const vendor = await db.query.vendors.findFirst({
      where: eq(vendors.userId, auction.currentBidderId),
    });

    if (vendor) {
      console.log(`\n👤 VENDOR WALLET STATE:`);
      console.log(`- Balance: ₦${vendor.walletBalance?.toLocaleString() || 0}`);
      console.log(`- Frozen: ₦${vendor.frozenFunds?.toLocaleString() || 0}`);
      console.log(`- Available: ₦${((vendor.walletBalance || 0) - (vendor.frozenFunds || 0)).toLocaleString()}`);
    }
  }

  console.log('\n✅ Diagnosis complete\n');
}

diagnose().catch(console.error);
