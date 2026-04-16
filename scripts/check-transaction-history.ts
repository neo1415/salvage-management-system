/**
 * Check Transaction History
 * Verify what's being recorded in depositEvents and walletTransactions
 */

import { db } from '@/lib/db/drizzle';
import { depositEvents } from '@/lib/db/schema/auction-deposit';
import { walletTransactions, escrowWallets } from '@/lib/db/schema/escrow';
import { eq, desc } from 'drizzle-orm';

async function checkHistory(vendorId: string) {
  console.log('\n📊 CHECKING TRANSACTION HISTORY FOR VENDOR:', vendorId);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check depositEvents
  const deposits = await db
    .select()
    .from(depositEvents)
    .where(eq(depositEvents.vendorId, vendorId))
    .orderBy(desc(depositEvents.createdAt))
    .limit(10);

  console.log('DEPOSIT EVENTS (depositEvents table):');
  console.log('Count:', deposits.length);
  if (deposits.length === 0) {
    console.log('  ❌ NO DEPOSIT EVENTS FOUND');
  } else {
    deposits.forEach(d => {
      console.log(`  - ${d.eventType} | ₦${parseFloat(d.amount).toLocaleString()} | ${d.createdAt.toISOString()}`);
      console.log(`    Reason: ${d.reason}`);
      console.log(`    Frozen: ₦${parseFloat(d.frozenBefore).toLocaleString()} → ₦${parseFloat(d.frozenAfter).toLocaleString()}`);
      if (d.auctionId) {
        console.log(`    Auction: ${d.auctionId.substring(0, 8)}...`);
      }
      console.log('');
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check walletTransactions (need to join through escrowWallets)
  const [wallet] = await db
    .select()
    .from(escrowWallets)
    .where(eq(escrowWallets.vendorId, vendorId))
    .limit(1);

  if (!wallet) {
    console.log('WALLET TRANSACTIONS (walletTransactions table):');
    console.log('❌ NO ESCROW WALLET FOUND FOR THIS VENDOR');
  } else {
    const transactions = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.walletId, wallet.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(10);

    console.log('WALLET TRANSACTIONS (walletTransactions table):');
    console.log('Count:', transactions.length);
    if (transactions.length === 0) {
      console.log('  ❌ NO WALLET TRANSACTIONS FOUND');
    } else {
      transactions.forEach(t => {
        console.log(`  - ${t.type} | ₦${parseFloat(t.amount).toLocaleString()} | ${t.createdAt.toISOString()}`);
        console.log(`    Reference: ${t.reference}`);
        console.log(`    Balance After: ₦${parseFloat(t.balanceAfter).toLocaleString()}`);
        console.log(`    Description: ${t.description}`);
        console.log('');
      });
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('SUMMARY:\n');
  console.log(`✅ Deposit Events: ${deposits.length}`);
  const transactionCount = wallet ? (await db.select().from(walletTransactions).where(eq(walletTransactions.walletId, wallet.id)).limit(10)).length : 0;
  console.log(`✅ Wallet Transactions: ${transactionCount}`);
  console.log(`\nTotal visible in transaction history: ${deposits.length + transactionCount}`);
}

const vendorId = process.argv[2] || '5e4eaa5f-7438-4c4f-bc8a-59db91d4a8c3';

checkHistory(vendorId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
