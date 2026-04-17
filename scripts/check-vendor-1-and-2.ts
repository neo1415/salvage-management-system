/**
 * Quick check for vendors #1 and #2 (The Vendor and Master)
 */

import { db } from '@/lib/db/drizzle';
import { vendors, bids, auctions } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

async function main() {
  console.log('🔍 Checking "The Vendor" and "Master"...\n');

  // Find The Vendor and Master
  const targetVendors = await db
    .select()
    .from(vendors)
    .where(
      sql`${vendors.businessName} IN ('The Vendor', 'Master')`
    );

  for (const vendor of targetVendors) {
    console.log(`\n📊 ${vendor.businessName}`);
    console.log(`   ID: ${vendor.id}`);
    console.log(`   Rating (stored): ${vendor.rating}`);

    // Get actual bids count
    const bidsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bids)
      .where(eq(bids.vendorId, vendor.id));

    const totalBids = bidsResult[0]?.count || 0;

    // Get actual wins count
    const winsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auctions)
      .where(
        and(
          eq(auctions.currentBidder, vendor.id),
          eq(auctions.status, 'closed')
        )
      );

    const totalWins = winsResult[0]?.count || 0;

    console.log(`   Actual Bids: ${totalBids}`);
    console.log(`   Actual Wins: ${totalWins}`);
    console.log(`   Win Rate: ${totalBids > 0 ? ((totalWins / totalBids) * 100).toFixed(1) : 0}%`);
    console.log(`   Stale performanceStats: ${JSON.stringify(vendor.performanceStats)}`);
  }

  console.log('\n✅ Done!');
  process.exit(0);
}

main();
