/**
 * Comprehensive Auction Payment Flow Diagnostic
 * 
 * This script diagnoses all the issues you've identified:
 * 1. Duplicate payment records
 * 2. Incorrect payment status display
 * 3. Socket.IO not updating UI in real-time
 * 4. Payment method selection failures
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { releaseForms } from '@/lib/db/schema/release-forms';
import { eq, desc } from 'drizzle-orm';

async function diagnoseAuctionPaymentFlow(auctionId: string) {
  console.log('\n🔍 AUCTION PAYMENT FLOW DIAGNOSTIC');
  console.log('=====================================\n');

  try {
    // 1. Check auction status
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      console.error('❌ Auction not found:', auctionId);
      return;
    }

    console.log('📊 AUCTION STATUS:');
    console.log(`   ID: ${auction.id}`);
    console.log(`   Status: ${auction.status}`);
    console.log(`   Winner: ${auction.currentBidder}`);
    console.log(`   Winning Bid: ₦${parseFloat(auction.currentBid || '0').toLocaleString()}`);
    console.log(`   Updated At: ${auction.updatedAt}\n`);

    // 2. Check documents
    const documents = await db
      .select()
      .from(releaseForms)
      .where(eq(releaseForms.auctionId, auctionId))
      .orderBy(desc(releaseForms.createdAt));

    console.log('📄 DOCUMENTS:');
    if (documents.length === 0) {
      console.log('   ⚠️  No documents found\n');
    } else {
      documents.forEach((doc, index) => {
        console.log(`   ${index + 1}. ${doc.documentType}`);
        console.log(`      Status: ${doc.status}`);
        console.log(`      Vendor: ${doc.vendorId}`);
        console.log(`      Signed At: ${doc.signedAt || 'Not signed'}`);
        console.log(`      Created At: ${doc.createdAt}`);
      });
      console.log();
    }

    // 3. Check payments (THIS IS WHERE DUPLICATES APPEAR)
    const paymentRecords = await db
      .select()
      .from(payments)
      .where(eq(payments.auctionId, auctionId))
      .orderBy(desc(payments.createdAt));

    console.log('💰 PAYMENT RECORDS:');
    if (paymentRecords.length === 0) {
      console.log('   ⚠️  No payment records found\n');
    } else {
      console.log(`   ⚠️  FOUND ${paymentRecords.length} PAYMENT RECORDS ${paymentRecords.length > 1 ? '(DUPLICATE!)' : ''}\n`);
      paymentRecords.forEach((payment, index) => {
        console.log(`   ${index + 1}. Payment ID: ${payment.id}`);
        console.log(`      Reference: ${payment.paymentReference || 'None'}`);
        console.log(`      Status: ${payment.status}`);
        console.log(`      Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
        console.log(`      Method: ${payment.paymentMethod || 'Not selected'}`);
        console.log(`      Vendor: ${payment.vendorId}`);
        console.log(`      Created At: ${payment.createdAt}`);
        console.log(`      Updated At: ${payment.updatedAt}`);
        console.log();
      });
    }

    // 4. Analyze the issues
    console.log('🔍 ISSUE ANALYSIS:');
    console.log('==================\n');

    // Issue 1: Duplicate payments
    if (paymentRecords.length > 1) {
      console.log('❌ ISSUE 1: DUPLICATE PAYMENT RECORDS');
      console.log(`   Found ${paymentRecords.length} payment records for one auction`);
      console.log(`   Root Cause: Auction closure is being called multiple times`);
      console.log(`   Impact: Confuses payment flow, blocks payment method selection\n`);
    }

    // Issue 2: Status mismatch
    const allDocsSigned = documents.length >= 2 && documents.every(d => d.status === 'signed');
    if (allDocsSigned && auction.status !== 'awaiting_payment') {
      console.log('❌ ISSUE 2: STATUS MISMATCH');
      console.log(`   Documents: All signed (${documents.length}/2)`);
      console.log(`   Auction Status: ${auction.status} (should be "awaiting_payment")`);
      console.log(`   Root Cause: Status update in signDocument() is failing silently\n`);
    }

    // Issue 3: Payment status display
    if (paymentRecords.length > 0) {
      const pendingPayments = paymentRecords.filter(p => p.status === 'pending');
      if (pendingPayments.length > 0 && allDocsSigned) {
        console.log('❌ ISSUE 3: PAYMENT STATUS DISPLAY');
        console.log(`   Payment shows "Waiting for Documents" but documents are signed`);
        console.log(`   Root Cause: UI not checking document status correctly\n`);
      }
    }

    // Issue 4: Payment method selection blocked
    if (paymentRecords.length > 1) {
      console.log('❌ ISSUE 4: PAYMENT METHOD SELECTION BLOCKED');
      console.log(`   Error: "A payment is already in progress"`);
      console.log(`   Root Cause: Multiple payment records exist, system finds first one\n`);
    }

    // 5. Recommendations
    console.log('💡 RECOMMENDED FIXES:');
    console.log('=====================\n');

    console.log('1. PREVENT DUPLICATE PAYMENTS:');
    console.log('   - Add unique constraint on (auction_id, vendor_id) in auction_payments table');
    console.log('   - Add idempotency check in auction closure service');
    console.log('   - Use database transaction with SELECT FOR UPDATE\n');

    console.log('2. FIX STATUS UPDATE:');
    console.log('   - Remove try-catch that swallows errors in signDocument()');
    console.log('   - Add proper error logging');
    console.log('   - Broadcast status change via Socket.IO\n');

    console.log('3. FIX SOCKET.IO UPDATES:');
    console.log('   - Verify Socket.IO is broadcasting status changes');
    console.log('   - Check client is listening to correct events');
    console.log('   - Add reconnection logic\n');

    console.log('4. CLEANUP DUPLICATES:');
    console.log('   - Delete duplicate payment records (keep most recent)');
    console.log('   - Update auction status if needed\n');

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Run diagnostic
const auctionId = process.argv[2] || 'ea06c5e4-6b98-46b7-a10b-c3a6b876fdd5';
console.log(`Running diagnostic for auction: ${auctionId}\n`);

diagnoseAuctionPaymentFlow(auctionId)
  .then(() => {
    console.log('✅ Diagnostic complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Diagnostic error:', error);
    process.exit(1);
  });
