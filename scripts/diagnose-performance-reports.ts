/**
 * Diagnose Performance Reports Issues
 * 
 * Tests My Performance, Vendor Performance, and Auction Performance reports
 */

import 'dotenv/config';
import { db } from '../src/lib/db/drizzle';
import { salvageCases, auctions, bids, vendors, users, payments } from '../src/lib/db/schema';
import { eq, and, sql, count, desc } from 'drizzle-orm';

async function diagnosePerformanceReports() {
  console.log('=== Diagnosing Performance Reports ===\n');

  try {
    // 1. Check Vendor Performance Data
    console.log('1. VENDOR PERFORMANCE DATA');
    console.log('   Checking vendors with auction activity...\n');

    // Simpler query - just count bids per vendor
    const vendorBids = await db
      .select({
        vendorId: bids.vendorId,
        bidCount: count(bids.id),
      })
      .from(bids)
      .groupBy(bids.vendorId)
      .limit(10);

    console.log('   Bids per Vendor:');
    console.table(vendorBids);

    // Get vendor details
    const vendorDetails = await db
      .select({
        id: vendors.id,
        name: vendors.businessName,
        tier: vendors.tier,
      })
      .from(vendors)
      .limit(10);

    console.log('\n   Vendor Details:');
    console.table(vendorDetails);
    console.log();

    // 2. Check Auction Performance Data
    console.log('2. AUCTION PERFORMANCE DATA');
    console.log('   Checking auction statistics...\n');

    const auctionStats = await db
      .select({
        status: auctions.status,
        count: sql<number>`count(*)`,
        avgBids: sql<number>`avg((select count(*) from ${bids} where ${bids.auctionId} = ${auctions.id}))`,
        withWinner: sql<number>`count(case when ${auctions.winnerId} is not null then 1 end)`,
      })
      .from(auctions)
      .groupBy(auctions.status);

    console.log('   Auction Stats by Status:');
    console.table(auctionStats);
    console.log();

    // Sample auctions with details
    const sampleAuctions = await db
      .select({
        auctionId: auctions.id,
        status: auctions.status,
        startingBid: auctions.startingBid,
        currentBid: auctions.currentBid,
        winnerId: auctions.winnerId,
        bidCount: sql<number>`(select count(*) from ${bids} where ${bids.auctionId} = ${auctions.id})`,
      })
      .from(auctions)
      .limit(5);

    console.log('   Sample Auctions:');
    console.table(sampleAuctions);
    console.log();

    // 3. Check My Performance Data (User Activity)
    console.log('3. MY PERFORMANCE DATA (User Activity)');
    console.log('   Checking user roles and activity...\n');

    const userStats = await db
      .select({
        role: users.role,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .groupBy(users.role);

    console.log('   Users by Role:');
    console.table(userStats);
    console.log();

    // Check cases by user role
    const casesByRole = await db
      .select({
        role: users.role,
        userName: users.name,
        casesCreated: sql<number>`count(distinct ${salvageCases.id})`,
      })
      .from(users)
      .leftJoin(salvageCases, eq(users.id, salvageCases.createdBy))
      .groupBy(users.role, users.name, users.id)
      .having(sql`count(distinct ${salvageCases.id}) > 0`)
      .limit(10);

    console.log('   Cases Created by Users:');
    console.table(casesByRole);
    console.log();

    // 4. Check for missing data relationships
    console.log('4. DATA RELATIONSHIP CHECKS');
    
    const orphanedBids = await db
      .select({ count: sql<number>`count(*)` })
      .from(bids)
      .leftJoin(auctions, eq(bids.auctionId, auctions.id))
      .where(sql`${auctions.id} IS NULL`);

    console.log(`   Orphaned bids (no auction): ${orphanedBids[0].count}`);

    const orphanedAuctions = await db
      .select({ count: sql<number>`count(*)` })
      .from(auctions)
      .leftJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(sql`${salvageCases.id} IS NULL`);

    console.log(`   Orphaned auctions (no case): ${orphanedAuctions[0].count}`);

    const casesWithoutAuctions = await db
      .select({ count: sql<number>`count(*)` })
      .from(salvageCases)
      .leftJoin(auctions, eq(salvageCases.id, auctions.caseId))
      .where(and(
        sql`${auctions.id} IS NULL`,
        eq(salvageCases.status, 'approved')
      ));

    console.log(`   Approved cases without auctions: ${casesWithoutAuctions[0].count}`);
    console.log();

    // 5. Check date ranges
    console.log('5. DATE RANGE CHECKS');
    
    const dateRanges = await db
      .select({
        table: sql<string>`'cases'`,
        earliest: sql<Date>`min(${salvageCases.createdAt})`,
        latest: sql<Date>`max(${salvageCases.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(salvageCases)
      .union(
        db.select({
          table: sql<string>`'auctions'`,
          earliest: sql<Date>`min(${auctions.createdAt})`,
          latest: sql<Date>`max(${auctions.createdAt})`,
          count: sql<number>`count(*)`,
        }).from(auctions)
      )
      .union(
        db.select({
          table: sql<string>`'bids'`,
          earliest: sql<Date>`min(${bids.createdAt})`,
          latest: sql<Date>`max(${bids.createdAt})`,
          count: sql<number>`count(*)`,
        }).from(bids)
      );

    console.log('   Data Date Ranges:');
    console.table(dateRanges);
    console.log();

    // 6. Summary
    console.log('=== SUMMARY ===');
    console.log('Check if:');
    console.log('1. Vendors have bids and won auctions');
    console.log('2. Auctions have bids and winners');
    console.log('3. Users have created cases');
    console.log('4. No orphaned data (bids without auctions, etc.)');
    console.log('5. Date ranges are reasonable');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

diagnosePerformanceReports()
  .then(() => {
    console.log('\n✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnosis failed:', error);
    process.exit(1);
  });
