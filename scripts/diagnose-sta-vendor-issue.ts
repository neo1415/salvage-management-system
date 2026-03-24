/**
 * Diagnose STA-3832 Vendor Issue
 */

import { db } from '@/lib/db/drizzle';
import { auctions, salvageCases, vendors, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function diagnoseStaVendorIssue() {
  console.log('🔍 Diagnosing STA-3832 vendor issue...\n');

  try {
    // Find the case
    const [caseData] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.claimReference, 'STA-3832'))
      .limit(1);

    if (!caseData) {
      console.log('❌ Case not found!');
      return;
    }

    console.log(`✅ Found case: ${caseData.claimReference}`);
    console.log(`   Case ID: ${caseData.id}\n`);

    // Find the auction
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.caseId, caseData.id))
      .limit(1);

    if (!auction) {
      console.log('❌ Auction not found!');
      return;
    }

    console.log(`✅ Found auction: ${auction.id}`);
    console.log(`   Current Bidder ID: ${auction.currentBidder || 'NULL'}\n`);

    if (!auction.currentBidder) {
      console.log('❌ PROBLEM: currentBidder is NULL!');
      return;
    }

    // Try to find the vendor
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, auction.currentBidder))
      .limit(1);

    if (!vendor) {
      console.log(`❌ PROBLEM: Vendor with ID ${auction.currentBidder} does NOT exist in vendors table!`);
      console.log('\nThis is why the LEFT JOIN returns NULL.\n');
      
      // Check if this vendor ID exists in users table
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, auction.currentBidder))
        .limit(1);

      if (user) {
        console.log(`⚠️  However, a USER with this ID exists:`);
        console.log(`   Name: ${user.fullName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}\n`);
        console.log('💡 DIAGNOSIS: The currentBidder is set to a USER ID instead of a VENDOR ID!');
        console.log('   This is a data integrity issue.');
      } else {
        console.log('❌ No user with this ID either. The ID is completely invalid.');
      }
      return;
    }

    console.log(`✅ Found vendor: ${vendor.businessName}`);
    console.log(`   Vendor ID: ${vendor.id}`);
    console.log(`   User ID: ${vendor.userId}\n`);

    // Get user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, vendor.userId))
      .limit(1);

    if (user) {
      console.log(`✅ Found user: ${user.fullName}`);
      console.log(`   Email: ${user.email}\n`);
    } else {
      console.log(`❌ PROBLEM: User with ID ${vendor.userId} not found!`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

diagnoseStaVendorIssue()
  .then(() => {
    console.log('\n✅ Diagnosis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnosis failed:', error);
    process.exit(1);
  });
