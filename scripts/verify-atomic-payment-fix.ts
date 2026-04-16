/**
 * Verification Script: Atomic Payment Fix
 * 
 * This script verifies that the atomic payment fix is working correctly
 * by checking the payment flow and deposit states.
 * 
 * Run with: npx tsx scripts/verify-atomic-payment-fix.ts
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { auctionWinners } from '@/lib/db/schema/auction-deposit';
import { escrowWallets, walletTransactions } from '@/lib/db/schema/escrow';
import { eq, and, desc } from 'drizzle-orm';

interface VerificationResult {
  auctionId: string;
  winnerId: string;
  paymentStatus: string;
  paymentAmount: number;
  depositAmount: number;
  depositReleased: boolean;
  nonWinnersUnfrozen: boolean;
  issues: string[];
}

async function verifyAtomicPaymentFix(): Promise<void> {
  console.log('🔍 Verifying atomic payment fix...\n');

  // Get all verified payments
  const verifiedPayments = await db
    .select({
      id: payments.id,
      auctionId: payments.auctionId,
      vendorId: payments.vendorId,
      amount: payments.amount,
      status: payments.status,
      verifiedAt: payments.verifiedAt,
    })
    .from(payments)
    .where(eq(payments.status, 'verified'))
    .orderBy(desc(payments.verifiedAt));

  console.log(`✅ Found ${verifiedPayments.length} verified payments\n`);

  if (verifiedPayments.length === 0) {
    console.log('No verified payments to check. Create a test auction and complete payment.');
    return;
  }

  const results: VerificationResult[] = [];

  for (const payment of verifiedPayments) {
    console.log(`\n📦 Checking auction ${payment.auctionId.substring(0, 8)}...`);
    
    const result: VerificationResult = {
      auctionId: payment.auctionId,
      winnerId: payment.vendorId,
      paymentStatus: payment.status,
      paymentAmount: parseFloat(payment.amount),
      depositAmount: 0,
      depositReleased: false,
      nonWinnersUnfrozen: false,
      issues: [],
    };

    try {
      // Get winner record
      const [winner] = await db
        .select()
        .from(auctionWinners)
        .where(
          and(
            eq(auctionWinners.auctionId, payment.auctionId),
            eq(auctionWinners.vendorId, payment.vendorId)
          )
        )
        .limit(1);

      if (!winner) {
        result.issues.push('Winner record not found');
        results.push(result);
        continue;
      }

      result.depositAmount = parseFloat(winner.depositAmount);

      // Check if deposit was released (debit transaction exists)
      const [debitTransaction] = await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.type, 'debit'),
            eq(walletTransactions.reference, `TRANSFER_${payment.auctionId.substring(0, 8)}_${payment.verifiedAt?.getTime()}`)
          )
        )
        .limit(1);

      // Alternative: Check for any debit transaction for this auction
      if (!debitTransaction) {
        const [anyDebitForAuction] = await db
          .select()
          .from(walletTransactions)
          .where(eq(walletTransactions.type, 'debit'))
          .orderBy(desc(walletTransactions.createdAt))
          .limit(10);

        // Check if any recent debit matches this auction
        const wallet = await db
          .select()
          .from(escrowWallets)
          .where(eq(escrowWallets.vendorId, payment.vendorId))
          .limit(1);

        if (wallet.length > 0) {
          const recentDebits = await db
            .select()
            .from(walletTransactions)
            .where(
              and(
                eq(walletTransactions.walletId, wallet[0].id),
                eq(walletTransactions.type, 'debit')
              )
            )
            .orderBy(desc(walletTransactions.createdAt))
            .limit(5);

          const hasDebit = recentDebits.some((t) => 
            t.reference.includes(payment.auctionId.substring(0, 8))
          );

          result.depositReleased = hasDebit;

          if (!hasDebit) {
            result.issues.push('Deposit NOT released - no debit transaction found');
          }
        }
      } else {
        result.depositReleased = true;
      }

      // Check if non-winners' deposits are unfrozen
      const allBidders = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, payment.auctionId));

      const nonWinners = allBidders.filter((b) => b.vendorId !== payment.vendorId);

      if (nonWinners.length === 0) {
        result.nonWinnersUnfrozen = true; // No non-winners to check
      } else {
        // Check if any non-winner still has frozen funds
        let allUnfrozen = true;

        for (const bidder of nonWinners) {
          const [wallet] = await db
            .select()
            .from(escrowWallets)
            .where(eq(escrowWallets.vendorId, bidder.vendorId))
            .limit(1);

          if (wallet) {
            const frozenAmount = parseFloat(wallet.frozenAmount);
            const depositAmount = parseFloat(bidder.depositAmount);

            // Check if this specific deposit is still frozen
            // (wallet might have other frozen amounts from other auctions)
            if (frozenAmount >= depositAmount) {
              // Check if there's an unfreeze transaction for this auction
              const [unfreezeTransaction] = await db
                .select()
                .from(walletTransactions)
                .where(
                  and(
                    eq(walletTransactions.walletId, wallet.id),
                    eq(walletTransactions.type, 'unfreeze'),
                    eq(walletTransactions.reference, `UNFREEZE_${payment.auctionId}`)
                  )
                )
                .limit(1);

              if (!unfreezeTransaction) {
                allUnfrozen = false;
                result.issues.push(
                  `Non-winner ${bidder.vendorId.substring(0, 8)} still has frozen deposit (₦${depositAmount.toLocaleString()})`
                );
              }
            }
          }
        }

        result.nonWinnersUnfrozen = allUnfrozen;
      }

      results.push(result);

      // Print result
      if (result.issues.length === 0) {
        console.log(`   ✅ All checks passed`);
      } else {
        console.log(`   ⚠️  Issues found:`);
        result.issues.forEach((issue) => console.log(`      - ${issue}`));
      }
    } catch (error) {
      console.error(`   ❌ Error checking auction:`, error);
      result.issues.push(error instanceof Error ? error.message : 'Unknown error');
      results.push(result);
    }
  }

  // Print summary
  console.log('\n\n📊 SUMMARY\n');
  console.log('='.repeat(80));

  const totalAuctions = results.length;
  const auctionsWithIssues = results.filter((r) => r.issues.length > 0).length;
  const auctionsOk = totalAuctions - auctionsWithIssues;

  console.log(`Total auctions checked: ${totalAuctions}`);
  console.log(`Auctions OK: ${auctionsOk}`);
  console.log(`Auctions with issues: ${auctionsWithIssues}`);

  if (auctionsWithIssues > 0) {
    console.log('\n⚠️  Auctions with issues:\n');
    results
      .filter((r) => r.issues.length > 0)
      .forEach((r) => {
        console.log(`Auction ${r.auctionId.substring(0, 8)}:`);
        console.log(`  Winner: ${r.winnerId.substring(0, 8)}`);
        console.log(`  Payment: ₦${r.paymentAmount.toLocaleString()}`);
        console.log(`  Deposit: ₦${r.depositAmount.toLocaleString()}`);
        console.log(`  Deposit released: ${r.depositReleased ? '✅' : '❌'}`);
        console.log(`  Non-winners unfrozen: ${r.nonWinnersUnfrozen ? '✅' : '❌'}`);
        console.log(`  Issues:`);
        r.issues.forEach((issue) => console.log(`    - ${issue}`));
        console.log('');
      });

    console.log('='.repeat(80));
    console.log('\n⚠️  Run the retroactive script to fix these issues:');
    console.log('   npx tsx scripts/unfreeze-non-winner-deposits-retroactive.ts');
  } else {
    console.log('\n✅ All auctions passed verification!');
    console.log('='.repeat(80));
  }
}

// Run the script
verifyAtomicPaymentFix()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
