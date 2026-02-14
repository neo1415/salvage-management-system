/**
 * Investigate Payment Issue Script
 * 
 * This script investigates the ₦30,000 payment to understand:
 * 1. Why it shows method='paystack' instead of 'escrow_wallet'
 * 2. Whether money was actually frozen in the wallet
 * 3. What the correct state should be
 */

import { db } from '../src/lib/db/drizzle';
import { payments } from '../src/lib/db/schema/payments';
import { escrowWallets, walletTransactions } from '../src/lib/db/schema/escrow';
import { vendors } from '../src/lib/db/schema/vendors';
import { auctions } from '../src/lib/db/schema/auctions';
import { eq } from 'drizzle-orm';

async function investigatePayment() {
  try {
    console.log('🔍 Investigating Payment Issue...\n');

    // Get the payment
    const allPayments = await db
      .select({
        payment: payments,
        auction: auctions,
        vendor: vendors,
      })
      .from(payments)
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(vendors, eq(payments.vendorId, vendors.id));

    if (allPayments.length === 0) {
      console.log('❌ No payments found');
      return;
    }

    const { payment, auction, vendor } = allPayments[0];

    console.log('📊 PAYMENT DETAILS:');
    console.log(`  Payment ID: ${payment.id}`);
    console.log(`  Amount: ₦${payment.amount}`);
    console.log(`  Method: ${payment.paymentMethod}`);
    console.log(`  Status: ${payment.status}`);
    console.log(`  Escrow Status: ${payment.escrowStatus}`);
    console.log(`  Created: ${payment.createdAt}`);
    console.log(`  Deadline: ${payment.paymentDeadline}`);
    console.log('');

    console.log('🏆 AUCTION DETAILS:');
    console.log(`  Auction ID: ${auction.id}`);
    console.log(`  Status: ${auction.status}`);
    console.log(`  Current Bid: ₦${auction.currentBid}`);
    console.log(`  Current Bidder: ${auction.currentBidder}`);
    console.log('');

    console.log('👤 VENDOR DETAILS:');
    console.log(`  Vendor ID: ${vendor.id}`);
    console.log(`  Business Name: ${vendor.businessName}`);
    console.log('');

    // Check if vendor has a wallet
    const wallet = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, vendor.id))
      .limit(1);

    if (wallet.length === 0) {
      console.log('❌ NO ESCROW WALLET FOUND for this vendor');
      console.log('   This explains why payment method is NOT escrow_wallet');
      console.log('');
    } else {
      const vendorWallet = wallet[0];
      console.log('💰 VENDOR WALLET:');
      console.log(`  Wallet ID: ${vendorWallet.id}`);
      console.log(`  Balance: ₦${vendorWallet.balance}`);
      console.log(`  Frozen Amount: ₦${vendorWallet.frozenAmount}`);
      console.log(`  Available Balance: ₦${vendorWallet.availableBalance}`);
      console.log('');

      // Get wallet transactions
      const transactions = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.walletId, vendorWallet.id))
        .orderBy(walletTransactions.createdAt);

      console.log(`📝 WALLET TRANSACTIONS (${transactions.length}):`);
      transactions.forEach((tx, idx) => {
        console.log(`  ${idx + 1}. ${tx.type.toUpperCase()} - ₦${tx.amount}`);
        console.log(`     Reference: ${tx.reference}`);
        console.log(`     Description: ${tx.description}`);
        console.log(`     Balance After: ₦${tx.balanceAfter}`);
        console.log(`     Created: ${tx.createdAt}`);
        console.log('');
      });

      // Check if there's a freeze transaction for this auction
      const freezeTransaction = transactions.find(
        tx => tx.type === 'freeze' && tx.reference.includes(auction.id)
      );

      if (freezeTransaction) {
        console.log('✅ FOUND FREEZE TRANSACTION:');
        console.log(`   Amount: ₦${freezeTransaction.amount}`);
        console.log(`   Reference: ${freezeTransaction.reference}`);
        console.log(`   This confirms money WAS frozen from wallet`);
        console.log('');
        console.log('🚨 PROBLEM IDENTIFIED:');
        console.log('   Money was frozen from wallet, but payment record shows:');
        console.log(`   - paymentMethod: '${payment.paymentMethod}' (should be 'escrow_wallet')`);
        console.log(`   - escrowStatus: '${payment.escrowStatus}' (should be 'frozen')`);
        console.log('');
        console.log('💡 SOLUTION:');
        console.log('   The payment record needs to be updated to reflect escrow wallet payment');
      } else {
        console.log('❌ NO FREEZE TRANSACTION FOUND');
        console.log('   Money was NOT frozen from wallet for this auction');
        console.log('   Payment method "paystack" is correct - vendor needs to pay externally');
      }
    }

    console.log('\n✅ Investigation complete!');
  } catch (error) {
    console.error('❌ Error investigating payment:', error);
    throw error;
  }
}

// Run the investigation
investigatePayment()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
