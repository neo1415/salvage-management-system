/**
 * Cleanup Script: Duplicate Auction Payments
 * 
 * This script finds and cancels duplicate pending payments for auctions
 * where a verified payment already exists.
 * 
 * Usage:
 *   npx tsx scripts/cleanup-duplicate-auction-payments.ts [--dry-run]
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { eq, and, ne, isNotNull } from 'drizzle-orm';

async function cleanupDuplicatePayments(dryRun: boolean = false) {
  console.log(`\n🧹 Cleaning up duplicate auction payments${dryRun ? ' (DRY RUN)' : ''}...\n`);

  try {
    // Find all verified payments
    const verifiedPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.status, 'verified'),
          isNotNull(payments.auctionId) // Only auction payments
        )
      );

    console.log(`✅ Found ${verifiedPayments.length} verified auction payments\n`);

    let totalDuplicates = 0;
    let cancelledCount = 0;

    // For each verified payment, check for duplicate pending payments
    for (const verifiedPayment of verifiedPayments) {
      if (!verifiedPayment.auctionId) continue;

      const duplicatePendingPayments = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.auctionId, verifiedPayment.auctionId),
            eq(payments.status, 'pending'),
            ne(payments.id, verifiedPayment.id)
          )
        );

      if (duplicatePendingPayments.length > 0) {
        totalDuplicates += duplicatePendingPayments.length;
        
        console.log(`\n⚠️  Found ${duplicatePendingPayments.length} duplicate(s) for auction ${verifiedPayment.auctionId}:`);
        console.log(`   Verified Payment: ${verifiedPayment.id} (${verifiedPayment.paymentReference})`);
        console.log(`   Amount: ₦${parseFloat(verifiedPayment.amount).toLocaleString()}`);
        console.log(`   Verified At: ${verifiedPayment.verifiedAt?.toLocaleString()}`);
        console.log(`\n   Duplicates to cancel:`);

        for (const duplicate of duplicatePendingPayments) {
          console.log(`   - ${duplicate.id} (${duplicate.paymentReference})`);
          console.log(`     Amount: ₦${parseFloat(duplicate.amount).toLocaleString()}`);
          console.log(`     Created: ${duplicate.createdAt.toLocaleString()}`);
          console.log(`     Method: ${duplicate.paymentMethod}`);

          if (!dryRun) {
            // Cancel the duplicate payment
            await db
              .update(payments)
              .set({
                status: 'rejected',
                updatedAt: new Date(),
              })
              .where(eq(payments.id, duplicate.id));
            
            cancelledCount++;
            console.log(`     ✅ Cancelled`);
          } else {
            console.log(`     🔍 Would cancel (dry run)`);
          }
        }
      }
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Total verified payments: ${verifiedPayments.length}`);
    console.log(`   Total duplicates found: ${totalDuplicates}`);
    
    if (dryRun) {
      console.log(`   Would cancel: ${totalDuplicates} payments`);
      console.log(`\n💡 Run without --dry-run to actually cancel these payments`);
    } else {
      console.log(`   Cancelled: ${cancelledCount} payments`);
      console.log(`\n✅ Cleanup complete!`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Check for --dry-run flag
const dryRun = process.argv.includes('--dry-run');

cleanupDuplicatePayments(dryRun)
  .then(() => {
    console.log('\n✅ Script complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
