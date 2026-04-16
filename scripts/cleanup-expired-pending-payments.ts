/**
 * Cleanup Expired Pending Payments
 * Removes pending payment records older than 24 hours
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { eq, and, lt } from 'drizzle-orm';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Cleanup Expired Pending Payments');
  console.log('═══════════════════════════════════════════════════════\n');

  // Calculate cutoff time (24 hours ago)
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
  console.log(`Cutoff time: ${cutoffTime.toISOString()}`);
  console.log(`Will delete pending payments created before this time.\n`);

  // Get expired pending payments
  const expiredPayments = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.status, 'pending'),
        lt(payments.createdAt, cutoffTime)
      )
    );

  console.log(`Found ${expiredPayments.length} expired pending payment(s)\n`);

  if (expiredPayments.length === 0) {
    console.log('✅ No expired pending payments to clean up.\n');
    return;
  }

  // Show what will be deleted
  console.log('Will delete the following payments:\n');
  for (const payment of expiredPayments) {
    const age = (Date.now() - new Date(payment.createdAt).getTime()) / (1000 * 60 * 60);
    console.log(`  - Payment ${payment.id}`);
    console.log(`    Auction: ${payment.auctionId}`);
    console.log(`    Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`    Age: ${age.toFixed(1)} hours`);
    console.log(`    Created: ${payment.createdAt}`);
    console.log('');
  }

  // Delete expired pending payments
  console.log('Deleting expired pending payments...\n');

  const deletedCount = await db
    .delete(payments)
    .where(
      and(
        eq(payments.status, 'pending'),
        lt(payments.createdAt, cutoffTime)
      )
    );

  console.log(`✅ Deleted ${expiredPayments.length} expired pending payment(s)\n`);

  // Verify cleanup
  const remainingPending = await db
    .select()
    .from(payments)
    .where(eq(payments.status, 'pending'));

  console.log('═══════════════════════════════════════════════════════');
  console.log('  Verification');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`Remaining pending payments: ${remainingPending.length}\n`);

  if (remainingPending.length > 0) {
    console.log('Recent pending payments (kept):');
    for (const payment of remainingPending) {
      const age = (Date.now() - new Date(payment.createdAt).getTime()) / (1000 * 60 * 60);
      console.log(`  - Payment ${payment.id} (${age.toFixed(1)} hours old)`);
    }
    console.log('');
  }

  console.log('✅ Cleanup complete!\n');
}

main().catch(console.error);
