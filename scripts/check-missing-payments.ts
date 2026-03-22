/**
 * Check for sold auctions without payment records
 */

import { db } from '@/lib/db/drizzle';
import { auctions, salvageCases, payments } from '@/lib/db/schema';
import { eq, sql, isNull } from 'drizzle-orm';

async function checkMissingPayments() {
  console.log('🔍 Checking for sold auctions without payment records...\n');

  // Get all sold cases
  const soldCases = await db
    .select({
      caseId: salvageCases.id,
      claimReference: salvageCases.claimReference,
      status: salvageCases.status,
    })
    .from(salvageCases)
    .where(eq(salvageCases.status, 'sold'));

  console.log(`Found ${soldCases.length} sold cases\n`);

  // Get all auctions for sold cases
  const auctionsForSoldCases = await db
    .select({
      auctionId: auctions.id,
      caseId: auctions.caseId,
      status: auctions.status,
      currentBid: auctions.currentBid,
      currentBidder: auctions.currentBidder,
    })
    .from(auctions)
    .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
    .where(eq(salvageCases.status, 'sold'));

  console.log(`Found ${auctionsForSoldCases.length} auctions for sold cases\n`);

  // Check which auctions have payments
  for (const auction of auctionsForSoldCases) {
    const paymentRecords = await db
      .select()
      .from(payments)
      .where(eq(payments.auctionId, auction.auctionId));

    console.log(`Auction ${auction.auctionId.slice(0, 8)}... (Case: ${auction.caseId.slice(0, 8)}...)`);
    console.log(`  Status: ${auction.status}`);
    console.log(`  Current Bid: ₦${auction.currentBid}`);
    console.log(`  Has Payment: ${paymentRecords.length > 0 ? 'YES' : 'NO'}`);
    if (paymentRecords.length > 0) {
      console.log(`  Payment Status: ${paymentRecords[0].status}`);
    }
    console.log('');
  }

  // Summary
  const auctionsWithPayments = await Promise.all(
    auctionsForSoldCases.map(async (auction) => {
      const paymentRecords = await db
        .select()
        .from(payments)
        .where(eq(payments.auctionId, auction.auctionId));
      return paymentRecords.length > 0;
    })
  );

  const withPayment = auctionsWithPayments.filter(Boolean).length;
  const withoutPayment = auctionsWithPayments.length - withPayment;

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total sold cases: ${soldCases.length}`);
  console.log(`Total auctions for sold cases: ${auctionsForSoldCases.length}`);
  console.log(`Auctions WITH payment records: ${withPayment}`);
  console.log(`Auctions WITHOUT payment records: ${withoutPayment}`);
  console.log('='.repeat(60));

  if (withoutPayment > 0) {
    console.log('\n⚠️  WARNING: Some sold auctions are missing payment records!');
    console.log('This explains why the finance dashboard shows 0 payments.');
  }
}

checkMissingPayments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
