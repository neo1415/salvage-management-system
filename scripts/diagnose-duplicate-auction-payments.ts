/**
 * Diagnostic Script: Duplicate Auction Payments
 * 
 * This script diagnoses the duplicate payment issue where vendors
 * end up with multiple payment records for the same auction.
 * 
 * Usage:
 *   npx tsx scripts/diagnose-duplicate-auction-payments.ts HON-2700
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, and, desc } from 'drizzle-orm';

async function diagnoseDuplicatePayments(auctionIdOrClaimRef: string) {
  console.log(`\n🔍 Diagnosing duplicate payments for: ${auctionIdOrClaimRef}\n`);

  try {
    // Find auction by ID or claim reference
    let auction;
    if (auctionIdOrClaimRef.startsWith('HON-')) {
      // Search by claim reference - need to join with salvage_cases
      const result = await db
        .select({
          auction: auctions,
        })
        .from(auctions)
        .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
        .where(eq(salvageCases.claimReference, auctionIdOrClaimRef))
        .limit(1);
      
      auction = result[0]?.auction;
    } else {
      // Search by auction ID
      const [foundAuction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, auctionIdOrClaimRef))
        .limit(1);
      auction = foundAuction;
    }

    if (!auction) {
      console.error(`❌ Auction not found: ${auctionIdOrClaimRef}`);
      return;
    }

    console.log(`✅ Found auction: ${auction.id}`);
    console.log(`   Status: ${auction.status}`);
    console.log(`   Current Bidder: ${auction.currentBidder || 'None'}`);
    console.log(`   Current Bid: ₦${auction.currentBid ? parseFloat(auction.currentBid).toLocaleString() : '0'}`);

    // Find all payments for this auction
    const auctionPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.auctionId, auction.id))
      .orderBy(desc(payments.createdAt));

    console.log(`\n📊 Payment Records Found: ${auctionPayments.length}\n`);

    if (auctionPayments.length === 0) {
      console.log('✅ No payments found - this is expected if payment hasn\'t been initiated yet.');
      return;
    }

    // Analyze each payment
    auctionPayments.forEach((payment, index) => {
      console.log(`\n${index + 1}. Payment ID: ${payment.id}`);
      console.log(`   Reference: ${payment.paymentReference || 'N/A'}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
      console.log(`   Method: ${payment.paymentMethod}`);
      console.log(`   Auto-Verified: ${payment.autoVerified ? 'Yes' : 'No'}`);
      console.log(`   Created: ${payment.createdAt.toLocaleString()}`);
      console.log(`   Deadline: ${payment.paymentDeadline.toLocaleString()}`);
      
      if (payment.verifiedAt) {
        console.log(`   Verified: ${payment.verifiedAt.toLocaleString()}`);
      }
    });

    // Identify duplicates
    const pendingPayments = auctionPayments.filter(p => p.status === 'pending');
    const verifiedPayments = auctionPayments.filter(p => p.status === 'verified');
    const awaitingPayments = auctionPayments.filter(p => p.status === 'awaiting_payment');

    console.log(`\n\n📈 Payment Status Breakdown:`);
    console.log(`   Pending: ${pendingPayments.length}`);
    console.log(`   Verified: ${verifiedPayments.length}`);
    console.log(`   Awaiting Payment: ${awaitingPayments.length}`);

    // Diagnosis
    console.log(`\n\n🔍 DIAGNOSIS:\n`);

    if (auctionPayments.length > 1) {
      console.log(`⚠️  DUPLICATE PAYMENTS DETECTED!`);
      console.log(`   Total payment records: ${auctionPayments.length}`);
      console.log(`   Expected: 1 payment record per auction`);
      console.log(`\n💡 ROOT CAUSE:`);
      console.log(`   The vendor likely clicked "Pay Now" multiple times because:`);
      console.log(`   1. First payment was made via Paystack`);
      console.log(`   2. Webhook processed payment and marked it as verified`);
      console.log(`   3. UI didn't update fast enough to show "Payment Verified"`);
      console.log(`   4. Vendor clicked "Pay Now" again, creating a second payment`);
      console.log(`\n🔧 FIX NEEDED:`);
      console.log(`   1. Add duplicate payment prevention in payment initialization`);
      console.log(`   2. Check for existing pending/verified payments before creating new one`);
      console.log(`   3. Improve UI feedback to show payment processing state`);
      console.log(`   4. Add loading state to "Pay Now" button after first click`);
    } else if (verifiedPayments.length === 1) {
      console.log(`✅ EXPECTED STATE:`);
      console.log(`   Single verified payment found - this is correct!`);
    } else if (pendingPayments.length === 1) {
      console.log(`⏳ PENDING STATE:`);
      console.log(`   Single pending payment found - waiting for verification.`);
    }

    // Check for specific issue: verified payment but auction still in awaiting_payment
    if (verifiedPayments.length > 0 && auction.status === 'awaiting_payment') {
      console.log(`\n⚠️  INCONSISTENT STATE DETECTED:`);
      console.log(`   Auction status: awaiting_payment`);
      console.log(`   Verified payments: ${verifiedPayments.length}`);
      console.log(`\n💡 This means:`);
      console.log(`   - Payment was verified successfully`);
      console.log(`   - But auction status wasn't updated`);
      console.log(`   - UI should show "Payment Verified" banner`);
      console.log(`   - Finance officer page should NOT show action buttons`);
    }

    // Recommendations
    console.log(`\n\n📋 RECOMMENDATIONS:\n`);
    
    if (pendingPayments.length > 1) {
      console.log(`1. Cancel duplicate pending payments:`);
      pendingPayments.slice(1).forEach(p => {
        console.log(`   npx tsx scripts/cancel-stuck-payment.ts ${p.id}`);
      });
    }

    if (verifiedPayments.length > 1) {
      console.log(`2. Review verified payments - only one should exist:`);
      verifiedPayments.forEach(p => {
        console.log(`   Payment ${p.id}: ₦${parseFloat(p.amount).toLocaleString()} (${p.paymentReference})`);
      });
      console.log(`   Consider refunding duplicate verified payments.`);
    }

    console.log(`\n3. Implement duplicate prevention:`);
    console.log(`   - Add check in /api/auctions/[id]/payment/paystack`);
    console.log(`   - Prevent creating new payment if one already exists`);
    console.log(`   - Return existing payment URL instead`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Get auction ID from command line
const auctionIdOrClaimRef = process.argv[2];

if (!auctionIdOrClaimRef) {
  console.error('Usage: npx tsx scripts/diagnose-duplicate-auction-payments.ts <auction-id-or-claim-ref>');
  console.error('Example: npx tsx scripts/diagnose-duplicate-auction-payments.ts HON-2700');
  process.exit(1);
}

diagnoseDuplicatePayments(auctionIdOrClaimRef)
  .then(() => {
    console.log('\n✅ Diagnosis complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnosis failed:', error);
    process.exit(1);
  });
