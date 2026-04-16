/**
 * Cleanup Duplicate Payment Records
 * Removes duplicate pending payment records, keeping only the most recent one per auction
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

async function cleanupDuplicatePayments() {
  console.log('Starting duplicate payment cleanup...\n');

  const auctionId = '7340f16e-4689-4795-98f4-be9a7731efe4';

  // Get all payment records for this auction
  const allPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.auctionId, auctionId))
    .orderBy(desc(payments.createdAt));

  console.log(`Found ${allPayments.length} payment records for auction ${auctionId}`);

  if (allPayments.length === 0) {
    console.log('No payments to clean up');
    return;
  }

  // Group by status
  const pendingPayments = allPayments.filter(p => p.status === 'pending');
  const verifiedPayments = allPayments.filter(p => p.status === 'verified');
  const rejectedPayments = allPayments.filter(p => p.status === 'rejected');

  console.log(`\nBreakdown:`);
  console.log(`  Pending: ${pendingPayments.length}`);
  console.log(`  Verified: ${verifiedPayments.length}`);
  console.log(`  Rejected: ${rejectedPayments.length}`);

  // If there are verified payments, delete all pending ones
  if (verifiedPayments.length > 0) {
    console.log(`\n✅ Found ${verifiedPayments.length} verified payment(s)`);
    console.log(`Deleting all ${pendingPayments.length} pending payments...`);

    for (const payment of pendingPayments) {
      await db.delete(payments).where(eq(payments.id, payment.id));
      console.log(`  Deleted pending payment: ${payment.id}`);
    }

    console.log(`\n✅ Cleanup complete! Kept ${verifiedPayments.length} verified payment(s)`);
    return;
  }

  // If no verified payments, keep only the most recent pending payment
  if (pendingPayments.length > 1) {
    const [mostRecent, ...toDelete] = pendingPayments;

    console.log(`\n⚠️  No verified payments found`);
    console.log(`Keeping most recent pending payment: ${mostRecent.id}`);
    console.log(`Deleting ${toDelete.length} older pending payments...`);

    for (const payment of toDelete) {
      await db.delete(payments).where(eq(payments.id, payment.id));
      console.log(`  Deleted: ${payment.id} (created ${payment.createdAt})`);
    }

    console.log(`\n✅ Cleanup complete! Kept 1 most recent pending payment`);
  } else {
    console.log(`\n✅ Only 1 pending payment found, no cleanup needed`);
  }

  // Delete all rejected payments
  if (rejectedPayments.length > 0) {
    console.log(`\nDeleting ${rejectedPayments.length} rejected payments...`);
    for (const payment of rejectedPayments) {
      await db.delete(payments).where(eq(payments.id, payment.id));
      console.log(`  Deleted rejected payment: ${payment.id}`);
    }
  }

  console.log('\n✅ All cleanup complete!');
}

cleanupDuplicatePayments()
  .then(() => {
    console.log('\nScript finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
