/**
 * Debug Document Visibility Script
 * 
 * Helps diagnose why documents might not be visible to vendors
 * 
 * Usage:
 *   npx tsx scripts/debug-document-visibility.ts <auctionId>
 */

import { db } from '@/lib/db/drizzle';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

async function debugDocumentVisibility(auctionId: string) {
  console.log('🔍 Debugging Document Visibility');
  console.log('================================\n');

  try {
    // Get auction details
    console.log('1️⃣ Checking auction...');
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      console.error('❌ Auction not found:', auctionId);
      return;
    }

    console.log('✅ Auction found:');
    console.log('   - ID:', auction.id);
    console.log('   - Status:', auction.status);
    console.log('   - Current Bidder:', auction.currentBidder || 'None');
    console.log('   - Current Bid:', auction.currentBid || 'None');
    console.log('');

    if (!auction.currentBidder) {
      console.log('⚠️ No winner for this auction yet');
      return;
    }

    // Get vendor details
    console.log('2️⃣ Checking vendor...');
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, auction.currentBidder))
      .limit(1);

    if (!vendor) {
      console.error('❌ Vendor not found:', auction.currentBidder);
      return;
    }

    console.log('✅ Vendor found:');
    console.log('   - Vendor ID:', vendor.id);
    console.log('   - User ID:', vendor.userId);
    console.log('');

    // Get user details
    console.log('3️⃣ Checking user...');
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, vendor.userId))
      .limit(1);

    if (!user) {
      console.error('❌ User not found:', vendor.userId);
      return;
    }

    console.log('✅ User found:');
    console.log('   - User ID:', user.id);
    console.log('   - Name:', user.fullName);
    console.log('   - Email:', user.email);
    console.log('   - Phone:', user.phone);
    console.log('');

    // Check documents for this auction
    console.log('4️⃣ Checking documents for auction...');
    const auctionDocs = await db
      .select()
      .from(releaseForms)
      .where(eq(releaseForms.auctionId, auctionId));

    console.log(`Found ${auctionDocs.length} documents for auction ${auctionId}:`);
    auctionDocs.forEach((doc, index) => {
      console.log(`\n   Document ${index + 1}:`);
      console.log('   - ID:', doc.id);
      console.log('   - Type:', doc.documentType);
      console.log('   - Status:', doc.status);
      console.log('   - Vendor ID:', doc.vendorId);
      console.log('   - Auction ID:', doc.auctionId);
      console.log('   - PDF URL:', doc.pdfUrl ? '✅ Present' : '❌ Missing');
      console.log('   - Created:', doc.createdAt.toISOString());
      console.log('   - Signed:', doc.signedAt?.toISOString() || 'Not signed');
    });
    console.log('');

    // Check documents for this vendor
    console.log('5️⃣ Checking all documents for vendor...');
    const vendorDocs = await db
      .select()
      .from(releaseForms)
      .where(eq(releaseForms.vendorId, vendor.id));

    console.log(`Found ${vendorDocs.length} total documents for vendor ${vendor.id}:`);
    vendorDocs.forEach((doc, index) => {
      console.log(`\n   Document ${index + 1}:`);
      console.log('   - ID:', doc.id);
      console.log('   - Type:', doc.documentType);
      console.log('   - Status:', doc.status);
      console.log('   - Auction ID:', doc.auctionId);
      console.log('   - Created:', doc.createdAt.toISOString());
    });
    console.log('');

    // Diagnosis
    console.log('📊 DIAGNOSIS');
    console.log('============\n');

    if (auctionDocs.length === 0) {
      console.log('❌ ISSUE: No documents generated for this auction');
      console.log('   Possible causes:');
      console.log('   1. Auction closure did not complete successfully');
      console.log('   2. Document generation failed (check logs)');
      console.log('   3. Documents were generated for wrong vendor ID');
      console.log('\n   Solutions:');
      console.log('   - Check auction closure logs for errors');
      console.log('   - Manually trigger document generation via admin panel');
      console.log('   - Run: POST /api/admin/auctions/' + auctionId + '/generate-documents');
    } else {
      const docsForWinner = auctionDocs.filter(doc => doc.vendorId === vendor.id);
      
      if (docsForWinner.length === 0) {
        console.log('❌ ISSUE: Documents exist but not linked to winner');
        console.log('   Documents were generated for vendor:', auctionDocs[0].vendorId);
        console.log('   But winner is:', vendor.id);
        console.log('\n   This is a critical bug - documents generated for wrong vendor!');
      } else {
        console.log('✅ Documents are correctly linked to winner');
        console.log(`   ${docsForWinner.length} documents found`);
        
        const missingPdf = docsForWinner.filter(doc => !doc.pdfUrl);
        if (missingPdf.length > 0) {
          console.log(`\n⚠️ WARNING: ${missingPdf.length} documents missing PDF URLs`);
          missingPdf.forEach(doc => {
            console.log(`   - ${doc.documentType} (ID: ${doc.id})`);
          });
        }
        
        console.log('\n   If vendor still cannot see documents:');
        console.log('   1. Check vendor session - ensure vendorId is set');
        console.log('   2. Check API response format - frontend expects "documents" at root');
        console.log('   3. Check browser console for errors');
        console.log('   4. Try refreshing the page');
      }
    }

    console.log('\n✅ Diagnostic complete');

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    throw error;
  }
}

// Run script
const auctionId = process.argv[2];

if (!auctionId) {
  console.error('Usage: npx tsx scripts/debug-document-visibility.ts <auctionId>');
  process.exit(1);
}

debugDocumentVisibility(auctionId)
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
