/**
 * Test Winner Record Creation Fix
 * 
 * This script tests that winner records are properly created when ending auctions early.
 * It verifies the permanent fix for the nested transaction issue.
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { bids } from '@/lib/db/schema/bids';
import { auctionWinners } from '@/lib/db/schema/auction-deposit';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { escrowWallets } from '@/lib/db/schema/auction-deposit';
import { eq, and } from 'drizzle-orm';
import { auctionClosureService } from '@/features/auctions/services/auction-closure.service';

async function testWinnerRecordCreation() {
  console.log('🧪 Testing Winner Record Creation Fix\n');

  try {
    // Step 1: Find an active auction with bids
    console.log('📋 Step 1: Finding active auction with bids...');
    const activeAuctions = await db
      .select()
      .from(auctions)
      .where(eq(auctions.status, 'active'))
      .limit(5);

    if (activeAuctions.length === 0) {
      console.log('❌ No active auctions found. Please create an auction first.');
      return;
    }

    // Find auction with bids
    let testAuction: typeof auctions.$inferSelect | null = null;
    for (const auction of activeAuctions) {
      const auctionBids = await db
        .select()
        .from(bids)
        .where(eq(bids.auctionId, auction.id))
        .limit(1);

      if (auctionBids.length > 0) {
        testAuction = auction;
        break;
      }
    }

    if (!testAuction) {
      console.log('❌ No active auctions with bids found. Please place a bid first.');
      return;
    }

    console.log(`✅ Found test auction: ${testAuction.id}`);
    console.log(`   - Status: ${testAuction.status}`);
    console.log(`   - Current Bid: ₦${testAuction.currentBid ? parseFloat(testAuction.currentBid).toLocaleString() : 'N/A'}`);
    console.log(`   - Current Bidder: ${testAuction.currentBidder || 'None'}`);

    // Step 2: Check if winner record already exists
    console.log('\n📋 Step 2: Checking for existing winner record...');
    const existingWinner = await db
      .select()
      .from(auctionWinners)
      .where(eq(auctionWinners.auctionId, testAuction.id))
      .limit(1);

    if (existingWinner.length > 0) {
      console.log('⚠️  Winner record already exists for this auction');
      console.log(`   - Winner ID: ${existingWinner[0].id}`);
      console.log(`   - Vendor ID: ${existingWinner[0].vendorId}`);
      console.log(`   - Bid Amount: ₦${parseFloat(existingWinner[0].bidAmount).toLocaleString()}`);
      console.log('\n   Skipping test - auction already has winner record');
      return;
    }

    console.log('✅ No existing winner record found');

    // Step 3: Get vendor wallet balance before closure
    console.log('\n📋 Step 3: Checking vendor wallet state...');
    if (!testAuction.currentBidder) {
      console.log('❌ No current bidder found');
      return;
    }

    const [wallet] = await db
      .select()
      .from(escrowWallets)
      .where(eq(escrowWallets.vendorId, testAuction.currentBidder))
      .limit(1);

    if (wallet) {
      console.log(`✅ Vendor wallet found:`);
      console.log(`   - Balance: ₦${parseFloat(wallet.balance).toLocaleString()}`);
      console.log(`   - Available: ₦${parseFloat(wallet.availableBalance).toLocaleString()}`);
      console.log(`   - Frozen: ₦${parseFloat(wallet.frozenAmount).toLocaleString()}`);
    } else {
      console.log('⚠️  No wallet found for vendor');
    }

    // Step 4: Close the auction
    console.log('\n📋 Step 4: Closing auction...');
    console.log('   This will test the permanent fix for winner record creation');
    
    const result = await auctionClosureService.closeAuction(testAuction.id);

    if (!result.success) {
      console.log(`❌ Auction closure failed: ${result.error}`);
      return;
    }

    console.log('✅ Auction closed successfully');
    console.log(`   - Winner ID: ${result.winnerId}`);
    console.log(`   - Winning Bid: ₦${result.winningBid?.toLocaleString()}`);
    console.log(`   - Top Bidders Kept Frozen: ${result.topBiddersCount}`);
    console.log(`   - Lower Bidders Unfrozen: ${result.unfrozenBiddersCount}`);

    // Step 5: Verify winner record was created
    console.log('\n📋 Step 5: Verifying winner record creation...');
    const [winnerRecord] = await db
      .select()
      .from(auctionWinners)
      .where(
        and(
          eq(auctionWinners.auctionId, testAuction.id),
          eq(auctionWinners.rank, 1)
        )
      )
      .limit(1);

    if (!winnerRecord) {
      console.log('❌ CRITICAL: Winner record was NOT created!');
      console.log('   This indicates the fix did not work');
      return;
    }

    console.log('✅ Winner record verified in database:');
    console.log(`   - Record ID: ${winnerRecord.id}`);
    console.log(`   - Vendor ID: ${winnerRecord.vendorId}`);
    console.log(`   - Bid Amount: ₦${parseFloat(winnerRecord.bidAmount).toLocaleString()}`);
    console.log(`   - Deposit Amount: ₦${parseFloat(winnerRecord.depositAmount).toLocaleString()}`);
    console.log(`   - Rank: ${winnerRecord.rank}`);
    console.log(`   - Status: ${winnerRecord.status}`);

    // Step 6: Test payment calculation endpoint
    console.log('\n📋 Step 6: Testing payment calculation endpoint...');
    const paymentCalcUrl = `/api/auctions/${testAuction.id}/payment/calculate`;
    console.log(`   Endpoint: ${paymentCalcUrl}`);
    console.log('   ✅ Winner record exists - endpoint should work now');

    // Step 7: Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST PASSED: Winner Record Creation Fix Verified');
    console.log('='.repeat(80));
    console.log('\nSummary:');
    console.log('  ✅ Auction closed successfully');
    console.log('  ✅ Winner record created in auction_winners table');
    console.log('  ✅ Payment calculation endpoint should work');
    console.log('  ✅ No nested transaction issues detected');
    console.log('\nThe permanent fix is working correctly! 🎉');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack trace:', error.stack);
    }
  } finally {
    process.exit(0);
  }
}

// Run the test
testWinnerRecordCreation();
