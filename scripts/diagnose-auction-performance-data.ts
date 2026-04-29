/**
 * Diagnostic script to understand auction performance data discrepancy
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function diagnose() {
  console.log('=== AUCTION PERFORMANCE DATA DIAGNOSIS ===\n');

  const startDate = '2026-02-01';
  const endDate = '2026-04-28';

  // 1. Check Master Report query (what it uses)
  console.log('1. MASTER REPORT QUERY (Correct):');
  console.log('   Filters: payments.created_at between dates, status = verified\n');
  
  const masterReportData = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT p.id) as payment_count,
      SUM(CAST(p.amount AS NUMERIC)) as total_revenue,
      COUNT(DISTINCT p.auction_id) as unique_auctions
    FROM payments p
    WHERE p.status = 'verified'
      AND p.created_at >= ${startDate}
      AND p.created_at <= ${endDate}
  `);
  
  console.log('   Results:', masterReportData[0]);
  console.log('');

  // 2. Check current Auction Performance query
  console.log('2. CURRENT AUCTION PERFORMANCE QUERY:');
  console.log('   Filters: auctions.start_time between dates\n');
  
  const currentQuery = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT a.id) as auction_count,
      COUNT(DISTINCT p.id) as payment_count,
      SUM(CAST(p.amount AS NUMERIC)) as total_revenue
    FROM auctions a
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    LEFT JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
    WHERE a.start_time >= ${startDate}::timestamp
      AND a.start_time <= ${endDate}::timestamp
      AND sc.status != 'draft'
  `);
  
  console.log('   Results:', currentQuery[0]);
  console.log('');

  // 3. Check what we SHOULD use (auctions with verified payments in date range)
  console.log('3. RECOMMENDED QUERY (Match Master Report):');
  console.log('   Filters: payments.created_at between dates, join to auctions\n');
  
  const recommendedQuery = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT a.id) as auction_count,
      COUNT(DISTINCT p.id) as payment_count,
      SUM(CAST(p.amount AS NUMERIC)) as total_revenue,
      COUNT(DISTINCT b.id) as total_bids
    FROM payments p
    INNER JOIN auctions a ON p.auction_id = a.id
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    LEFT JOIN bids b ON b.auction_id = a.id
    WHERE p.status = 'verified'
      AND p.created_at >= ${startDate}
      AND p.created_at <= ${endDate}
      AND sc.status != 'draft'
  `);
  
  console.log('   Results:', recommendedQuery[0]);
  console.log('');

  // 4. Show sample auctions with payments
  console.log('4. SAMPLE AUCTIONS WITH VERIFIED PAYMENTS:');
  const sampleAuctions = await db.execute(sql`
    SELECT 
      sc.claim_reference,
      a.start_time,
      p.created_at as payment_date,
      p.amount as payment_amount,
      a.id as auction_id
    FROM payments p
    INNER JOIN auctions a ON p.auction_id = a.id
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    WHERE p.status = 'verified'
      AND p.created_at >= ${startDate}
      AND p.created_at <= ${endDate}
    ORDER BY p.created_at DESC
    LIMIT 10
  `);
  
  console.log('   Sample (first 10):');
  sampleAuctions.forEach((row: any) => {
    console.log(`   - ${row.claim_reference}: Payment ₦${row.payment_amount} on ${row.payment_date}`);
  });
  console.log('');

  // 5. Check for duplicate auction IDs
  console.log('5. CHECK FOR DUPLICATE AUCTION IDs:');
  const duplicates = await db.execute(sql`
    SELECT 
      a.id,
      sc.claim_reference,
      COUNT(*) as occurrence_count
    FROM auctions a
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    WHERE a.start_time >= ${startDate}::timestamp
      AND a.start_time <= ${endDate}::timestamp
    GROUP BY a.id, sc.claim_reference
    HAVING COUNT(*) > 1
  `);
  
  if (duplicates.length > 0) {
    console.log('   DUPLICATES FOUND:');
    duplicates.forEach((row: any) => {
      console.log(`   - ${row.id} (${row.claim_reference}): ${row.occurrence_count} times`);
    });
  } else {
    console.log('   No duplicates found in auctions table');
  }
  console.log('');

  console.log('=== CONCLUSION ===');
  console.log('The Auction Performance report should use the RECOMMENDED QUERY');
  console.log('to match the Master Report revenue numbers.');
}

diagnose()
  .then(() => {
    console.log('\nDiagnosis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
