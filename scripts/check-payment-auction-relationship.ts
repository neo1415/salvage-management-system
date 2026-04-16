import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, payments } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkRelationships() {
  console.log('=== Checking Payment-Auction Relationships ===\n');

  // Get all sold cases
  const soldCases = await db
    .select()
    .from(salvageCases)
    .where(eq(salvageCases.status, 'sold'))
    .limit(5);

  console.log(`Found ${soldCases.length} sold cases\n`);

  for (const sCase of soldCases) {
    console.log(`\nCase: ${sCase.claimReference}`);
    console.log(`  Market Value: ₦${parseFloat(sCase.marketValue).toLocaleString()}`);

    // Find auction for this case
    const auction = await db
      .select()
      .from(auctions)
      .where(eq(auctions.caseId, sCase.id))
      .limit(1);

    if (auction.length === 0) {
      console.log('  ❌ No auction found');
      continue;
    }

    console.log(`  Auction ID: ${auction[0].id}`);
    console.log(`  Auction Status: ${auction[0].status}`);
    console.log(`  Current Bid: ₦${auction[0].currentBid ? parseFloat(auction[0].currentBid).toLocaleString() : '0'}`);

    // Find payments for this auction
    const auctionPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.auctionId, auction[0].id));

    console.log(`  Payments found: ${auctionPayments.length}`);
    
    for (const payment of auctionPayments) {
      console.log(`    - Payment ${payment.id.substring(0, 8)}...`);
      console.log(`      Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
      console.log(`      Status: ${payment.status}`);
      console.log(`      Method: ${payment.paymentMethod}`);
    }
  }

  console.log('\n=== Check Complete ===');
  process.exit(0);
}

checkRelationships().catch(console.error);
