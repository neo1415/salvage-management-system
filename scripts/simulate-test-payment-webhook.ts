/**
 * Simulate Paystack Webhook for Test Payment
 * 
 * This script simulates a Paystack webhook for the specific test payment
 * REF-5677 (PAY-962dc370-973f-49b8-a533-8286b61c0271-1777989845198)
 * 
 * Use this when you can't make real payments with a test Paystack account.
 */

import { paymentService } from '@/features/auction-deposit/services/payment.service';
import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { auctions } from '@/lib/db/schema/auctions';
import { eq } from 'drizzle-orm';

const PAYMENT_REFERENCE = 'PAY-962dc370-973f-49b8-a533-8286b61c0271-1777989845198';

async function simulateTestPaymentWebhook() {
  console.log('🔄 Simulating Paystack Webhook for Test Payment\n');
  console.log(`Payment Reference: ${PAYMENT_REFERENCE}`);
  console.log('═'.repeat(80));
  console.log('');
  
  try {
    // Step 1: Find the payment
    console.log('📋 Step 1: Finding payment...');
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentReference, PAYMENT_REFERENCE))
      .limit(1);
    
    if (!payment) {
      console.error('❌ Payment not found!');
      console.log('\nTip: Check if the payment reference is correct.');
      return;
    }
    
    console.log('✅ Payment found:');
    console.log(`   ID: ${payment.id}`);
    console.log(`   Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Payment Method: ${payment.paymentMethod}`);
    console.log(`   Vendor ID: ${payment.vendorId}`);
    console.log(`   Auction ID: ${payment.auctionId || 'N/A'}`);
    console.log('');
    
    if (payment.status === 'verified') {
      console.log('⚠️  Payment is already verified!');
      console.log('   No action needed. The webhook has already been processed.');
      return;
    }
    
    if (payment.status !== 'pending') {
      console.log(`⚠️  Payment status is "${payment.status}", not "pending"`);
      console.log('   This script is designed for pending payments.');
      console.log('   Proceeding anyway...\n');
    }
    
    // Step 2: Get wallet state before
    console.log('💰 Step 2: Checking wallet state BEFORE...');
    const [walletBefore] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, payment.vendorId))
      .limit(1);
    
    if (!walletBefore) {
      console.error('❌ Wallet not found for vendor!');
      return;
    }
    
    console.log('   Balance: ₦' + parseFloat(walletBefore.balance).toLocaleString());
    console.log('   Available: ₦' + parseFloat(walletBefore.availableBalance).toLocaleString());
    console.log('   Frozen: ₦' + parseFloat(walletBefore.frozenAmount).toLocaleString());
    console.log('');
    
    // Step 3: Get auction state before (if applicable)
    let auctionBefore = null;
    if (payment.auctionId) {
      console.log('🎯 Step 3: Checking auction state BEFORE...');
      [auctionBefore] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, payment.auctionId))
        .limit(1);
      
      if (auctionBefore) {
        console.log(`   Auction Status: ${auctionBefore.status}`);
        console.log(`   Winner ID: ${auctionBefore.winnerId || 'N/A'}`);
        console.log('');
      }
    }
    
    // Step 4: Simulate the webhook
    console.log('🚀 Step 4: Simulating Paystack webhook (payment success)...');
    console.log('   This will:');
    console.log('   1. Mark payment as verified');
    console.log('   2. Release frozen deposit (if any)');
    console.log('   3. Transfer funds to NEM Insurance');
    console.log('   4. Update auction status (if applicable)');
    console.log('   5. Trigger real-time notifications');
    console.log('');
    
    await paymentService.handlePaystackWebhook(PAYMENT_REFERENCE, true);
    
    console.log('✅ Webhook processed successfully!\n');
    
    // Step 5: Verify payment status after
    console.log('📊 Step 5: Verifying payment status AFTER...');
    const [paymentAfter] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, payment.id))
      .limit(1);
    
    if (!paymentAfter) {
      console.error('❌ Payment not found after processing!');
      return;
    }
    
    console.log(`   Status: ${payment.status} → ${paymentAfter.status}`);
    console.log('');
    
    // Step 6: Verify wallet state after
    console.log('💰 Step 6: Checking wallet state AFTER...');
    const [walletAfter] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, payment.vendorId))
      .limit(1);
    
    if (!walletAfter) {
      console.error('❌ Wallet not found after processing!');
      return;
    }
    
    console.log('   Balance: ₦' + parseFloat(walletAfter.balance).toLocaleString());
    console.log('   Available: ₦' + parseFloat(walletAfter.availableBalance).toLocaleString());
    console.log('   Frozen: ₦' + parseFloat(walletAfter.frozenAmount).toLocaleString());
    console.log('');
    
    // Step 7: Verify auction state after (if applicable)
    if (payment.auctionId) {
      console.log('🎯 Step 7: Checking auction state AFTER...');
      const [auctionAfter] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, payment.auctionId))
        .limit(1);
      
      if (auctionAfter) {
        console.log(`   Auction Status: ${auctionBefore?.status} → ${auctionAfter.status}`);
        console.log('');
      }
    }
    
    // Step 8: Summary
    console.log('═'.repeat(80));
    console.log('📈 SUMMARY OF CHANGES:');
    console.log('═'.repeat(80));
    
    const balanceChange = parseFloat(walletAfter.balance) - parseFloat(walletBefore.balance);
    const availableChange = parseFloat(walletAfter.availableBalance) - parseFloat(walletBefore.availableBalance);
    const frozenChange = parseFloat(walletAfter.frozenAmount) - parseFloat(walletBefore.frozenAmount);
    
    console.log('\n💳 Payment:');
    console.log(`   Status: ${payment.status} → ${paymentAfter.status}`);
    
    console.log('\n💰 Wallet:');
    console.log(`   Balance: ${balanceChange >= 0 ? '+' : ''}₦${balanceChange.toLocaleString()}`);
    console.log(`   Available: ${availableChange >= 0 ? '+' : ''}₦${availableChange.toLocaleString()}`);
    console.log(`   Frozen: ${frozenChange >= 0 ? '+' : ''}₦${frozenChange.toLocaleString()}`);
    
    if (payment.auctionId && auctionBefore) {
      const [auctionAfter] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, payment.auctionId))
        .limit(1);
      
      if (auctionAfter) {
        console.log('\n🎯 Auction:');
        console.log(`   Status: ${auctionBefore.status} → ${auctionAfter.status}`);
      }
    }
    
    console.log('\n');
    
    if (paymentAfter.status === 'verified') {
      console.log('✅ SUCCESS! Payment has been verified and processed.');
      console.log('');
      console.log('🎉 What to do next:');
      console.log('   1. Refresh the Finance Payments page');
      console.log('   2. Check that the payment status shows as "Verified"');
      console.log('   3. Verify the vendor wallet balance is correct');
      console.log('   4. Check auction status (if applicable)');
      console.log('   5. Verify real-time notifications were sent');
    } else {
      console.log('⚠️  Payment status is not "verified". Something may have gone wrong.');
      console.log('   Check the logs above for errors.');
    }
    
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    if (error instanceof Error) {
      console.error('\nError Details:');
      console.error('   Message:', error.message);
      console.error('   Stack:', error.stack);
    }
    throw error;
  }
}

// Run the script
simulateTestPaymentWebhook()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
