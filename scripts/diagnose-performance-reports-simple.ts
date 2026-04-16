/**
 * Simple Performance Reports Diagnosis
 */

import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { salvageCases, auctions, bids, vendors, users } from '../src/lib/db/schema';
import { sql, count, desc } from 'drizzle-orm';

async function diagnose() {
  console.log('=== Performance Reports Diagnosis ===\n');

  // 1. Vendor Performance
  console.log('1. VENDOR PERFORMANCE');
  const vendorCount = await db.select({ count: count() }).from(vendors);
  console.log(`   Total vendors: ${vendorCount[0].count}`);

  const bidCount = await db.select({ count: count() }).from(bids);
  console.log(`   Total bids: ${bidCount[0].count}`);

  const bidsPerVendor = await db
    .select({
      vendorId: bids.vendorId,
      count: count(),
    })
    .from(bids)
    .groupBy(bids.vendorId)
    .orderBy(desc(count()))
    .limit(5);

  console.log('\n   Top 5 vendors by bid count:');
  console.table(bidsPerVendor);

  // 2. Auction Performance
  console.log('\n2. AUCTION PERFORMANCE');
  const auctionCount = await db.select({ count: count() }).from(auctions);
  console.log(`   Total auctions: ${auctionCount[0].count}`);

  const auctionsByStatus = await db
    .select({
      status: auctions.status,
      count: count(),
    })
    .from(auctions)
    .groupBy(auctions.status);

  console.log('\n   Auctions by status:');
  console.table(auctionsByStatus);

  // 3. My Performance (User Activity)
  console.log('\n3. MY PERFORMANCE (User Activity)');
  const userCount = await db.select({ count: count() }).from(users);
  console.log(`   Total users: ${userCount[0].count}`);

  const usersByRole = await db
    .select({
      role: users.role,
      count: count(),
    })
    .from(users)
    .groupBy(users.role);

  console.log('\n   Users by role:');
  console.table(usersByRole);

  const caseCount = await db.select({ count: count() }).from(salvageCases);
  console.log(`\n   Total cases: ${caseCount[0].count}`);

  const casesByStatus = await db
    .select({
      status: salvageCases.status,
      count: count(),
    })
    .from(salvageCases)
    .groupBy(salvageCases.status);

  console.log('\n   Cases by status:');
  console.table(casesByStatus);

  // 4. Check if createdBy field exists and has data
  const casesWithCreator = await db
    .select({
      createdBy: salvageCases.createdBy,
      count: count(),
    })
    .from(salvageCases)
    .groupBy(salvageCases.createdBy)
    .limit(5);

  console.log('\n   Cases by creator (sample):');
  console.table(casesWithCreator);

  // 5. Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Vendors: ${vendorCount[0].count}`);
  console.log(`Bids: ${bidCount[0].count}`);
  console.log(`Auctions: ${auctionCount[0].count}`);
  console.log(`Users: ${userCount[0].count}`);
  console.log(`Cases: ${caseCount[0].count}`);

  console.log('\n=== POTENTIAL ISSUES ===');
  if (bidCount[0].count === 0) {
    console.log('❌ NO BIDS - Vendor Performance will be empty');
  }
  if (auctionCount[0].count === 0) {
    console.log('❌ NO AUCTIONS - Auction Performance will be empty');
  }
  if (caseCount[0].count === 0) {
    console.log('❌ NO CASES - My Performance will be empty');
  }
  if (casesWithCreator.every(c => !c.createdBy)) {
    console.log('❌ NO CASE CREATORS - My Performance won\'t show user activity');
  }
}

diagnose()
  .then(() => {
    console.log('\n✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
