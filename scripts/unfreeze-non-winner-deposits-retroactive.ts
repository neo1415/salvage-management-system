/**
 * Retroactive Script: Unfreeze Non-Winner Deposits
 * 
 * This script unfreezes deposits for non-winners in auctions where the winner
 * has already completed payment. This is a one-time fix for existing auctions
 * that were affected by the bug where non-winner deposits remained frozen
 * after winner payment.
 * 
 * Run with: npx tsx scripts/unfreeze-non-winner-deposits-retroactive.ts
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { auctionWinners } from '@/lib/db/schema/auction-deposit';
import { escrowWallets } from '@/lib/db/schema/escrow';
import { eq, and, inArray } from 'drizzle-orm';
import { escrowService } from '@/features/payments/services/escrow.service';

interface UnfreezeResult {
  auctionId: string;
  winnerId: string;
  nonWinnersUnfrozen: number;
  totalAmountUnfrozen: number;
  errors: Array<{ vendorId: string; error: string }>;
}

async function unfreezeNonWinnerDepositsRetroactive(): Promise<void> {
  console.log('🔍 Finding auctions with verified payments...\n');

  // Step 1: Find all auctions with verified payments
  const verifiedPayments = await db
    .select({
      auctionId: payments.auctionId,
      vendorId: payments.vendorId,
      amount: payments.amount,
      verifiedAt: payments.verifiedAt,
    })
    .from(payments)
    .where(eq(payments.status, 'verified'));

  console.log(`✅ Found ${verifiedPayments.length} auctions with verified payments\n`);

  if (verifiedPayments.length === 0) {
    console.log('No auctions to process. Exiting.');
    return;
  }

  const results: UnfreezeResult[] = [];

  // Step 2: For each auction, unfreeze non-winner deposits
  for (const payment of verifiedPayments) {
    console.log(`\n📦 Processing auction ${payment.auctionId.substring(0, 8)}...`);
    console.log(`   Winner: ${payment.vendorId.substring(0, 8)}`);
    console.log(`   Payment: ₦${parseFloat(payment.amount).toLocaleString()}`);

    try {
      // Get all bidders for this auction
      const allBidders = await db
        .select()
        .from(auctionWinners)
        .where(eq(auctionWinners.auctionId, payment.auctionId));

      console.log(`   Total bidders: ${allBidders.length}`);

      // Filter out the winner
      const nonWinners = allBidders.filter((b) => b.vendorId !== payment.vendorId);

      console.log(`   Non-winners: ${nonWinners.length}`);

      if (nonWinners.length === 0) {
        console.log(`   ✅ No non-winners to unfreeze`);
        results.push({
          auctionId: payment.auctionId,
          winnerId: payment.vendorId,
          nonWinnersUnfrozen: 0,
          totalAmountUnfrozen: 0,
          errors: [],
        });
        continue;
      }

      const result: UnfreezeResult = {
        auctionId: payment.auctionId,
        winnerId: payment.vendorId,
        nonWinnersUnfrozen: 0,
        totalAmountUnfrozen: 0,
        errors: [],
      };

      // Unfreeze each non-winner's deposit
      for (const bidder of nonWinners) {
        const depositAmount = parseFloat(bidder.depositAmount);

        console.log(`   🔓 Unfreezing ₦${depositAmount.toLocaleString()} for vendor ${bidder.vendorId.substring(0, 8)}...`);

        try {
          // Check if deposit is actually frozen
          const [wallet] = await db
            .select()
            .from(escrowWallets)
            .where(eq(escrowWallets.vendorId, bidder.vendorId))
            .limit(1);

          if (!wallet) {
            console.log(`   ⚠️  Wallet not found for vendor ${bidder.vendorId.substring(0, 8)}`);
            result.errors.push({
              vendorId: bidder.vendorId,
              error: 'Wallet not found',
            });
            continue;
          }

          const frozenAmount = parseFloat(wallet.frozenAmount);

          if (frozenAmount < depositAmount) {
            console.log(`   ⚠️  Insufficient frozen amount (${frozenAmount} < ${depositAmount}). Skipping.`);
            result.errors.push({
              vendorId: bidder.vendorId,
              error: `Insufficient frozen amount: ${frozenAmount} < ${depositAmount}`,
            });
            continue;
          }

          // Unfreeze the deposit
          await escrowService.unfreezeFunds(
            bidder.vendorId,
            depositAmount,
            payment.auctionId,
            'system' // userId for audit trail
          );

          console.log(`   ✅ Unfroze ₦${depositAmount.toLocaleString()}`);
          result.nonWinnersUnfrozen++;
          result.totalAmountUnfrozen += depositAmount;
        } catch (error) {
          console.error(`   ❌ Failed to unfreeze:`, error);
          result.errors.push({
            vendorId: bidder.vendorId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      results.push(result);
      console.log(`   ✅ Auction ${payment.auctionId.substring(0, 8)} complete`);
    } catch (error) {
      console.error(`   ❌ Error processing auction:`, error);
      results.push({
        auctionId: payment.auctionId,
        winnerId: payment.vendorId,
        nonWinnersUnfrozen: 0,
        totalAmountUnfrozen: 0,
        errors: [
          {
            vendorId: 'N/A',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      });
    }
  }

  // Step 3: Print summary
  console.log('\n\n📊 SUMMARY\n');
  console.log('='.repeat(80));

  let totalAuctions = results.length;
  let totalNonWinnersUnfrozen = 0;
  let totalAmountUnfrozen = 0;
  let totalErrors = 0;

  for (const result of results) {
    totalNonWinnersUnfrozen += result.nonWinnersUnfrozen;
    totalAmountUnfrozen += result.totalAmountUnfrozen;
    totalErrors += result.errors.length;

    if (result.nonWinnersUnfrozen > 0 || result.errors.length > 0) {
      console.log(`\nAuction: ${result.auctionId.substring(0, 8)}`);
      console.log(`  Winner: ${result.winnerId.substring(0, 8)}`);
      console.log(`  Non-winners unfrozen: ${result.nonWinnersUnfrozen}`);
      console.log(`  Amount unfrozen: ₦${result.totalAmountUnfrozen.toLocaleString()}`);
      
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.length}`);
        result.errors.forEach((err) => {
          console.log(`    - Vendor ${err.vendorId.substring(0, 8)}: ${err.error}`);
        });
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`Total auctions processed: ${totalAuctions}`);
  console.log(`Total non-winners unfrozen: ${totalNonWinnersUnfrozen}`);
  console.log(`Total amount unfrozen: ₦${totalAmountUnfrozen.toLocaleString()}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log('='.repeat(80));

  if (totalErrors > 0) {
    console.log('\n⚠️  Some deposits could not be unfrozen. Review errors above.');
  } else {
    console.log('\n✅ All non-winner deposits successfully unfrozen!');
  }
}

// Run the script
unfreezeNonWinnerDepositsRetroactive()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
