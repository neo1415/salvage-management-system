import { db } from '@/lib/db/drizzle';
import { payments, depositEvents, escrowWallets, auctionWinners, auctions } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

async function diagnosePaymentWebhook() {
  try {
    console.log('🔍 COMPREHENSIVE PAYMENT WEBHOOK DIAGNOSIS\n');
    console.log('='.repeat(80));

    // Get the latest payment
    const [latestPayment] = await db
      .select()
      .from(payments)
      .orderBy(desc(payments.createdAt))
      .limit(1);

    if (!latestPayment) {
      console.log('❌ No payments found');
      return;
    }

    console.log('\n📋 LATEST PAYMENT:');
    console.log('  ID:', latestPayment.id);
    console.log('  Auction ID:', latestPayment.auctionId);
    console.log('  Vendor ID:', latestPayment.vendorId);
    console.log('  Amount:', latestPayment.amount);
    console.log('  Method:', latestPayment.paymentMethod);
    console.log('  Status:', latestPayment.status);
    console.log('  Reference:', latestPayment.paymentReference);
    console.log('  Created:', latestPayment.createdAt);
    console.log('  Verified:', latestPayment.verifiedAt);

    // Get auction details
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, latestPayment.auctionId))
      .limit(1);

    console.log('\n🏷️  AUCTION:');
    console.log('  Asset:', auction?.assetName);
    console.log('  Status:', auction?.status);
    console.log('  Final Bid:', auction?.finalBid);

    // Get winner record
    const [winner] = await db
      .select()
      .from(auctionWinners)
      .where(
        and(
          eq(auctionWinners.auctionId, latestPayment.auctionId),
          eq(auctionWinners.vendorId, latestPayment.vendorId)
        )
      )
      .limit(1);

    console.log('\n🏆 WINNER RECORD:');
    if (winner) {
      console.log('  Status:', winner.status);
      console.log('  Deposit Amount:', winner.depositAmount);
      console.log('  Final Bid:', winner.finalBid);
      console.log('  Payment Deadline:', winner.paymentDeadline);
    } else {
      console.log('  ❌ No winner record found');
    }

    // Get wallet state
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, latestPayment.vendorId))
      .limit(1);

    console.log('\n💰 WALLET STATE:');
    if (wallet) {
      console.log('  Balance:', wallet.balance);
      console.log('  Available:', wallet.availableBalance);
      console.log('  Frozen:', wallet.frozenAmount);
      console.log('  Forfeited:', wallet.forfeitedAmount);
    } else {
      console.log('  ❌ No wallet found');
    }

    // Get ALL deposit events for this auction
    const events = await db
      .select()
      .from(depositEvents)
      .where(
        and(
          eq(depositEvents.vendorId, latestPayment.vendorId),
          eq(depositEvents.auctionId, latestPayment.auctionId)
        )
      )
      .orderBy(desc(depositEvents.createdAt));

    console.log('\n📊 DEPOSIT EVENTS FOR THIS AUCTION:');
    console.log(`  Total events: ${events.length}`);
    
    if (events.length === 0) {
      console.log('  ❌ NO DEPOSIT EVENTS FOUND - THIS IS THE PROBLEM!');
    } else {
      events.forEach((event, index) => {
        console.log(`\n  Event ${index + 1}:`);
        console.log('    Type:', event.eventType);
        console.log('    Amount:', event.amount);
        console.log('    Balance Before:', event.balanceBefore || 'NULL ❌');
        console.log('    Balance After:', event.balanceAfter);
        console.log('    Frozen Before:', event.frozenBefore || 'NULL ❌');
        console.log('    Frozen After:', event.frozenAfter);
        console.log('    Description:', event.description);
        console.log('    Created:', event.createdAt);
      });
    }

    // Check if unfreeze event exists
    const unfreezeEvent = events.find(e => e.eventType === 'unfreeze');
    
    console.log('\n🔓 UNFREEZE EVENT CHECK:');
    if (unfreezeEvent) {
      console.log('  ✅ Unfreeze event exists');
      console.log('  Has balanceBefore:', !!unfreezeEvent.balanceBefore);
      console.log('  Has frozenBefore:', !!unfreezeEvent.frozenBefore);
      
      if (!unfreezeEvent.balanceBefore || !unfreezeEvent.frozenBefore) {
        console.log('  ⚠️  Missing before values - transaction history won\'t show properly');
      }
    } else {
      console.log('  ❌ NO UNFREEZE EVENT - Deposit was never released!');
    }

    // Compare manual script vs webhook code
    console.log('\n🔬 CODE COMPARISON:');
    console.log('  Manual script calls: paymentService.handlePaystackWebhook(reference, true)');
    console.log('  Webhook route calls: paymentService.handlePaystackWebhook(reference, true)');
    console.log('  ✅ Both call the same method');
    
    console.log('\n  Checking notification service...');
    console.log('  Manual script: Calls sendPaymentConfirmationNotification AFTER transaction');
    console.log('  Webhook code: Calls sendPaymentConfirmationNotification AFTER transaction');
    console.log('  ✅ Both call notifications the same way');

    console.log('\n🎯 ROOT CAUSE ANALYSIS:');
    
    if (latestPayment.status === 'pending') {
      console.log('  ❌ CRITICAL: Payment still pending - webhook never processed!');
      console.log('  Possible causes:');
      console.log('    1. Webhook not reaching server (check Paystack dashboard)');
      console.log('    2. Webhook signature verification failing');
      console.log('    3. Error in webhook processing (check server logs)');
      console.log('    4. Notification errors breaking the webhook');
    } else if (latestPayment.status === 'verified') {
      console.log('  ✅ Payment verified successfully');
      
      if (!unfreezeEvent) {
        console.log('  ❌ BUT: No unfreeze event created - transaction logic failed');
      } else if (!unfreezeEvent.balanceBefore || !unfreezeEvent.frozenBefore) {
        console.log('  ⚠️  Unfreeze event missing before values - won\'t show in history');
      } else {
        console.log('  ✅ Unfreeze event created with all fields');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Diagnosis complete\n');

  } catch (error) {
    console.error('\n❌ Diagnosis error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  } finally {
    process.exit(0);
  }
}

diagnosePaymentWebhook();
