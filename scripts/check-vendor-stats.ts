import { db } from '@/lib/db';
import { vendors, auctions, bids } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

async function checkVendorStats() {
  try {
    console.log('Checking vendor statistics...\n');

    // Get all vendors with their stats
    const allVendors = await db.select().from(vendors);

    console.log(`Found ${allVendors.length} vendors\n`);

    for (const vendor of allVendors) {
      console.log(`\n=== Vendor: ${vendor.businessName} (ID: ${vendor.id}) ===`);
      console.log(`Stored Stats:`);
      console.log(`  - Rating: ${vendor.rating}`);
      console.log(`  - Total Bids: ${vendor.totalBids}`);
      console.log(`  - Total Wins: ${vendor.totalWins}`);
      console.log(`  - Win Rate: ${vendor.totalBids > 0 ? ((vendor.totalWins / vendor.totalBids) * 100).toFixed(1) : 0}%`);
      console.log(`  - On-Time Pickups: ${vendor.onTimePickups} / ${vendor.totalPickups}`);
      console.log(`  - On-Time Rate: ${vendor.totalPickups > 0 ? ((vendor.onTimePickups / vendor.totalPickups) * 100).toFixed(1) : 0}%`);

      // Count actual bids from database
      const actualBids = await db
        .select({ count: sql<number>`count(*)` })
        .from(bids)
        .where(eq(bids.vendorId, vendor.id));

      // Count actual wins (auctions where this vendor won)
      const actualWins = await db
        .select({ count: sql<number>`count(*)` })
        .from(auctions)
        .where(
          and(
            eq(auctions.winningVendorId, vendor.id),
            eq(auctions.status, 'closed')
          )
        );

      console.log(`\nActual Database Counts:`);
      console.log(`  - Actual Bids: ${actualBids[0]?.count || 0}`);
      console.log(`  - Actual Wins: ${actualWins[0]?.count || 0}`);
      console.log(`  - Actual Win Rate: ${actualBids[0]?.count > 0 ? ((Number(actualWins[0]?.count || 0) / Number(actualBids[0]?.count)) * 100).toFixed(1) : 0}%`);

      const bidMismatch = Number(actualBids[0]?.count || 0) !== vendor.totalBids;
      const winMismatch = Number(actualWins[0]?.count || 0) !== vendor.totalWins;

      if (bidMismatch || winMismatch) {
        console.log(`\n⚠️  MISMATCH DETECTED!`);
        if (bidMismatch) {
          console.log(`  - Bid count mismatch: stored=${vendor.totalBids}, actual=${actualBids[0]?.count || 0}`);
        }
        if (winMismatch) {
          console.log(`  - Win count mismatch: stored=${vendor.totalWins}, actual=${actualWins[0]?.count || 0}`);
        }
      } else {
        console.log(`\n✓ Stats are in sync`);
      }
    }

    console.log('\n\nDone!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkVendorStats();
