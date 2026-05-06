/**
 * Diagnose Wallet Payment Issue
 * 
 * Investigates:
 * 1. Why UI didn't show payment verified banner
 * 2. Why transaction history shows same balance for unfreeze and debit
 * 3. Whether wallet invariant was violated
 */

import { db } from '@/lib/db/drizzle';
import { 
  payments, 
  auctions, 
  escrowWallets, 
  walletTransactions,
  auctionWinners,
  depositEvents 
} from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const AUCTION_ID = 'c7cb9983-e65f-4dc7-bb66-9a157e73835f';

async function diagnose() {
  console.log('🔍 Diagnosing Wallet Payment Issue');
  console.log('=====================================\n');

  // 1. Check auction status
  console.log('1️⃣ AUCTION STATUS');
  console.log('-------------------');
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, AUCTION_ID))
    .limit(1);

  if (auction) {
    console.log(`✅ Auction found: ${auction.id}`);
    console.log(`   Status: ${auction.status}`);
    console.log(`   Updated At: ${auction.updatedAt}`);
  } else {
    console.log(`❌ Auction not found`);
    return;
  }

  // 2. Check payment record
  console.log('\n2️⃣ PAYMENT RECORD');
  console.log('-------------------');
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.auctionId, AUCTION_ID))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  if (payment) {
    console.log(`✅ Payment found: ${payment.id}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Auto Verified: ${payment.autoVerified}`);
    console.log(`   Verified At: ${payment.verifiedAt}`);
    console.log(`   Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`   Method: ${payment.paymentMethod}`);
    console.log(`   Reference: ${payment.paymentReference}`);
  } else {
    console.log(`❌ Payment not found`);
    return;
  }

  // 3. Check winner record
  console.log('\n3️⃣ WINNER RECORD');
  console.log('-------------------');
  const [winner] = await db
    .select()
    .from(auctionWinners)
    .where(eq(auctionWinners.auctionId, AUCTION_ID))
    .limit(1);

  if (winner) {
    console.log(`✅ Winner found: ${winner.vendorId}`);
    console.log(`   Bid Amount: ₦${parseFloat(winner.bidAmount).toLocaleString()}`);
    console.log(`   Deposit Amount: ₦${parseFloat(winner.depositAmount).toLocaleString()}`);
    console.log(`   Remaining: ₦${(parseFloat(winner.bidAmount) - parseFloat(winner.depositAmount)).toLocaleString()}`);
  } else {
    console.log(`❌ Winner not found`);
    return;
  }

  // 4. Check wallet state
  console.log('\n4️⃣ CURRENT WALLET STATE');
  console.log('-------------------------');
  const [wallet] = await db
    .select()
    .from(escrowWallets)
    .where(eq(escrowWallets.vendorId, winner.vendorId))
    .limit(1);

  if (wallet) {
    const balance = parseFloat(wallet.balance);
    const available = parseFloat(wallet.availableBalance);
    const frozen = parseFloat(wallet.frozenAmount);
    const forfeited = parseFloat(wallet.forfeitedAmount || '0');

    console.log(`✅ Wallet found: ${wallet.id}`);
    console.log(`   Balance: ₦${balance.toLocaleString()}`);
    console.log(`   Available: ₦${available.toLocaleString()}`);
    console.log(`   Frozen: ₦${frozen.toLocaleString()}`);
    console.log(`   Forfeited: ₦${forfeited.toLocaleString()}`);
    
    // Check invariant
    const expectedBalance = available + frozen + forfeited;
    const invariantValid = Math.abs(balance - expectedBalance) < 0.01;
    
    console.log(`\n   Invariant Check:`);
    console.log(`   Expected Balance: ₦${expectedBalance.toLocaleString()}`);
    console.log(`   Actual Balance: ₦${balance.toLocaleString()}`);
    console.log(`   Difference: ₦${(balance - expectedBalance).toFixed(2)}`);
    console.log(`   Status: ${invariantValid ? '✅ VALID' : '❌ VIOLATED'}`);
  } else {
    console.log(`❌ Wallet not found`);
    return;
  }

  // 5. Check wallet transactions (last 10)
  console.log('\n5️⃣ RECENT WALLET TRANSACTIONS');
  console.log('-------------------------------');
  const transactions = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.walletId, wallet.id))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(10);

  console.log(`Found ${transactions.length} recent transactions:\n`);
  
  transactions.forEach((tx, index) => {
    const amount = parseFloat(tx.amount);
    const balanceAfter = parseFloat(tx.balanceAfter);
    const sign = tx.type === 'credit' || tx.type === 'unfreeze' ? '+' : '-';
    
    console.log(`${index + 1}. ${tx.createdAt?.toLocaleString()}`);
    console.log(`   Type: ${tx.type}`);
    console.log(`   Amount: ${sign}₦${amount.toLocaleString()}`);
    console.log(`   Balance After: ₦${balanceAfter.toLocaleString()}`);
    console.log(`   Reference: ${tx.reference}`);
    console.log(`   Description: ${tx.description}`);
    console.log('');
  });

  // 6. Check deposit events
  console.log('\n6️⃣ DEPOSIT EVENTS FOR THIS AUCTION');
  console.log('-------------------------------------');
  const events = await db
    .select()
    .from(depositEvents)
    .where(
      and(
        eq(depositEvents.vendorId, winner.vendorId),
        eq(depositEvents.auctionId, AUCTION_ID)
      )
    )
    .orderBy(desc(depositEvents.createdAt))
    .limit(5);

  console.log(`Found ${events.length} deposit events:\n`);
  
  events.forEach((event, index) => {
    console.log(`${index + 1}. ${event.createdAt?.toLocaleString()}`);
    console.log(`   Event Type: ${event.eventType}`);
    console.log(`   Amount: ₦${parseFloat(event.amount).toLocaleString()}`);
    console.log(`   Balance: ${event.balanceBefore} → ${event.balanceAfter}`);
    console.log(`   Frozen: ${event.frozenBefore} → ${event.frozenAfter}`);
    console.log(`   Available: ${event.availableBefore} → ${event.availableAfter}`);
    console.log(`   Description: ${event.description}`);
    console.log('');
  });

  // 7. Analyze the issue
  console.log('\n7️⃣ ISSUE ANALYSIS');
  console.log('-------------------');
  
  const finalBid = parseFloat(winner.bidAmount);
  const depositAmount = parseFloat(winner.depositAmount);
  const remainingAmount = finalBid - depositAmount;
  
  console.log(`Payment Breakdown:`);
  console.log(`  Final Bid: ₦${finalBid.toLocaleString()}`);
  console.log(`  Deposit (frozen): ₦${depositAmount.toLocaleString()}`);
  console.log(`  Remaining (from available): ₦${remainingAmount.toLocaleString()}`);
  
  // Find the wallet state BEFORE payment
  const freezeEvent = events.find(e => e.eventType === 'freeze' && e.auctionId === AUCTION_ID);
  if (freezeEvent) {
    const availableBeforePayment = parseFloat(freezeEvent.availableBefore || '0');
    console.log(`\n  Available Balance BEFORE Payment: ₦${availableBeforePayment.toLocaleString()}`);
    console.log(`  Required from Available: ₦${remainingAmount.toLocaleString()}`);
    
    if (availableBeforePayment < remainingAmount) {
      console.log(`\n  ❌ PROBLEM FOUND: Insufficient available balance!`);
      console.log(`     Shortfall: ₦${(remainingAmount - availableBeforePayment).toLocaleString()}`);
      console.log(`     This payment should have been BLOCKED.`);
    } else {
      console.log(`\n  ✅ Sufficient available balance`);
    }
  }

  // Check transaction history issue
  console.log(`\n8️⃣ TRANSACTION HISTORY ISSUE`);
  console.log('------------------------------');
  
  const unfreezeT x = transactions.find(tx => 
    tx.reference?.includes('UNFREEZE') && tx.reference?.includes(AUCTION_ID.substring(0, 8))
  );
  const debitTx = transactions.find(tx => 
    tx.reference?.includes('TRANSFER') && tx.reference?.includes(AUCTION_ID.substring(0, 8))
  );
  
  if (unfreezeT x && debitTx) {
    const unfreezeBalance = parseFloat(unfreezeT x.balanceAfter);
    const debitBalance = parseFloat(debitTx.balanceAfter);
    
    console.log(`Unfreeze Transaction:`);
    console.log(`  Balance After: ₦${unfreezeBalance.toLocaleString()}`);
    console.log(`\nDebit Transaction:`);
    console.log(`  Balance After: ₦${debitBalance.toLocaleString()}`);
    
    if (Math.abs(unfreezeBalance - debitBalance) < 0.01) {
      console.log(`\n❌ PROBLEM: Both transactions show SAME balance!`);
      console.log(`   This is incorrect. The debit should reduce the balance.`);
      console.log(`   Expected debit balance: ₦${(unfreezeBalance - depositAmount).toLocaleString()}`);
    } else {
      console.log(`\n✅ Balances are different (correct)`);
    }
  }

  console.log('\n=====================================');
  console.log('✅ Diagnosis Complete');
}

diagnose()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
