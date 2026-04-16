/**
 * Check Non-Winners' Frozen Deposits
 * 
 * Checks if non-winning bidders still have frozen deposits after winner's payment is verified
 */

import { db } from '@/lib/db/drizzle';
import { auctionWinners } from '@/lib/db/schema/auction-deposit';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, and, ne } from 'drizzle-orm';

async function checkNonWinnersFrozenDeposits() {
  console.log('\n🔍 CHECKING NON-WINNERS\' FROZEN DEPOSITS\n');
  console.log('='.repeat(80));
  
  // Get all auctions with verified payments
  const verifiedPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.status, 'verified'));
  
  console.log(`\n📋 Found ${verifiedPayments.length} verified payments\n`);
  
  for (const payment of verifiedPayments) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`\n🏆 AUCTION: ${payment.auctionId.substring(0, 8)}`);
    console.log(`  Payment verified at: ${payment.verifiedAt}`);
    
    // Get auction details
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, payment.auctionId))
      .limit(1);
    
    if (!auction) {
      console.log(`  ❌ Auction not found`);
      continue;
    }
    
    console.log(`  Status: ${auction.status}`);
    
    // Get all winners for this auction (including fallback chain)
    const winners = await db
      .select()
      .from(auctionWinners)
      .where(eq(auctionWinners.auctionId, payment.auctionId));
    
    console.log(`\n  👥 Total bidders in winners table: ${winners.length}`);
    
    // Find the active winner
    const activeWinner = winners.find(w => w.status === 'active');
    
    if (!activeWinner) {
      console.log(`  ❌ No active winner found`);
      continue;
    }
    
    console.log(`\n  ✅ Active Winner: ${activeWinner.vendorId.substring(0, 8)}`);
    console.log(`     Rank: ${activeWinner.rank}`);
    console.log(`     Deposit: ₦${parseFloat(activeWinner.depositAmount).toLocaleString()}`);
    console.log(`     Deposit Status: ${activeWinner.depositStatus}`);
    
    // Find non-winners (rank > 1 and not the active winner)
    const nonWinners = winners.filter(w => 
      w.vendorId !== activeWinner.vendorId && 
      w.rank > 1
    );
    
    if (nonWinners.length === 0) {
      console.log(`\n  ℹ️  No non-winners found (single bidder auction)`);
      continue;
    }
    
    console.log(`\n  👥 Non-Winners (${nonWinners.length}):`);
    
    let frozenCount = 0;
    let unfrozenCount = 0;
    
    for (const nonWinner of nonWinners) {
      const isFrozen = nonWinner.depositStatus === 'frozen';
      const status = isFrozen ? '❌ FROZEN' : '✅ UNFROZEN';
      
      if (isFrozen) frozenCount++;
      else unfrozenCount++;
      
      console.log(`\n     ${status} - Vendor: ${nonWinner.vendorId.substring(0, 8)}`);
      console.log(`       Rank: ${nonWinner.rank}`);
      console.log(`       Deposit: ₦${parseFloat(nonWinner.depositAmount).toLocaleString()}`);
      console.log(`       Status: ${nonWinner.status}`);
    }
    
    console.log(`\n  📊 Summary:`);
    console.log(`     Frozen: ${frozenCount}`);
    console.log(`     Unfrozen: ${unfrozenCount}`);
    
    if (frozenCount > 0) {
      console.log(`\n  ⚠️  ISSUE: ${frozenCount} non-winner(s) still have frozen deposits!`);
      console.log(`     These should be unfrozen after winner's payment is verified.`);
    } else {
      console.log(`\n  ✅ All non-winners' deposits are unfrozen`);
    }
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('\n✅ Check complete\n');
}

checkNonWinnersFrozenDeposits().catch(console.error);
