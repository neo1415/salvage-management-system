/**
 * Unfreeze Non-Winner Deposits for Test Auction
 * 
 * The wallet payment code now calls unfreezeNonWinnerDeposits(), but the test
 * auction was paid before this fix. This script unfreezes the non-winner deposits
 * retroactively.
 */

import { db } from '@/lib/db/drizzle';
import { auctionWinners } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const AUCTION_ID = '8dbeba4b-6b2f-4f02-ba88-fd954e397a70';

async function main() {
  console.log('🔓 Unfreezing non-winner deposits for auction:', AUCTION_ID);
  console.log('');

  // Get all bidders
  const allWinners = await db
    .select()
    .from(auctionWinners)
    .where(eq(auctionWinners.auctionId, AUCTION_ID));

  if (!allWinners || allWinners.length === 0) {
    console.log('⚠️  No bidders found');
    return;
  }

  // Find the winner (rank 1)
  const winner = allWinners.find(w => w.rank === 1);
  if (!winner) {
    console.log('⚠️  No winner found');
    return;
  }

  console.log(`Winner: ${winner.vendorId.substring(0, 8)} (Rank 1)`);
  console.log('');

  // Get non-winners
  const nonWinners = allWinners.filter(w => w.vendorId !== winner.vendorId);

  if (nonWinners.length === 0) {
    console.log('✅ No non-winner deposits to unfreeze');
    return;
  }

  console.log(`Found ${nonWinners.length} non-winner(s) to unfreeze:`);
  console.log('');

  // Unfreeze each non-winner's deposit
  const { escrowService } = await import('@/features/payments/services/escrow.service');

  for (const bidder of nonWinners) {
    const depositAmount = parseFloat(bidder.depositAmount);
    
    console.log(`Unfreezing ₦${depositAmount.toLocaleString()} for vendor ${bidder.vendorId.substring(0, 8)} (Rank ${bidder.rank})...`);
    
    try {
      await escrowService.unfreezeFunds(
        bidder.vendorId,
        depositAmount,
        AUCTION_ID,
        'system'
      );
      
      console.log(`   ✅ Unfroze ₦${depositAmount.toLocaleString()}`);
    } catch (error) {
      console.error(`   ❌ Failed:`, error instanceof Error ? error.message : error);
    }
  }

  console.log('');
  console.log('✅ Non-winner deposits unfrozen!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
