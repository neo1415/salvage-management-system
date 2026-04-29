/**
 * Investigate operational performance issues
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function investigateOperationalIssues() {
  console.log('🔍 INVESTIGATING OPERATIONAL PERFORMANCE ISSUES\n');
  console.log('=' .repeat(80));

  // 1. Check cases stuck in "active_auction" status
  console.log('\n1️⃣ CASES STUCK IN "active_auction" STATUS:\n');
  
  const stuckCases = await db.execute(sql`
    SELECT 
      sc.id,
      sc.claim_reference,
      sc.status as case_status,
      sc.created_at,
      a.id as auction_id,
      a.status as auction_status,
      a.end_time,
      CASE 
        WHEN a.end_time < NOW() THEN 'EXPIRED'
        WHEN a.status = 'closed' THEN 'CLOSED'
        WHEN a.status = 'active' AND a.end_time > NOW() THEN 'TRULY ACTIVE'
        ELSE 'OTHER'
      END as actual_state
    FROM salvage_cases sc
    LEFT JOIN auctions a ON sc.id = a.case_id
    WHERE sc.status = 'active_auction'
      AND sc.created_at >= '2026-02-01'
      AND sc.created_at <= '2026-04-28'
    ORDER BY sc.created_at DESC
  `);

  console.log(`Total cases in "active_auction" status: ${stuckCases.length}\n`);
  
  stuckCases.forEach((c: any, i: number) => {
    console.log(`${i + 1}. ${c.claim_reference}`);
    console.log(`   Case Status: ${c.case_status}`);
    console.log(`   Auction Status: ${c.auction_status || 'NO AUCTION'}`);
    console.log(`   Actual State: ${c.actual_state}`);
    console.log(`   End Time: ${c.end_time ? new Date(c.end_time).toLocaleString() : 'N/A'}`);
    console.log('');
  });

  // 2. Check auction count discrepancy
  console.log('\n' + '=' .repeat(80));
  console.log('2️⃣ AUCTION COUNT DISCREPANCY:\n');
  
  const auctionStats = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT sc.id) as total_cases,
      COUNT(a.id) as total_auctions,
      COUNT(a.id) FILTER (WHERE a.created_at >= '2026-02-01' AND a.created_at <= '2026-04-28') as auctions_in_range,
      COUNT(DISTINCT a.case_id) as cases_with_auctions,
      COUNT(a.id) - COUNT(DISTINCT a.case_id) as extra_auctions
    FROM salvage_cases sc
    LEFT JOIN auctions a ON sc.id = a.case_id
    WHERE sc.created_at >= '2026-02-01'
      AND sc.created_at <= '2026-04-28'
      AND sc.status != 'draft'
  `);

  const stats = auctionStats[0] as any;
  console.log(`Total Cases: ${stats.total_cases}`);
  console.log(`Total Auctions: ${stats.total_auctions}`);
  console.log(`Auctions in date range: ${stats.auctions_in_range}`);
  console.log(`Cases with auctions: ${stats.cases_with_auctions}`);
  console.log(`Extra auctions (multiple per case): ${stats.extra_auctions}`);

  // Find cases with multiple auctions
  const multipleAuctions = await db.execute(sql`
    SELECT 
      sc.claim_reference,
      sc.status as case_status,
      COUNT(a.id) as auction_count,
      array_agg(a.status ORDER BY a.created_at) as auction_statuses,
      array_agg(a.created_at ORDER BY a.created_at) as auction_dates
    FROM salvage_cases sc
    JOIN auctions a ON sc.id = a.case_id
    WHERE sc.created_at >= '2026-02-01'
      AND sc.created_at <= '2026-04-28'
      AND sc.status != 'draft'
    GROUP BY sc.id, sc.claim_reference, sc.status
    HAVING COUNT(a.id) > 1
    ORDER BY COUNT(a.id) DESC
    LIMIT 10
  `);

  console.log(`\nCases with multiple auctions: ${multipleAuctions.length}\n`);
  multipleAuctions.forEach((c: any, i: number) => {
    console.log(`${i + 1}. ${c.claim_reference} - ${c.auction_count} auctions`);
    console.log(`   Statuses: ${c.auction_statuses}`);
  });

  // 3. Check document completion rate
  console.log('\n' + '=' .repeat(80));
  console.log('3️⃣ DOCUMENT COMPLETION RATE:\n');
  
  const docStats = await db.execute(sql`
    SELECT 
      COUNT(*) as total_docs,
      COUNT(*) FILTER (WHERE status = 'signed') as signed_docs,
      COUNT(*) FILTER (WHERE status = 'pending') as pending_docs,
      array_agg(DISTINCT status) as all_statuses
    FROM auction_documents
    WHERE created_at >= '2026-02-01'
      AND created_at <= '2026-04-28'
  `);

  const docRow = docStats[0] as any;
  console.log(`Total Documents: ${docRow.total_docs}`);
  console.log(`Signed: ${docRow.signed_docs}`);
  console.log(`Pending: ${docRow.pending_docs}`);
  console.log(`All Statuses: ${docRow.all_statuses}`);

  // 4. Check pricing analysis
  console.log('\n' + '=' .repeat(80));
  console.log('4️⃣ PRICING ANALYSIS BUG:\n');
  
  const pricingDebug = await db.execute(sql`
    SELECT 
      a.id,
      sc.claim_reference,
      sc.market_value,
      sc.estimated_salvage_value,
      a.current_bid,
      a.minimum_increment,
      a.status,
      a.current_bidder,
      (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count,
      (SELECT MIN(CAST(amount AS NUMERIC)) FROM bids WHERE auction_id = a.id) as first_bid
    FROM auctions a
    JOIN salvage_cases sc ON a.case_id = sc.id
    WHERE a.status = 'closed'
      AND a.current_bidder IS NOT NULL
      AND a.created_at >= '2026-02-01'
      AND a.created_at <= '2026-04-28'
      AND sc.status != 'draft'
    ORDER BY a.created_at DESC
    LIMIT 10
  `);

  console.log(`Sample of closed successful auctions:\n`);
  pricingDebug.forEach((a: any, i: number) => {
    console.log(`${i + 1}. ${a.claim_reference}`);
    console.log(`   Market Value: ₦${parseFloat(a.market_value || 0).toLocaleString()}`);
    console.log(`   Estimated Salvage Value: ₦${parseFloat(a.estimated_salvage_value || 0).toLocaleString()}`);
    console.log(`   First Bid: ₦${parseFloat(a.first_bid || 0).toLocaleString()}`);
    console.log(`   Current Bid (Winning): ₦${parseFloat(a.current_bid || 0).toLocaleString()}`);
    console.log(`   Minimum Increment: ₦${parseFloat(a.minimum_increment || 0).toLocaleString()}`);
    console.log(`   Bid Count: ${a.bid_count}`);
    console.log('');
  });

  // Calculate averages
  const avgPricing = await db.execute(sql`
    SELECT 
      AVG(CAST(sc.estimated_salvage_value AS NUMERIC)) as avg_salvage_value,
      AVG((SELECT MIN(CAST(amount AS NUMERIC)) FROM bids WHERE auction_id = a.id)) as avg_first_bid,
      AVG(CAST(a.current_bid AS NUMERIC)) as avg_winning,
      AVG(CAST(sc.market_value AS NUMERIC)) as avg_market_value
    FROM auctions a
    JOIN salvage_cases sc ON a.case_id = sc.id
    WHERE a.status = 'closed'
      AND a.current_bidder IS NOT NULL
      AND a.created_at >= '2026-02-01'
      AND a.created_at <= '2026-04-28'
      AND sc.status != 'draft'
  `);

  const avgRow = avgPricing[0] as any;
  console.log('\nAverages:');
  console.log(`Avg Salvage Value: ₦${parseFloat(avgRow.avg_salvage_value || 0).toLocaleString()}`);
  console.log(`Avg First Bid: ₦${parseFloat(avgRow.avg_first_bid || 0).toLocaleString()}`);
  console.log(`Avg Winning Bid: ₦${parseFloat(avgRow.avg_winning || 0).toLocaleString()}`);
  console.log(`Avg Market Value: ₦${parseFloat(avgRow.avg_market_value || 0).toLocaleString()}`);

  // 5. Check all real adjusters
  console.log('\n' + '=' .repeat(80));
  console.log('5️⃣ ALL REAL ADJUSTERS (including 0 cases):\n');
  
  const allRealAdjusters = await db.execute(sql`
    SELECT 
      u.id,
      u.full_name,
      u.email,
      u.created_at,
      COUNT(sc.id) as case_count
    FROM users u
    LEFT JOIN salvage_cases sc ON u.id = sc.created_by 
      AND sc.created_at >= '2026-02-01'
      AND sc.created_at <= '2026-04-28'
      AND sc.status != 'draft'
    WHERE u.role = 'claims_adjuster'
      AND u.full_name NOT LIKE '%Test%'
      AND u.full_name NOT LIKE '%test%'
    GROUP BY u.id, u.full_name, u.email, u.created_at
    ORDER BY case_count DESC, u.full_name
  `);

  console.log(`Total real adjusters: ${allRealAdjusters.length}\n`);
  allRealAdjusters.forEach((adj: any, i: number) => {
    console.log(`${i + 1}. ${adj.full_name}`);
    console.log(`   Email: ${adj.email}`);
    console.log(`   Cases in period: ${adj.case_count}`);
    console.log(`   Created: ${new Date(adj.created_at).toLocaleDateString()}`);
    console.log('');
  });
}

investigateOperationalIssues()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
