/**
 * Check PHI-2728 Auction Specifically
 */

import { db } from '@/lib/db/drizzle';
import { auctions, salvageCases, vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkPhiAuction() {
  console.log('🔍 Checking PHI-2728 auction...\n');

  try {
    // Find the case
    const [caseData] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.claimReference, 'PHI-2728'))
      .limit(1);

    if (!caseData) {
      console.log('❌ Case PHI-2728 not found!');
      return;
    }

    console.log(`✅ Found case: ${caseData.claimReference}`);
    console.log(`   Asset Type: ${caseData.assetType}`);
    console.log(`   Case ID: ${caseData.id}\n`);

    // Find the auction
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.caseId, caseData.id))
      .limit(1);

    if (!auction) {
      console.log('❌ No auction found for this case!');
      return;
    }

    console.log(`✅ Found auction: ${auction.id}`);
    console.log(`   Status: ${auction.status}`);
    console.log(`   Current Bid: ₦${auction.currentBid ? parseFloat(auction.currentBid).toLocaleString() : '0'}`);
    console.log(`   Current Bidder: ${auction.currentBidder || 'None'}`);
    console.log(`   End Time: ${auction.endTime}\n`);

    // Get vendor details
    if (auction.currentBidder) {
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, auction.currentBidder))
        .limit(1);

      if (vendor) {
        console.log(`✅ Found vendor: ${vendor.businessName}`);
        console.log(`   Vendor ID: ${vendor.id}`);
        console.log(`   User ID: ${vendor.userId}\n`);

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, vendor.userId))
          .limit(1);

        if (user) {
          console.log(`✅ Found user: ${user.fullName}`);
          console.log(`   Email: ${user.email}`);
          console.log(`   Phone: ${user.phone}\n`);
        }
      }
    }

    // Now test the exact query from the API
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Testing API query...\n');

    const apiResult = await db
      .select({
        auction: auctions,
        case: salvageCases,
        vendor: vendors,
        vendorUser: users,
      })
      .from(auctions)
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .leftJoin(vendors, eq(auctions.currentBidder, vendors.id))
      .leftJoin(users, eq(vendors.userId, users.id))
      .where(eq(auctions.status, 'closed'));

    console.log(`API query returned ${apiResult.length} closed auctions\n`);

    const phiResult = apiResult.find(r => r.case.claimReference === 'PHI-2728');
    
    if (phiResult) {
      console.log('✅ PHI-2728 IS in the API results!');
      console.log(`   Auction ID: ${phiResult.auction.id}`);
      console.log(`   Vendor: ${phiResult.vendor?.businessName || 'null'}`);
      console.log(`   User: ${phiResult.vendorUser?.fullName || 'null'}`);
    } else {
      console.log('❌ PHI-2728 NOT in the API results!');
      console.log('\nAll closed auctions:');
      for (const r of apiResult) {
        console.log(`  - ${r.case.claimReference}: ${r.auction.status} (bidder: ${r.auction.currentBidder || 'none'})`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkPhiAuction()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Check failed:', error);
    process.exit(1);
  });
