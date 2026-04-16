/**
 * Manually Close Expired Auctions Script
 * 
 * This script manually closes all expired auctions that are still in "active" status.
 * Use this to fix stuck auctions that weren't closed due to missing cron job configuration.
 * 
 * Usage:
 *   npm run script scripts/manually-close-expired-auctions.ts
 */

import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { auctions } from '@/lib/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import { auctionClosureService } from '@/features/auctions/services/closure.service';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function manuallyCloseExpiredAuctions() {
  try {
    console.log('🔍 Searching for expired auctions that are still active...\n');

    const now = new Date();

    // Find all active auctions that have ended
    const expiredAuctions = await db
      .select()
      .from(auctions)
      .where(
        and(
          lte(auctions.endTime, now),
          eq(auctions.status, 'active')
        )
      );

    if (expiredAuctions.length === 0) {
      console.log('✅ No expired active auctions found. All auctions are properly closed.');
      return;
    }

    console.log(`⚠️ Found ${expiredAuctions.length} expired active auctions:\n`);

    // Display details of expired auctions
    for (const auction of expiredAuctions) {
      const hoursExpired = Math.floor((now.getTime() - auction.endTime.getTime()) / (1000 * 60 * 60));
      console.log(`  📋 Auction ID: ${auction.id}`);
      console.log(`     Status: ${auction.status}`);
      console.log(`     End Time: ${auction.endTime.toISOString()}`);
      console.log(`     Expired: ${hoursExpired} hours ago`);
      console.log(`     Current Bid: ${auction.currentBid ? `₦${parseFloat(auction.currentBid).toLocaleString()}` : 'No bids'}`);
      console.log(`     Winner: ${auction.currentBidder || 'None'}`);
      console.log('');
    }

    console.log('🔄 Starting manual closure process...\n');

    // Close each expired auction
    const results = [];
    for (const auction of expiredAuctions) {
      console.log(`\n📌 Processing Auction ${auction.id}...`);
      
      try {
        const result = await auctionClosureService.closeAuction(auction.id);
        results.push(result);

        if (result.success) {
          console.log(`✅ Successfully closed auction ${auction.id}`);
          if (result.winnerId) {
            console.log(`   Winner: ${result.winnerId}`);
            console.log(`   Winning Bid: ₦${result.winningBid?.toLocaleString()}`);
          } else {
            console.log(`   No winner (no bids placed)`);
          }
        } else {
          console.log(`❌ Failed to close auction ${auction.id}: ${result.error}`);
        }
      } catch (error) {
        console.error(`❌ Error closing auction ${auction.id}:`, error);
        results.push({
          success: false,
          auctionId: auction.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log('\n' + '='.repeat(60));
    console.log('📊 CLOSURE SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Processed: ${results.length}`);
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    console.log('='.repeat(60));

    if (failed > 0) {
      console.log('\n⚠️ Failed Auctions:');
      results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  - ${r.auctionId}: ${r.error}`);
        });
    }

    console.log('\n✅ Manual closure process completed!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the script
manuallyCloseExpiredAuctions()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
