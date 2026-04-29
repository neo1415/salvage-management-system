/**
 * Diagnostic Script: Vendor Performance Report vs Master Report
 * 
 * Compares vendor performance data between the two reports
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function diagnose() {
  console.log('🔍 VENDOR PERFORMANCE REPORT DIAGNOSTIC\n');
  console.log('=' .repeat(80));

  const startDate = '2024-03-29';
  const endDate = '2026-04-28';

  // 1. Master Report Vendor Data (CORRECT - uses verified payments)
  console.log('\n📊 MASTER REPORT VENDOR DATA (Verified Payments Only):');
  console.log('-'.repeat(80));
  
  const masterReportData = await db.execute(sql`
    WITH vendor_payments AS (
      SELECT 
        v.id as vendor_id,
        COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) as total_spent,
        COUNT(DISTINCT p.auction_id) as paid_auctions
      FROM vendors v
      LEFT JOIN payments p ON p.vendor_id = v.id AND p.status = 'verified'
      WHERE p.created_at >= ${startDate} AND p.created_at <= ${endDate}
      GROUP BY v.id
    )
    SELECT 
      v.id,
      v.business_name,
      v.tier,
      COUNT(DISTINCT b.auction_id) as auctions_participated,
      COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id) as auctions_won,
      CASE 
        WHEN COUNT(DISTINCT b.auction_id) > 0 
        THEN (COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id)::NUMERIC / COUNT(DISTINCT b.auction_id) * 100)
        ELSE 0
      END as win_rate,
      COALESCE(vp.total_spent, 0) as total_spent
    FROM vendors v
    LEFT JOIN bids b ON v.id = b.vendor_id 
      AND b.created_at >= ${startDate}
      AND b.created_at <= ${endDate}
    LEFT JOIN auctions a ON b.auction_id = a.id AND a.current_bidder = v.id
    LEFT JOIN vendor_payments vp ON v.id = vp.vendor_id
    GROUP BY v.id, v.business_name, v.tier, vp.total_spent, vp.paid_auctions
    HAVING COUNT(DISTINCT b.auction_id) > 0
    ORDER BY total_spent DESC
    LIMIT 5
  `);
  
  console.log('   Master Report (Correct):');
  for (const vendor of masterReportData as any[]) {
    console.log(`   ${vendor.business_name}:`);
    console.log(`      Bids: ${vendor.auctions_participated}`);
    console.log(`      Wins: ${vendor.auctions_won}`);
    console.log(`      Win Rate: ${parseFloat(vendor.win_rate).toFixed(2)}%`);
    console.log(`      Total Spent: ₦${parseFloat(vendor.total_spent).toLocaleString()}`);
  }

  // 2. Current Vendor Performance Report Data (WRONG - uses all bids)
  console.log('\n📊 VENDOR PERFORMANCE REPORT DATA (All Bids - WRONG):');
  console.log('-'.repeat(80));
  
  const vendorReportData = await db.execute(sql`
    SELECT 
      v.id,
      v.business_name,
      v.tier,
      COUNT(b.id) as total_bids,
      COUNT(DISTINCT b.auction_id) as auctions_participated,
      COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id) as auctions_won,
      COALESCE(SUM(CAST(b.amount AS NUMERIC)), 0) as total_spent_all_bids,
      CASE 
        WHEN COUNT(b.id) > 0 
        THEN (COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id)::NUMERIC / COUNT(b.id) * 100)
        ELSE 0
      END as win_rate
    FROM vendors v
    LEFT JOIN bids b ON v.id = b.vendor_id 
      AND b.created_at >= ${startDate}
      AND b.created_at <= ${endDate}
    LEFT JOIN auctions a ON b.auction_id = a.id AND a.current_bidder = v.id
    GROUP BY v.id, v.business_name, v.tier
    HAVING COUNT(b.id) > 0
    ORDER BY total_spent_all_bids DESC
    LIMIT 5
  `);
  
  console.log('   Vendor Performance Report (Wrong):');
  for (const vendor of vendorReportData as any[]) {
    console.log(`   ${vendor.business_name}:`);
    console.log(`      Bids: ${vendor.total_bids}`);
    console.log(`      Wins: ${vendor.auctions_won}`);
    console.log(`      Win Rate: ${parseFloat(vendor.win_rate).toFixed(2)}%`);
    console.log(`      Total Spent (All Bids): ₦${parseFloat(vendor.total_spent_all_bids).toLocaleString()}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 ISSUES IDENTIFIED:');
  console.log('   1. Vendor Performance Report uses SUM of ALL bids as "Total Spent"');
  console.log('   2. Master Report uses SUM of VERIFIED PAYMENTS as "Total Spent"');
  console.log('   3. Win Rate calculation is different:');
  console.log('      - Vendor Report: wins / total_bids');
  console.log('      - Master Report: wins / auctions_participated');
  console.log('\n   FIX NEEDED: Update Vendor Performance Report to match Master Report logic');
  console.log('='.repeat(80));
}

diagnose()
  .then(() => {
    console.log('\n✅ Diagnostic complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  });
