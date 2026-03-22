/**
 * CRITICAL: Detect and Fix Infinite Money Glitch
 * 
 * Problem: Money frozen in escrow gets released to finance officer, BUT the money is STILL frozen
 * in the vendor's wallet. This creates infinite money!
 * 
 * Root Cause: The unfreezing and sending are not truly atomic. Money is sent to finance officer
 * but not deducted from vendor's frozen balance.
 * 
 * Solution:
 * 1. Detect all instances where payment.escrowStatus === 'released' but vendor's frozen balance
 *    still contains that amount
 * 2. Fix by unfreezing the amount from vendor's wallet
 * 3. Add verification that ensures atomicity going forward
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { escrowWallets, walletTransactions } from '@/lib/db/schema/escrow';
import { eq, and } from 'drizzle-orm';

interface InfiniteMoneyIssue {
  paymentId: string;
  auctionId: string;
  vendorId: string;
  walletId: string;
  amount: number;
  currentFrozenAmount: number;
  shouldBeFrozenAmount: number;
  discrepancy: number;
}

/**
 * Detect all instances of the infinite money glitch
 */
async function detectInfiniteMoneyGlitch(): Promise<InfiniteMoneyIssue[]> {
  console.log('🔍 Scanning for infinite money glitch instances...\n');

  const issues: InfiniteMoneyIssue[] = [];

  // Get all payments with escrowStatus = 'released'
  const releasedPayments = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.paymentMethod, 'escrow_wallet'),
        eq(payments.escrowStatus, 'released')
      )
    );

  console.log(`Found ${releasedPayments.length} released escrow payments\n`);

  for (const payment of releasedPayments) {
    // Get vendor's wallet
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, payment.vendorId))
      .limit(1);

    if (!wallet) {
      console.warn(`⚠️  No wallet found for vendor ${payment.vendorId}`);
      continue;
    }

    const paymentAmount = parseFloat(payment.amount);
    const currentFrozen = parseFloat(wallet.frozenAmount);

    // Check if this payment's amount is still frozen
    // We need to check wallet transactions to see if this specific payment was unfrozen
    const [freezeTransaction] = await db
      .select()
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.walletId, wallet.id),
          eq(walletTransactions.type, 'freeze'),
          eq(walletTransactions.reference, `FREEZE_${payment.auctionId}`)
        )
      )
      .limit(1);

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

    const [debitTransaction] = await db
      .select()
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.walletId, wallet.id),
          eq(walletTransactions.type, 'debit'),
          eq(walletTransactions.reference, `TRANSFER_${payment.auctionId.substring(0, 8)}`)
        )
      )
      .limit(1);

    // ISSUE DETECTED: Payment released (debit exists) but no unfreeze transaction
    if (freezeTransaction && debitTransaction && !unfreezeTransaction) {
      const discrepancy = paymentAmount;
      
      issues.push({
        paymentId: payment.id,
        auctionId: payment.auctionId,
        vendorId: payment.vendorId,
        walletId: wallet.id,
        amount: paymentAmount,
        currentFrozenAmount: currentFrozen,
        shouldBeFrozenAmount: currentFrozen - discrepancy,
        discrepancy,
      });

      console.log(`🚨 INFINITE MONEY GLITCH DETECTED:`);
      console.log(`   Payment ID: ${payment.id}`);
      console.log(`   Auction ID: ${payment.auctionId}`);
      console.log(`   Vendor ID: ${payment.vendorId}`);
      console.log(`   Amount: ₦${paymentAmount.toLocaleString()}`);
      console.log(`   Current Frozen: ₦${currentFrozen.toLocaleString()}`);
      console.log(`   Should Be Frozen: ₦${(currentFrozen - discrepancy).toLocaleString()}`);
      console.log(`   Discrepancy: ₦${discrepancy.toLocaleString()}`);
      console.log(`   ❌ Money was released but NOT unfrozen from wallet!\n`);
    }
  }

  return issues;
}

/**
 * Fix all detected infinite money glitch instances
 */
async function fixInfiniteMoneyGlitch(issues: InfiniteMoneyIssue[]): Promise<void> {
  console.log(`\n🔧 Fixing ${issues.length} infinite money glitch instance(s)...\n`);

  for (const issue of issues) {
    try {
      console.log(`Fixing payment ${issue.paymentId}...`);

      // Get current wallet state
      const [wallet] = await db
        .select()
        .from(escrowWallets)
        .where(eq(escrowWallets.id, issue.walletId))
        .limit(1);

      if (!wallet) {
        console.error(`❌ Wallet not found: ${issue.walletId}`);
        continue;
      }

      const currentBalance = parseFloat(wallet.balance);
      const currentFrozen = parseFloat(wallet.frozenAmount);
      const newFrozen = currentFrozen - issue.amount;

      // Verify invariant before fix
      if (Math.abs(currentBalance - (parseFloat(wallet.availableBalance) + currentFrozen)) > 0.01) {
        console.error(`❌ Balance invariant violation BEFORE fix for wallet ${issue.walletId}`);
        console.error(`   Balance: ${currentBalance}`);
        console.error(`   Available: ${wallet.availableBalance}`);
        console.error(`   Frozen: ${currentFrozen}`);
        continue;
      }

      // Update wallet: reduce frozen amount (balance stays the same because money was already debited)
      await db
        .update(escrowWallets)
        .set({
          frozenAmount: newFrozen.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(escrowWallets.id, issue.walletId));

      // Create unfreeze transaction record (retroactive)
      await db.insert(walletTransactions).values({
        walletId: issue.walletId,
        type: 'unfreeze',
        amount: issue.amount.toString(),
        balanceAfter: currentBalance.toFixed(2),
        reference: `UNFREEZE_${issue.auctionId}`,
        description: `[RETROACTIVE FIX] Funds unfrozen for auction ${issue.auctionId.substring(0, 8)} - Fixing infinite money glitch`,
      });

      console.log(`✅ Fixed payment ${issue.paymentId}`);
      console.log(`   Reduced frozen amount: ₦${currentFrozen.toLocaleString()} → ₦${newFrozen.toLocaleString()}`);
      console.log(`   Created retroactive unfreeze transaction\n`);
    } catch (error) {
      console.error(`❌ Error fixing payment ${issue.paymentId}:`, error);
    }
  }
}

/**
 * Verify all wallets have correct balance invariants
 */
async function verifyWalletInvariants(): Promise<void> {
  console.log('\n🔍 Verifying wallet balance invariants...\n');

  const wallets = await db.select().from(escrowWallets);

  let violations = 0;

  for (const wallet of wallets) {
    const balance = parseFloat(wallet.balance);
    const available = parseFloat(wallet.availableBalance);
    const frozen = parseFloat(wallet.frozenAmount);

    const expectedBalance = available + frozen;
    const diff = Math.abs(balance - expectedBalance);

    if (diff > 0.01) {
      violations++;
      console.log(`❌ INVARIANT VIOLATION:`);
      console.log(`   Wallet ID: ${wallet.id}`);
      console.log(`   Vendor ID: ${wallet.vendorId}`);
      console.log(`   Balance: ₦${balance.toLocaleString()}`);
      console.log(`   Available: ₦${available.toLocaleString()}`);
      console.log(`   Frozen: ₦${frozen.toLocaleString()}`);
      console.log(`   Expected Balance: ₦${expectedBalance.toLocaleString()}`);
      console.log(`   Difference: ₦${diff.toLocaleString()}\n`);
    }
  }

  if (violations === 0) {
    console.log(`✅ All ${wallets.length} wallets have correct balance invariants\n`);
  } else {
    console.log(`❌ Found ${violations} wallet(s) with balance invariant violations\n`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  INFINITE MONEY GLITCH DETECTION AND FIX');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Step 1: Detect issues
    const issues = await detectInfiniteMoneyGlitch();

    if (issues.length === 0) {
      console.log('✅ No infinite money glitch instances detected!\n');
    } else {
      console.log(`\n🚨 CRITICAL: Found ${issues.length} infinite money glitch instance(s)\n`);
      
      // Calculate total money duplicated
      const totalDuplicated = issues.reduce((sum, issue) => sum + issue.discrepancy, 0);
      console.log(`💰 Total money duplicated: ₦${totalDuplicated.toLocaleString()}\n`);

      // Step 2: Fix issues
      await fixInfiniteMoneyGlitch(issues);
    }

    // Step 3: Verify all wallets
    await verifyWalletInvariants();

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  SCAN COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
