/**
 * Test Auction Closure Cron Job
 * 
 * This script tests the auction closure cron job by calling the API endpoint directly.
 * Use this to verify that the cron job is working correctly.
 * 
 * Usage:
 *   npm run script scripts/test-auction-closure-cron.ts
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

async function testAuctionClosureCron() {
  try {
    console.log('🧪 Testing Auction Closure Cron Job\n');
    console.log('='.repeat(60));

    // Step 1: Check for expired auctions
    console.log('\n📋 Step 1: Checking for expired auctions...\n');

    const now = new Date();
    const expiredAuctions = await db
      .select()
      .from(auctions)
      .where(
        and(
          lte(auctions.endTime, now),
          eq(auctions.status, 'active')
        )
      );

    console.log(`Found ${expiredAuctions.length} expired active auctions`);

    if (expiredAuctions.length > 0) {
      console.log('\n📋 Expired Auctions:');
      for (const auction of expiredAuctions) {
        const hoursExpired = Math.floor((now.getTime() - auction.endTime.getTime()) / (1000 * 60 * 60));
        console.log(`  - ${auction.id} (expired ${hoursExpired}h ago)`);
      }
    }

    // Step 2: Test the closure service
    console.log('\n📋 Step 2: Testing closure service...\n');

    const result = await auctionClosureService.closeExpiredAuctions();

    console.log('✅ Closure service executed successfully');
    console.log(`   Total Processed: ${result.totalProcessed}`);
    console.log(`   Successful: ${result.successful}`);
    console.log(`   Failed: ${result.failed}`);

    // Step 3: Display results
    if (result.results.length > 0) {
      console.log('\n📋 Step 3: Closure Results:\n');
      
      for (const closureResult of result.results) {
        if (closureResult.success) {
          console.log(`✅ ${closureResult.auctionId}`);
          if (closureResult.winnerId) {
            console.log(`   Winner: ${closureResult.winnerId}`);
            console.log(`   Winning Bid: ₦${closureResult.winningBid?.toLocaleString()}`);
          } else {
            console.log(`   No winner (no bids)`);
          }
        } else {
          console.log(`❌ ${closureResult.auctionId}`);
          console.log(`   Error: ${closureResult.error}`);
        }
      }
    }

    // Step 4: Verify no more expired auctions
    console.log('\n📋 Step 4: Verifying all expired auctions are closed...\n');

    const remainingExpired = await db
      .select()
      .from(auctions)
      .where(
        and(
          lte(auctions.endTime, now),
          eq(auctions.status, 'active')
        )
      );

    if (remainingExpired.length === 0) {
      console.log('✅ All expired auctions have been closed successfully!');
    } else {
      console.log(`⚠️ Warning: ${remainingExpired.length} expired auctions still active`);
      for (const auction of remainingExpired) {
        console.log(`  - ${auction.id}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run the test
testAuctionClosureCron()
  .then(() => {
    console.log('\n✅ Test script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test script failed:', error);
    process.exit(1);
  });
