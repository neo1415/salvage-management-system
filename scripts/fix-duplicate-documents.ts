/**
 * Fix Duplicate Documents Issue
 * 
 * Problem: When going offline/online during auction closure, multiple closure
 * requests can happen simultaneously, creating duplicate documents (3x bill_of_sale, 3x liability_waiver).
 * 
 * Root Cause: Race condition between "check if document exists" and "insert document".
 * Multiple requests pass the check before any completes the insert.
 * 
 * Solution:
 * 1. Add UNIQUE constraint on (auction_id, vendor_id, document_type)
 * 2. Delete duplicate documents (keep oldest)
 * 3. Database will prevent future duplicates automatically
 */

import { db } from '@/lib/db/drizzle';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { eq, and, sql } from 'drizzle-orm';

async function fixDuplicateDocuments() {
  console.log('🔧 Starting duplicate document fix...\n');

  try {
    // Step 1: Find all duplicate documents
    console.log('📊 Finding duplicate documents...');
    
    const duplicates = await db.execute<{
      auction_id: string;
      vendor_id: string;
      document_type: string;
      count: number;
      document_ids: string[];
      statuses: string[];
    }>(sql`
      SELECT 
        auction_id,
        vendor_id,
        document_type,
        COUNT(*) as count,
        ARRAY_AGG(id ORDER BY created_at ASC) as document_ids,
        ARRAY_AGG(status ORDER BY created_at ASC) as statuses
      FROM release_forms
      GROUP BY auction_id, vendor_id, document_type
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
    `);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate documents found!');
    } else {
      console.log(`⚠️  Found ${duplicates.length} sets of duplicate documents:\n`);
      
      for (const dup of duplicates) {
        console.log(`   Auction: ${dup.auction_id}`);
        console.log(`   Vendor: ${dup.vendor_id}`);
        console.log(`   Type: ${dup.document_type}`);
        console.log(`   Count: ${dup.count} duplicates`);
        console.log(`   IDs: ${dup.document_ids.join(', ')}`);
        console.log(`   Statuses: ${dup.statuses.join(', ')}`);
        console.log('');
      }

      // Step 2: Delete duplicates (keep oldest)
      console.log('🗑️  Deleting duplicate documents (keeping oldest)...\n');
      
      let totalDeleted = 0;
      
      for (const dup of duplicates) {
        const documentIds = dup.document_ids;
        const keepId = documentIds[0]; // Keep oldest (first in array)
        const deleteIds = documentIds.slice(1); // Delete rest
        
        console.log(`   ${dup.document_type} for auction ${dup.auction_id}:`);
        console.log(`   - Keeping: ${keepId}`);
        console.log(`   - Deleting: ${deleteIds.join(', ')}`);
        
        // Delete duplicates
        for (const deleteId of deleteIds) {
          await db.delete(releaseForms).where(eq(releaseForms.id, deleteId));
          totalDeleted++;
        }
        
        console.log('');
      }
      
      console.log(`✅ Deleted ${totalDeleted} duplicate documents\n`);
    }

    // Step 3: Add UNIQUE constraint to prevent future duplicates
    console.log('🔒 Adding UNIQUE constraint to prevent future duplicates...');
    
    try {
      await db.execute(sql`
        ALTER TABLE release_forms 
        ADD CONSTRAINT release_forms_auction_vendor_type_unique 
        UNIQUE (auction_id, vendor_id, document_type)
      `);
      console.log('✅ UNIQUE constraint added successfully!');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('✅ UNIQUE constraint already exists');
      } else {
        throw error;
      }
    }

    console.log('\n✅ Duplicate document fix complete!');
    console.log('\n📝 Summary:');
    console.log('   - Duplicate documents removed');
    console.log('   - UNIQUE constraint added: (auction_id, vendor_id, document_type)');
    console.log('   - Future duplicates will be prevented automatically');
    console.log('\n💡 The database will now reject duplicate document inserts,');
    console.log('   and the application will handle conflicts gracefully.');

  } catch (error) {
    console.error('❌ Error fixing duplicate documents:', error);
    throw error;
  }
}

// Run the fix
fixDuplicateDocuments()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
