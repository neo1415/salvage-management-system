/**
 * Simple Vendor Performance Test
 */

import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { bids, vendors, auctions } from '../src/lib/db/schema';
import { eq, count } from 'drizzle-orm';

async function test() {
  console.log('=== Testing Vendor Performance Query ===\n');

  try {
    // Simple query without where clause
    console.log('1. Testing simple bid query...');
    const simpleBids = await db
      .select({
        vendorId: bids.vendorId,
        bidAmount: bids.amount,
        auctionId: bids.auctionId,
      })
      .from(bids)
      .limit(5);

    console.log('Simple bids:', simpleBids.length);
    console.table(simpleBids);

    // Query with joins
    console.log('\n2. Testing query with joins...');
    const bidsWithVendor = await db
      .select({
        vendorId: bids.vendorId,
        vendorName: vendors.businessName,
        vendorTier: vendors.tier,
        bidAmount: bids.amount,
        auctionId: bids.auctionId,
        winnerId: auctions.winnerId,
      })
      .from(bids)
      .leftJoin(vendors, eq(bids.vendorId, vendors.id))
      .leftJoin(auctions, eq(bids.auctionId, auctions.id))
      .limit(5);

    console.log('Bids with vendor:', bidsWithVendor.length);
    console.table(bidsWithVendor);

    console.log('\n✅ Queries work!');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

test()
  .then(() => {
    console.log('\n✅ Test complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
