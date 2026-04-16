/**
 * Cleanup Duplicate Payments for Specific Auction
 * 
 * This script removes duplicate payment records for a specific auction,
 * keeping only the most recent one.
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { eq, desc, and, ne } from 'drizzle-orm';

async function cleanupDuplicatePayments(auctionId: string) {
  console.log('\n🧹 CLEANUP DUPLICATE PAYMENTS');
  console.log('==============================\n');

  try {
    // Get all payments for this auction
    const allPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.auctionId, auctionId))
      .orderBy(desc(payments.createdAt));

    if (allPayments.length === 0) {
      console.log('✅ No payments found for this auction');
      return;
    }

    if (allPayments.length === 1) {
      console.log('✅ Only one payment record exists - no duplicates to clean');
      console.log(`   Payment ID: ${allPayments[0].id}`);
      console.log(`   Reference: ${allPayments[0].paymentReference}`);
      console.log(`   Status: ${allPayments[0].status}`);
      return;
    }

    console.log(`⚠️  Found ${allPayments.length} payment records (duplicates detected)\n`);

    // Keep the most recent payment
    const keepPayment = allPayments[0];
    const deletePayments = allPayments.slice(1);

    console.log('📌 KEEPING (most recent):');
    console.log(`   Payment ID: ${keepPayment.id}`);
    console.log(`   Reference: ${keepPayment.paymentReference}`);
    console.log(`   Status: ${keepPayment.status}`);
    console.log(`   Created: ${keepPayment.createdAt}\n`);

    console.log('🗑️  DELETING (duplicates):');
    deletePayments.forEach((payment, index) => {
      console.log(`   ${index + 1}. Payment ID: ${payment.id}`);
      console.log(`      Reference: ${payment.paymentReference}`);
      console.log(`      Status: ${payment.status}`);
      console.log(`      Created: ${payment.createdAt}`);
    });
    console.log();

    // Delete duplicate payments
    for (const payment of deletePayments) {
      await db
        .delete(payments)
        .where(eq(payments.id, payment.id));
      
      console.log(`✅ Deleted payment ${payment.id}`);
    }

    console.log(`\n✅ Cleanup complete! Removed ${deletePayments.length} duplicate payment(s)\n`);

    // Verify cleanup
    const remainingPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.auctionId, auctionId));

    console.log('📊 VERIFICATION:');
    console.log(`   Payments remaining: ${remainingPayments.length}`);
    if (remainingPayments.length === 1) {
      console.log(`   ✅ Success! Only one payment record remains`);
    } else {
      console.log(`   ⚠️  Warning: ${remainingPayments.length} payments still exist`);
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// Run cleanup
const auctionId = process.argv[2];

if (!auctionId) {
  console.error('❌ Error: Auction ID required');
  console.log('Usage: npx tsx scripts/cleanup-duplicate-payments-for-auction.ts <auction-id>');
  process.exit(1);
}

console.log(`Cleaning up duplicate payments for auction: ${auctionId}\n`);

cleanupDuplicatePayments(auctionId)
  .then(() => {
    console.log('✅ Script complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script error:', error);
    process.exit(1);
  });
