/**
 * Complete Payment Flow Diagnostic Script
 * 
 * Investigates all issues reported by user:
 * 1. Why payment records show ₦20k instead of ₦120k
 * 2. Why multiple duplicate payments are being created
 * 3. Why deposit is not being unfrozen
 * 4. Why auction status is not updating
 * 5. Why "Pay Now" button still shows after payment
 */

import { db } from '@/lib/db/drizzle';
import { payments, auctions, auctionWinners, escrowWallets, depositEvents } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const AUCTION_ID = '7340f16e-4689-4795-98f4-be9a7731efe4';
const VENDOR_ID = '049ac348-f4e2-42e0-99cf-b9f4f811560c';

async function diagnose() {
  console.log('🔍 COMPLETE PAYMENT FLOW DIAGNOSTIC');
  console.log('=====================================\n');

  // 1. Check all payment records
  console.log('1️⃣  PAYMENT RECORDS');
  console.log('-------------------');
  const allPayments = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, AUCTION_ID),
        eq(payments.vendorId, VENDOR_ID)
      )
    )
    .orderBy(desc(payments.createdAt));

  console.log(`Found ${allPayments.length} payment records:\n`);
  allPayments.forEach((payment, index) => {
    console.log(`Payment #${index + 1}:`);
    console.log(`  ID: ${payment.id}`);
    console.log(`  Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`  Method: ${payment.paymentMethod}`);
    console.log(`  Status: ${payment.status}`);
    console.log(`  Reference: ${payment.paymentReference}`);
    console.log(`  Created: ${payment.createdAt}`);
    console.log(`  Verified: ${payment.verifiedAt || 'Not verified'}`);
    console.log('');
  });

  // 2. Check auction details
  console.log('\n2️⃣  AUCTION DETAILS');
  console.log('-------------------');
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, AUCTION_ID))
    .limit(1);

  if (auction) {
    console.log(`Status: ${auction.status}`);
    console.log(`Current Bid: ₦${parseFloat(auction.currentBid || '0').toLocaleString()}`);
    console.log(`Current Bidder: ${auction.currentBidder || 'None'}`);
    console.log('');
  }

  // 3. Check winner record
  console.log('\n3️⃣  WINNER RECORD');
  console.log('-------------------');
  const [winner] = await db
    .select()
    .from(auctionWinners)
    .where(
      and(
        eq(auctionWinners.auctionId, AUCTION_ID),
        eq(auctionWinners.vendorId, VENDOR_ID)
      )
    )
    .limit(1);

  if (winner) {
    console.log(`Bid Amount: ₦${parseFloat(winner.bidAmount).toLocaleString()}`);
    console.log(`Deposit Amount: ₦${parseFloat(winner.depositAmount).toLocaleString()}`);
    console.log(`Status: ${winner.status}`);
    console.log(`Rank: ${winner.rank}`);
    console.log('');
  }

  // 4. Check wallet state
  console.log('\n4️⃣  WALLET STATE');
  console.log('-------------------');
  const [wallet] = await db
    .select()
    .from(escrowWallets)
    .where(eq(escrowWallets.vendorId, VENDOR_ID))
    .limit(1);

  if (wallet) {
    const balance = parseFloat(wallet.balance);
    const available = parseFloat(wallet.availableBalance);
    const frozen = parseFloat(wallet.frozenAmount);
    const forfeited = parseFloat(wallet.forfeitedAmount || '0');

    console.log(`Balance: ₦${balance.toLocaleString()}`);
    console.log(`Available: ₦${available.toLocaleString()}`);
    console.log(`Frozen: ₦${frozen.toLocaleString()}`);
    console.log(`Forfeited: ₦${forfeited.toLocaleString()}`);
    console.log('');

    // Check invariant
    const expectedBalance = available + frozen + forfeited;
    const invariantValid = Math.abs(balance - expectedBalance) < 0.01;
    console.log(`Invariant Check: ${invariantValid ? '✅ VALID' : '❌ INVALID'}`);
    if (!invariantValid) {
      console.log(`  Expected: ₦${expectedBalance.toLocaleString()}`);
      console.log(`  Actual: ₦${balance.toLocaleString()}`);
      console.log(`  Difference: ₦${(balance - expectedBalance).toLocaleString()}`);
    }
    console.log('');
  }

  // 5. Check deposit events
  console.log('\n5️⃣  DEPOSIT EVENTS');
  console.log('-------------------');
  const events = await db
    .select()
    .from(depositEvents)
    .where(
      and(
        eq(depositEvents.auctionId, AUCTION_ID),
        eq(depositEvents.vendorId, VENDOR_ID)
      )
    )
    .orderBy(desc(depositEvents.createdAt));

  console.log(`Found ${events.length} deposit events:\n`);
  events.forEach((event, index) => {
    console.log(`Event #${index + 1}:`);
    console.log(`  Type: ${event.eventType}`);
    console.log(`  Amount: ₦${parseFloat(event.amount).toLocaleString()}`);
    console.log(`  Balance After: ₦${parseFloat(event.balanceAfter).toLocaleString()}`);
    console.log(`  Frozen After: ₦${parseFloat(event.frozenAfter).toLocaleString()}`);
    console.log(`  Description: ${event.description}`);
    console.log(`  Created: ${event.createdAt}`);
    console.log('');
  });

  // 6. Analysis and recommendations
  console.log('\n6️⃣  ANALYSIS & ISSUES');
  console.log('-------------------');

  const issues: string[] = [];

  // Check payment amount issue
  const verifiedPayments = allPayments.filter(p => p.status === 'verified');
  if (verifiedPayments.length > 0) {
    const paymentAmount = parseFloat(verifiedPayments[0].amount);
    const expectedAmount = winner ? parseFloat(winner.bidAmount) : 0;
    
    if (paymentAmount !== expectedAmount) {
      issues.push(`❌ Payment amount mismatch: Record shows ₦${paymentAmount.toLocaleString()} but should be ₦${expectedAmount.toLocaleString()}`);
    }
  }

  // Check duplicate payments
  const pendingPayments = allPayments.filter(p => p.status === 'pending');
  if (pendingPayments.length > 1) {
    issues.push(`❌ Multiple pending payments: ${pendingPayments.length} records (should be 1 or 0)`);
  }

  // Check deposit unfreeze
  const unfreezeEvents = events.filter(e => e.eventType === 'unfreeze');
  if (verifiedPayments.length > 0 && unfreezeEvents.length === 0) {
    issues.push(`❌ Deposit not unfrozen: Payment verified but no unfreeze event found`);
  }

  // Check auction status
  if (verifiedPayments.length > 0 && auction && auction.status !== 'paid') {
    issues.push(`❌ Auction status not updated: Status is "${auction.status}" but should be "paid"`);
  }

  // Check frozen amount
  if (wallet && winner) {
    const depositAmount = parseFloat(winner.depositAmount);
    const frozenAmount = parseFloat(wallet.frozenAmount);
    
    if (verifiedPayments.length > 0 && frozenAmount >= depositAmount) {
      issues.push(`❌ Deposit still frozen: ₦${depositAmount.toLocaleString()} should have been unfrozen`);
    }
  }

  if (issues.length === 0) {
    console.log('✅ No issues found - payment flow is working correctly');
  } else {
    console.log('Found the following issues:\n');
    issues.forEach(issue => console.log(issue));
  }

  console.log('\n\n7️⃣  RECOMMENDATIONS');
  console.log('-------------------');

  if (pendingPayments.length > 1) {
    console.log('1. Clean up duplicate pending payments');
    console.log('   - Keep only the most recent pending payment');
    console.log('   - Delete older duplicates');
  }

  if (verifiedPayments.length > 0) {
    const paymentAmount = parseFloat(verifiedPayments[0].amount);
    const expectedAmount = winner ? parseFloat(winner.bidAmount) : 0;
    
    if (paymentAmount !== expectedAmount) {
      console.log('2. Fix payment amount in database');
      console.log(`   - Update payment.amount from ₦${paymentAmount.toLocaleString()} to ₦${expectedAmount.toLocaleString()}`);
    }

    if (unfreezeEvents.length === 0) {
      console.log('3. Manually trigger deposit unfreeze');
      console.log('   - Call webhook handler or payment service to unfreeze deposit');
    }

    if (auction && auction.status !== 'paid') {
      console.log('4. Update auction status');
      console.log(`   - Change status from "${auction.status}" to "paid"`);
    }
  }

  console.log('\n✅ Diagnostic complete');
}

diagnose()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  });
