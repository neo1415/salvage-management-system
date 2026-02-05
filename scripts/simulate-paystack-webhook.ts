/**
 * Simulate Paystack Webhook Script
 * 
 * This script simulates a Paystack webhook call to process pending wallet funding transactions.
 * Use this in development when Paystack webhooks can't reach localhost.
 * 
 * Usage: npx tsx scripts/simulate-paystack-webhook.ts
 */

import { db } from '@/lib/db/drizzle';
import { walletTransactions } from '@/lib/db/schema/escrow';
import { desc, like, eq } from 'drizzle-orm';

async function main() {
  try {
    console.log('\n🔄 Simulating Paystack Webhook for Pending Transactions\n');

    // Find pending wallet funding transactions
    const pendingTransactions = await db
      .select()
      .from(walletTransactions)
      .where(like(walletTransactions.description, '%Pending confirmation%'))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(10);

    if (pendingTransactions.length === 0) {
      console.log('✅ No pending transactions found');
      return;
    }

    console.log(`Found ${pendingTransactions.length} pending transaction(s):\n`);

    for (const transaction of pendingTransactions) {
      console.log(`Transaction ID: ${transaction.id}`);
      console.log(`Reference: ${transaction.reference}`);
      console.log(`Amount: ₦${parseFloat(transaction.amount).toLocaleString()}`);
      console.log(`Created: ${transaction.createdAt}`);
      console.log(`Description: ${transaction.description}\n`);
    }

    // Ask which transaction to process
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = (query: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(query, resolve);
      });
    };

    const answer = await question('Enter transaction reference to process (or "all" for all): ');
    
    if (answer.toLowerCase() === 'all') {
      // Process all pending transactions
      for (const transaction of pendingTransactions) {
        await processTransaction(transaction);
      }
    } else {
      // Process specific transaction
      const transaction = pendingTransactions.find(t => t.reference === answer.trim());
      if (!transaction) {
        console.log('❌ Transaction not found');
        rl.close();
        return;
      }
      await processTransaction(transaction);
    }

    rl.close();
    console.log('\n✅ Done!\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

async function processTransaction(transaction: any) {
  try {
    console.log(`\n🔄 Processing ${transaction.reference}...`);

    // For pending transactions, we need to extract wallet and vendor info from the reference
    // Reference format: WALLET_{walletId}_{timestamp}
    const walletId = transaction.walletId;
    
    if (!walletId) {
      console.log('❌ Missing wallet ID in transaction');
      return;
    }

    const amount = parseFloat(transaction.amount);

    // Get vendor ID from wallet
    const { escrowWallets } = await import('@/lib/db/schema/escrow');
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.id, walletId))
      .limit(1);

    if (!wallet) {
      console.log('❌ Wallet not found');
      return;
    }

    const vendorId = wallet.vendorId;

    // Import escrow service dynamically
    const { escrowService } = await import('@/features/payments/services/escrow.service');

    // Credit the wallet (this will create a new transaction)
    await escrowService.creditWallet(walletId, amount, transaction.reference, vendorId);

    // Update the original pending transaction description
    await db
      .update(walletTransactions)
      .set({
        description: transaction.description.replace('Pending confirmation', 'Confirmed via webhook simulation'),
      })
      .where(eq(walletTransactions.id, transaction.id));

    console.log(`✅ Credited ₦${amount.toLocaleString()} to wallet ${walletId}`);

  } catch (error) {
    console.error(`❌ Error processing ${transaction.reference}:`, error);
  }
}

main();
