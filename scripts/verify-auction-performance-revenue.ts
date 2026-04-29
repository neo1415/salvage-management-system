/**
 * Verify Auction Performance Revenue Calculation
 * 
 * This script verifies the revenue calculation matches expectations
 */

import { db } from '../src/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function verifyRevenue() {
  console.log('=== AUCTION PERFORMANCE REVENUE VERIFICATION ===\n');

  const startDate = '2026-02-01';
  const endDate = '2026-04-28';

  // Check current query (with DISTINCT ON to handle duplicate payments)
  console.log('1. Current Repository Query (with DISTINCT ON):');
  const currentQuery = await db.execute(sql`
    SELECT DISTINCT ON (a.id)
      a.id as auction_id,
      sc.claim_reference,
      a.status,
      p.amount as winning_bid,
      p.id as payment_id,
      p.created_at as payment_created
    FROM auctions a
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    LEFT JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
    WHERE a.end_time >= ${startDate}::timestamp
      AND a.end_time <= ${endDate}::timestamp
      AND a.status IN ('closed', 'awaiting_payment')
      AND sc.status != 'draft'
    ORDER BY a.id, p.created_at DESC NULLS LAST
  `);

  console.log(`   Total Auctions: ${currentQuery.length}`);
  
  const totalRevenue = currentQuery.reduce((sum: number, row: any) => {
    return sum + parseFloat(row.winning_bid || '0');
  }, 0);
  
  console.log(`   Total Revenue: ₦${totalRevenue.toLocaleString()}`);
  console.log('');

  // Check for auctions with multiple payments
  console.log('2. Auctions with Multiple Payments:');
  const multiplePayments = await db.execute(sql`
    SELECT 
      a.id,
      sc.claim_reference,
      COUNT(p.id) as payment_count,
      STRING_AGG(CAST(p.amount AS TEXT), ', ') as amounts
    FROM auctions a
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    LEFT JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
    WHERE a.end_time >= ${startDate}::timestamp
      AND a.end_time <= ${endDate}::timestamp
      AND a.status IN ('closed', 'awaiting_payment')
      AND sc.status != 'draft'
    GROUP BY a.id, sc.claim_reference
    HAVING COUNT(p.id) > 1
    ORDER BY sc.claim_reference
  `);

  if (multiplePayments.length > 0) {
    console.log(`   Found ${multiplePayments.length} auctions with multiple payments:`);
    multiplePayments.forEach((row: any) => {
      console.log(`   - ${row.claim_reference}: ${row.payment_count} payments (₦${row.amounts})`);
    });
  } else {
    console.log('   ✅ No auctions with multiple payments');
  }
  console.log('');

  // Check auctions without payments
  console.log('3. Auctions Without Payments:');
  const noPayments = await db.execute(sql`
    SELECT 
      a.id,
      sc.claim_reference,
      a.status,
      a.current_bid
    FROM auctions a
    LEFT JOIN salvage_cases sc ON a.case_id = sc.id
    LEFT JOIN payments p ON p.auction_id = a.id AND p.status = 'verified'
    WHERE a.end_time >= ${startDate}::timestamp
      AND a.end_time <= ${endDate}::timestamp
      AND a.status IN ('closed', 'awaiting_payment')
      AND sc.status != 'draft'
      AND p.id IS NULL
    ORDER BY sc.claim_reference
  `);

  console.log(`   Found ${noPayments.length} auctions without verified payments`);
  if (noPayments.length > 0 && noPayments.length <= 10) {
    noPayments.forEach((row: any) => {
      console.log(`   - ${row.claim_reference}: ${row.status} (Current Bid: ₦${parseFloat(row.current_bid || '0').toLocaleString()})`);
    });
  }
  console.log('');

  // Compare with Master Report logic (by payment date)
  console.log('4. Master Report Logic (by payment date):');
  const masterReportRevenue = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT p.id) as payment_count,
      SUM(CAST(p.amount AS NUMERIC)) as total_revenue
    FROM payments p
    WHERE p.status = 'verified'
      AND p.created_at >= ${startDate}::timestamp
      AND p.created_at <= ${endDate}::timestamp
      AND p.auction_id IS NOT NULL
  `);

  const masterStats = masterReportRevenue[0] as any;
  console.log(`   Total Payments: ${masterStats.payment_count}`);
  console.log(`   Total Revenue: ₦${parseFloat(masterStats.total_revenue || '0').toLocaleString()}`);
  console.log('');

  // Summary
  console.log('=== SUMMARY ===\n');
  console.log(`Auction Performance Report (by auction end_time): ₦${totalRevenue.toLocaleString()}`);
  console.log(`Master Report (by payment date): ₦${parseFloat(masterStats.total_revenue || '0').toLocaleString()}`);
  console.log(`Difference: ₦${Math.abs(totalRevenue - parseFloat(masterStats.total_revenue || '0')).toLocaleString()}`);
  console.log('');
  
  if (totalRevenue === parseFloat(masterStats.total_revenue || '0')) {
    console.log('✅ Revenue calculations match!');
  } else {
    console.log('⚠️  Revenue calculations differ - this is expected if:');
    console.log('   - Auction Performance filters by auction end_time');
    console.log('   - Master Report filters by payment date');
    console.log('   - Some payments were made outside the auction end_time range');
  }
}

verifyRevenue()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
