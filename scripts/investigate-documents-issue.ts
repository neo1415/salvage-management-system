/**
 * Investigate why documents show 0 in the report
 * User said "that's a lie..there can't be auctions without those documents"
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function investigateDocuments() {
  console.log('🔍 INVESTIGATING DOCUMENTS ISSUE\n');
  console.log('=' .repeat(80));

  const startDate = '2026-02-01';
  const endDate = '2026-04-28';

  // 1. Check total auction documents
  console.log('\n1️⃣ TOTAL AUCTION DOCUMENTS:\n');
  
  const totalDocs = await db.execute(sql`
    SELECT COUNT(*) as count FROM auction_documents
  `);
  console.log(`Total documents in database: ${(totalDocs[0] as any)?.count || 0}`);

  const docsInRange = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM auction_documents
    WHERE created_at >= ${startDate}
      AND created_at <= ${endDate}
  `);
  console.log(`Documents in date range (Feb-Apr 2026): ${(docsInRange[0] as any)?.count || 0}`);

  // 2. Check documents by status
  console.log('\n2️⃣ DOCUMENTS BY STATUS:\n');
  
  const docsByStatus = await db.execute(sql`
    SELECT 
      status,
      COUNT(*) as count
    FROM auction_documents
    GROUP BY status
    ORDER BY count DESC
  `);

  (docsByStatus as any[]).forEach((row: any) => {
    console.log(`${row.status}: ${row.count}`);
  });

  // 3. Check auctions vs documents
  console.log('\n3️⃣ AUCTIONS VS DOCUMENTS:\n');
  
  const auctionDocStats = await db.execute(sql`
    SELECT 
      COUNT(DISTINCT a.id) as total_auctions,
      COUNT(DISTINCT ad.auction_id) as auctions_with_docs,
      COUNT(DISTINCT a.id) - COUNT(DISTINCT ad.auction_id) as auctions_without_docs
    FROM auctions a
    LEFT JOIN auction_documents ad ON a.id = ad.auction_id
    WHERE a.created_at >= ${startDate}
      AND a.created_at <= ${endDate}
  `);

  const stats = auctionDocStats[0] as any;
  console.log(`Total Auctions: ${stats.total_auctions}`);
  console.log(`Auctions with Documents: ${stats.auctions_with_docs}`);
  console.log(`Auctions without Documents: ${stats.auctions_without_docs}`);

  // 4. Check closed auctions with winners
  console.log('\n4️⃣ CLOSED AUCTIONS WITH WINNERS:\n');
  
  const closedAuctions = await db.execute(sql`
    SELECT 
      COUNT(*) as total_closed,
      COUNT(*) FILTER (WHERE current_bidder IS NOT NULL) as with_winner,
      COUNT(DISTINCT ad.auction_id) as with_documents
    FROM auctions a
    LEFT JOIN auction_documents ad ON a.id = ad.auction_id
    WHERE a.status = 'closed'
      AND a.created_at >= ${startDate}
      AND a.created_at <= ${endDate}
  `);

  const closed = closedAuctions[0] as any;
  console.log(`Total Closed Auctions: ${closed.total_closed}`);
  console.log(`Closed with Winner: ${closed.with_winner}`);
  console.log(`Closed with Documents: ${closed.with_documents}`);

  // 5. Sample auctions without documents
  console.log('\n5️⃣ SAMPLE AUCTIONS WITHOUT DOCUMENTS:\n');
  
  const auctionsWithoutDocs = await db.execute(sql`
    SELECT 
      a.id,
      sc.claim_reference,
      a.status,
      a.current_bidder,
      a.created_at,
      a.end_time
    FROM auctions a
    JOIN salvage_cases sc ON a.case_id = sc.id
    LEFT JOIN auction_documents ad ON a.id = ad.auction_id
    WHERE a.created_at >= ${startDate}
      AND a.created_at <= ${endDate}
      AND ad.id IS NULL
    ORDER BY a.created_at DESC
    LIMIT 10
  `);

  console.log(`Sample of auctions without documents:\n`);
  (auctionsWithoutDocs as any[]).forEach((a: any, i: number) => {
    console.log(`${i + 1}. ${a.claim_reference}`);
    console.log(`   Auction ID: ${a.id}`);
    console.log(`   Status: ${a.status}`);
    console.log(`   Winner: ${a.current_bidder || 'None'}`);
    console.log(`   Created: ${new Date(a.created_at).toLocaleDateString()}`);
    console.log('');
  });

  // 6. Check document creation dates
  console.log('\n6️⃣ DOCUMENT CREATION TIMELINE:\n');
  
  const docTimeline = await db.execute(sql`
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM') as month,
      COUNT(*) as count
    FROM auction_documents
    GROUP BY TO_CHAR(created_at, 'YYYY-MM')
    ORDER BY month DESC
    LIMIT 12
  `);

  console.log('Documents by month:\n');
  (docTimeline as any[]).forEach((row: any) => {
    console.log(`${row.month}: ${row.count} documents`);
  });

  // 7. Check if documents are created after auction closes
  console.log('\n7️⃣ DOCUMENT CREATION TIMING:\n');
  
  const docTiming = await db.execute(sql`
    SELECT 
      COUNT(*) as total_docs,
      COUNT(*) FILTER (WHERE ad.created_at > a.end_time) as created_after_close,
      COUNT(*) FILTER (WHERE ad.created_at <= a.end_time) as created_before_close
    FROM auction_documents ad
    JOIN auctions a ON ad.auction_id = a.id
  `);

  const timing = docTiming[0] as any;
  console.log(`Total Documents: ${timing.total_docs}`);
  console.log(`Created After Auction Close: ${timing.created_after_close}`);
  console.log(`Created Before Auction Close: ${timing.created_before_close}`);

  // 8. Check the actual query used in the report
  console.log('\n8️⃣ REPORT QUERY RESULT:\n');
  
  const reportQuery = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'signed') as completed,
      AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600) FILTER (WHERE status = 'signed') as avg_hours
    FROM auction_documents
    WHERE created_at >= ${startDate} AND created_at <= ${endDate}
  `);

  const report = reportQuery[0] as any;
  console.log(`Total Documents (report query): ${report.total}`);
  console.log(`Completed Documents: ${report.completed}`);
  console.log(`Avg Hours to Complete: ${report.avg_hours || 0}`);

  console.log('\n' + '=' .repeat(80));
  console.log('\n📊 SUMMARY:\n');
  
  if (parseInt((docsInRange[0] as any)?.count || '0') === 0) {
    console.log('❌ NO DOCUMENTS EXIST in the date range (Feb-Apr 2026)');
    console.log('');
    console.log('Possible reasons:');
    console.log('1. Documents are created with auction creation date, not closure date');
    console.log('2. Documents are created in a different date range');
    console.log('3. Document generation is broken or not triggered');
    console.log('4. Documents are stored in a different table or system');
  } else {
    console.log('✅ Documents exist in the date range');
    console.log(`Total: ${(docsInRange[0] as any)?.count}`);
  }
}

investigateDocuments()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
