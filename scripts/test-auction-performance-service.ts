/**
 * Test Auction Performance Service
 * 
 * Test what the actual service returns for the Auction Performance report
 */

import { AuctionPerformanceService } from '../src/features/reports/operational/services';

async function testService() {
  console.log('=== TESTING AUCTION PERFORMANCE SERVICE ===\n');

  const startDate = '2026-02-01';
  const endDate = '2026-04-28';

  try {
    const result = await AuctionPerformanceService.generateReport({
      startDate,
      endDate,
    });

    console.log('SERVICE RESPONSE:\n');
    console.log(`Total Auctions: ${result.auctions.length}`);
    console.log(`Total Revenue: ₦${result.summary.totalRevenue.toLocaleString()}`);
    console.log(`Average Winning Bid: ₦${result.summary.averageWinningBid.toLocaleString()}`);
    console.log(`Average Reserve Price: ₦${result.summary.averageReservePrice.toLocaleString()}`);
    console.log('');

    console.log('REVENUE BY ASSET TYPE:');
    result.summary.revenueByAssetType.forEach((item: any) => {
      console.log(`  ${item.assetType}: ₦${item.revenue.toLocaleString()} (${item.percentage}%)`);
    });
    console.log('');

    console.log('BIDDING METRICS:');
    console.log(`  Total Bids: ${result.summary.totalBids}`);
    console.log(`  Average Bids per Auction: ${result.summary.averageBidsPerAuction}`);
    console.log(`  Competitive Auctions: ${result.summary.competitiveAuctions}`);
    console.log('');

    console.log('SAMPLE AUCTIONS (first 10):');
    result.auctions.slice(0, 10).forEach((auction: any) => {
      console.log(`  ${auction.claimReference}: ${auction.status} - ₦${parseFloat(auction.winningBid || '0').toLocaleString()}`);
    });
    console.log('');

    // Check for duplicate claim references
    const claimRefs = result.auctions.map((a: any) => a.claimReference);
    const duplicates = claimRefs.filter((ref: string, index: number) => claimRefs.indexOf(ref) !== index);
    
    if (duplicates.length > 0) {
      console.log('⚠️  DUPLICATE CLAIM REFERENCES FOUND:');
      const uniqueDuplicates = [...new Set(duplicates)];
      uniqueDuplicates.forEach((ref: string) => {
        const count = claimRefs.filter((r: string) => r === ref).length;
        console.log(`  ${ref}: appears ${count} times`);
      });
      console.log('');
    } else {
      console.log('✅ No duplicate claim references\n');
    }

  } catch (error: any) {
    console.error('❌ Error calling service:', error.message);
    console.error(error.stack);
  }
}

testService()
  .then(() => {
    console.log('✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
