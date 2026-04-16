/**
 * Simulate Paystack Webhook for Auction Payment
 * 
 * This script simulates a Paystack webhook call to test the payment completion
 * and deposit unfreezing without needing actual Paystack payment.
 * 
 * Use this in development when Paystack webhooks can't reach localhost.
 */

import { paymentService } from '@/features/auction-deposit/services/payment.service';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { eq, and } from 'drizzle-orm';

const AUCTION_ID = '7340f16e-4689-4795-98f4-be9a7731efe4';

async function simulateWebhook() {
  console.log('🔄 Simulating Paystack Webhook for Auction Payment\n');
  
  try {
    // Step 1: Find the pending Paystack payment
    console.log('Step 1: Finding pending Paystack payment...');
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, AUCTION_ID),
          eq(payments.paymentMethod, 'paystack'),
          eq(payments.status, 'pending')
        )
      )
      .limit(1);
    
    if (!payment) {
      console.error('❌ No pending Paystack payment found');
      return;
    }
    
    console.log('✅ Found payment:');
    console.log(`  ID: ${payment.id}`);
    console.log(`  Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`  Reference: ${payment.paymentReference}`);
    console.log('');
    
    // Step 2: Get wallet state before
    console.log('Step 2: Checking wallet state before...');
    const [walletBefore] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, payment.vendorId))
      .limit(1);
    
    if (!walletBefore) {
      console.error('❌ Wallet not found');
      return;
    }
    
    console.log('Wallet before:');
    console.log(`  Balance: ₦${parseFloat(walletBefore.balance).toLocaleString()}`);
    console.log(`  Available: ₦${parseFloat(walletBefore.availableBalance).toLocaleString()}`);
    console.log(`  Frozen: ₦${parseFloat(walletBefore.frozenAmount).toLocaleString()}`);
    console.log('');
    
    // Step 3: Simulate webhook
    console.log('Step 3: Simulating webhook (payment success)...');
    await paymentService.handlePaystackWebhook(payment.paymentReference, true);
    console.log('✅ Webhook processed\n');
    
    // Step 4: Verify payment status
    console.log('Step 4: Verifying payment status...');
    const [paymentAfter] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id))
      .limit(1);
    
    console.log('Payment after:');
    console.log(`  Status: ${paymentAfter?.status}`);
    console.log('');
    
    // Step 5: Verify wallet state after
    console.log('Step 5: Checking wallet state after...');
    const [walletAfter] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, payment.vendorId))
      .limit(1);
    
    if (!walletAfter) {
      console.error('❌ Wallet not found');
      return;
    }
    
    console.log('Wallet after:');
    console.log(`  Balance: ₦${parseFloat(walletAfter.balance).toLocaleString()}`);
    console.log(`  Available: ₦${parseFloat(walletAfter.availableBalance).toLocaleString()}`);
    console.log(`  Frozen: ₦${parseFloat(walletAfter.frozenAmount).toLocaleString()}`);
    console.log('');
    
    // Step 6: Show changes
    console.log('Step 6: Summary of changes:');
    const balanceChange = parseFloat(walletAfter.balance) - parseFloat(walletBefore.balance);
    const frozenChange = parseFloat(walletAfter.frozenAmount) - parseFloat(walletBefore.frozenAmount);
    
    console.log(`  Balance change: ₦${balanceChange.toLocaleString()}`);
    console.log(`  Frozen change: ₦${frozenChange.toLocaleString()}`);
    console.log(`  Payment status: ${payment.status} → ${paymentAfter?.status}`);
    console.log('');
    
    if (paymentAfter?.status === 'verified' && frozenChange < 0) {
      console.log('✅ SUCCESS! Payment verified and deposit unfrozen');
    } else {
      console.log('⚠️ Something may be wrong. Check the details above.');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
    throw error;
  }
}

simulateWebhook()
  .then(() => {
    console.log('\n✅ Simulation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Simulation failed:', error);
    process.exit(1);
  });
