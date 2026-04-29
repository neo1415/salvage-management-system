/**
 * Diagnostic Script: Documents Table Mismatch
 * 
 * This script investigates why the Master Report shows 0 documents
 * when the vendor documents page shows 46 documents.
 * 
 * HYPOTHESIS: The report is querying the wrong table
 * - Master Report queries: auction_documents (auction-deposit schema)
 * - Actual documents are in: release_forms table
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function diagnose() {
  console.log('🔍 DOCUMENTS TABLE MISMATCH DIAGNOSTIC\n');
  console.log('=' .repeat(80));

  // Check auction_documents table (what the report queries)
  console.log('\n📊 CHECKING auction_documents TABLE (Master Report query):');
  console.log('-'.repeat(80));
  
  try {
    const auctionDocsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE status = 'signed') as signed_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        MIN(created_at) as earliest_doc,
        MAX(created_at) as latest_doc
      FROM auction_documents
    `);
    
    const auctionDocsRow = auctionDocsResult[0] as any;
    console.log('   Total documents:', auctionDocsRow.total_count);
    console.log('   Signed:', auctionDocsRow.signed_count);
    console.log('   Pending:', auctionDocsRow.pending_count);
    console.log('   Date range:', auctionDocsRow.earliest_doc, 'to', auctionDocsRow.latest_doc);
  } catch (error: any) {
    console.log('   ❌ ERROR:', error.message);
    if (error.message.includes('does not exist')) {
      console.log('   ⚠️  TABLE DOES NOT EXIST!');
    }
  }

  // Check release_forms table (actual documents table)
  console.log('\n📊 CHECKING release_forms TABLE (Actual documents):');
  console.log('-'.repeat(80));
  
  try {
    const releaseFormsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE status = 'signed') as signed_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        MIN(created_at) as earliest_doc,
        MAX(created_at) as latest_doc,
        COUNT(DISTINCT auction_id) as unique_auctions,
        COUNT(DISTINCT vendor_id) as unique_vendors
      FROM release_forms
    `);
    
    const releaseFormsRow = releaseFormsResult[0] as any;
    console.log('   Total documents:', releaseFormsRow.total_count);
    console.log('   Signed:', releaseFormsRow.signed_count);
    console.log('   Pending:', releaseFormsRow.pending_count);
    console.log('   Unique auctions:', releaseFormsRow.unique_auctions);
    console.log('   Unique vendors:', releaseFormsRow.unique_vendors);
    console.log('   Date range:', releaseFormsRow.earliest_doc, 'to', releaseFormsRow.latest_doc);
  } catch (error: any) {
    console.log('   ❌ ERROR:', error.message);
  }

  // Check documents by document type
  console.log('\n📊 DOCUMENTS BY TYPE (release_forms):');
  console.log('-'.repeat(80));
  
  try {
    const byTypeResult = await db.execute(sql`
      SELECT 
        document_type,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'signed') as signed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending
      FROM release_forms
      GROUP BY document_type
      ORDER BY count DESC
    `);
    
    for (const row of byTypeResult as any[]) {
      console.log(`   ${row.document_type}:`, row.count, 'total,', row.signed, 'signed,', row.pending, 'pending');
    }
  } catch (error: any) {
    console.log('   ❌ ERROR:', error.message);
  }

  // Check documents with auction join (what the report SHOULD query)
  console.log('\n📊 DOCUMENTS WITH AUCTION JOIN (Correct query):');
  console.log('-'.repeat(80));
  
  try {
    const withAuctionResult = await db.execute(sql`
      SELECT 
        COUNT(rf.*) as total,
        COUNT(rf.*) FILTER (WHERE rf.status = 'signed') as completed,
        AVG(EXTRACT(EPOCH FROM (rf.signed_at - rf.created_at)) / 3600) FILTER (WHERE rf.status = 'signed') as avg_hours
      FROM release_forms rf
      JOIN auctions a ON rf.auction_id = a.id
      WHERE a.created_at >= '2024-01-01' AND a.created_at <= '2026-12-31'
    `);
    
    const row = withAuctionResult[0] as any;
    console.log('   Total documents:', row.total);
    console.log('   Completed (signed):', row.completed);
    console.log('   Avg time to complete:', row.avg_hours ? `${parseFloat(row.avg_hours).toFixed(2)} hours` : 'N/A');
  } catch (error: any) {
    console.log('   ❌ ERROR:', error.message);
  }

  // Sample documents
  console.log('\n📊 SAMPLE DOCUMENTS (release_forms):');
  console.log('-'.repeat(80));
  
  try {
    const sampleResult = await db.execute(sql`
      SELECT 
        rf.id,
        rf.document_type,
        rf.status,
        rf.created_at,
        rf.signed_at,
        a.id as auction_id,
        sc.claim_reference
      FROM release_forms rf
      JOIN auctions a ON rf.auction_id = a.id
      JOIN salvage_cases sc ON a.case_id = sc.id
      ORDER BY rf.created_at DESC
      LIMIT 5
    `);
    
    for (const row of sampleResult as any[]) {
      console.log(`   ${row.claim_reference} - ${row.document_type} - ${row.status} - Created: ${row.created_at}`);
    }
  } catch (error: any) {
    console.log('   ❌ ERROR:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 CONCLUSION:');
  console.log('   The Master Report is querying the WRONG table!');
  console.log('   - Report queries: auction_documents (likely empty or non-existent)');
  console.log('   - Actual documents: release_forms table');
  console.log('   - FIX: Update getOperationalData() to query release_forms instead');
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
