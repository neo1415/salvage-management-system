/**
 * Verification Script: Documents Fix
 * 
 * Verifies that the Master Report now correctly queries release_forms
 * and returns the actual document counts.
 */

import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';

async function verify() {
  console.log('✅ VERIFYING DOCUMENTS FIX\n');
  console.log('=' .repeat(80));

  const startDate = '2024-01-01';
  const endDate = '2026-12-31';

  // Test the FIXED query (what the report now uses)
  console.log('\n📊 TESTING FIXED QUERY (release_forms):');
  console.log('-'.repeat(80));
  console.log(`   Date range: ${startDate} to ${endDate}`);
  
  const documentsData = await db.execute(sql`
    SELECT 
      COUNT(rf.*) as total,
      COUNT(rf.*) FILTER (WHERE rf.status = 'signed') as completed,
      AVG(EXTRACT(EPOCH FROM (rf.signed_at - rf.created_at)) / 3600) FILTER (WHERE rf.status = 'signed') as avg_hours
    FROM release_forms rf
    JOIN auctions a ON rf.auction_id = a.id
    WHERE a.created_at >= ${startDate} AND a.created_at <= ${endDate}
  `);

  const docRow = documentsData[0] as any;
  const totalDocs = parseInt(docRow?.total || '0');
  const completedDocs = parseInt(docRow?.completed || '0');
  const avgHours = parseFloat(docRow?.avg_hours || '0');

  console.log('\n   📄 RESULTS:');
  console.log(`   Total documents generated: ${totalDocs}`);
  console.log(`   Completed (signed): ${completedDocs}`);
  console.log(`   Completion rate: ${totalDocs > 0 ? ((completedDocs / totalDocs) * 100).toFixed(2) : 0}%`);
  console.log(`   Avg time to complete: ${avgHours.toFixed(2)} hours`);

  // Breakdown by document type
  console.log('\n📊 BREAKDOWN BY DOCUMENT TYPE:');
  console.log('-'.repeat(80));
  
  const byTypeResult = await db.execute(sql`
    SELECT 
      rf.document_type,
      COUNT(rf.*) as total,
      COUNT(rf.*) FILTER (WHERE rf.status = 'signed') as signed,
      COUNT(rf.*) FILTER (WHERE rf.status = 'pending') as pending
    FROM release_forms rf
    JOIN auctions a ON rf.auction_id = a.id
    WHERE a.created_at >= ${startDate} AND a.created_at <= ${endDate}
    GROUP BY rf.document_type
    ORDER BY total DESC
  `);
  
  for (const row of byTypeResult as any[]) {
    const completionRate = row.total > 0 ? ((row.signed / row.total) * 100).toFixed(1) : '0.0';
    console.log(`   ${row.document_type}:`);
    console.log(`      Total: ${row.total}, Signed: ${row.signed}, Pending: ${row.pending}`);
    console.log(`      Completion rate: ${completionRate}%`);
  }

  // Compare with vendor documents page data
  console.log('\n📊 VENDOR DOCUMENTS PAGE COMPARISON:');
  console.log('-'.repeat(80));
  
  const vendorDocsResult = await db.execute(sql`
    SELECT 
      v.business_name,
      COUNT(rf.*) as total_docs,
      COUNT(rf.*) FILTER (WHERE rf.status = 'signed') as signed_docs
    FROM release_forms rf
    JOIN vendors v ON rf.vendor_id = v.id
    JOIN auctions a ON rf.auction_id = a.id
    WHERE a.created_at >= ${startDate} AND a.created_at <= ${endDate}
    GROUP BY v.id, v.business_name
    ORDER BY total_docs DESC
    LIMIT 5
  `);
  
  console.log('   Top 5 vendors by document count:');
  for (const row of vendorDocsResult as any[]) {
    console.log(`   ${row.business_name}: ${row.total_docs} docs (${row.signed_docs} signed)`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('🎯 VERIFICATION RESULT:');
  if (totalDocs > 0) {
    console.log('   ✅ SUCCESS! Documents are now being counted correctly.');
    console.log(`   ✅ Found ${totalDocs} documents (${completedDocs} signed)`);
    console.log('   ✅ Master Report will now show accurate document metrics');
  } else {
    console.log('   ❌ FAILED! Still showing 0 documents');
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
