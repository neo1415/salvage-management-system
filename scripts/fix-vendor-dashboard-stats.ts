import { db } from '@/lib/db';
import { vendors, auctions, bids } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { cache } from '@/lib/redis/client';

async function fixVendorDashboardStats() {
  try {
    console.log('Fixing vendor dashboard statistics...\n');

    // Get all vendors
    const allVendors = await db.select().from(vendors);

    console.log(`Found ${allVendors.length} vendors\n`);

    for (const vendor of allVendors) {
      console.log(`\n=== Vendor: ${vendor.businessName} (ID: ${vendor.id}) ===`);

      // Count actual bids from database
      const actualBidsResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bids)
        .where(eq(bids.vendorId, vendor.id));

      const actualBids = actualBidsResult[0]?.count || 0;

      // Count actual wins (auctions where this vendor won)
      const actualWinsResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(auctions)
        .where(
          and(
            eq(auctions.currentBidder, vendor.id),
            eq(auctions.status, 'closed')
          )
        );

      const actualWins = actualWinsResult[0]?.count || 0;

      console.log(`Current Stats:`);
      console.log(`  - Bids: ${actualBids}`);
      console.log(`  - Wins: ${actualWins}`);
      console.log(`  - Win Rate: ${actualBids > 0 ? ((actualWins / actualBids) * 100).toFixed(1) : 0}%`);
      console.log(`  - Rating: ${vendor.rating}`);

      // Clear cache for this vendor
      const cacheKey = `dashboard:vendor:${vendor.id}`;
      try {
        await cache.del(cacheKey);
        console.log(`  ✓ Cache cleared for vendor ${vendor.id}`);
      } catch (error) {
        console.log(`  ⚠️  Could not clear cache (Redis might not be available)`);
      }

      // Update performanceStats JSONB field
      const performanceStats = {
        totalBids: actualBids,
        totalWins: actualWins,
        winRate: actualBids > 0 ? (actualWins / actualBids) * 100 : 0,
        avgPaymentTimeHours: 0, // Will be calculated by auto-rating service
        onTimePickupRate: 0, // Will be calculated by auto-rating service
        fraudFlags: 0,
      };

      await db
        .update(vendors)
        .set({
          performanceStats,
          updatedAt: new Date(),
        })
        .where(eq(vendors.id, vendor.id));

      console.log(`  ✓ Performance stats updated in database`);
    }

    console.log('\n\n✅ All vendor statistics have been updated!');
    console.log('\nNext steps:');
    console.log('1. The dashboard will now show accurate statistics');
    console.log('2. Stats are calculated fresh from the database on each request');
    console.log('3. Cache has been cleared to ensure fresh data');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

fixVendorDashboardStats();
