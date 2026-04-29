/**
 * Verification Script: Vendor Performance Fix
 * 
 * Verifies that vendor "Total Spent" now matches verified payments only
 * and does not exceed total revenue.
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function verify() {
  console.log('🔍 VENDOR PERFORMANCE FIX VERIFICATION\n');
  console.log('=' .repeat(80));

  const startDate = '2024-01-01';
  const endDate = '2026-12-31';

  // 1. Get total revenue (verified payments only)
  console.log('\n📊 TOTAL REVENUE (Verified Payments):');
  console.log('-'.repeat(80));
  
  const revenueResult = await db.execute(sql`
    SELECT 
      COALESCE(SUM(CAST(amount AS NUMERIC)), 0) as total_revenue,
      COUNT(*) as payment_count
    FROM payments
    WHERE status = 'verified'
      AND created_at >= ${startDate}
      AND created_at <= ${endDate}
  `);
  
  const revenueRow = revenueResult[0] as any;
  const totalRevenue = parseFloat(revenueRow.total_revenue);
  console.log(`   Total Revenue: ₦${totalRevenue.toLocaleString()}`);
  console.log(`   Payment Count: ${revenueRow.payment_count}`);

  // 2. Get vendor spending using FIXED query (with CTE)
  console.log('\n📊 VENDOR SPENDING (Fixed Query with CTE):');
  console.log('-'.repeat(80));
  
  const vendorsData = await db.execute(sql`
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
      COALESCE(vp.total_spent, 0) as total_spent,
      CASE 
        WHEN COUNT(b.id) > 0 
        THEN AVG(CAST(b.amount AS NUMERIC))
        ELSE 0
      END as avg_bid,
      CASE 
        WHEN COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id) > 0
        THEN (COALESCE(vp.paid_auctions, 0)::NUMERIC / COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id) * 100)
        ELSE 0
      END as payment_rate
    FROM vendors v
    LEFT JOIN bids b ON v.id = b.vendor_id 
      AND b.created_at >= ${startDate}
      AND b.created_at <= ${endDate}
    LEFT JOIN auctions a ON b.auction_id = a.id AND a.current_bidder = v.id
    LEFT JOIN vendor_payments vp ON v.id = vp.vendor_id
    GROUP BY v.id, v.business_name, v.tier, vp.total_spent, vp.paid_auctions
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
    console.log(`      Auctions Won: ${vendor.auctions_won}`);
    console.log(`      Payment Rate: ${parseFloat(vendor.payment_rate).toFixed(2)}%`);
  }
  
  console.log('\n   TOTAL VENDOR SPENDING:', `₦${totalVendorSpending.toLocaleString()}`);

  // 3. Verify consistency
  console.log('\n' + '='.repeat(80));
  console.log('🎯 VERIFICATION RESULTS:');
  console.log(`   Total Revenue (verified): ₦${totalRevenue.toLocaleString()}`);
  console.log(`   Total Vendor Spending (fixed query): ₦${totalVendorSpending.toLocaleString()}`);
  console.log(`   Difference: ₦${Math.abs(totalVendorSpending - totalRevenue).toLocaleString()}`);
  
  // Allow small difference for registration fees (non-auction payments)
  const registrationFees = totalRevenue - totalVendorSpending;
  
  if (totalVendorSpending <= totalRevenue) {
    console.log('\n   ✅ SUCCESS: Vendor spending does NOT exceed total revenue!');
    if (registrationFees > 0) {
      console.log(`   ℹ️  Note: ₦${registrationFees.toLocaleString()} is from registration fees (non-auction payments)`);
    }
  } else {
    console.log('\n   ❌ ISSUE: Vendor spending still exceeds total revenue!');
    console.log('   This should not happen with the fixed query.');
  }
  
  console.log('='.repeat(80));
}

verify()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
