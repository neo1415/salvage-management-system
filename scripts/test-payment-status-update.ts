/**
 * Test Payment Status Update Fix
 * 
 * This script tests that the auction status is correctly updated to 'closed'
 * after payment verification.
 * 
 * Usage:
 *   npx tsx scripts/test-payment-status-update.ts
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { eq, and, desc } from 'drizzle-orm';

async function testPaymentStatusUpdate() {
  console.log('🧪 Testing Payment Status Update Fix\n');
  console.log('=' .repeat(60));

  // Find a recent auction in awaiting_payment status with verified payment
  const [auction] = await db
    .select({
      id: auctions.id,
      status: auctions.status,
      currentBid: auctions.currentBid,
      currentBidder: auctions.currentBidder,
      updatedAt: auctions.updatedAt,
    })
    .from(auctions)
    .where(eq(auctions.status, 'awaiting_payment'))
    .orderBy(desc(auctions.updatedAt))
    .limit(1);

  if (!auction) {
    console.log('❌ No auctions found in awaiting_payment status');
    console.log('   Create an auction and complete it to test this fix');
    return;
  }

  console.log(`\n📋 Found Auction: ${auction.id}`);
  console.log(`   Status: ${auction.status}`);
  console.log(`   Current Bid: ₦${parseFloat(auction.currentBid || '0').toLocaleString()}`);
  console.log(`   Updated At: ${auction.updatedAt}`);

  // Check if payment exists and is verified
  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, auction.id),
        eq(payments.status, 'verified')
      )
    )
    .limit(1);

  if (!payment) {
    console.log('\n⚠️  No verified payment found for this auction');
    console.log('   This auction is waiting for payment');
    console.log('   Make a payment to test the fix');
    return;
  }

  console.log(`\n💳 Payment Found: ${payment.id}`);
  console.log(`   Status: ${payment.status}`);
  console.log(`   Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
  console.log(`   Method: ${payment.paymentMethod}`);
  console.log(`   Verified At: ${payment.verifiedAt}`);

  // Check if auction status was updated to closed
  if (auction.status === 'closed') {
    console.log('\n✅ SUCCESS: Auction status is correctly set to "closed"');
    console.log('   The fix is working correctly!');
    console.log('   Payment verified → Auction closed ✅');
  } else if (auction.status === 'awaiting_payment') {
    console.log('\n❌ ISSUE DETECTED: Auction status is still "awaiting_payment"');
    console.log('   Expected: "closed"');
    console.log('   Actual: "awaiting_payment"');
    console.log('\n   This indicates the fix has NOT been applied yet or');
    console.log('   the payment was verified before the fix was deployed.');
    console.log('\n   To test the fix:');
    console.log('   1. Deploy the updated payment.service.ts');
    console.log('   2. Make a new payment on a different auction');
    console.log('   3. Run this script again');
  } else {
    console.log(`\n⚠️  Unexpected auction status: ${auction.status}`);
    console.log('   Expected: "closed"');
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Test complete\n');
}

// Run the test
testPaymentStatusUpdate()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
