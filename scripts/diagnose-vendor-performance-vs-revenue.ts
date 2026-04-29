/**
 * Diagnostic Script: Vendor Performance vs Revenue Mismatch
 * 
 * Investigates why vendor "Total Spent" exceeds total revenue.
 * 
 * HYPOTHESIS:
 * - Vendor query may include pending/unverified payments
 * - Vendor query may have duplicate counting
 * - Vendor query may not filter by date correctly
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function diagnose() {
  console.log('🔍 VENDOR PERFORMANCE VS REVENUE DIAGNOSTIC\n');
  console.log('=' .repeat(80));

  const startDate = '2024-01-01';
  const endDate = '2026-12-31';

  // 1. Check ACTUAL total revenue (verified payments only)
  console.log('\n📊 ACTUAL TOTAL REVENUE (Verified Payments):');
  console.log('-'.repeat(80));
  
  const revenueResult = await db.execute(sql`
    SELECT 
      COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as total_revenue,
      COUNT(*) as payment_count,
      COUNT(*) FILTER (WHERE auction_id IS NOT NULL) as auction_payments,
      COUNT(*) FILTER (WHERE auction_id IS NULL) as registration_fees
    FROM payments
    WHERE status = 'verified'
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
  `);
  
  const revenueRow = revenueResult[0] as any;
  console.log('   Total Revenue:', `₦${parseFloat(revenueRow.total_revenue).toLocaleString()}`);
  console.log('   Payment Count:', revenueRow.payment_count);
  console.log('   Auction Payments:', revenueRow.auction_payments);
  console.log('   Registration Fees:', revenueRow.registration_fees);

  // 2. Check vendor "Total Spent" using CURRENT query logic
  console.log('\n📊 VENDOR "TOTAL SPENT" (Current Query Logic):');
  console.log('-'.repeat(80));
  
  const vendorsData = await db.execute(sql`
    SELECT 
      v.id,
      v.business_name,
      v.tier,
      COUNT(DISTINCT b.auction_id) as auctions_participated,
      COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id) as auctions_won,
      COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) as total_spent,
      COUNT(p.id) as payment_count,
      COUNT(p.id) FILTER (WHERE p.status = 'verified') as verified_payments,
      COUNT(p.id) FILTER (WHERE p.status != 'verified') as unverified_payments
    FROM vendors v
    LEFT JOIN bids b ON v.id = b.vendor_id 
      AND b.created_at >= ${startDate}
      AND b.created_at <= ${endDate}
    LEFT JOIN auctions a ON b.auction_id = a.id AND a.current_bidder = v.id
    LEFT JOIN payments p ON a.id = p.auction_id AND p.vendor_id = v.id
    GROUP BY v.id, v.business_name, v.tier
    HAVING COUNT(DISTINCT b.auction_id) > 0
    ORDER BY total_spent DESC
    LIMIT 10
  `);
  
  let totalVendorSpending = 0;
  for (const vendor of vendorsData as any[]) {
    const spent = parseFloat(vendor.total_spent);
    totalVendorSpending += spent;
    console.log(`   ${vendor.business_name}:`);
    console.log(`      Total Spent: ₦${spent.toLocaleString()}`);
    console.log(`      Payments: ${vendor.payment_count} (${vendor.verified_payments} verified, ${vendor.unverified_payments} unverified)`);
    console.log(`      Auctions Won: ${vendor.auctions_won}`);
  }
  
  console.log('\n   TOTAL VENDOR SPENDING:', `₦${totalVendorSpending.toLocaleString()}`);

  // 3. Check if vendor query is missing payment status filter
  console.log('\n📊 VENDOR SPENDING (VERIFIED ONLY):');
  console.log('-'.repeat(80));
  
  const vendorsVerifiedData = await db.execute(sql`
    SELECT 
      v.id,
      v.business_name,
      COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) as total_spent_verified,
      COUNT(p.id) as payment_count
    FROM vendors v
    LEFT JOIN bids b ON v.id = b.vendor_id 
      AND b.created_at >= ${startDate}
      AND b.created_at <= ${endDate}
    LEFT JOIN auctions a ON b.auction_id = a.id AND a.current_bidder = v.id
    LEFT JOIN payments p ON a.id = p.auction_id AND p.vendor_id = v.id AND p.status = 'verified'
    GROUP BY v.id, v.business_name
    HAVING COUNT(DISTINCT b.auction_id) > 0
    ORDER BY total_spent_verified DESC
    LIMIT 10
  `);
  
  let totalVerifiedSpending = 0;
  for (const vendor of vendorsVerifiedData as any[]) {
    const spent = parseFloat(vendor.total_spent_verified);
    totalVerifiedSpending += spent;
    console.log(`   ${vendor.business_name}: ₦${spent.toLocaleString()} (${vendor.payment_count} payments)`);
  }
  
  console.log('\n   TOTAL VERIFIED SPENDING:', `₦${totalVerifiedSpending.toLocaleString()}`);

  // 4. Check for duplicate payments
  console.log('\n📊 CHECKING FOR DUPLICATE PAYMENTS:');
  console.log('-'.repeat(80));
  
  const duplicatesResult = await db.execute(sql`
    SELECT 
      auction_id,
      vendor_id,
      COUNT(*) as payment_count,
      SUM(CAST(amount AS NUMERIC)) as total_amount
    FROM payments
    WHERE auction_id IS NOT NULL
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
    GROUP BY auction_id, vendor_id
    HAVING COUNT(*) > 1
    ORDER BY payment_count DESC
    LIMIT 10
  `);
  
  if ((duplicatesResult as any[]).length > 0) {
    console.log('   ⚠️  DUPLICATE PAYMENTS FOUND:');
    for (const dup of duplicatesResult as any[]) {
      console.log(`      Auction ${dup.auction_id}: ${dup.payment_count} payments, ₦${parseFloat(dup.total_amount).toLocaleString()}`);
    }
  } else {
    console.log('   ✅ No duplicate payments found');
  }

  // 5. Check payment status breakdown
  console.log('\n📊 PAYMENT STATUS BREAKDOWN:');
  console.log('-'.repeat(80));
  
  const statusResult = await db.execute(sql`
    SELECT 
      status,
      COUNT(*) as count,
      SUM(CAST(amount AS NUMERIC)) as total_amount
    FROM payments
    WHERE auction_id IS NOT NULL
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
    GROUP BY status
    ORDER BY total_amount DESC
  `);
  
  for (const row of statusResult as any[]) {
    console.log(`   ${row.status}: ${row.count} payments, ₦${parseFloat(row.total_amount).toLocaleString()}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 ANALYSIS:');
  console.log(`   Total Revenue (verified): ₦${parseFloat(revenueRow.total_revenue).toLocaleString()}`);
  console.log(`   Vendor Spending (current query): ₦${totalVendorSpending.toLocaleString()}`);
  console.log(`   Vendor Spending (verified only): ₦${totalVerifiedSpending.toLocaleString()}`);
  console.log(`   Difference: ₦${(totalVendorSpending - parseFloat(revenueRow.total_revenue)).toLocaleString()}`);
  
  if (totalVendorSpending > parseFloat(revenueRow.total_revenue)) {
    console.log('\n   ❌ ISSUE: Vendor spending exceeds total revenue!');
    console.log('   LIKELY CAUSE: Vendor query is NOT filtering by payment status');
    console.log('   FIX: Add "AND p.status = \'verified\'" to the vendor query');
  } else if (Math.abs(totalVerifiedSpending - parseFloat(revenueRow.total_revenue)) < 1) {
    console.log('\n   ✅ VERIFIED: Vendor spending matches revenue when filtered by status');
  }
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
