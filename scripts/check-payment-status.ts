/**
 * Check Payment Status Script
 * 
 * This script checks the status of payments and escrow wallets
 * to help debug why Finance dashboard shows payments but payments page doesn't
 */

import { db } from '../src/lib/db/drizzle';
import { payments } from '../src/lib/db/schema/payments';
import { escrowWallets, walletTransactions } from '../src/lib/db/schema/escrow';
import { vendors } from '../src/lib/db/schema/vendors';
import { eq } from 'drizzle-orm';

async function checkPaymentStatus() {
  try {
    console.log('🔍 Checking Payment Status...\n');

    // Check all payments
    console.log('📊 ALL PAYMENTS:');
    const allPayments = await db
      .select({
        id: payments.id,
        auctionId: payments.auctionId,
        vendorId: payments.vendorId,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        status: payments.status,
        escrowStatus: payments.escrowStatus,
        autoVerified: payments.autoVerified,
        paymentDeadline: payments.paymentDeadline,
        createdAt: payments.createdAt,
      })
      .from(payments);

    if (allPayments.length === 0) {
      console.log('  ❌ No payments found in payments table');
    } else {
      console.log(`  ✅ Found ${allPayments.length} payment(s):\n`);
      allPayments.forEach((payment, index) => {
        console.log(`  Payment #${index + 1}:`);
        console.log(`    ID: ${payment.id}`);
        console.log(`    Auction ID: ${payment.auctionId}`);
        console.log(`    Vendor ID: ${payment.vendorId}`);
        console.log(`    Amount: ₦${payment.amount}`);
        console.log(`    Method: ${payment.paymentMethod}`);
        console.log(`    Status: ${payment.status}`);
        console.log(`    Escrow Status: ${payment.escrowStatus}`);
        console.log(`    Auto Verified: ${payment.autoVerified}`);
        console.log(`    Payment Deadline: ${payment.paymentDeadline}`);
        console.log(`    Created At: ${payment.createdAt}`);
        console.log('');
      });
    }

    // Check escrow wallets
    console.log('\n💰 ESCROW WALLETS:');
    const wallets = await db
      .select({
        wallet: escrowWallets,
        vendor: vendors,
      })
      .from(escrowWallets)
      .leftJoin(vendors, eq(escrowWallets.vendorId, vendors.id));

    if (wallets.length === 0) {
      console.log('  ❌ No escrow wallets found');
    } else {
      console.log(`  ✅ Found ${wallets.length} wallet(s):\n`);
      for (const { wallet, vendor } of wallets) {
        console.log(`  Wallet for ${vendor?.businessName || 'Unknown Vendor'}:`);
        console.log(`    Wallet ID: ${wallet.id}`);
        console.log(`    Balance: ₦${wallet.balance}`);
        console.log(`    Frozen Amount: ₦${wallet.frozenAmount}`);
        console.log(`    Available Balance: ₦${wallet.availableBalance}`);
        console.log(`    Created At: ${wallet.createdAt}`);

        // Get transactions for this wallet
        const transactions = await db
          .select()
          .from(walletTransactions)
          .where(eq(walletTransactions.walletId, wallet.id))
          .orderBy(walletTransactions.createdAt);

        if (transactions.length > 0) {
          console.log(`    Transactions (${transactions.length}):`);
          transactions.forEach((tx, idx) => {
            console.log(`      ${idx + 1}. ${tx.type.toUpperCase()} - ₦${tx.amount}`);
            console.log(`         Reference: ${tx.reference}`);
            console.log(`         Description: ${tx.description}`);
            console.log(`         Balance After: ₦${tx.balanceAfter}`);
            console.log(`         Created: ${tx.createdAt}`);
          });
        }
        console.log('');
      }
    }

    // Check today's payments specifically
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log('\n📅 TODAY\'S PAYMENTS:');
    const todaysPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.createdAt, today));

    console.log(`  Found ${todaysPayments.length} payment(s) created today`);

    // Check bank transfer payments
    console.log('\n🏦 BANK TRANSFER PAYMENTS (Pending):');
    const bankTransferPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.paymentMethod, 'bank_transfer'));

    console.log(`  Found ${bankTransferPayments.length} bank transfer payment(s)`);

    console.log('\n✅ Check complete!');
  } catch (error) {
    console.error('❌ Error checking payment status:', error);
    throw error;
  }
}

// Run the check
checkPaymentStatus()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
