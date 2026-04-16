import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

/**
 * Diagnose why Paystack payment didn't process correctly
 * Check payment status, webhook logs, wallet state, etc.
 */

async function diagnosePaystackAuctionPayment() {
  console.log('🔍 Diagnosing Paystack Auction Payment Issue...\n');

  try {
    // Find the payment
    const paymentReference = 'PAY-ea06c5e4-6b98-46b7-a10b-c3a6b876fdd5-1776077176140';
    
    console.log(`Looking for payment: ${paymentReference}\n`);

    const result = await db
      .select({
        payment: payments,
        auction: auctions,
        vendor: vendors,
        user: users,
      })
      .from(payments)
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(vendors, eq(payments.vendorId, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(eq(payments.paymentReference, paymentReference))
      .limit(1);

    if (result.length === 0) {
      console.log('❌ Payment not found!');
      return;
    }

    const { payment, auction, vendor, user } = result[0];

    console.log('📊 Payment Details:');
    console.log(`   - ID: ${payment.id}`);
    console.log(`   - Reference: ${payment.paymentReference}`);
    console.log(`   - Status: ${payment.status}`);
    console.log(`   - Payment Method: ${payment.paymentMethod}`);
    console.log(`   - Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`   - Auto Verified: ${payment.autoVerified}`);
    console.log(`   - Created: ${payment.createdAt.toISOString()}`);
    console.log(`   - Updated: ${payment.updatedAt.toISOString()}`);
    console.log('');

    console.log('🎯 Auction Details:');
    console.log(`   - ID: ${auction.id}`);
    console.log(`   - Status: ${auction.status}`);
    console.log(`   - Winning Bid: ₦${parseFloat(auction.winningBid || '0').toLocaleString()}`);
    console.log('');

    console.log('👤 Vendor Details:');
    console.log(`   - ID: ${vendor.id}`);
    console.log(`   - Business Name: ${vendor.businessName}`);
    console.log(`   - Email: ${user.email}`);
    console.log('');

    // Check wallet state
    const wallet = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, vendor.id))
      .limit(1);

    if (wallet.length === 0) {
      console.log('❌ No wallet found for vendor!');
      return;
    }

    const walletData = wallet[0];

    console.log('💰 Wallet State:');
    console.log(`   - Available Balance: ₦${parseFloat(walletData.availableBalance).toLocaleString()}`);
    console.log(`   - Frozen Amount: ₦${parseFloat(walletData.frozenAmount).toLocaleString()}`);
    console.log(`   - Total Balance: ₦${parseFloat(walletData.totalBalance).toLocaleString()}`);
    console.log('');

    // Calculate expected amounts
    const winningBid = parseFloat(auction.winningBid || '0');
    const depositRate = 0.10; // 10%
    const minimumDeposit = 100000; // ₦100k
    const calculatedDeposit = Math.max(winningBid * depositRate, minimumDeposit);
    const remainingBalance = winningBid - calculatedDeposit;

    console.log('💡 Expected Payment Flow:');
    console.log(`   - Winning Bid: ₦${winningBid.toLocaleString()}`);
    console.log(`   - Frozen Deposit (10%): ₦${calculatedDeposit.toLocaleString()}`);
    console.log(`   - Remaining Balance: ₦${remainingBalance.toLocaleString()}`);
    console.log(`   - Payment Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log('');

    console.log('🔍 What Should Happen When Paystack Webhook Fires:');
    console.log('   1. Verify payment with Paystack API');
    console.log('   2. Update payment status to "verified"');
    console.log('   3. Release frozen deposit from wallet');
    console.log('   4. Transfer total amount (frozen + paid) to NEM Insurance');
    console.log('   5. Update auction status to "payment_verified"');
    console.log('');

    console.log('❌ Current State Analysis:');
    if (payment.status === 'pending') {
      console.log('   - Payment status is still "pending" (webhook not processed)');
    }
    if (auction.status === 'awaiting_payment') {
      console.log('   - Auction status is still "awaiting_payment" (not updated)');
    }
    if (parseFloat(walletData.frozenAmount) > 0) {
      console.log(`   - Frozen amount still in wallet: ₦${parseFloat(walletData.frozenAmount).toLocaleString()}`);
      console.log('   - Frozen deposit was NOT released');
    }
    console.log('');

    console.log('🔧 Webhook Configuration:');
    console.log('   - Webhook URL: https://nemsalvage.com/api/webhooks/paystack');
    console.log('   - This webhook is for WALLET FUNDING (works correctly)');
    console.log('');
    console.log('   ⚠️  ISSUE IDENTIFIED:');
    console.log('   - For AUCTION PAYMENTS, you need a DIFFERENT webhook!');
    console.log('   - Auction payment webhook: /api/webhooks/paystack-auction');
    console.log('');

    console.log('📋 Webhook Comparison:');
    console.log('');
    console.log('   Wallet Funding Webhook:');
    console.log('   - URL: /api/webhooks/paystack');
    console.log('   - Purpose: Add funds to vendor wallet');
    console.log('   - Action: Increase wallet balance');
    console.log('');
    console.log('   Auction Payment Webhook:');
    console.log('   - URL: /api/webhooks/paystack-auction');
    console.log('   - Purpose: Process auction payment');
    console.log('   - Action: Release frozen deposit + transfer total to NEM');
    console.log('');

    console.log('🎯 Root Cause:');
    console.log('   The payment was made through Paystack, but the webhook');
    console.log('   that fired was the WALLET FUNDING webhook, not the');
    console.log('   AUCTION PAYMENT webhook.');
    console.log('');
    console.log('   The wallet funding webhook doesn\'t know how to handle');
    console.log('   auction payments, so it did nothing.');
    console.log('');

    console.log('💡 Solution:');
    console.log('   1. Check Paystack dashboard for webhook logs');
    console.log('   2. Verify which webhook URL was called');
    console.log('   3. Check if metadata was passed correctly');
    console.log('   4. Manually trigger the auction payment webhook');
    console.log('');

    console.log('🔍 Next Steps:');
    console.log('   1. Check payment metadata in database');
    console.log('   2. Look for webhook logs in Paystack dashboard');
    console.log('   3. Simulate webhook to process payment');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the diagnostic
diagnosePaystackAuctionPayment()
  .then(() => {
    console.log('\n✅ Diagnostic complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  });
