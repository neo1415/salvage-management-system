/**
 * Manual Auction Closure Trigger Script
 * 
 * This script manually triggers the auction closure process
 * Useful for testing and immediate closure of expired auctions
 * 
 * Usage:
 *   npx tsx scripts/trigger-auction-closure.ts
 */

import { auctionClosureService } from '@/features/auctions/services/closure.service';

async function main() {
  console.log('🔄 Starting manual auction closure...\n');

  try {
    const result = await auctionClosureService.closeExpiredAuctions();

    console.log('\n✅ Auction closure completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Total Processed: ${result.totalProcessed}`);
    console.log(`✅ Successful: ${result.successful}`);
    console.log(`❌ Failed: ${result.failed}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (result.results.length > 0) {
      console.log('📋 Detailed Results:\n');
      result.results.forEach((res, index) => {
        console.log(`${index + 1}. Auction ${res.auctionId}`);
        console.log(`   Status: ${res.success ? '✅ Success' : '❌ Failed'}`);
        if (res.winnerId) {
          console.log(`   Winner: ${res.winnerId}`);
          console.log(`   Winning Bid: ₦${res.winningBid?.toLocaleString()}`);
          console.log(`   Payment ID: ${res.paymentId}`);
        }
        if (res.error) {
          console.log(`   Error: ${res.error}`);
        }
        console.log('');
      });
    } else {
      console.log('ℹ️  No expired auctions found to close.\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during auction closure:', error);
    process.exit(1);
  }
}

main();
