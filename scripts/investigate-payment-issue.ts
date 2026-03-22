/**
 * Investigation Script: Payment Record Issue
 * 
 * This script investigates why the payment record is not found for auction:
 * 7757497f-b807-41af-a1a0-4b5104b7ae66
 * 
 * It will:
 * 1. Check if payment record exists for this auction
 * 2. Check what paymentMethod values exist
 * 3. Check auction details
 * 4. Check if documents exist
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { eq, and } from 'drizzle-orm';

const AUCTION_ID = '7757497f-b807-41af-a1a0-4b5104b7ae66';
const VENDOR_ID = '5e4eaa5f-7438-4c4f-bc8a-59db91d4a8c3';

async function investigate() {
  console.log('🔍 Starting investigation...\n');

  // Step 1: Check auction details
  console.log('📋 Step 1: Checking auction details...');
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, AUCTION_ID))
    .limit(1);

  if (!auction) {
    console.error('❌ Auction not found!');
    return;
  }

  console.log('✅ Auction found:');
  console.log(`   - ID: ${auction.id}`);
  console.log(`   - Status: ${auction.status}`);
  console.log(`   - Current Bidder: ${auction.currentBidder}`);
  console.log(`   - Current Bid: ₦${auction.currentBid ? parseFloat(auction.currentBid).toLocaleString() : 'N/A'}`);
  console.log(`   - End Time: ${auction.endTime}`);
  console.log(`   - Created At: ${auction.createdAt}`);
  console.log('');

  // Step 2: Check ALL payment records for this auction (without paymentMethod filter)
  console.log('💰 Step 2: Checking ALL payment records for this auction...');
  const allPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.auctionId, AUCTION_ID));

  if (allPayments.length === 0) {
    console.error('❌ NO payment records found for this auction!');
    console.log('   This means the payment record was never created when the auction closed.');
  } else {
    console.log(`✅ Found ${allPayments.length} payment record(s):`);
    allPayments.forEach((payment, index) => {
      console.log(`\n   Payment ${index + 1}:`);
      console.log(`   - ID: ${payment.id}`);
      console.log(`   - Vendor ID: ${payment.vendorId}`);
      console.log(`   - Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
      console.log(`   - Payment Method: ${payment.paymentMethod}`);
      console.log(`   - Escrow Status: ${payment.escrowStatus}`);
      console.log(`   - Status: ${payment.status}`);
      console.log(`   - Payment Reference: ${payment.paymentReference}`);
      console.log(`   - Created At: ${payment.createdAt}`);
    });
  }
  console.log('');

  // Step 3: Check payment records with escrow_wallet filter
  console.log('💰 Step 3: Checking payment records with escrow_wallet filter...');
  const escrowPayments = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, AUCTION_ID),
        eq(payments.vendorId, VENDOR_ID),
        eq(payments.paymentMethod, 'escrow_wallet')
      )
    );

  if (escrowPayments.length === 0) {
    console.error('❌ NO payment records found with escrow_wallet payment method!');
  } else {
    console.log(`✅ Found ${escrowPayments.length} escrow_wallet payment record(s)`);
  }
  console.log('');

  // Step 4: Check documents
  console.log('📄 Step 4: Checking documents...');
  const auctionDocuments = await db
    .select()
    .from(releaseForms)
    .where(
      and(
        eq(releaseForms.auctionId, AUCTION_ID),
        eq(releaseForms.vendorId, VENDOR_ID)
      )
    );

  if (auctionDocuments.length === 0) {
    console.error('❌ NO documents found for this auction!');
  } else {
    console.log(`✅ Found ${auctionDocuments.length} document(s):`);
    auctionDocuments.forEach((doc, index) => {
      console.log(`\n   Document ${index + 1}:`);
      console.log(`   - ID: ${doc.id}`);
      console.log(`   - Type: ${doc.documentType}`);
      console.log(`   - Status: ${doc.status}`);
      console.log(`   - Signed At: ${doc.signedAt || 'Not signed'}`);
      console.log(`   - Created At: ${doc.createdAt}`);
    });
  }
  console.log('');

  // Step 5: Analysis and recommendations
  console.log('📊 Step 5: Analysis and Recommendations\n');
  
  if (allPayments.length === 0) {
    console.log('🔴 ROOT CAUSE: Payment record was never created when auction closed');
    console.log('');
    console.log('💡 POSSIBLE REASONS:');
    console.log('   1. Auction was closed BEFORE payment record creation logic was added');
    console.log('   2. Auction was closed manually without using auctionClosureService');
    console.log('   3. Payment record creation failed during closure but auction was still marked as closed');
    console.log('');
    console.log('✅ RECOMMENDED FIXES:');
    console.log('   1. Create payment record retroactively for this auction');
    console.log('   2. Update triggerFundReleaseOnDocumentCompletion to create payment record if missing');
    console.log('   3. Add migration script to create payment records for all closed auctions without payments');
  } else {
    const escrowPayment = allPayments.find(p => p.paymentMethod === 'escrow_wallet');
    if (!escrowPayment) {
      console.log('🟡 ISSUE: Payment record exists but with wrong payment method');
      console.log(`   Expected: escrow_wallet`);
      console.log(`   Actual: ${allPayments[0].paymentMethod}`);
      console.log('');
      console.log('✅ RECOMMENDED FIX:');
      console.log('   Update payment record to use escrow_wallet payment method');
    } else {
      console.log('🟢 Payment record exists with correct payment method');
      console.log('   The issue might be with the query logic or vendor ID mismatch');
    }
  }
}

investigate()
  .then(() => {
    console.log('\n✅ Investigation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Investigation failed:', error);
    process.exit(1);
  });
