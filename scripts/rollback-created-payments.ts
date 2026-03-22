/**
 * ROLLBACK: Delete the 6 payment records that were just created
 * 
 * This script removes the payment records created by create-missing-payment-records-for-sold-auctions.ts
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema';
import { eq, gte } from 'drizzle-orm';

async function rollbackCreatedPayments() {
  console.log('🔄 Rolling back created payment records...\n');

  // Get all payments created in the last 5 minutes (the ones we just created)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  
  const recentPayments = await db
    .select()
    .from(payments)
    .where(gte(payments.createdAt, fiveMinutesAgo));

  console.log(`Found ${recentPayments.length} payment records created in the last 5 minutes\n`);

  if (recentPayments.length === 0) {
    console.log('No recent payments to rollback.');
    return;
  }

  // Show what will be deleted
  console.log('Payment records to be deleted:');
  for (const payment of recentPayments) {
    console.log(`  - ${payment.id.slice(0, 8)}... | Auction: ${payment.auctionId.slice(0, 8)}... | Amount: ₦${payment.amount}`);
  }

  console.log('\nDeleting...');

  // Delete the payments
  for (const payment of recentPayments) {
    await db.delete(payments).where(eq(payments.id, payment.id));
    console.log(`✅ Deleted payment ${payment.id.slice(0, 8)}...`);
  }

  console.log('\n✅ Rollback complete. Payment records have been deleted.');
}

rollbackCreatedPayments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error during rollback:', error);
    process.exit(1);
  });
