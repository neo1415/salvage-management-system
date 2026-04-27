import { db } from '@/lib/db';
import { payments, auctions } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Manually process a Paystack auction payment when webhook doesn't fire in local dev
 * This simulates what the webhook would do
 */

const AUCTION_ID = '50d96c73-21a5-4a20-990d-557ca32283d0';

async function manuallyProcessPayment() {
  console.log('🔍 Finding pending payment for auction:', AUCTION_ID);

  // Find the pending payment
  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, AUCTION_ID),
        eq(payments.status, 'pending'),
        eq(payments.paymentMethod, 'paystack')
      )
    )
    .limit(1);

  if (!payment) {
    console.log('❌ No pending Paystack payment found for this auction');
    return;
  }

  console.log('✅ Found payment:', {
    id: payment.id,
    amount: payment.amount,
    status: payment.status,
    reference: payment.paystackReference,
  });

  // Update payment to verified
  console.log('📝 Updating payment status to verified...');
  await db
    .update(payments)
    .set({
      status: 'verified',
      verifiedAt: new Date(),
    })
    .where(eq(payments.id, payment.id));

  console.log('✅ Payment marked as verified');

  // Update auction status to payment_complete
  console.log('📝 Updating auction status to payment_complete...');
  await db
    .update(auctions)
    .set({
      status: 'payment_complete',
    })
    .where(eq(auctions.id, AUCTION_ID));

  console.log('✅ Auction status updated to payment_complete');

  // Invalidate cache
  console.log('🗑️ Invalidating auction cache...');
  const { cache } = await import('@/lib/redis/client');
  await cache.del(`auction:details:${AUCTION_ID}`);
  console.log('✅ Cache invalidated');

  console.log('\n✅ DONE! Refresh the page to see the "Payment Complete" banner');
}

manuallyProcessPayment()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
