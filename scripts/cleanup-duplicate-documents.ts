/**
 * Cleanup duplicate documents before adding unique constraint
 * Keeps the most recent document for each auction/vendor/documentType combination
 */

import { db } from '@/lib/db/drizzle';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { sql } from 'drizzle-orm';

async function cleanupDuplicates() {
  try {
    console.log('🔍 Finding duplicate documents...');
    
    // Find duplicates
    const duplicates = await db.execute(sql`
      SELECT 
        auction_id, 
        vendor_id, 
        document_type, 
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY created_at DESC) as ids
      FROM release_forms
      GROUP BY auction_id, vendor_id, document_type
      HAVING COUNT(*) > 1
    `);
    
    const rows = Array.isArray(duplicates) ? duplicates : (duplicates.rows || []);
    
    if (rows.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }
    
    console.log(`⚠️  Found ${rows.length} sets of duplicates`);
    
    let totalDeleted = 0;
    
    // For each set of duplicates, keep the most recent and delete the rest
    for (const row of rows) {
      const ids = row.ids as string[];
      const keepId = ids[0]; // Most recent (first in DESC order)
      const deleteIds = ids.slice(1); // Rest to delete
      
      console.log(`\n📋 Duplicate set:`);
      console.log(`   - Auction: ${row.auction_id}`);
      console.log(`   - Vendor: ${row.vendor_id}`);
      console.log(`   - Type: ${row.document_type}`);
      console.log(`   - Count: ${row.count}`);
      console.log(`   - Keeping: ${keepId}`);
      console.log(`   - Deleting: ${deleteIds.join(', ')}`);
      
      // Delete duplicates
      for (const deleteId of deleteIds) {
        await db.execute(sql`
          DELETE FROM release_forms
          WHERE id = ${deleteId}
        `);
      }
      
      totalDeleted += deleteIds.length;
    }
    
    console.log(`\n✅ Cleanup complete!`);
    console.log(`   - Deleted ${totalDeleted} duplicate documents`);
    console.log(`   - Kept ${rows.length} most recent documents`);
    
    // Now add the unique constraint
    console.log('\n🔄 Adding unique constraint...');
    
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_release_forms_unique_document 
      ON release_forms (auction_id, vendor_id, document_type)
    `);
    
    await db.execute(sql`
      COMMENT ON INDEX idx_release_forms_unique_document IS 'Prevents duplicate document generation for the same auction, vendor, and document type'
    `);
    
    console.log('✅ Unique constraint added successfully!');
    console.log('   - Index: idx_release_forms_unique_document');
    console.log('   - Constraint: (auction_id, vendor_id, document_type)');
    console.log('   - Duplicate documents are now impossible');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupDuplicates();
