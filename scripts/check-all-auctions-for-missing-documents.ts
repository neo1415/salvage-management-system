/**
 * Check All Closed Auctions for Missing Documents
 * 
 * Purpose: Find all closed auctions that are missing required documents
 * and optionally regenerate them.
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { eq } from 'drizzle-orm';
import { generateDocument } from '@/features/documents/services/document.service';

interface AuctionWithMissingDocs {
  auctionId: string;
  winnerId: string;
  winningBid: string;
  closedAt: Date;
  missingDocuments: string[];
  existingDocuments: string[];
}

async function checkAllAuctionsForMissingDocuments(autoFix = false) {
  console.log('='.repeat(80));
  console.log('CHECK ALL CLOSED AUCTIONS FOR MISSING DOCUMENTS');
  console.log('='.repeat(80));
  console.log(`Auto-fix: ${autoFix ? 'ENABLED' : 'DISABLED'}`);
  console.log('');

  try {
    // 1. Get all closed auctions
    console.log('📋 STEP 1: Finding All Closed Auctions');
    console.log('-'.repeat(80));
    
    const closedAuctions = await db
      .select()
      .from(auctions)
      .where(eq(auctions.status, 'closed'));

    console.log(`Found ${closedAuctions.length} closed auction(s)`);
    console.log('');

    if (closedAuctions.length === 0) {
      console.log('✅ No closed auctions found. Nothing to check.');
      return;
    }

    // 2. Check each auction for missing documents
    console.log('📄 STEP 2: Checking Documents for Each Auction');
    console.log('-'.repeat(80));
    
    const auctionsWithMissingDocs: AuctionWithMissingDocs[] = [];
    const requiredDocTypes = ['bill_of_sale', 'liability_waiver'];

    for (const auction of closedAuctions) {
      if (!auction.currentBidder) {
        console.log(`⏭️  Skipping auction ${auction.id} (no winner)`);
        continue;
      }

      // Get documents for this auction
      const documents = await db
        .select()
        .from(releaseForms)
        .where(eq(releaseForms.auctionId, auction.id));

      const existingTypes = documents.map(d => d.documentType);
      const missingTypes = requiredDocTypes.filter(type => !existingTypes.includes(type));

      if (missingTypes.length > 0) {
        auctionsWithMissingDocs.push({
          auctionId: auction.id,
          winnerId: auction.currentBidder,
          winningBid: auction.currentBid || '0',
          closedAt: auction.updatedAt,
          missingDocuments: missingTypes,
          existingDocuments: existingTypes,
        });

        console.log(`⚠️  Auction ${auction.id}:`);
        console.log(`   - Winner: ${auction.currentBidder}`);
        console.log(`   - Winning Bid: ₦${parseFloat(auction.currentBid || '0').toLocaleString()}`);
        console.log(`   - Closed At: ${auction.updatedAt}`);
        console.log(`   - Existing: ${existingTypes.join(', ') || 'NONE'}`);
        console.log(`   - Missing: ${missingTypes.join(', ')}`);
        console.log('');
      }
    }

    console.log('');
    console.log('📊 SUMMARY');
    console.log('-'.repeat(80));
    console.log(`Total closed auctions: ${closedAuctions.length}`);
    console.log(`Auctions with missing documents: ${auctionsWithMissingDocs.length}`);
    console.log(`Auctions with complete documents: ${closedAuctions.length - auctionsWithMissingDocs.length}`);
    console.log('');

    if (auctionsWithMissingDocs.length === 0) {
      console.log('✅ All closed auctions have complete documents!');
      return;
    }

    // 3. Auto-fix if enabled
    if (autoFix) {
      console.log('');
      console.log('🔧 STEP 3: Auto-Fixing Missing Documents');
      console.log('-'.repeat(80));
      
      let fixedCount = 0;
      let failedCount = 0;

      for (const auction of auctionsWithMissingDocs) {
        console.log(`\n🔄 Fixing auction ${auction.auctionId}...`);
        
        for (const docType of auction.missingDocuments) {
          try {
            console.log(`   Generating ${docType}...`);
            const document = await generateDocument(
              auction.auctionId,
              auction.winnerId,
              docType as 'bill_of_sale' | 'liability_waiver',
              'system'
            );
            console.log(`   ✅ ${docType} generated: ${document.id}`);
            fixedCount++;
          } catch (error) {
            console.error(`   ❌ Failed to generate ${docType}:`, error instanceof Error ? error.message : 'Unknown error');
            failedCount++;
          }
        }
      }

      console.log('');
      console.log('📊 AUTO-FIX RESULTS');
      console.log('-'.repeat(80));
      console.log(`Documents generated: ${fixedCount}`);
      console.log(`Documents failed: ${failedCount}`);
      console.log('');

      if (failedCount === 0) {
        console.log('✅ All missing documents have been regenerated!');
      } else {
        console.log('⚠️  Some documents failed to regenerate. Check errors above.');
      }
    } else {
      console.log('');
      console.log('💡 TIP: Run with --fix flag to automatically regenerate missing documents:');
      console.log('   npx tsx scripts/check-all-auctions-for-missing-documents.ts --fix');
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('CHECK COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('');
    console.error('❌ ERROR:');
    console.error('-'.repeat(80));
    console.error(error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const autoFix = args.includes('--fix');

// Run the script
checkAllAuctionsForMissingDocuments(autoFix)
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
