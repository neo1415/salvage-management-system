/**
 * Find and delete the 6 payment records that were created by the script
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';

async function findAndDeleteCreatedPayments() {
  console.log('🔍 Finding payment records created by script...\n');

  // These are the 6 auction IDs we created payments for
  const auctionIds = [
    'cc350b7c-bc72-4692-9f6c-669e4b79f7ca',
    'bc665614-6f4d-4e82-b368-bb4ee2a8f5e0',
    '4ac37380-3431-4bd1-97f6-b8dcc88db151',
    'ebe0b7e6-0665-48e7-a946-1fbecf7e29e6',
    '6fac712e-02ef-4001-96ea-0f9863c0e090',
    '7757497f-b807-41af-a1a0-4b5104b7ae66',
  ];

  const createdPayments = await db
    .select()
    .from(payments)
    .where(inArray(payments.auctionId, auctionIds));

  console.log(`Found ${createdPayments.length} payment records for these auctions\n`);

  if (createdPayments.length === 0) {
    console.log('No payments found to delete.');
    return;
  }

  console.log('Payment records to be deleted:');
  for (const payment of createdPayments) {
    console.log(`  - ID: ${payment.id.slice(0, 8)}...`);
    console.log(`    Auction: ${payment.auctionId.slice(0, 8)}...`);
    console.log(`    Amount: ₦${payment.amount}`);
    console.log(`    Status: ${payment.status}`);
    console.log(`    Method: ${payment.paymentMethod}`);
    console.log(`    Created: ${payment.createdAt}`);
    console.log('');
  }

  console.log('Deleting...\n');

  for (const payment of createdPayments) {
    await db.delete(payments).where(eq(payments.id, payment.id));
    console.log(`✅ Deleted payment ${payment.id.slice(0, 8)}...`);
  }

  console.log('\n✅ Rollback complete. All created payment records have been deleted.');
  console.log('Database is back to original state (0 payments).');
}

findAndDeleteCreatedPayments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
