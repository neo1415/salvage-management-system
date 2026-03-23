import { db } from '@/lib/db/drizzle';
import { walletTransactions, escrowWallets as wallets } from '@/lib/db/schema/escrow';
import { eq, and, like, sql } from 'drizzle-orm';

/**
 * Cleanup duplicate wallet transactions and fix balanceAfter values
 * This script will:
 * 1. Remove duplicate transactions (keeping the properly processed ones)
 * 2. Fix balanceAfter values for remaining transactions
 * 3. Recalculate correct wallet balance
 */
async function cleanupDuplicateTransactions() {
  console.log('🔍 Finding duplicate wallet transactions...\n');

  // Get all transactions for the wallet, ordered by creation time
  const allTransactions = await db
    .select()
    .from(walletTransactions)
    .orderBy(walletTransactions.createdAt);

  if (allTransactions.length === 0) {
    console.log('✅ No transactions found!');
    return;
  }

  // Group transactions by reference to find duplicates
  const transactionsByRef = new Map<string, typeof allTransactions>();
  
  for (const transaction of allTransactions) {
    const ref = transaction.reference;
    if (!transactionsByRef.has(ref)) {
      transactionsByRef.set(ref, []);
    }
    transactionsByRef.get(ref)!.push(transaction);
  }

  // Find and remove duplicates
  console.log('🗑️  Removing duplicate transactions...\n');
  
  for (const [ref, transactions] of transactionsByRef.entries()) {
    if (transactions.length > 1) {
      console.log(`Found ${transactions.length} transactions with reference: ${ref}`);
      
      // Keep the one that was properly processed (has correct description)
      const properTransaction = transactions.find(
        t => t.description.includes('Wallet funded') && !t.description.includes('manual fix')
      );
      
      const duplicates = transactions.filter(t => t.id !== properTransaction?.id);
      
      for (const duplicate of duplicates) {
        console.log(`   Deleting duplicate: ${duplicate.id}`);
        await db
          .delete(walletTransactions)
          .where(eq(walletTransactions.id, duplicate.id));
      }
      
      console.log(`   ✅ Kept transaction: ${properTransaction?.id}\n`);
    }
  }

  // Now recalculate balanceAfter for all remaining transactions
  console.log('🔄 Recalculating balanceAfter values...\n');
  
  // Get all remaining transactions ordered by creation time
  const remainingTransactions = await db
    .select()
    .from(walletTransactions)
    .orderBy(walletTransactions.createdAt);

  let runningBalance = 0;

  for (const transaction of remainingTransactions) {
    const amount = parseFloat(transaction.amount);
    
    // Calculate new balance based on transaction type
    if (transaction.type === 'credit') {
      runningBalance += amount;
    } else if (transaction.type === 'debit') {
      runningBalance -= amount;
    }
    // freeze and unfreeze don't change available balance

    console.log(`Transaction ${transaction.id.substring(0, 8)}...`);
    console.log(`   Type: ${transaction.type}`);
    console.log(`   Amount: ₦${amount.toLocaleString()}`);
    console.log(`   Balance After: ₦${runningBalance.toLocaleString()}`);

    // Update balanceAfter
    await db
      .update(walletTransactions)
      .set({
        balanceAfter: runningBalance.toString(),
      })
      .where(eq(walletTransactions.id, transaction.id));

    console.log(`   ✅ Updated\n`);
  }

  // Update wallet balance to match final running balance
  console.log('💰 Updating wallet balance...\n');
  
  const [wallet] = await db
    .select()
    .from(wallets)
    .limit(1);

  if (wallet) {
    await db
      .update(wallets)
      .set({
        availableBalance: runningBalance.toString(),
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, wallet.id));

    console.log(`Wallet ${wallet.id.substring(0, 8)}...`);
    console.log(`   Final Balance: ₦${runningBalance.toLocaleString()}`);
    console.log(`   ✅ Updated\n`);
  }

  console.log('🎉 Cleanup complete!');
}

// Run the script
cleanupDuplicateTransactions()
  .then(() => {
    console.log('\n✨ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
