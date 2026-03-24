/**
 * Check Auction Documents Script
 * 
 * Purpose: Investigate why only 1 document is showing instead of 2
 * Expected: Bill of Sale + Liability Waiver (2 documents)
 * 
 * This script queries the database to check:
 * 1. How many documents exist for the auction
 * 2. What document types are present
 * 3. What are their statuses
 * 4. When were they created
 */

import { db } from '@/lib/db/drizzle';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { eq } from 'drizzle-orm';

const auctionId = '5a14f878-56cd-4a63-b66e-43197b7675da';

async function checkAuctionDocuments() {
  console.log('='.repeat(80));
  console.log('AUCTION DOCUMENT INVESTIGATION');
  console.log('='.repeat(80));
  console.log(`Auction ID: ${auctionId}`);
  console.log('');

  try {
    // 1. Get auction details
    console.log('📋 STEP 1: Checking Auction Details');
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

    console.log(`✅ Auction Found:`);
    console.log(`   - Status: ${auction.status}`);
    console.log(`   - Winner: ${auction.currentBidder || 'No winner'}`);
    console.log(`   - Winning Bid: ${auction.currentBid ? `₦${parseFloat(auction.currentBid).toLocaleString()}` : 'N/A'}`);
    console.log(`   - End Time: ${auction.endTime}`);
    console.log(`   - Updated At: ${auction.updatedAt}`);
    console.log('');

    // 2. Get payment details
    console.log('💰 STEP 2: Checking Payment Record');
    console.log('-'.repeat(80));
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.auctionId, auctionId))
      .limit(1);

    if (!payment) {
      console.log('❌ ERROR: No payment record found!');
      console.log('   This means the auction closure did not complete successfully.');
    } else {
      console.log(`✅ Payment Found:`);
      console.log(`   - Payment ID: ${payment.id}`);
      console.log(`   - Status: ${payment.status}`);
      console.log(`   - Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
      console.log(`   - Method: ${payment.paymentMethod}`);
      console.log(`   - Escrow Status: ${payment.escrowStatus || 'N/A'}`);
      console.log(`   - Payment Deadline: ${payment.paymentDeadline}`);
      console.log(`   - Created At: ${payment.createdAt}`);
    }
    console.log('');

    // 3. Get all documents for this auction
    console.log('📄 STEP 3: Checking Documents');
    console.log('-'.repeat(80));
    const documents = await db
      .select()
      .from(releaseForms)
      .where(eq(releaseForms.auctionId, auctionId));

    console.log(`Found ${documents.length} document(s) for auction ${auctionId}:`);
    console.log('');

    if (documents.length === 0) {
      console.log('❌ CRITICAL: NO DOCUMENTS FOUND!');
      console.log('   Expected: 2 documents (Bill of Sale + Liability Waiver)');
      console.log('   Actual: 0 documents');
      console.log('');
      console.log('🔍 DIAGNOSIS:');
      console.log('   - Document generation failed during auction closure');
      console.log('   - Check closure service logs for errors');
      console.log('   - Verify generateWinnerDocuments() was called');
    } else {
      documents.forEach((doc, index) => {
        console.log(`Document ${index + 1}:`);
        console.log(`   - ID: ${doc.id}`);
        console.log(`   - Type: ${doc.documentType}`);
        console.log(`   - Status: ${doc.status}`);
        console.log(`   - Vendor ID: ${doc.vendorId}`);
        console.log(`   - Signed At: ${doc.signedAt || 'Not signed'}`);
        console.log(`   - Created At: ${doc.createdAt}`);
        console.log(`   - PDF URL: ${doc.pdfUrl || 'Not generated'}`);
        console.log('');
      });

      // Check for expected document types
      const documentTypes = documents.map(d => d.documentType);
      const hasBillOfSale = documentTypes.includes('bill_of_sale');
      const hasLiabilityWaiver = documentTypes.includes('liability_waiver');

      console.log('📊 DOCUMENT TYPE ANALYSIS:');
      console.log(`   - Bill of Sale: ${hasBillOfSale ? '✅ Present' : '❌ MISSING'}`);
      console.log(`   - Liability Waiver: ${hasLiabilityWaiver ? '✅ Present' : '❌ MISSING'}`);
      console.log('');

      if (documents.length === 1) {
        console.log('⚠️  WARNING: Only 1 document found (expected 2)');
        console.log('');
        console.log('🔍 DIAGNOSIS:');
        if (!hasBillOfSale) {
          console.log('   - Bill of Sale generation FAILED');
        }
        if (!hasLiabilityWaiver) {
          console.log('   - Liability Waiver generation FAILED');
        }
        console.log('   - Check closure service logs for document generation errors');
        console.log('   - Verify generateDocument() function is working correctly');
      } else if (documents.length === 2) {
        console.log('✅ SUCCESS: Both documents found!');
        console.log('');
        console.log('🔍 NEXT STEPS:');
        console.log('   - Check document retrieval API');
        console.log('   - Check frontend document display logic');
        console.log('   - Verify no filtering is happening in the API or UI');
      } else if (documents.length > 2) {
        console.log('⚠️  WARNING: More than 2 documents found (possible duplicates)');
        console.log('');
        console.log('🔍 DIAGNOSIS:');
        console.log('   - Duplicate document generation occurred');
        console.log('   - Check for race conditions in closure service');
        console.log('   - Verify idempotency checks are working');
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('INVESTIGATION COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ ERROR:', error);
    process.exit(1);
  }
}

// Run the script
checkAuctionDocuments()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
