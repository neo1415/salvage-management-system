/**
 * Regenerate Missing Liability Waiver Script
 * 
 * Purpose: Manually regenerate the missing Liability Waiver document
 * for auction 5a14f878-56cd-4a63-b66e-43197b7675da
 */

import { db } from '@/lib/db/drizzle';
import { generateDocument } from '@/features/documents/services/document.service';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { auctions } from '@/lib/db/schema/auctions';
import { eq } from 'drizzle-orm';

const auctionId = '5a14f878-56cd-4a63-b66e-43197b7675da';

async function regenerateLiabilityWaiver() {
  console.log('='.repeat(80));
  console.log('REGENERATE MISSING LIABILITY WAIVER');
  console.log('='.repeat(80));
  console.log(`Auction ID: ${auctionId}`);
  console.log('');

  try {
    // 1. Get auction details
    console.log('📋 STEP 1: Getting Auction Details');
    console.log('-'.repeat(80));
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      console.log('❌ ERROR: Auction not found!');
      process.exit(1);
    }

    if (!auction.currentBidder) {
      console.log('❌ ERROR: No winner for this auction!');
      process.exit(1);
    }

    console.log(`✅ Auction Found:`);
    console.log(`   - Status: ${auction.status}`);
    console.log(`   - Winner: ${auction.currentBidder}`);
    console.log(`   - Winning Bid: ₦${parseFloat(auction.currentBid!).toLocaleString()}`);
    console.log('');

    // 2. Check existing documents
    console.log('📄 STEP 2: Checking Existing Documents');
    console.log('-'.repeat(80));
    const existingDocuments = await db
      .select()
      .from(releaseForms)
      .where(eq(releaseForms.auctionId, auctionId));

    console.log(`Found ${existingDocuments.length} existing document(s):`);
    existingDocuments.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.documentType} (${doc.status})`);
    });
    console.log('');

    const hasLiabilityWaiver = existingDocuments.some(
      doc => doc.documentType === 'liability_waiver'
    );

    if (hasLiabilityWaiver) {
      console.log('⚠️  Liability Waiver already exists!');
      console.log('   Skipping regeneration.');
      process.exit(0);
    }

    // 3. Generate Liability Waiver
    console.log('🔄 STEP 3: Generating Liability Waiver');
    console.log('-'.repeat(80));
    console.log('   Calling generateDocument()...');
    
    const document = await generateDocument(
      auctionId,
      auction.currentBidder,
      'liability_waiver',
      'system'
    );

    console.log('');
    console.log('✅ SUCCESS: Liability Waiver Generated!');
    console.log(`   - Document ID: ${document.id}`);
    console.log(`   - Type: ${document.documentType}`);
    console.log(`   - Status: ${document.status}`);
    console.log(`   - PDF URL: ${document.pdfUrl}`);
    console.log(`   - Created At: ${document.createdAt}`);
    console.log('');

    // 4. Verify both documents now exist
    console.log('📊 STEP 4: Verifying All Documents');
    console.log('-'.repeat(80));
    const allDocuments = await db
      .select()
      .from(releaseForms)
      .where(eq(releaseForms.auctionId, auctionId));

    console.log(`Total documents: ${allDocuments.length}`);
    allDocuments.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.documentType} (${doc.status}) - ${doc.id}`);
    });
    console.log('');

    const hasBillOfSale = allDocuments.some(doc => doc.documentType === 'bill_of_sale');
    const hasLiabilityWaiverNow = allDocuments.some(doc => doc.documentType === 'liability_waiver');

    console.log('📊 DOCUMENT TYPE ANALYSIS:');
    console.log(`   - Bill of Sale: ${hasBillOfSale ? '✅ Present' : '❌ MISSING'}`);
    console.log(`   - Liability Waiver: ${hasLiabilityWaiverNow ? '✅ Present' : '❌ MISSING'}`);
    console.log('');

    if (hasBillOfSale && hasLiabilityWaiverNow) {
      console.log('🎉 SUCCESS: Both documents now exist!');
      console.log('   User should now see 2 documents in the UI.');
    } else {
      console.log('⚠️  WARNING: Still missing documents!');
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('REGENERATION COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('');
    console.error('❌ ERROR DURING REGENERATION:');
    console.error('-'.repeat(80));
    console.error(error);
    console.error('');
    
    if (error instanceof Error) {
      console.error('Error Message:', error.message);
      console.error('Error Stack:', error.stack);
    }
    
    console.error('');
    console.error('🔍 DIAGNOSIS:');
    console.error('   - Check if PDF generation service is working');
    console.error('   - Check if Cloudinary upload is working');
    console.error('   - Check database connection');
    console.error('   - Check for missing dependencies');
    
    process.exit(1);
  }
}

// Run the script
regenerateLiabilityWaiver()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
