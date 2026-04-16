/**
 * Diagnose Current Payment State
 * Check the complete state of the auction and payments
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { auctionWinners, auctionDocuments } from '@/lib/db/schema/auction-deposit';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { vendors } from '@/lib/db/schema/vendors';
import { eq, and, desc } from 'drizzle-orm';

const AUCTION_ID = '260582d5-5c55-4ca5-8e22-609fef09b7f3';
const VENDOR_ID = '5e4eaa5f-7438-4c4f-bc8a-59db91d4a8c3';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Complete Payment State Diagnosis');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Check auction status
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, AUCTION_ID))
    .limit(1);

  console.log('1. AUCTION STATUS');
  console.log('─────────────────────────────────────────────────────');
  if (auction) {
    console.log(`Status: ${auction.status}`);
    console.log(`Current Bid: ₦${parseFloat(auction.currentBid || '0').toLocaleString()}`);
    console.log(`Current Bidder: ${auction.currentBidder || 'None'}`);
  } else {
    console.log('❌ Auction not found');
  }
  console.log('');

  // 2. Check winner record
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

  console.log('2. WINNER RECORD');
  console.log('─────────────────────────────────────────────────────');
  if (winner) {
    console.log(`Status: ${winner.status}`);
    console.log(`Bid Amount: ₦${parseFloat(winner.bidAmount).toLocaleString()}`);
    console.log(`Deposit Amount: ₦${parseFloat(winner.depositAmount).toLocaleString()}`);
    console.log(`Remaining Amount: ₦${(parseFloat(winner.bidAmount) - parseFloat(winner.depositAmount)).toLocaleString()}`);
    console.log(`Payment Deadline: ${winner.paymentDeadline || 'Not set'}`);
  } else {
    console.log('❌ Winner record not found');
  }
  console.log('');

  // 3. Check documents
  const documents = await db
    .select()
    .from(auctionDocuments)
    .where(eq(auctionDocuments.auctionId, AUCTION_ID))
    .orderBy(desc(auctionDocuments.createdAt));

  console.log('3. DOCUMENTS');
  console.log('─────────────────────────────────────────────────────');
  console.log(`Total documents: ${documents.length}`);
  for (const doc of documents) {
    console.log(`  - ${doc.documentType}: ${doc.status} (signed: ${doc.signedAt ? 'Yes' : 'No'})`);
  }
  console.log('');

  // 4. Check all payments
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

  console.log('4. ALL PAYMENTS');
  console.log('─────────────────────────────────────────────────────');
  console.log(`Total payments: ${allPayments.length}\n`);
  
  for (const payment of allPayments) {
    const age = (Date.now() - new Date(payment.createdAt).getTime()) / (1000 * 60);
    console.log(`Payment ${payment.id}:`);
    console.log(`  Method: ${payment.paymentMethod}`);
    console.log(`  Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`  Status: ${payment.status}`);
    console.log(`  Reference: ${payment.paymentReference || 'N/A'}`);
    console.log(`  Created: ${payment.createdAt} (${age.toFixed(0)} min ago)`);
    console.log(`  Verified: ${payment.verifiedAt || 'Not verified'}`);
    console.log('');
  }

  // 5. Check wallet state
  const [wallet] = await db
    .select()
    .from(escrowWallets)
    .where(eq(escrowWallets.vendorId, VENDOR_ID))
    .limit(1);

  console.log('5. WALLET STATE');
  console.log('─────────────────────────────────────────────────────');
  if (wallet) {
    const balance = parseFloat(wallet.balance);
    const available = parseFloat(wallet.availableBalance);
    const frozen = parseFloat(wallet.frozenAmount);
    const forfeited = parseFloat(wallet.forfeitedAmount || '0');
    
    console.log(`Balance: ₦${balance.toLocaleString()}`);
    console.log(`Available: ₦${available.toLocaleString()}`);
    console.log(`Frozen: ₦${frozen.toLocaleString()}`);
    console.log(`Forfeited: ₦${forfeited.toLocaleString()}`);
    console.log(`Invariant Check: ${balance} = ${available} + ${frozen} + ${forfeited} = ${(available + frozen + forfeited).toFixed(2)}`);
    console.log(`Invariant: ${Math.abs(balance - (available + frozen + forfeited)) < 0.01 ? '✅ PASS' : '❌ FAIL'}`);
  } else {
    console.log('❌ Wallet not found');
  }
  console.log('');

  // 6. Analysis
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ANALYSIS');
  console.log('═══════════════════════════════════════════════════════\n');

  const signedDocs = documents.filter(d => d.signedAt !== null);
  const pendingPayments = allPayments.filter(p => p.status === 'pending');
  const verifiedPayments = allPayments.filter(p => p.status === 'verified');

  console.log(`Documents signed: ${signedDocs.length}/${documents.length}`);
  console.log(`Pending payments: ${pendingPayments.length}`);
  console.log(`Verified payments: ${verifiedPayments.length}`);
  console.log('');

  if (signedDocs.length === documents.length && documents.length > 0) {
    console.log('✅ All documents are signed');
  } else {
    console.log('⚠️  Not all documents are signed');
  }

  if (verifiedPayments.length > 0) {
    console.log('✅ Payment has been verified');
    console.log('');
    console.log('EXPECTED BEHAVIOR:');
    console.log('  1. Deposit should be unfrozen from wallet');
    console.log('  2. "Pay Now" button should disappear');
    console.log('  3. Pickup authorization should appear');
    console.log('');
  } else if (pendingPayments.length > 0) {
    console.log('⏳ Payment is pending (waiting for Paystack webhook)');
    console.log('');
    console.log('NEXT STEPS:');
    console.log('  1. Complete Paystack payment');
    console.log('  2. Webhook will verify payment');
    console.log('  3. Deposit will be unfrozen');
    console.log('  4. Pickup authorization will appear');
    console.log('');
  } else {
    console.log('❌ No payment found');
    console.log('');
    console.log('ISSUE: Payment record may have been deleted');
    console.log('');
  }

  // 7. Recommendations
  console.log('═══════════════════════════════════════════════════════');
  console.log('  RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════\n');

  if (pendingPayments.length > 0) {
    const paystackPayment = pendingPayments.find(p => p.paymentMethod === 'paystack');
    if (paystackPayment) {
      console.log('Current state: Paystack payment is pending');
      console.log('');
      console.log('Options:');
      console.log('  A. Complete the Paystack payment (recommended)');
      console.log('     - Go to Paystack and complete payment');
      console.log('     - Webhook will auto-verify');
      console.log('');
      console.log('  B. Simulate webhook for testing:');
      console.log(`     npx tsx scripts/simulate-paystack-webhook-auction.ts ${AUCTION_ID}`);
      console.log('');
    }
  }
}

main().catch(console.error);
