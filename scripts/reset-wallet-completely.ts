import { db } from '../src/lib/db/drizzle';
import { walletTransactions, escrowWallets } from '../src/lib/db/schema/escrow';
import { eq } from 'drizzle-orm';
import { kv } from '@vercel/kv';

/**
 * Complete wallet reset - deletes ALL transactions and resets wallet to zero
 * Use this to start fresh when wallet data is corrupted
 */
async function resetWallet() {
  console.log('🔄 Starting complete wallet reset...\n');

  // Get all wallets
  const allWallets = await db.select().from(escrowWallets);

  if (allWallets.length === 0) {
    console.log('✅ No wallets found!');
    return;
  }

  console.log(`Found ${allWallets.length} wallet(s)\n`);

  for (const wallet of allWallets) {
    console.log(`\n💼 Processing Wallet: ${wallet.id}`);
    console.log(`   Vendor ID: ${wallet.vendorId}`);
    console.log(`   Current Balance: ₦${parseFloat(wallet.balance).toLocaleString()}`);
    console.log(`   Current Available Balance: ₦${parseFloat(wallet.availableBalance).toLocaleString()}`);
    console.log(`   Current Frozen Amount: ₦${parseFloat(wallet.frozenAmount).toLocaleString()}`);

    // Get all transactions for this wallet
    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.walletId, wallet.id));

    console.log(`   Found ${transactions.length} transaction(s)`);

    // Delete all transactions
    if (transactions.length > 0) {
      await db
        .delete(walletTransactions)
        .where(eq(walletTransactions.walletId, wallet.id));
      console.log(`   ✅ Deleted all transactions`);
    }

    // Reset wallet balances to zero (all three fields)
    await db
      .update(escrowWallets)
      .set({
        balance: '0.00',
        availableBalance: '0.00',
        frozenAmount: '0.00',
        updatedAt: new Date(),
      })
      .where(eq(escrowWallets.id, wallet.id));

    // Clear Redis cache for this wallet
    await kv.del(`wallet:${wallet.id}`);

    console.log(`   ✅ Reset all wallet balances to ₦0`);
    console.log(`   ✅ Cleared Redis cache`);
  }

  console.log('\n🎉 Complete wallet reset finished!');
  console.log('\nAll wallets now have:');
  console.log('  - Total Balance: ₦0');
  console.log('  - Available Balance: ₦0');
  console.log('  - Frozen Amount: ₦0');
  console.log('  - No transaction history');
  console.log('  - Redis cache cleared');
  console.log('\nYou can now start fresh with new wallet funding.');
}

// Run the script
resetWallet()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
