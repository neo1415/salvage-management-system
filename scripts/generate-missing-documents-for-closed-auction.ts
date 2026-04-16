/**
 * Generate Missing Documents for Closed Auction
 * 
 * This script generates documents for auctions that were closed
 * without document generation (due to using the wrong closure service).
 * 
 * Usage: npx tsx scripts/generate-missing-documents-for-closed-auction.ts <auctionId>
 */

import { db } from '../src/lib/db/drizzle';
import { auctions } from '../src/lib/db/schema/auctions';
import { eq } from 'drizzle-orm';
import { generateDocument } from '../src/features/documents/services/document.service';

async function generateMissingDocuments(auctionId: string) {
  try {
    console.log(`\n🔍 Checking auction ${auctionId}...`);

    // Get auction details
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      console.error(`❌ Auction not found: ${auctionId}`);
      process.exit(1);
    }

    console.log(`\n📊 Auction Details:`);
    console.log(`   - Status: ${auction.status}`);
    console.log(`   - Winner: ${auction.currentBidder || 'No winner'}`);
    console.log(`   - Winning Bid: ${auction.currentBid ? `₦${parseFloat(auction.currentBid).toLocaleString()}` : 'N/A'}`);

    if (auction.status !== 'closed') {
      console.error(`❌ Auction is not closed (status: ${auction.status})`);
      process.exit(1);
    }

    if (!auction.currentBidder) {
      console.error(`❌ Auction has no winner`);
      process.exit(1);
    }

    const vendorId = auction.currentBidder;

    console.log(`\n📄 Generating documents for vendor ${vendorId}...`);

    // Generate Bill of Sale
    try {
      console.log(`\n1️⃣  Generating Bill of Sale...`);
      const billOfSale = await generateDocument(
        auctionId,
        vendorId,
        'bill_of_sale',
        'system'
      );
      console.log(`   ✅ Bill of Sale generated: ${billOfSale.id}`);
    } catch (error) {
      console.error(`   ❌ Failed to generate Bill of Sale:`, error);
    }

    // Generate Liability Waiver
    try {
      console.log(`\n2️⃣  Generating Liability Waiver...`);
      const liabilityWaiver = await generateDocument(
        auctionId,
        vendorId,
        'liability_waiver',
        'system'
      );
      console.log(`   ✅ Liability Waiver generated: ${liabilityWaiver.id}`);
    } catch (error) {
      console.error(`   ❌ Failed to generate Liability Waiver:`, error);
    }

    console.log(`\n✅ Document generation complete!`);
    console.log(`\nThe winner can now sign the documents at:`);
    console.log(`   ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/vendor/auctions/${auctionId}`);

  } catch (error) {
    console.error(`\n❌ Error:`, error);
    process.exit(1);
  }
}

// Get auction ID from command line
const auctionId = process.argv[2];

if (!auctionId) {
  console.error(`\n❌ Usage: npx tsx scripts/generate-missing-documents-for-closed-auction.ts <auctionId>`);
  process.exit(1);
}

generateMissingDocuments(auctionId)
  .then(() => {
    console.log(`\n✅ Done!`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`\n❌ Fatal error:`, error);
    process.exit(1);
  });
