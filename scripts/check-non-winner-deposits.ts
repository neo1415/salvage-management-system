import { db } from '@/lib/db/drizzle';
import { auctionWinners, escrowWallets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const AUCTION_ID = '8dbeba4b-6b2f-4f02-ba88-fd954e397a70';

async function main() {
  console.log('🔍 Checking non-winner deposits for auction:', AUCTION_ID);
  console.log('');

  const winners = await db
    .select()
    .from(auctionWinners)
    .where(eq(auctionWinners.auctionId, AUCTION_ID));

  console.log(`Found ${winners.length} bidder(s):`);
  console.log('');

  for (const winner of winners) {
    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, winner.vendorId));

    const frozenAmount = parseFloat(wallet.frozenAmount);
    const depositAmount = parseFloat(winner.depositAmount);
    const isWinner = winner.rank === 1;
    const shouldBeFrozen = isWinner ? 0 : 0; // After payment, all should be unfrozen

    console.log(`Rank ${winner.rank} (${isWinner ? 'WINNER' : 'NON-WINNER'}):`);
    console.log(`   Vendor: ${winner.vendorId.substring(0, 8)}`);
    console.log(`   Deposit: ₦${depositAmount.toLocaleString()}`);
    console.log(`   Frozen: ₦${frozenAmount.toLocaleString()}`);
    console.log(`   Status: ${winner.status}`);
    
    if (frozenAmount === 0) {
      console.log(`   ✅ Deposit unfrozen correctly`);
    } else {
      console.log(`   ⚠️  Deposit still frozen (expected: ₦0)`);
    }
    console.log('');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
