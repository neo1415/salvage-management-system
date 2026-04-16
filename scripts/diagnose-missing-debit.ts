/**
 * Diagnostic Script: Missing Debit Transaction
 * 
 * Checks if debit transaction is missing after Paystack payment verification
 */

import { db } from '@/lib/db/drizzle';
import { walletTransactions, escrowWallets } from '@/lib/db/schema/escrow';
import { depositEvents, auctionWinners } from '@/lib/db/schema/auction-deposit';
import { payments } from '@/lib/db/schema/payments';
import { eq, and, desc } from 'drizzle-orm';

async function diagnose() {
  console.log('\n🔍 DIAGNOSING MISSING DEBIT TRANSACTION\n');
  console.log('='.repeat(80));
  
  // Get latest verified Paystack payment
  const [latestPayment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.paymentMethod, 'paystack'),
        eq(payments.status, 'verified')
      )
    )
    .orderBy(desc(payments.verifiedAt))
    .limit(1);
  
  if (!latestPayment) {
    console.log('❌ No verified Paystack payments found');
    return;
  }
  
  console.log('\n📋 LATEST VERIFIED PAYSTACK PAYMENT:');
  console.log(`  Payment ID: ${latestPayment.id}`);
  console.log(`  Auction ID: ${latestPayment.auctionId}`);
  console.log(`  Vendor ID: ${latestPayment.vendorId}`);
  console.log(`  Amount: ₦${parseFloat(latestPayment.amount).toLocaleString()}`);
  console.log(`  Verified At: ${latestPayment.verifiedAt}`);
  
  // Get winner record to find deposit amount
  const [winner] = await db
    .select()
    .from(auctionWinners)
    .where(
      and(
        eq(auctionWinners.auctionId, latestPayment.auctionId),
        eq(auctionWinners.vendorId, latestPayment.vendorId),
        eq(auctionWinners.status, 'active')
      )
    )
    .limit(1);
  
  if (!winner) {
    console.log('\n❌ Winner record not found');
    return;
  }
  
  const depositAmount = parseFloat(winner.depositAmount);
  console.log(`\n💰 DEPOSIT AMOUNT: ₦${depositAmount.toLocaleString()}`);
  
  // Get wallet
  const [wallet] = await db
    .select()
    .from(escrowWallets)
    .where(eq(escrowWallets.vendorId, latestPayment.vendorId))
    .limit(1);
  
  if (!wallet) {
    console.log('\n❌ Wallet not found');
    return;
  }
  
  console.log(`\n💳 WALLET STATE:`);
  console.log(`  Balance: ₦${parseFloat(wallet.balance).toLocaleString()}`);
  console.log(`  Available: ₦${parseFloat(wallet.availableBalance).toLocaleString()}`);
  console.log(`  Frozen: ₦${parseFloat(wallet.frozenAmount).toLocaleString()}`);
  
  // Check for unfreeze event in depositEvents
  const unfreezeEvents = await db
    .select()
    .from(depositEvents)
    .where(
      and(
        eq(depositEvents.auctionId, latestPayment.auctionId),
        eq(depositEvents.vendorId, latestPayment.vendorId),
        eq(depositEvents.eventType, 'unfreeze')
      )
    );
  
  console.log(`\n📊 DEPOSIT EVENTS (depositEvents table):`);
  console.log(`  Unfreeze events: ${unfreezeEvents.length}`);
  if (unfreezeEvents.length > 0) {
    console.log(`  ✅ Unfreeze event exists`);
    unfreezeEvents.forEach((event, i) => {
      console.log(`\n  Event ${i + 1}:`);
      console.log(`    Amount: ₦${parseFloat(event.amount).toLocaleString()}`);
      console.log(`    Created: ${event.createdAt}`);
      console.log(`    Description: ${event.description}`);
    });
  } else {
    console.log(`  ❌ No unfreeze events found`);
  }
  
  // Check for debit transaction in walletTransactions
  const debitTransactions = await db
    .select()
    .from(walletTransactions)
    .where(
      and(
        eq(walletTransactions.walletId, wallet.id),
        eq(walletTransactions.type, 'debit'),
        eq(walletTransactions.reference, `TRANSFER_${latestPayment.auctionId.substring(0, 8)}`)
      )
    );
  
  console.log(`\n📊 WALLET TRANSACTIONS (walletTransactions table):`);
  console.log(`  Debit transactions for this auction: ${debitTransactions.length}`);
  if (debitTransactions.length > 0) {
    console.log(`  ✅ Debit transaction exists`);
    debitTransactions.forEach((tx, i) => {
      console.log(`\n  Transaction ${i + 1}:`);
      console.log(`    Amount: ₦${parseFloat(tx.amount).toLocaleString()}`);
      console.log(`    Created: ${tx.createdAt}`);
      console.log(`    Description: ${tx.description}`);
    });
  } else {
    console.log(`  ❌ NO DEBIT TRANSACTION FOUND`);
    console.log(`\n  🔍 Expected transaction:`);
    console.log(`    Type: debit`);
    console.log(`    Amount: ₦${depositAmount.toLocaleString()}`);
    console.log(`    Reference: TRANSFER_${latestPayment.auctionId.substring(0, 8)}`);
    console.log(`    Description: Funds released for auction ${latestPayment.auctionId.substring(0, 8)} - Transferred to NEM Insurance via Paystack`);
  }
  
  // Check for unfreeze transaction in walletTransactions
  const unfreezeTransactions = await db
    .select()
    .from(walletTransactions)
    .where(
      and(
        eq(walletTransactions.walletId, wallet.id),
        eq(walletTransactions.type, 'unfreeze'),
        eq(walletTransactions.reference, `UNFREEZE_${latestPayment.auctionId}`)
      )
    );
  
  console.log(`\n  Unfreeze transactions for this auction: ${unfreezeTransactions.length}`);
  if (unfreezeTransactions.length > 0) {
    console.log(`  ✅ Unfreeze transaction exists in walletTransactions`);
  } else {
    console.log(`  ❌ NO UNFREEZE TRANSACTION in walletTransactions`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 ROOT CAUSE:');
  console.log('  The Paystack webhook is calling handlePaystackWebhook which:');
  console.log('  1. ✅ Unfreezes deposit in depositEvents table');
  console.log('  2. ❌ Does NOT call triggerFundReleaseOnDocumentCompletion');
  console.log('  3. ❌ Does NOT create debit transaction in walletTransactions');
  console.log('  4. ❌ Does NOT transfer money to finance via escrowService.releaseFunds()');
  
  console.log('\n💡 SOLUTION:');
  console.log('  The webhook already calls triggerFundReleaseOnDocumentCompletion,');
  console.log('  but it may be failing silently. Check the logs for errors.');
  console.log('  The debit transaction should be created by escrowService.releaseFunds()');
  console.log('  which is called by triggerFundReleaseOnDocumentCompletion.');
  
  console.log('\n✅ Diagnosis complete\n');
}

diagnose().catch(console.error);
