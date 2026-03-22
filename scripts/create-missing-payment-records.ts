/**
 * Migration Script: Create Missing Payment Records
 * 
 * This script creates payment records for all closed auctions that don't have them.
 * This handles the case where auctions were closed before the payment record creation
 * logic was added to the closure service.
 * 
 * Run with: npx tsx scripts/create-missing-payment-records.ts
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { eq, and, notInArray } from 'drizzle-orm';

async function createMissingPaymentRecords() {
  console.log('🔄 Starting migration: Create missing payment records...\n');

  try {
    // Step 1: Find all closed auctions
    console.log('📋 Step 1: Finding all closed auctions...');
    const closedAuctions = await db
      .select()
      .from(auctions)
      .where(eq(auctions.status, 'closed'));

    console.log(`✅ Found ${closedAuctions.length} closed auctions\n`);

    // Step 2: Find auctions without payment records
    console.log('💰 Step 2: Checking which auctions have payment records...');
    const existingPayments = await db
      .select({ auctionId: payments.auctionId })
      .from(payments);

    const auctionIdsWithPayments = new Set(existingPayments.map(p => p.auctionId));
    const auctionsWithoutPayments = closedAuctions.filter(
      auction => !auctionIdsWithPayments.has(auction.id)
    );

    console.log(`✅ Found ${auctionsWithoutPayments.length} closed auctions WITHOUT payment records\n`);

    if (auctionsWithoutPayments.length === 0) {
      console.log('✅ All closed auctions already have payment records. Nothing to do.');
      return;
    }

    // Step 3: Create payment records for auctions without them
    console.log('📝 Step 3: Creating missing payment records...\n');
    
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const auction of auctionsWithoutPayments) {
      try {
        // Skip auctions without winning bids
        if (!auction.currentBid || !auction.currentBidder) {
          console.log(`⏭️  Skipping auction ${auction.id} (no winning bid)`);
          skipped++;
          continue;
        }

        // Calculate payment deadline (24 hours from auction end time)
        const paymentDeadline = new Date(auction.endTime);
        paymentDeadline.setHours(paymentDeadline.getHours() + 24);

        // Generate unique payment reference
        const reference = `PAY_${auction.id.substring(0, 8)}_${Date.now()}`;

        // Create payment record
        const [payment] = await db
          .insert(payments)
          .values({
            auctionId: auction.id,
            vendorId: auction.currentBidder,
            amount: auction.currentBid.toString(),
            paymentMethod: 'escrow_wallet',
            escrowStatus: 'frozen',
            paymentReference: reference,
            status: 'pending',
            paymentDeadline,
            autoVerified: false,
          })
          .returning();

        console.log(`✅ Created payment record for auction ${auction.id}`);
        console.log(`   - Payment ID: ${payment.id}`);
        console.log(`   - Vendor ID: ${auction.currentBidder}`);
        console.log(`   - Amount: ₦${parseFloat(auction.currentBid).toLocaleString()}`);
        console.log(`   - Payment Method: escrow_wallet`);
        console.log(`   - Escrow Status: frozen`);
        console.log('');

        created++;
      } catch (error) {
        console.error(`❌ Failed to create payment record for auction ${auction.id}:`, error);
        failed++;
      }
    }

    // Step 4: Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   - Total closed auctions: ${closedAuctions.length}`);
    console.log(`   - Auctions without payments: ${auctionsWithoutPayments.length}`);
    console.log(`   - Payment records created: ${created}`);
    console.log(`   - Auctions skipped (no bid): ${skipped}`);
    console.log(`   - Failed: ${failed}`);
    console.log('');

    if (created > 0) {
      console.log('✅ Migration completed successfully!');
      console.log('');
      console.log('📝 Next Steps:');
      console.log('   1. Vendors can now visit auction details or documents page');
      console.log('   2. System will detect all documents are signed');
      console.log('   3. Payment will be processed automatically');
      console.log('   4. Pickup code will be sent to vendor');
    } else {
      console.log('ℹ️  No payment records were created.');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

createMissingPaymentRecords()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
