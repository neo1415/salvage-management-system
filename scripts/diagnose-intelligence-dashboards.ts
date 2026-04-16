/**
 * Diagnose Intelligence Dashboard Issues
 * 
 * Quick diagnostic script to identify why dashboards might show "No data available"
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function diagnose() {
  console.log('🔍 Diagnosing Intelligence Dashboard Issues...\n');
  console.log('='.repeat(70));

  try {
    // 1. Check if auctions exist
    console.log('\n1️⃣  AUCTION DATA CHECK');
    console.log('-'.repeat(70));
    const auctionStats: any = await db.execute(sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM auctions
      GROUP BY status
      ORDER BY count DESC
    `);
    console.log('Auction Status Distribution:');
    auctionStats.forEach((stat: any) => {
      console.log(`   ${stat.status}: ${stat.count} auctions`);
    });

    const closedCount = auctionStats.find((s: any) => s.status === 'closed')?.count || 0;
    if (closedCount === 0) {
      console.log('\n❌ ISSUE: No closed auctions found!');
      console.log('   → Intelligence data requires completed auctions to populate.');
      console.log('   → Complete at least 2 auctions with different winners.');
      return;
    } else {
      console.log(`\n✅ Found ${closedCount} closed auctions`);
    }

    // 2. Check if bids exist
    console.log('\n2️⃣  BID DATA CHECK');
    console.log('-'.repeat(70));
    const bidStats: any = await db.execute(sql`
      SELECT 
        COUNT(*) as total_bids,
        COUNT(DISTINCT vendor_id) as unique_vendors,
        COUNT(DISTINCT auction_id) as auctions_with_bids
      FROM bids
    `);
    console.log(`Total Bids: ${bidStats[0].total_bids}`);
    console.log(`Unique Vendors: ${bidStats[0].unique_vendors}`);
    console.log(`Auctions with Bids: ${bidStats[0].auctions_with_bids}`);

    if (bidStats[0].total_bids === 0) {
      console.log('\n❌ ISSUE: No bids found!');
      console.log('   → Intelligence data requires bid activity.');
      return;
    } else {
      console.log('\n✅ Bid data available');
    }

    // 3. Check intelligence table population
    console.log('\n3️⃣  INTELLIGENCE TABLE STATUS');
    console.log('-'.repeat(70));
    
    const tables = [
      { name: 'predictions', critical: true },
      { name: 'recommendations', critical: false },
      { name: 'interactions', critical: true },
      { name: 'vendor_segments', critical: true },
      { name: 'asset_performance_analytics', critical: true },
      { name: 'attribute_performance_analytics', critical: true },
      { name: 'temporal_patterns_analytics', critical: true },
      { name: 'geographic_patterns_analytics', critical: true },
      { name: 'ml_training_datasets', critical: true },
      { name: 'conversion_funnel_analytics', critical: true },
      { name: 'session_analytics', critical: false },
    ];

    let emptyTables = [];
    let criticalEmpty = [];

    for (const table of tables) {
      const result: any = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${table.name}`));
      const count = result[0]?.count || result.rows?.[0]?.count || 0;
      const status = count > 0 ? '✅' : (table.critical ? '❌' : '⚠️');
      console.log(`${status} ${table.name.padEnd(40)} ${count} rows`);
      
      if (count === 0) {
        emptyTables.push(table.name);
        if (table.critical) {
          criticalEmpty.push(table.name);
        }
      }
    }

    // 4. Diagnosis and recommendations
    console.log('\n4️⃣  DIAGNOSIS & RECOMMENDATIONS');
    console.log('-'.repeat(70));

    if (criticalEmpty.length > 0) {
      console.log('\n❌ CRITICAL ISSUE: Empty intelligence tables detected!');
      console.log('\nEmpty Critical Tables:');
      criticalEmpty.forEach(table => console.log(`   - ${table}`));
      
      console.log('\n📋 SOLUTION:');
      console.log('   Run the population script to fill intelligence tables:');
      console.log('   ```bash');
      console.log('   npx tsx scripts/populate-intelligence-data-fixed.ts');
      console.log('   ```');
      console.log('\n   Then verify the fix:');
      console.log('   ```bash');
      console.log('   npx tsx scripts/verify-intelligence-dashboards.ts');
      console.log('   ```');
    } else if (emptyTables.length > 0) {
      console.log('\n⚠️  WARNING: Some non-critical tables are empty');
      console.log('\nEmpty Tables:');
      emptyTables.forEach(table => console.log(`   - ${table}`));
      console.log('\n   These tables are not critical for dashboard display.');
    } else {
      console.log('\n✅ ALL INTELLIGENCE TABLES POPULATED!');
      console.log('\n   Dashboards should display data correctly.');
      console.log('   If you still see "No data available", check:');
      console.log('   1. API routes are returning data correctly');
      console.log('   2. Frontend components are fetching from correct endpoints');
      console.log('   3. Browser console for any errors');
    }

    // 5. Sample data check
    console.log('\n5️⃣  SAMPLE DATA VERIFICATION');
    console.log('-'.repeat(70));
    
    // Check trending assets
    const trendingAssets: any = await db.execute(sql`
      SELECT COUNT(*) as count FROM asset_performance_analytics WHERE demand_score > 0
    `);
    console.log(`Trending Assets Available: ${trendingAssets[0].count > 0 ? '✅ Yes' : '❌ No'}`);

    // Check temporal patterns
    const temporalPatterns: any = await db.execute(sql`
      SELECT COUNT(*) as count FROM temporal_patterns_analytics WHERE peak_activity_score > 0
    `);
    console.log(`Temporal Patterns Available: ${temporalPatterns[0].count > 0 ? '✅ Yes' : '❌ No'}`);

    // Check geographic patterns
    const geoPatterns: any = await db.execute(sql`
      SELECT COUNT(*) as count FROM geographic_patterns_analytics WHERE demand_score > 0
    `);
    console.log(`Geographic Patterns Available: ${geoPatterns[0].count > 0 ? '✅ Yes' : '❌ No'}`);

    // Check vendor segments
    const vendorSegs: any = await db.execute(sql`
      SELECT COUNT(*) as count FROM vendor_segments
    `);
    console.log(`Vendor Segments Available: ${vendorSegs[0].count > 0 ? '✅ Yes' : '❌ No'}`);

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ Diagnosis Complete!');

  } catch (error) {
    console.error('\n❌ Error during diagnosis:', error);
    throw error;
  }
}

diagnose()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Diagnosis failed:', error);
    process.exit(1);
  });
