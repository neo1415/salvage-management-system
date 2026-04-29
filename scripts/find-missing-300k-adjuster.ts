/**
 * Find the Missing ₦300,000 Adjuster
 * Investigates the ₦300k revenue discrepancy
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function findMissing300kAdjuster() {
  console.log('🔍 INVESTIGATING ₦300,000 REVENUE DISCREPANCY\n');
  console.log('=' .repeat(80));

  // Get all verified payments with their case creators
  console.log('\n📋 ALL VERIFIED AUCTION PAYMENTS WITH CASE CREATORS:');
  console.log('-'.repeat(80));
  
  const allPayments = await db.execute(sql`
    SELECT 
      p.id as payment_id,
      p.amount,
      sc.claim_reference,
      sc.created_by as case_creator_id,
      u.full_name as creator_name,
      u.role as creator_role,
      sc.status as case_status,
      a.id as auction_id
    FROM payments p
    JOIN auctions a ON p.auction_id = a.id
    JOIN salvage_cases sc ON a.case_id = sc.id
    LEFT JOIN users u ON sc.created_by = u.id
    WHERE p.status = 'verified'
    ORDER BY p.amount DESC
  `);
  
  let totalRevenue = 0;
  let ademolaCases = 0;
  let ademolaRevenue = 0;
  let otherCases = 0;
  let otherRevenue = 0;
  let noCases = 0;
  let noRevenue = 0;
  
  console.log('\nPayment Breakdown:');
  (allPayments as any[]).forEach((payment: any, index: number) => {
    const amount = parseFloat(payment.amount);
    totalRevenue += amount;
    
    console.log(`${index + 1}. ${payment.claim_reference} - ₦${amount.toLocaleString()}`);
    console.log(`   Creator: ${payment.creator_name || 'UNKNOWN'} (${payment.creator_role || 'N/A'})`);
    console.log(`   Case Status: ${payment.case_status}`);
    
    if (payment.creator_name === 'Ademola Dan') {
      ademolaCases++;
      ademolaRevenue += amount;
    } else if (payment.creator_name && !payment.creator_name.includes('Test')) {
      otherCases++;
      otherRevenue += amount;
      console.log(`   ⚠️  NON-ADEMOLA CASE FOUND!`);
    } else if (!payment.creator_name) {
      noCases++;
      noRevenue += amount;
      console.log(`   ⚠️  NO CREATOR FOUND!`);
    }
    console.log('');
  });
  
  console.log('=' .repeat(80));
  console.log('📊 SUMMARY:');
  console.log('-'.repeat(80));
  console.log(`Total Verified Auction Payments: ${(allPayments as any[]).length}`);
  console.log(`Total Revenue: ₦${totalRevenue.toLocaleString()}`);
  console.log('');
  console.log(`Ademola Dan Cases: ${ademolaCases} → ₦${ademolaRevenue.toLocaleString()}`);
  console.log(`Other Real Adjuster Cases: ${otherCases} → ₦${otherRevenue.toLocaleString()}`);
  console.log(`Cases with No Creator: ${noCases} → ₦${noRevenue.toLocaleString()}`);
  console.log('');
  console.log(`Expected Discrepancy: ₦${(totalRevenue - ademolaRevenue).toLocaleString()}`);
  
  // Check if there are cases created by deleted users or test users
  console.log('\n🔍 CHECKING FOR ORPHANED OR TEST USER CASES:');
  console.log('-'.repeat(80));
  
  const orphanedCases = await db.execute(sql`
    SELECT 
      sc.claim_reference,
      sc.created_by,
      u.full_name,
      u.role,
      COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) as revenue
    FROM salvage_cases sc
    LEFT JOIN users u ON sc.created_by = u.id
    LEFT JOIN auctions a ON sc.id = a.case_id
    LEFT JOIN payments p ON a.id = p.auction_id AND p.status = 'verified'
    WHERE sc.status != 'draft'
      AND (u.full_name IS NULL OR u.full_name LIKE '%Test%')
      AND p.id IS NOT NULL
    GROUP BY sc.id, sc.claim_reference, sc.created_by, u.full_name, u.role
    HAVING SUM(CAST(p.amount AS NUMERIC)) > 0
    ORDER BY revenue DESC
  `);
  
  if ((orphanedCases as any[]).length > 0) {
    console.log('Found cases with payments but no valid creator:');
    (orphanedCases as any[]).forEach((c: any) => {
      console.log(`  - ${c.claim_reference}: ₦${parseFloat(c.revenue).toLocaleString()} (Creator: ${c.full_name || 'DELETED USER'})`);
    });
  } else {
    console.log('No orphaned cases found.');
  }
  
  // Check for other real adjusters
  console.log('\n👥 ALL REAL ADJUSTERS (non-test):');
  console.log('-'.repeat(80));
  
  const realAdjusters = await db.execute(sql`
    SELECT 
      u.id,
      u.full_name,
      u.email,
      COUNT(DISTINCT sc.id) as total_cases,
      COUNT(DISTINCT sc.id) FILTER (WHERE sc.status != 'draft') as non_draft_cases,
      COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) as revenue
    FROM users u
    LEFT JOIN salvage_cases sc ON u.id = sc.created_by
    LEFT JOIN auctions a ON sc.id = a.case_id
    LEFT JOIN payments p ON a.id = p.auction_id AND p.status = 'verified'
    WHERE u.role = 'claims_adjuster'
      AND u.full_name NOT LIKE '%Test%'
    GROUP BY u.id, u.full_name, u.email
    ORDER BY revenue DESC
  `);
  
  (realAdjusters as any[]).forEach((adj: any) => {
    console.log(`${adj.full_name} (${adj.email})`);
    console.log(`  Cases: ${adj.non_draft_cases} non-draft / ${adj.total_cases} total`);
    console.log(`  Revenue: ₦${parseFloat(adj.revenue).toLocaleString()}`);
    console.log('');
  });
  
  console.log('=' .repeat(80));
  console.log('🎯 CONCLUSION:');
  console.log('-'.repeat(80));
  
  if (otherRevenue > 0) {
    console.log(`✅ Found the missing ₦${otherRevenue.toLocaleString()} from other real adjusters!`);
  } else if (noRevenue > 0) {
    console.log(`⚠️  The missing ₦${noRevenue.toLocaleString()} is from cases with no creator (deleted users?)`);
  } else {
    console.log(`❓ The ₦300,000 discrepancy remains unexplained. Possible causes:`);
    console.log(`   - Cases created by deleted users`);
    console.log(`   - Cases created by test users that were later renamed`);
    console.log(`   - Data inconsistency in the database`);
  }
  console.log('');
}

findMissing300kAdjuster()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Investigation failed:', error);
    process.exit(1);
  });
