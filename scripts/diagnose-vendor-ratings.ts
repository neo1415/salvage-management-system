import { db } from '@/lib/db/drizzle';
import { vendors, bids, auctions } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function diagnoseVendorRatings() {
  console.log('🔍 Diagnosing Vendor Ratings...\n');

  // Get all vendors with their stats
  const allVendors = await db
    .select({
      id: vendors.id,
      businessName: vendors.businessName,
      rating: vendors.rating,
      performanceStats: vendors.performanceStats,
    })
    .from(vendors);

  console.log(`Found ${allVendors.length} vendors\n`);

  for (const vendor of allVendors) {
    console.log(`\n📊 Vendor: ${vendor.businessName}`);
    console.log(`   ID: ${vendor.id}`);
    console.log(`   Rating (stored): ${vendor.rating}`);
    
    // Get bid count
    const bidCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bids)
      .where(eq(bids.vendorId, vendor.id));
    
    // Get win count
    const winCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auctions)
      .where(
        sql`${auctions.currentBidder} = ${vendor.id} AND ${auctions.status} = 'closed'`
      );

    console.log(`   Total Bids: ${bidCount[0]?.count || 0}`);
    console.log(`   Total Wins: ${winCount[0]?.count || 0}`);
    console.log(`   Performance Stats:`, vendor.performanceStats);
  }
}

diagnoseVendorRatings()
  .then(() => {
    console.log('\n✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
