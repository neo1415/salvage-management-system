import { db } from '@/lib/db/drizzle';
import { salvageCases, auctions, bids, users } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function diagnoseReportingIssues() {
  console.log('🔍 Diagnosing Reporting Issues\n');

  // 1. Check salvage_cases schema
  console.log('1️⃣ Checking salvage_cases table structure...');
  try {
    const schemaQuery = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'salvage_cases'
      ORDER BY ordinal_position
    `);
    console.log('✅ salvage_cases columns:', schemaQuery);
  } catch (error: any) {
    console.error('❌ Error checking schema:', error.message);
  }

  // 2. Check auction bidding data
  console.log('\n2️⃣ Checking auction bidding patterns...');
  try {
    const biddingData = await db.execute(sql`
      SELECT 
        a.id as auction_id,
        a.status,
        COUNT(DISTINCT b.vendor_id) as unique_bidders,
        COUNT(b.id) as total_bids
      FROM auctions a
      LEFT JOIN bids b ON a.id = b.auction_id
      WHERE a.created_at >= NOW() - INTERVAL '30 days'
      GROUP BY a.id, a.status
      ORDER BY unique_bidders DESC
      LIMIT 20
    `);
    
    console.log('✅ Sample auction bidding data:');
    for (const row of biddingData as any[]) {
      console.log(`  Auction ${row.auction_id}: ${row.unique_bidders} bidders, ${row.total_bids} bids, status: ${row.status}`);
    }

    // Summary stats
    const summary = await db.execute(sql`
      SELECT 
        COUNT(DISTINCT a.id) as total_auctions,
        COUNT(DISTINCT CASE WHEN bidder_count >= 2 THEN a.id END) as competitive_2plus,
        COUNT(DISTINCT CASE WHEN bidder_count >= 3 THEN a.id END) as competitive_3plus,
        COUNT(DISTINCT CASE WHEN bidder_count = 1 THEN a.id END) as single_bidder,
        COUNT(DISTINCT CASE WHEN bidder_count = 0 THEN a.id END) as no_bids
      FROM auctions a
      LEFT JOIN (
        SELECT auction_id, COUNT(DISTINCT vendor_id) as bidder_count
        FROM bids
        GROUP BY auction_id
      ) b ON a.id = b.auction_id
      WHERE a.created_at >= NOW() - INTERVAL '30 days'
    `);
    
    console.log('\n📊 Bidding Summary (last 30 days):');
    console.log(summary[0]);

  } catch (error: any) {
    console.error('❌ Error checking bidding data:', error.message);
  }

  // 3. Check if there's test data
  console.log('\n3️⃣ Checking for test data...');
  try {
    const testData = await db.execute(sql`
      SELECT 
        COUNT(*) as count,
        'auctions' as table_name
      FROM auctions
      WHERE claim_reference LIKE '%TEST%' OR claim_reference LIKE '%test%'
      UNION ALL
      SELECT 
        COUNT(*) as count,
        'salvage_cases' as table_name
      FROM salvage_cases
      WHERE claim_reference LIKE '%TEST%' OR claim_reference LIKE '%test%'
    `);
    
    console.log('✅ Test data check:', testData);
  } catch (error: any) {
    console.error('❌ Error checking test data:', error.message);
  }

  // 4. Check users table for adjuster_id issue
  console.log('\n4️⃣ Checking user/adjuster relationship...');
  try {
    const userCheck = await db.execute(sql`
      SELECT 
        u.id,
        u.name,
        u.role,
        COUNT(sc.id) as cases_count
      FROM users u
      LEFT JOIN salvage_cases sc ON u.id = sc.adjuster_id
      WHERE u.role = 'adjuster'
      GROUP BY u.id, u.name, u.role
      LIMIT 10
    `);
    
    console.log('✅ Adjuster data:', userCheck);
  } catch (error: any) {
    console.error('❌ Error checking adjuster data:', error.message);
  }

  console.log('\n✅ Diagnosis complete!');
}

diagnoseReportingIssues()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
