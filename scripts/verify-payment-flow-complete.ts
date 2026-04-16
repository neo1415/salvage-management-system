/**
 * Verify Complete Payment Flow
 * 
 * This script verifies that the payment flow works end-to-end:
 * 1. Payment verified via Paystack webhook
 * 2. Deposit unfrozen
 * 3. Pickup authorization generated
 * 4. Funds transferred to finance officer
 * 
 * Usage:
 *   npx tsx scripts/verify-payment-flow-complete.ts <auction-id>
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { depositEvents } from '@/lib/db/schema/auction-deposit';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { eq, and, desc } from 'drizzle-orm';

async function verifyPaymentFlow(auctionId: string) {
  console.log('🔍 Verifying Complete Payment Flow');
  console.log('='.repeat(60));
  console.log(`Auction ID: ${auctionId}`);
  console.log('');

  // Step 1: Check auction status
  console.log('1️⃣  Checking auction status...');
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .limit(1);

  if (!auction) {
    console.error('❌ Auction not found');
    return;
  }

  console.log(`   - Status: ${auction.status}`);
  console.log(`   - Winner: ${auction.currentBidder || 'None'}`);
  console.log('');

  if (!auction.currentBidder) {
    console.error('❌ No winner for this auction');
    return;
  }

  const vendorId = auction.currentBidder;

  // Step 2: Check payment record
  console.log('2️⃣  Checking payment record...');
  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, auctionId),
        eq(payments.vendorId, vendorId)
      )
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);

  if (!payment) {
    console.error('❌ No payment record found');
    return;
  }

  console.log(`   - Payment ID: ${payment.id}`);
  console.log(`   - Status: ${payment.status}`);
  console.log(`   - Method: ${payment.paymentMethod}`);
  console.log(`   - Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
  console.log(`   - Reference: ${payment.paymentReference}`);
  console.log('');

  // Step 3: Check deposit unfreeze event
  console.log('3️⃣  Checking deposit unfreeze event...');
  const unfreezeEvents = await db
    .select()
    .from(depositEvents)
    .where(
      and(
        eq(depositEvents.auctionId, auctionId),
        eq(depositEvents.vendorId, vendorId),
        eq(depositEvents.eventType, 'unfreeze')
      )
    )
    .orderBy(desc(depositEvents.createdAt));

  if (unfreezeEvents.length === 0) {
    console.error('❌ No unfreeze event found');
    console.error('   - Deposit was NOT unfrozen after payment');
    return;
  }

  const unfreezeEvent = unfreezeEvents[0];
  console.log(`✅ Deposit unfrozen`);
  console.log(`   - Amount: ₦${parseFloat(unfreezeEvent.amount).toLocaleString()}`);
  console.log(`   - Balance Before: ₦${parseFloat(unfreezeEvent.balanceBefore || '0').toLocaleString()}`);
  console.log(`   - Balance After: ₦${parseFloat(unfreezeEvent.balanceAfter).toLocaleString()}`);
  console.log(`   - Frozen Before: ₦${parseFloat(unfreezeEvent.frozenBefore || '0').toLocaleString()}`);
  console.log(`   - Frozen After: ₦${parseFloat(unfreezeEvent.frozenAfter).toLocaleString()}`);
  console.log('');

  // Step 4: Check pickup authorization document
  console.log('4️⃣  Checking pickup authorization document...');
  const pickupAuthDocs = await db
    .select()
    .from(releaseForms)
    .where(
      and(
        eq(releaseForms.auctionId, auctionId),
        eq(releaseForms.vendorId, vendorId),
        eq(releaseForms.documentType, 'pickup_authorization')
      )
    );

  if (pickupAuthDocs.length === 0) {
    console.error('❌ No pickup authorization document found');
    console.error('   - Vendor will NOT be able to collect the asset');
    return;
  }

  const pickupAuthDoc = pickupAuthDocs[0];
  console.log(`✅ Pickup authorization generated`);
  console.log(`   - Document ID: ${pickupAuthDoc.id}`);
  console.log(`   - Status: ${pickupAuthDoc.status}`);
  console.log(`   - Created: ${pickupAuthDoc.createdAt.toLocaleString()}`);
  console.log('');

  // Step 5: Check fund release (transfer to finance)
  console.log('5️⃣  Checking fund release to finance...');
  
  // Check if payment status is 'completed' (indicates fund release succeeded)
  if (payment.status === 'completed') {
    console.log(`✅ Funds released to finance officer`);
    console.log(`   - Payment status: completed`);
    console.log(`   - Money transferred via Paystack`);
  } else if (payment.status === 'verified') {
    console.warn(`⚠️  Payment verified but NOT yet released to finance`);
    console.warn(`   - Payment status: verified (should be 'completed' after fund release)`);
    console.warn(`   - This means money is still in escrow`);
    console.warn(`   - Finance officer has NOT received the money yet`);
  } else {
    console.error(`❌ Payment status: ${payment.status}`);
    console.error(`   - Expected: 'completed' or 'verified'`);
  }
  console.log('');

  // Step 6: Check wallet state
  console.log('6️⃣  Checking vendor wallet state...');
  const [wallet] = await db
    .select()
    .from(escrowWallets)
    .where(eq(escrowWallets.vendorId, vendorId))
    .limit(1);

  if (!wallet) {
    console.error('❌ Wallet not found');
    return;
  }

  console.log(`   - Balance: ₦${parseFloat(wallet.balance).toLocaleString()}`);
  console.log(`   - Available: ₦${parseFloat(wallet.availableBalance).toLocaleString()}`);
  console.log(`   - Frozen: ₦${parseFloat(wallet.frozenAmount).toLocaleString()}`);
  console.log(`   - Forfeited: ₦${parseFloat(wallet.forfeitedAmount || '0').toLocaleString()}`);
  console.log('');

  // Summary
  console.log('📋 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Auction Status: ${auction.status}`);
  console.log(`Payment Status: ${payment.status}`);
  console.log(`Deposit Unfrozen: ${unfreezeEvents.length > 0 ? '✅ Yes' : '❌ No'}`);
  console.log(`Pickup Auth Generated: ${pickupAuthDocs.length > 0 ? '✅ Yes' : '❌ No'}`);
  console.log(`Funds Released to Finance: ${payment.status === 'completed' ? '✅ Yes' : '⚠️  Not yet'}`);
  console.log('');

  if (payment.status === 'completed') {
    console.log('✅ PAYMENT FLOW COMPLETE');
    console.log('   - All steps executed successfully');
    console.log('   - Vendor can collect asset with pickup authorization');
    console.log('   - Finance officer has received the money');
  } else if (payment.status === 'verified') {
    console.log('⚠️  PAYMENT FLOW INCOMPLETE');
    console.log('   - Payment verified but funds NOT released to finance');
    console.log('   - This is the bug we just fixed');
    console.log('   - Next payment should complete the full flow');
  } else {
    console.log('❌ PAYMENT FLOW FAILED');
    console.log('   - Payment status is not verified or completed');
    console.log('   - Check payment webhook logs for errors');
  }
}

// Get auction ID from command line
const auctionId = process.argv[2];

if (!auctionId) {
  console.error('❌ Please provide an auction ID');
  console.error('Usage: npx tsx scripts/verify-payment-flow-complete.ts <auction-id>');
  process.exit(1);
}

verifyPaymentFlow(auctionId)
  .then(() => {
    console.log('');
    console.log('✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
