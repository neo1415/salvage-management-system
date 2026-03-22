/**
 * Create missing payment records for sold auctions
 * 
 * This script identifies sold auctions without payment records and creates them
 */

import { db } from '@/lib/db/drizzle';
import { auctions, salvageCases, payments, vendors } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function createMissingPaymentRecords() {
  console.log('🔧 Creating missing payment records for sold auctions...\n');

  // Get all sold cases with their auctions
  const soldAuctions = await db
    .select({
      auctionId: auctions.id,
      caseId: auctions.caseId,
      currentBid: auctions.currentBid,
      currentBidder: auctions.currentBidder,
      endTime: auctions.endTime,
      claimReference: salvageCases.claimReference,
    })
    .from(auctions)
    .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
    .where(eq(salvageCases.status, 'sold'));

  console.log(`Found ${soldAuctions.length} sold auctions\n`);

  let created = 0;
  let skipped = 0;

  for (const auction of soldAuctions) {
    // Check if payment record already exists
    const existingPayment = await db
      .select()
      .from(payments)
      .where(eq(payments.auctionId, auction.auctionId))
      .limit(1);

    if (existingPayment.length > 0) {
      console.log(`✓ Auction ${auction.auctionId.slice(0, 8)}... already has payment record`);
      skipped++;
      continue;
    }

    if (!auction.currentBidder) {
      console.log(`⚠️  Auction ${auction.auctionId.slice(0, 8)}... has no winner, skipping`);
      skipped++;
      continue;
    }

    // Calculate payment deadline (7 days from auction end)
    const paymentDeadline = new Date(auction.endTime);
    paymentDeadline.setDate(paymentDeadline.getDate() + 7);

    // Create payment record
    try {
      await db.insert(payments).values({
        auctionId: auction.auctionId,
        vendorId: auction.currentBidder,
        amount: auction.currentBid,
        status: 'pending', // Set as pending since we don't know if they paid
        paymentMethod: 'bank_transfer', // Default to bank transfer
        paymentDeadline: paymentDeadline,
        createdAt: auction.endTime, // Use auction end time as creation time
      });

      console.log(`✅ Created payment record for auction ${auction.auctionId.slice(0, 8)}...`);
      console.log(`   Amount: ₦${auction.currentBid}`);
      console.log(`   Deadline: ${paymentDeadline.toISOString()}`);
      console.log('');
      created++;
    } catch (error) {
      console.error(`❌ Failed to create payment for auction ${auction.auctionId.slice(0, 8)}...`);
      console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('');
    }
  }

  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total sold auctions: ${soldAuctions.length}`);
  console.log(`Payment records created: ${created}`);
  console.log(`Skipped (already exists or no winner): ${skipped}`);
  console.log('='.repeat(60));

  if (created > 0) {
    console.log('\n✅ SUCCESS: Missing payment records have been created!');
    console.log('The finance dashboard should now show the correct data.');
    console.log('\nNext steps:');
    console.log('1. Clear the finance dashboard cache');
    console.log('2. Refresh the finance dashboard');
    console.log('3. Verify the payment records appear correctly');
  }
}

createMissingPaymentRecords()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
