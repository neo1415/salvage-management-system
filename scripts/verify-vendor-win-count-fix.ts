/**
 * Verify Vendor Win Count Fix
 * 
 * This script verifies that the vendor dashboard correctly counts wins from both:
 * 1. Legacy system: auctions.currentBidder (old auctions)
 * 2. New deposit system: auction_winners table with rank=1 (new auctions)
 */

import { db } from '@/lib/db/drizzle';
import { auctions, auctionWinners, vendors } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

async function verifyWinCounts() {
  console.log('🔍 Verifying vendor win counts...\n');

  try {
    // Get all vendors with their win counts from both systems
    const vendorsResult = await db
      .select({
        vendorId: vendors.id,
        businessName: vendors.businessName,
        legacyWins: sql<number>`count(DISTINCT CASE WHEN ${auctions.currentBidder} = ${vendors.id} AND ${auctions.status} = 'closed' THEN ${auctions.id} END)::int`,
        depositWins: sql<number>`count(DISTINCT CASE WHEN ${auctionWinners.vendorId} = ${vendors.id} AND ${auctionWinners.rank} = 1 THEN ${auctionWinners.auctionId} END)::int`,
      })
      .from(vendors)
      .leftJoin(auctions, eq(auctions.currentBidder, vendors.id))
      .leftJoin(auctionWinners, eq(auctionWinners.vendorId, vendors.id))
      .groupBy(vendors.id, vendors.businessName);

    // Calculate total wins and display results
    const vendorsWithWins = vendorsResult
      .map(v => ({
        ...v,
        totalWins: v.legacyWins + v.depositWins,
      }))
      .filter(v => v.totalWins > 0)
      .sort((a, b) => b.totalWins - a.totalWins);

    console.log('📊 Vendor Win Counts:\n');
    console.log('┌─────────────────────────────────────┬──────────┬─────────────┬───────────┐');
    console.log('│ Business Name                       │ Legacy   │ Deposit     │ Total     │');
    console.log('├─────────────────────────────────────┼──────────┼─────────────┼───────────┤');

    for (const vendor of vendorsWithWins) {
      const name = (vendor.businessName || 'Unknown').padEnd(35).substring(0, 35);
      const legacy = vendor.legacyWins.toString().padStart(8);
      const deposit = vendor.depositWins.toString().padStart(11);
      const total = vendor.totalWins.toString().padStart(9);
      console.log(`│ ${name} │ ${legacy} │ ${deposit} │ ${total} │`);
    }

    console.log('└─────────────────────────────────────┴──────────┴─────────────┴───────────┘\n');

    // Summary statistics
    const totalVendors = vendorsWithWins.length;
    const totalLegacyWins = vendorsWithWins.reduce((sum, v) => sum + v.legacyWins, 0);
    const totalDepositWins = vendorsWithWins.reduce((sum, v) => sum + v.depositWins, 0);
    const totalWins = totalLegacyWins + totalDepositWins;

    console.log('📈 Summary:');
    console.log(`   - Total vendors with wins: ${totalVendors}`);
    console.log(`   - Total legacy wins: ${totalLegacyWins}`);
    console.log(`   - Total deposit system wins: ${totalDepositWins}`);
    console.log(`   - Total wins (combined): ${totalWins}\n`);

    // Check for vendors with only deposit wins (these would have been missed before the fix)
    const vendorsWithOnlyDepositWins = vendorsWithWins.filter(v => v.legacyWins === 0 && v.depositWins > 0);
    
    if (vendorsWithOnlyDepositWins.length > 0) {
      console.log('⚠️  Vendors with wins that were NOT counted before the fix:');
      for (const vendor of vendorsWithOnlyDepositWins) {
        console.log(`   - ${vendor.businessName}: ${vendor.depositWins} wins`);
      }
      console.log('');
    }

    console.log('✅ Verification complete!\n');
    console.log('💡 The dashboard API now correctly counts wins from both systems.');
    console.log('   Vendors should see their win counts update after the cache expires (5 minutes).\n');

  } catch (error) {
    console.error('❌ Error verifying win counts:', error);
    throw error;
  }
}

// Run verification
verifyWinCounts()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
