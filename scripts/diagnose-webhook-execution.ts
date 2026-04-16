/**
 * Diagnose Webhook Execution
 * 
 * This script checks if the webhook is being called and what's happening
 */

import 'dotenv/config';
import { db } from '@/lib/db/drizzle';
import { payments, depositEvents, auctions } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function diagnoseWebhookExecution() {
  console.log('🔍 Diagnosing Webhook Execution\n');

  // Get the most recent auction payment
  const [recentPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentMethod, 'paystack'))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  if (!recentPayment) {
    console.log('❌ No Paystack payments found');
    return;
  }

  console.log('📋 Most Recent Paystack Payment:');
  console.log(`   Payment ID: ${recentPayment.id}`);
  console.log(`   Auction ID: ${recentPayment.auctionId}`);
  console.log(`   Vendor ID: ${recentPayment.vendorId}`);
  console.log(`   Amount: ₦${parseFloat(recentPayment.amount).toLocaleString()}`);
  console.log(`   Status: ${recentPayment.status}`);
  console.log(`   Reference: ${recentPayment.paymentReference}`);
  console.log(`   Created: ${recentPayment.createdAt.toLocaleString()}`);
  console.log(`   Updated: ${recentPayment.updatedAt.toLocaleString()}`);
  console.log(`   Verified At: ${recentPayment.verifiedAt?.toLocaleString() || 'NULL'}`);
  console.log(`   Auto Verified: ${recentPayment.autoVerified}`);

  // Check if deposit was unfrozen
  const unfreezeEvents = await db
    .select()
    .from(depositEvents)
    .where(eq(depositEvents.auctionId, recentPayment.auctionId))
    .orderBy(desc(depositEvents.createdAt));

  console.log(`\n📊 Deposit Events for this Auction: ${unfreezeEvents.length}`);
  
  for (const event of unfreezeEvents) {
    console.log(`\n   Event Type: ${event.eventType}`);
    console.log(`   Amount: ₦${parseFloat(event.amount).toLocaleString()}`);
    console.log(`   Balance Before: ${event.balanceBefore || 'NULL'}`);
    console.log(`   Balance After: ${event.balanceAfter || 'NULL'}`);
    console.log(`   Frozen Before: ${event.frozenBefore || 'NULL'}`);
    console.log(`   Frozen After: ${event.frozenAfter || 'NULL'}`);
    console.log(`   Available Before: ${event.availableBefore || 'NULL'}`);
    console.log(`   Available After: ${event.availableAfter || 'NULL'}`);
    console.log(`   Description: ${event.description}`);
    console.log(`   Created: ${event.createdAt.toLocaleString()}`);
  }

  // Check auction status
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, recentPayment.auctionId))
    .limit(1);

  console.log(`\n🎯 Auction Status: ${auction?.status}`);

  // Analyze the situation
  console.log('\n\n📊 Analysis:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (recentPayment.status === 'pending') {
    console.log('\n❌ ISSUE: Payment is still PENDING');
    console.log('   This means the webhook has NOT been called or failed');
    console.log('\n   Possible causes:');
    console.log('   1. Paystack webhook not configured');
    console.log('   2. Webhook URL incorrect');
    console.log('   3. Payment not completed on Paystack');
    console.log('   4. Webhook signature verification failed');
    console.log('\n   Next steps:');
    console.log('   1. Check Paystack dashboard for webhook logs');
    console.log('   2. Verify webhook URL is correct');
    console.log('   3. Check server logs for webhook errors');
  } else if (recentPayment.status === 'verified') {
    console.log('\n✅ Payment is VERIFIED');
    
    if (unfreezeEvents.length === 0) {
      console.log('\n❌ ISSUE: No unfreeze events found');
      console.log('   The webhook was called but deposit was NOT unfrozen');
      console.log('\n   Possible causes:');
      console.log('   1. Error in handlePaystackWebhook method');
      console.log('   2. Transaction rolled back due to error');
      console.log('   3. Winner record not found');
      console.log('\n   Next steps:');
      console.log('   1. Check server logs for errors during webhook processing');
      console.log('   2. Verify winner record exists');
      console.log('   3. Check wallet state');
    } else {
      const hasNullValues = unfreezeEvents.some(e => 
        !e.balanceBefore || !e.frozenBefore || !e.availableBefore || !e.availableAfter
      );
      
      if (hasNullValues) {
        console.log('\n⚠️  ISSUE: Unfreeze event has NULL before/after values');
        console.log('   The webhook was called but OLD CODE is running');
        console.log('\n   Possible causes:');
        console.log('   1. Dev server not restarted after code changes');
        console.log('   2. Build not updated');
        console.log('   3. Code changes not deployed');
        console.log('\n   Next steps:');
        console.log('   1. Restart dev server: npm run dev');
        console.log('   2. Hard refresh browser: Ctrl+Shift+R');
        console.log('   3. Clear .next folder: rm -rf .next');
      } else {
        console.log('\n✅ Unfreeze event has complete before/after values');
        console.log('   The webhook is working correctly!');
      }
    }

    if (auction?.status === 'awaiting_payment') {
      console.log('\n⚠️  ISSUE: Auction still in awaiting_payment status');
      console.log('   Payment verified but auction status not updated');
      console.log('\n   This is a separate issue from webhook');
      console.log('   Need to investigate auction status transition logic');
    }
  }

  console.log('\n\n💡 Key Insight:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('The unified webhook at /api/webhooks/paystack IS being called');
  console.log('(because wallet funding works). The issue is likely:');
  console.log('1. Error in auction payment handler');
  console.log('2. Old code still running (need restart)');
  console.log('3. Auction status transition logic');
}

// Run the diagnostic
diagnoseWebhookExecution()
  .then(() => {
    console.log('\n✅ Diagnostic completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  });
