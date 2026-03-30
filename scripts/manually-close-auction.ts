/**
 * Manually Close Auction Script
 * 
 * Use this to manually trigger closure for auctions that got stuck
 * in 'extended' status and didn't close automatically.
 * 
 * Usage:
 * export AUCTION_ID="your-auction-id"
 * npx tsx scripts/manually-close-auction.ts
 */

import { auctionClosureService } from '../src/features/auctions/services/closure.service';

async function manuallyCloseAuction() {
  const auctionId = process.env.AUCTION_ID;

  if (!auctionId) {
    console.error('❌ Error: AUCTION_ID environment variable is required');
    console.log('\nUsage:');
    console.log('  export AUCTION_ID="your-auction-id"');
    console.log('  npx tsx scripts/manually-close-auction.ts');
    process.exit(1);
  }

  console.log(`\n🎯 Manually Closing Auction: ${auctionId}`);
  console.log(`   Timestamp: ${new Date().toISOString()}\n`);

  try {
    const result = await auctionClosureService.closeAuction(auctionId);

    if (result.success) {
      console.log('\n✅ Auction closed successfully!');
      console.log(`   Auction ID: ${result.auctionId}`);
      console.log(`   Winner: ${result.winnerId || 'No winner'}`);
      console.log(`   Winning Bid: ${result.winningBid ? `₦${result.winningBid.toLocaleString()}` : 'N/A'}`);
      console.log(`   Payment ID: ${result.paymentId || 'N/A'}`);
      
      console.log('\n📄 Documents Generated:');
      console.log('   - Bill of Sale');
      console.log('   - Liability Waiver');
      
      console.log('\n📧 Winner Notifications Sent:');
      console.log('   - SMS with document signing link');
      console.log('   - Email with document signing link');
      console.log('   - In-app notification');
      
      console.log('\n✅ The winner can now sign documents and complete payment!');
    } else {
      console.error('\n❌ Auction closure failed:');
      console.error(`   Error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  }
}

manuallyCloseAuction();
