/**
 * Script: Find and Delete Duplicate Documents
 * 
 * Problem: When auction expires, documents don't show immediately. 
 * User reloads page and gets DUPLICATE documents (4 instead of 2).
 * 
 * This script:
 * 1. Finds all duplicate documents (same auctionId + documentType)
 * 2. Keeps the oldest document (first created)
 * 3. Deletes newer duplicates
 * 4. Logs all deletions for audit trail
 */

import { db } from '@/lib/db/drizzle';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { eq, and, sql } from 'drizzle-orm';

interface DuplicateGroup {
  auctionId: string;
  vendorId: string;
  documentType: string;
  count: number;
}

interface DocumentRecord {
  id: string;
  auctionId: string;
  vendorId: string;
  documentType: string;
  status: string;
  createdAt: Date;
}

async function findDuplicateDocuments(): Promise<DuplicateGroup[]> {
  console.log('🔍 Searching for duplicate documents...\n');

  // Find groups with more than 1 document of the same type for the same auction
  const duplicates = await db
    .select({
      auctionId: releaseForms.auctionId,
      vendorId: releaseForms.vendorId,
      documentType: releaseForms.documentType,
      count: sql<number>`count(*)::int`,
    })
    .from(releaseForms)
    .groupBy(
      releaseForms.auctionId,
      releaseForms.vendorId,
      releaseForms.documentType
    )
    .having(sql`count(*) > 1`);

  return duplicates as DuplicateGroup[];
}

async function deleteDuplicates(dryRun: boolean = true): Promise<void> {
  const duplicateGroups = await findDuplicateDocuments();

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate documents found!\n');
    return;
  }

  console.log(`⚠️  Found ${duplicateGroups.length} duplicate document groups:\n`);

  let totalDeleted = 0;
  const deletionLog: Array<{
    auctionId: string;
    vendorId: string;
    documentType: string;
    deletedIds: string[];
    keptId: string;
    keptCreatedAt: Date;
  }> = [];

  for (const group of duplicateGroups) {
    console.log(`📄 Duplicate Group:`);
    console.log(`   - Auction ID: ${group.auctionId}`);
    console.log(`   - Vendor ID: ${group.vendorId}`);
    console.log(`   - Document Type: ${group.documentType}`);
    console.log(`   - Count: ${group.count}`);

    // Get all documents in this group, ordered by creation date (oldest first)
    const documents = await db
      .select({
        id: releaseForms.id,
        auctionId: releaseForms.auctionId,
        vendorId: releaseForms.vendorId,
        documentType: releaseForms.documentType,
        status: releaseForms.status,
        createdAt: releaseForms.createdAt,
      })
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.auctionId, group.auctionId),
          eq(releaseForms.vendorId, group.vendorId),
          eq(releaseForms.documentType, group.documentType)
        )
      )
      .orderBy(releaseForms.createdAt); // Oldest first

    if (documents.length <= 1) {
      console.log('   ⏭️  Skipping - only 1 document found\n');
      continue;
    }

    // Keep the oldest document (first in array)
    const [keepDoc, ...deleteDocsArray] = documents;

    console.log(`   ✅ Keeping oldest document:`);
    console.log(`      - ID: ${keepDoc.id}`);
    console.log(`      - Status: ${keepDoc.status}`);
    console.log(`      - Created: ${keepDoc.createdAt.toISOString()}`);

    console.log(`   🗑️  Deleting ${deleteDocsArray.length} duplicate(s):`);
    const deletedIds: string[] = [];

    for (const doc of deleteDocsArray) {
      console.log(`      - ID: ${doc.id}`);
      console.log(`        Status: ${doc.status}`);
      console.log(`        Created: ${doc.createdAt.toISOString()}`);

      if (!dryRun) {
        await db
          .delete(releaseForms)
          .where(eq(releaseForms.id, doc.id));
        
        deletedIds.push(doc.id);
        totalDeleted++;
      }
    }

    deletionLog.push({
      auctionId: group.auctionId,
      vendorId: group.vendorId,
      documentType: group.documentType,
      deletedIds,
      keptId: keepDoc.id,
      keptCreatedAt: keepDoc.createdAt,
    });

    console.log('');
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total duplicate groups found: ${duplicateGroups.length}`);
  console.log(`Total documents to delete: ${totalDeleted}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes made)' : 'LIVE (changes applied)'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (dryRun) {
    console.log('💡 This was a DRY RUN. No documents were deleted.');
    console.log('💡 Run with --live flag to actually delete duplicates.\n');
  } else {
    console.log('✅ Duplicate documents deleted successfully!\n');
    
    // Write deletion log to file
    const fs = await import('fs/promises');
    const logPath = `./deletion-log-${Date.now()}.json`;
    await fs.writeFile(logPath, JSON.stringify(deletionLog, null, 2));
    console.log(`📝 Deletion log saved to: ${logPath}\n`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isLive = args.includes('--live');

  console.log('═══════════════════════════════════════════════════════');
  console.log('DUPLICATE DOCUMENT CLEANUP SCRIPT');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    await deleteDuplicates(!isLive);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
