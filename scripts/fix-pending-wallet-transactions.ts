import { db } from '@/lib/db/drizzle';
import { walletTransactions, escrowWallets as wallets } from '@/lib/db/schema/escrow';
import { eq, and, like } from 'drizzle-orm';

/**
 * Fix pending wallet transactions that were stuck due to webhook signature issues
 * This script will mark them as confirmed and update wallet balances
 */
async function fixPendingTransactions() {
  console.log('🔍 Finding pending wallet transactions...\n');

  // Get all pending credit transactions (those with "Pending confirmation" in description)
  const pendingTransactions = await db
    .select()
    .from(walletTransactions)
    .where(
      and(
        eq(walletTransactions.type, 'credit'),
        like(walletTransactions.description, '%Pending confirmation%')
      )
    );

  if (pendingTransactions.length === 0) {
    console.log('✅ No pending transactions found!');
    return;
  }

  console.log(`Found ${pendingTransactions.length} pending transaction(s):\n`);

  for (const transaction of pendingTransactions) {
    console.log(`📝 Transaction: ${transaction.id}`);
    console.log(`   Reference: ${transaction.reference}`);
    console.log(`   Amount: ₦${parseFloat(transaction.amount).toLocaleString()}`);
    console.log(`   Wallet ID: ${transaction.walletId}`);
    console.log(`   Created: ${transaction.createdAt}`);

    // Get current wallet balance
    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, transaction.walletId))
      .limit(1);

    if (!wallet) {
      console.log(`   ❌ Wallet not found! Skipping...\n`);
      continue;
    }

    const currentBalance = parseFloat(wallet.availableBalance);
    const transactionAmount = parseFloat(transaction.amount);
    const newBalance = currentBalance + transactionAmount;

    console.log(`   Current balance: ₦${currentBalance.toLocaleString()}`);
    console.log(`   New balance: ₦${newBalance.toLocaleString()}`);

    // Update transaction description AND balanceAfter to mark as confirmed
    await db
      .update(walletTransactions)
      .set({
        description: 'Wallet funding via Paystack - Confirmed (manual fix)',
        balanceAfter: newBalance.toString(),
      })
      .where(eq(walletTransactions.id, transaction.id));

    // Update wallet balance
    await db
      .update(wallets)
      .set({
        availableBalance: newBalance.toString(),
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, transaction.walletId));

    console.log(`   ✅ Transaction confirmed and balance updated!\n`);
  }

  console.log('🎉 All pending transactions have been fixed!');
}

// Run the script
fixPendingTransactions()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
