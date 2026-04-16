/**
 * Fix Specific Pending Payment Issue
 * Handles the case where a wallet payment is pending but user wants to pay with Paystack
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, and } from 'drizzle-orm';

const AUCTION_ID = '260582d5-5c55-4ca5-8e22-609fef09b7f3';
const VENDOR_ID = '5e4eaa5f-7438-4c4f-bc8a-59db91d4a8c3';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Fix Pending Payment Issue');
  console.log('═══════════════════════════════════════════════════════\n');

  // Get the pending payment
  const [pendingPayment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, AUCTION_ID),
        eq(payments.vendorId, VENDOR_ID),
        eq(payments.status, 'pending')
      )
    )
    .limit(1);

  if (!pendingPayment) {
    console.log('✅ No pending payment found. Issue may already be resolved.\n');
    return;
  }

  console.log('Found pending payment:');
  console.log(`  Payment ID: ${pendingPayment.id}`);
  console.log(`  Method: ${pendingPayment.paymentMethod}`);
  console.log(`  Amount: ₦${parseFloat(pendingPayment.amount).toLocaleString()}`);
  console.log(`  Created: ${pendingPayment.createdAt}`);
  console.log('');

  // Check auction status
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, AUCTION_ID))
    .limit(1);

  if (auction) {
    console.log('Auction details:');
    console.log(`  Status: ${auction.status}`);
    console.log(`  Current Bid: ₦${parseFloat(auction.currentBid || '0').toLocaleString()}`);
    console.log('');
  }

  // Solution: Delete the pending wallet payment to allow Paystack payment
  console.log('Solution: Delete the pending wallet payment to allow Paystack payment\n');
  console.log('This is safe because:');
  console.log('  1. The payment is still pending (not completed)');
  console.log('  2. No funds have been deducted yet');
  console.log('  3. User wants to use a different payment method (Paystack)\n');

  console.log('Deleting pending payment...\n');

  await db
    .delete(payments)
    .where(eq(payments.id, pendingPayment.id));

  console.log('✅ Pending payment deleted successfully!\n');

  // Verify
  const [verifyPayment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, AUCTION_ID),
        eq(payments.vendorId, VENDOR_ID),
        eq(payments.status, 'pending')
      )
    )
    .limit(1);

  if (!verifyPayment) {
    console.log('✅ Verification: No pending payments found for this auction\n');
    console.log('You can now try to pay with Paystack again.\n');
  } else {
    console.log('⚠️  Warning: Still found a pending payment. Please investigate.\n');
  }
}

main().catch(console.error);
