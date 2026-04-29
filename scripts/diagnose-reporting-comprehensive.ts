/**
 * Comprehensive Reporting Diagnostics
 * Investigates ALL reporting inconsistencies identified by user
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function diagnoseReporting() {
  console.log('='.repeat(80));
  console.log('COMPREHENSIVE REPORTING DIAGNOSTICS');
  console.log('='.repeat(80));

  // 1. REVENUE ANALYSIS
  console.log('\n1. REVENUE BREAKDOWN');
  console.log('-'.repeat(80));
  
  const revenueBreakdown = await db.execute(sql`
    SELECT 
      'Auction Payments' as source,
      COUNT(*) as count,
      SUM(CAST(amount AS NUMERIC)) as total
    FROM payments
    WHERE status = 'verified' AND auction_id IS NOT NULL
    
    UNION ALL
    
    SELECT 
      'Registration Fees' as source,
      COUNT(*) as count,
      SUM(CAST(amount AS NUMERIC)) as total
    FROM payments
    WHERE status = 'verified' AND auction_id IS NULL
    
    UNION ALL
    
    SELECT 
      'ALL Verified Payments' as source,
      COUNT(*) as count,
      SUM(CAST(amount AS NUMERIC)) as total
    FROM payments
    WHERE status = 'verified'
  `);
  
  console.table(revenueBreakdown);

  // 2. CASE STATUS BREAKDOWN
  console.log('\n2. CASE STATUS BREAKDOWN');
  console.log('-'.repeat(80));
  
  const caseStatus = await db.execute(sql`
    SELECT 
      status,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
    FROM salvage_cases
    GROUP BY status
    ORDER BY count DESC
  `);
  
  console.table(caseStatus);

  // 3. AUCTION STATUS BREAKDOWN
  console.log('\n3. AUCTION STATUS BREAKDOWN');
  console.log('-'.repeat(80));
  
  const auctionStatus = await db.execute(sql`
    SELECT 
      status,
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE current_bidder IS NOT NULL) as with_winner,
      COUNT(*) FILTER (WHERE end_time > NOW()) as not_ended_yet,
      COUNT(*) FILTER (WHERE end_time <= NOW()) as ended
    FROM auctions
    GROUP BY status
    ORDER BY count DESC
  `);
  
  console.table(auctionStatus);

  // 4. ACTIVE AUCTION INVESTIGATION
  console.log('\n4. ACTIVE AUCTION INVESTIGATION');
  console.log('-'.repeat(80));
  
  const activeAuctions = await db.execute(sql`
    SELECT 
      a.id,
      a.status as auction_status,
      sc.status as case_status,
      a.start_time,
      a.end_time,
      a.end_time > NOW() as still_running,
      a.current_bidder IS NOT NULL as has_winner
    FROM auctions a
    JOIN salvage_cases sc ON a.case_id = sc.id
    WHERE a.status = 'active' OR sc.status = 'active_auction'
    ORDER BY a.end_time DESC
  `);
  
  console.log(`Found ${(activeAuctions as any[]).length} "active" auctions:`);
  console.table(activeAuctions);

  // 5. CASE-TO-AUCTION RELATIONSHIP
  console.log('\n5. CASE-TO-AUCTION RELATIONSHIP');
  console.log('-'.repeat(80));
  
  const caseAuctionRel = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT sc.id) as total_cases,
      COUNT(DISTINCT a.id) as total_auctions,
      COUNT(DISTINCT a.id) - COUNT(DISTINCT sc.id) as extra_auctions,
      COUNT(DISTINCT sc.id) FILTER (WHERE sc.status = 'draft') as draft_cases
    FROM salvage_cases sc
    LEFT JOIN auctions a ON sc.id = a.case_id
  `);
  
  console.table(caseAuctionRel);

  // 6. CASES WITH MULTIPLE AUCTIONS
  console.log('\n6. CASES WITH MULTIPLE AUCTIONS');
  console.log('-'.repeat(80));
  
  const multipleAuctions = await db.execute(sql`
    SELECT 
      sc.claim_reference,
      sc.status as case_status,
      COUNT(a.id) as auction_count,
      array_agg(a.status ORDER BY a.created_at) as auction_statuses
    FROM salvage_cases sc
    JOIN auctions a ON sc.id = a.case_id
    GROUP BY sc.id, sc.claim_reference, sc.status
    HAVING COUNT(a.id) > 1
    ORDER BY COUNT(a.id) DESC
    LIMIT 10
  `);
  
  console.log(`Cases with multiple auctions:`);
  console.table(multipleAuctions);

  // 7. ADJUSTER PERFORMANCE
  console.log('\n7. ADJUSTER PERFORMANCE');
  console.log('-'.repeat(80));
  
  const adjusterPerf = await db.execute(sql`
    SELECT 
      u.full_name,
      u.role,
      COUNT(sc.id) as cases_created,
      COUNT(sc.id) FILTER (WHERE sc.status != 'draft') as non_draft_cases,
      COALESCE(SUM(CAST(p.amount AS NUMERIC)), 0) as total_revenue
    FROM users u
    LEFT JOIN salvage_cases sc ON u.id = sc.created_by
    LEFT JOIN auctions a ON sc.id = a.case_id
    LEFT JOIN payments p ON a.id = p.auction_id AND p.status = 'verified'
    WHERE u.role = 'claims_adjuster'
    GROUP BY u.id, u.full_name, u.role
    ORDER BY total_revenue DESC
  `);
  
  console.table(adjusterPerf);

  // 8. VENDOR PERFORMANCE COMPARISON
  console.log('\n8. VENDOR PERFORMANCE (Master Report Logic)');
  console.log('-'.repeat(80));
  
  const vendorPerfMaster = await db.execute(sql`
    SELECT 
      v.business_name,
      COUNT(DISTINCT b.auction_id) as auctions_participated,
      COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id) as auctions_won,
      CASE 
        WHEN COUNT(DISTINCT b.auction_id) > 0 
        THEN ROUND(COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id)::NUMERIC / COUNT(DISTINCT b.auction_id) * 100, 2)
        ELSE 0
      END as win_rate_participated,
      COUNT(b.id) as total_bids,
      CASE 
        WHEN COUNT(b.id) > 0 
        THEN ROUND(COUNT(DISTINCT a.id) FILTER (WHERE a.current_bidder = v.id)::NUMERIC / COUNT(b.id) * 100, 2)
        ELSE 0
      END as win_rate_bids
    FROM vendors v
    LEFT JOIN bids b ON v.id = b.vendor_id
    LEFT JOIN auctions a ON b.auction_id = a.id AND a.current_bidder = v.id
    GROUP BY v.id, v.business_name
    HAVING COUNT(DISTINCT b.auction_id) > 0
    ORDER BY auctions_participated DESC
    LIMIT 5
  `);
  
  console.table(vendorPerfMaster);

  // 9. ASSET TYPE RECOVERY RATES
  console.log('\n9. ASSET TYPE RECOVERY RATES');
  console.log('-'.repeat(80));
  
  const recoveryRates = await db.execute(sql`
    SELECT 
      sc.asset_type,
      COUNT(*) as case_count,
      ROUND(AVG(CAST(sc.market_value AS NUMERIC)), 2) as avg_market_value,
      ROUND(AVG(CAST(p.amount AS NUMERIC)), 2) as avg_payment,
      ROUND(AVG(CAST(p.amount AS NUMERIC) / NULLIF(CAST(sc.market_value AS NUMERIC), 0) * 100), 2) as recovery_rate_pct
    FROM salvage_cases sc
    JOIN auctions a ON sc.id = a.case_id
    JOIN payments p ON a.id = p.auction_id AND p.status = 'verified'
    GROUP BY sc.asset_type
    ORDER BY recovery_rate_pct DESC
  `);
  
  console.table(recoveryRates);

  // 10. DOCUMENT COMPLETION
  console.log('\n10. DOCUMENT COMPLETION');
  console.log('-'.repeat(80));
  
  const docCompletion = await db.execute(sql`
    SELECT 
      status,
      COUNT(*) as count
    FROM auction_documents
    GROUP BY status
    ORDER BY count DESC
  `);
  
  console.table(docCompletion);

  // 11. PRICING ANALYSIS (Starting Bid Issue)
  console.log('\n11. PRICING ANALYSIS');
  console.log('-'.repeat(80));
  
  const pricingAnalysis = await db.execute(sql`
    SELECT 
      'Using market_value (WRONG)' as method,
      ROUND(AVG(CAST(sc.market_value AS NUMERIC)), 2) as avg_starting_bid
    FROM auctions a
    JOIN salvage_cases sc ON a.case_id = sc.id
    WHERE a.status = 'closed' AND a.current_bidder IS NOT NULL
    
    UNION ALL
    
    SELECT 
      'Using minimum_bid (CORRECT)' as method,
      ROUND(AVG(CAST(a.minimum_bid AS NUMERIC)), 2) as avg_starting_bid
    FROM auctions a
    WHERE a.status = 'closed' AND a.current_bidder IS NOT NULL
    
    UNION ALL
    
    SELECT 
      'Avg Winning Bid' as method,
      ROUND(AVG(CAST(a.current_bid AS NUMERIC)), 2) as value
    FROM auctions a
    WHERE a.status = 'closed' AND a.current_bidder IS NOT NULL
  `);
  
  console.table(pricingAnalysis);

  // 12. TEST DATA IDENTIFICATION
  console.log('\n12. TEST DATA IDENTIFICATION');
  console.log('-'.repeat(80));
  
  const testData = await db.execute(sql`
    SELECT 
      'Test Adjusters' as category,
      COUNT(*) as count
    FROM users
    WHERE role = 'claims_adjuster' AND full_name LIKE '%Test%'
    
    UNION ALL
    
    SELECT 
      'Test Vendors' as category,
      COUNT(*) as count
    FROM vendors
    WHERE business_name LIKE '%Test%'
  `);
  
  console.table(testData);

  console.log('\n' + '='.repeat(80));
  console.log('DIAGNOSIS COMPLETE');
  console.log('='.repeat(80));
}

diagnoseReporting()
  .then(() => {
    console.log('\n✅ Diagnostic complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  });
