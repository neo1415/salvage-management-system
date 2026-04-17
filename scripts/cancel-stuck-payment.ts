/**
 * Cancel Stuck Payment
 * 
 * Cancels a pending payment that's blocking new payment attempts
 */

import { config } from 'dotenv';
config();

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const AUCTION_ID = '17b57f99-f7a8-4642-9d3b-5b7cb66f2407';

async function cancelStuckPayment() {
  console.log('🔧 Canceling Stuck Payment\n');
  console.log(`Auction ID: ${AUCTION_ID}\n`);

  // 1. Find pending payments for this auction
  console.log('1️⃣ Finding pending payments...');
  const pendingPayments = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, AUCTION_ID),
        eq(payments.status, 'pending')
      )
    );

  if (pendingPayments.length === 0) {
    console.log('✅ No pending payments found. You can proceed with a new payment.\n');
    process.exit(0);
  }

  console.log(`   Found ${pendingPayments.length} pending payment(s):\n`);
  for (const payment of pendingPayments) {
    console.log(`   Payment ID: ${payment.id}`);
    console.log(`   Amount: ₦${payment.amount}`);
    console.log(`   Method: ${payment.paymentMethod}`);
    console.log(`   Provider: ${payment.provider || 'N/A'}`);
    console.log(`   Created: ${payment.createdAt}`);
    console.log(`   Reference: ${payment.paystackReference || payment.flutterwaveReference || 'N/A'}\n`);
  }

  // 2. Cancel all pending payments (set to 'rejected')
  console.log('2️⃣ Canceling pending payments...');
  for (const payment of pendingPayments) {
    const [cancelled] = await db
      .update(payments)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id))
      .returning();

    console.log(`   ✅ Cancelled payment: ${cancelled.id}`);
  }

  console.log('\n✅ All stuck payments cancelled successfully!');
  console.log('   You can now make a new payment.\n');

  process.exit(0);
}

cancelStuckPayment().catch((error) => {
  console.error('❌ Failed to cancel stuck payment:', error);
  process.exit(1);
});
