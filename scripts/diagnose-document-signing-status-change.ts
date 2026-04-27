/**
 * Diagnostic Script: Document Signing Status Change
 * 
 * This script helps diagnose the issue where auction status changes back to 'active'
 * after signing documents, when it should remain 'closed' or change to 'awaiting_payment'.
 * 
 * Usage:
 *   npx tsx scripts/diagnose-document-signing-status-change.ts <auctionId>
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { eq, and } from 'drizzle-orm';

async function diagnose(auctionId: string) {
  console.log(`\n🔍 Diagnosing Document Signing Status Change for Auction: ${auctionId}\n`);

  try {
    // 1. Get auction details
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      console.error(`❌ Auction not found: ${auctionId}`);
      return;
    }

    console.log(`📊 Auction Status: ${auction.status}`);
    console.log(`   - Current Bid: ₦${parseFloat(auction.currentBid || '0').toLocaleString()}`);
    console.log(`   - Current Bidder: ${auction.currentBidder || 'None'}`);
    console.log(`   - End Time: ${auction.endTime}`);
    console.log(`   - Updated At: ${auction.updatedAt}\n`);

    // 2. Get documents for this auction
    const documents = await db
      .select()
      .from(releaseForms)
      .where(eq(releaseForms.auctionId, auctionId));

    console.log(`📄 Documents (${documents.length} total):`);
    documents.forEach(doc => {
      console.log(`   - ${doc.documentType}: ${doc.status}`);
      if (doc.signedAt) {
        console.log(`     Signed at: ${doc.signedAt}`);
      }
    });

    // 3. Check if all required documents are signed
    const requiredDocs = ['bill_of_sale', 'liability_waiver'];
    const signedDocs = documents
      .filter(doc => doc.status === 'signed')
      .map(doc => doc.documentType);

    const allSigned = requiredDocs.every(type => signedDocs.includes(type));

    console.log(`\n✅ All Required Documents Signed: ${allSigned ? 'YES' : 'NO'}`);
    console.log(`   - Required: ${requiredDocs.join(', ')}`);
    console.log(`   - Signed: ${signedDocs.join(', ')}`);

    // 4. Expected status
    console.log(`\n🎯 Expected Status:`);
    if (allSigned && auction.status === 'closed') {
      console.log(`   ⚠️  ISSUE DETECTED: All documents signed but status is still 'closed'`);
      console.log(`   ✅ Expected: 'awaiting_payment'`);
      console.log(`   ❌ Actual: '${auction.status}'`);
      console.log(`\n💡 This is the bug! After signing all documents, the status should be 'awaiting_payment'.`);
    } else if (allSigned && auction.status === 'awaiting_payment') {
      console.log(`   ✅ Status is correct: 'awaiting_payment'`);
    } else if (!allSigned && auction.status === 'closed') {
      console.log(`   ✅ Status is correct: 'closed' (not all documents signed yet)`);
    } else {
      console.log(`   ℹ️  Status: ${auction.status}`);
    }

    // 5. Check for recent status changes
    console.log(`\n📝 Recent Activity:`);
    console.log(`   - Last auction update: ${auction.updatedAt}`);
    
    const latestDoc = documents
      .filter(doc => doc.signedAt)
      .sort((a, b) => new Date(b.signedAt!).getTime() - new Date(a.signedAt!).getTime())[0];
    
    if (latestDoc) {
      console.log(`   - Latest document signed: ${latestDoc.documentType} at ${latestDoc.signedAt}`);
      
      const timeDiff = new Date(auction.updatedAt).getTime() - new Date(latestDoc.signedAt!).getTime();
      console.log(`   - Time between last signature and auction update: ${Math.abs(timeDiff)}ms`);
      
      if (timeDiff < 0) {
        console.log(`   ⚠️  WARNING: Auction was updated BEFORE the last document was signed!`);
        console.log(`   This suggests a race condition or timing issue.`);
      }
    }

    console.log(`\n✅ Diagnosis complete\n`);

  } catch (error) {
    console.error('❌ Error during diagnosis:', error);
    throw error;
  }
}

// Get auction ID from command line
const auctionId = process.argv[2];

if (!auctionId) {
  console.error('Usage: npx tsx scripts/diagnose-document-signing-status-change.ts <auctionId>');
  process.exit(1);
}

diagnose(auctionId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
