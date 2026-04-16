import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { auctionWinners, depositEvents } from '@/lib/db/schema/auction-deposit';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Fix the payment complete state
 * - Update auction status to payment_verified
 * - Verify frozen deposit was released
 * - Fix wallet balance if needed
 */

async function fixPaymentCompleteState() {
  console.log('🔧 Fixing Payment Complete State...\n');

  try {
    const paymentReference = 'PAY-ea06c5e4-6b98-46b7-a10b-c3a6b876fdd5-1776077176140';
    
    // Get payment
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentReference, paymentReference))
      .limit(1);

    if (!payment) {
      console.log('❌ Payment not found!');
      return;
    }

    console.log('📊 Current State:');
    console.log(`   - Payment Status: ${payment.status}`);
    console.log(`   - Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log('');

    // Get auction
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, payment.auctionId))
      .limit(1);

    console.log(`   - Auction Status: ${auction?.status}`);
    console.log('');

    // Get winner
    const [winner] = await db
      .select()
      .from(auctionWinners)
      .where(
        and(
          eq(auctionWinners.auctionId, payment.auctionId),
          eq(auctionWinners.vendorId, payment.vendorId),
          eq(auctionWinners.status, 'active')
        )
      )
      .limit(1);

    if (!winner) {
      console.log('❌ Winner record not found!');
      return;
    }

    console.log(`   - Winning Bid: ₦${parseFloat(winner.bidAmount).toLocaleString()}`);
    console.log(`   - Deposit Amount: ₦${parseFloat(winner.depositAmount).toLocaleString()}`);
    console.log('');

    // Get wallet
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, payment.vendorId))
      .limit(1);

    console.log(`   - Wallet Available: ₦${parseFloat(wallet?.availableBalance || '0').toLocaleString()}`);
    console.log(`   - Wallet Frozen: ₦${parseFloat(wallet?.frozenAmount || '0').toLocaleString()}`);
    console.log('');

    // Check deposit events
    const events = await db
      .select()
      .from(depositEvents)
      .where(
        and(
          eq(depositEvents.vendorId, payment.vendorId),
          eq(depositEvents.auctionId, payment.auctionId)
        )
      )
      .orderBy(desc(depositEvents.createdAt))
      .limit(5);

    console.log('📋 Recent Deposit Events:');
    events.forEach((event, i) => {
      console.log(`   ${i + 1}. ${event.eventType.toUpperCase()} - ₦${parseFloat(event.amount).toLocaleString()}`);
      console.log(`      Balance After: ₦${parseFloat(event.balanceAfter).toLocaleString()}`);
      console.log(`      Frozen After: ₦${parseFloat(event.frozenAfter).toLocaleString()}`);
      console.log(`      ${event.description}`);
    });
    console.log('');

    // Check if deposit was unfrozen
    const unfreezeEvent = events.find(e => e.eventType === 'unfreeze');
    
    if (!unfreezeEvent) {
      console.log('❌ No unfreeze event found! The deposit was NOT released.');
      console.log('   This means the webhook handler failed or didn\'t complete.');
      console.log('');
    } else {
      console.log('✅ Deposit was unfrozen');
      console.log('');
    }

    // Fix auction status
    if (auction?.status !== 'payment_verified') {
      console.log('🔧 Updating auction status to payment_verified...');
      await db
        .update(auctions)
        .set({
          status: 'payment_verified',
          updatedAt: new Date(),
        })
        .where(eq(auctions.id, payment.auctionId));
      console.log('✅ Auction status updated');
    } else {
      console.log('✅ Auction status already correct');
    }

    console.log('');
    console.log('🎯 Summary:');
    console.log(`   - Payment: ${payment.status}`);
    console.log(`   - Auction: payment_verified`);
    console.log(`   - Deposit Released: ${unfreezeEvent ? 'Yes' : 'No'}`);
    console.log('');

    if (!unfreezeEvent) {
      console.log('⚠️  WARNING: Deposit was not released!');
      console.log('   The frozen amount is still in the wallet.');
      console.log('   This needs to be investigated further.');
      console.log('');
      console.log('   Possible causes:');
      console.log('   1. Webhook handler failed mid-transaction');
      console.log('   2. Database transaction rolled back');
      console.log('   3. Error in wallet update logic');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the fix
fixPaymentCompleteState()
  .then(() => {
    console.log('\n✅ Fix complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });
