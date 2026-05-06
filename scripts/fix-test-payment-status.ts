/**
 * Fix Test Payment Status
 * 
 * This script fixes the auction status for REF-5677 payment
 * The webhook incorrectly set status to 'closed' instead of keeping it as 'awaiting_payment'
 * 
 * Correct behavior:
 * - Auction status: 'awaiting_payment' (NOT 'closed')
 * - Payment status: 'verified'
 * - hasVerifiedPayment: true (computed dynamically by API)
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { eq } from 'drizzle-orm';

async function fixTestPaymentStatus() {
  console.log('🔧 Fixing test payment status for REF-5677...\n');

  const paymentReference = 'PAY-962dc370-973f-49b8-a533-8286b61c0271-1777989845198';
  const auctionId = '962dc370-973f-49b8-a533-8286b61c0271';

  // Step 1: Check current payment status
  console.log('📋 Step 1: Checking current payment status...');
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentReference, paymentReference))
    .limit(1);

  if (!payment) {
    console.error(`❌ Payment not found: ${paymentReference}`);
    process.exit(1);
  }

  console.log(`✅ Payment found:`);
  console.log(`   - ID: ${payment.id}`);
  console.log(`   - Status: ${payment.status}`);
  console.log(`   - Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
  console.log(`   - Auction ID: ${payment.auctionId}`);
  console.log('');

  // Step 2: Check current auction status
  console.log('📋 Step 2: Checking current auction status...');
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .limit(1);

  if (!auction) {
    console.error(`❌ Auction not found: ${auctionId}`);
    process.exit(1);
  }

  console.log(`✅ Auction found:`);
  console.log(`   - ID: ${auction.id}`);
  console.log(`   - Status: ${auction.status}`);
  console.log(`   - Current Bid: ₦${auction.currentBid ? parseFloat(auction.currentBid).toLocaleString() : 'None'}`);
  console.log('');

  // Step 3: Fix auction status if it's 'closed'
  if (auction.status === 'closed') {
    console.log('🔧 Step 3: Fixing auction status from "closed" to "awaiting_payment"...');
    
    await db
      .update(auctions)
      .set({
        status: 'awaiting_payment',
        updatedAt: new Date(),
      })
      .where(eq(auctions.id, auctionId));

    console.log(`✅ Auction status updated to "awaiting_payment"`);
    console.log('');
  } else if (auction.status === 'awaiting_payment') {
    console.log(`✅ Auction status is already correct: "awaiting_payment"`);
    console.log('');
  } else {
    console.log(`⚠️  Auction status is "${auction.status}" (expected "awaiting_payment" or "closed")`);
    console.log('');
  }

  // Step 4: Verify payment status is 'verified'
  console.log('📋 Step 4: Verifying payment status...');
  if (payment.status === 'verified') {
    console.log(`✅ Payment status is correct: "verified"`);
  } else {
    console.log(`⚠️  Payment status is "${payment.status}" (expected "verified")`);
    console.log('   This may need manual investigation');
  }
  console.log('');

  // Step 5: Verify the fix
  console.log('📋 Step 5: Verifying the fix...');
  const [updatedAuction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .limit(1);

  const [verifiedPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.auctionId, auctionId))
    .where(eq(payments.status, 'verified'))
    .limit(1);

  const hasVerifiedPayment = !!verifiedPayment;

  console.log(`✅ Final state:`);
  console.log(`   - Auction Status: ${updatedAuction?.status}`);
  console.log(`   - Payment Status: ${payment.status}`);
  console.log(`   - hasVerifiedPayment: ${hasVerifiedPayment}`);
  console.log('');

  if (updatedAuction?.status === 'awaiting_payment' && hasVerifiedPayment) {
    console.log('✅ SUCCESS! The payment is now correctly configured:');
    console.log('   - Auction status: "awaiting_payment" ✓');
    console.log('   - Payment verified: true ✓');
    console.log('   - hasVerifiedPayment will be computed as: true ✓');
    console.log('');
    console.log('🎯 Expected UI behavior:');
    console.log('   - Green "Payment Verified" banner should appear');
    console.log('   - "Pay Now" button should be hidden');
    console.log('   - Polling should show hasVerifiedPayment: true');
  } else {
    console.log('⚠️  WARNING: State may not be correct');
    console.log(`   - Auction status: ${updatedAuction?.status} (expected: "awaiting_payment")`);
    console.log(`   - hasVerifiedPayment: ${hasVerifiedPayment} (expected: true)`);
  }
}

fixTestPaymentStatus()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
