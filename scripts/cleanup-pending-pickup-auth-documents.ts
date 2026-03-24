/**
 * Cleanup Script: Remove Pending Pickup Authorization Documents
 * 
 * This script removes any pickup_authorization documents that are in "pending" status.
 * Pickup authorization documents should NEVER be in pending status - they are only
 * generated AFTER payment is complete, and are immediately sent to the vendor.
 * 
 * This fixes the bug where vendors see pickup auth documents asking them to sign,
 * when they should only sign bill_of_sale and liability_waiver.
 */

import { db } from '@/lib/db/drizzle';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { eq, and } from 'drizzle-orm';

async function cleanupPendingPickupAuthDocuments() {
  console.log('🔍 Starting cleanup of pending pickup authorization documents...\n');

  try {
    // Find all pending pickup_authorization documents
    const pendingPickupDocs = await db
      .select()
      .from(releaseForms)
      .where(
        and(
          eq(releaseForms.documentType, 'pickup_authorization'),
          eq(releaseForms.status, 'pending')
        )
      );

    console.log(`Found ${pendingPickupDocs.length} pending pickup authorization documents\n`);

    if (pendingPickupDocs.length === 0) {
      console.log('✅ No pending pickup authorization documents found. Database is clean!');
      return;
    }

    // Display details of documents to be deleted
    console.log('📋 Documents to be deleted:');
    console.log('─'.repeat(80));
    for (const doc of pendingPickupDocs) {
      console.log(`Document ID: ${doc.id}`);
      console.log(`  Auction ID: ${doc.auctionId}`);
      console.log(`  Vendor ID: ${doc.vendorId}`);
      console.log(`  Status: ${doc.status}`);
      console.log(`  Created: ${doc.createdAt}`);
      console.log(`  Title: ${doc.title}`);
      console.log('─'.repeat(80));
    }

    // Delete the documents
    console.log(`\n🗑️  Deleting ${pendingPickupDocs.length} pending pickup authorization documents...`);
    
    for (const doc of pendingPickupDocs) {
      await db
        .delete(releaseForms)
        .where(eq(releaseForms.id, doc.id));
      
      console.log(`✅ Deleted document ${doc.id} for auction ${doc.auctionId}`);
    }

    console.log(`\n✅ Successfully deleted ${pendingPickupDocs.length} pending pickup authorization documents`);
    console.log('\n📝 Summary:');
    console.log(`   - Total documents deleted: ${pendingPickupDocs.length}`);
    console.log(`   - Unique auctions affected: ${new Set(pendingPickupDocs.map(d => d.auctionId)).size}`);
    console.log(`   - Unique vendors affected: ${new Set(pendingPickupDocs.map(d => d.vendorId)).size}`);
    
    console.log('\n✅ Cleanup complete!');
    console.log('\n💡 Note: Pickup authorization documents will be generated automatically');
    console.log('   when vendors complete payment (after signing bill_of_sale and liability_waiver).');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
cleanupPendingPickupAuthDocuments()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
