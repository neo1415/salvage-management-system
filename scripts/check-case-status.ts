/**
 * Check Case Status Script
 * Diagnose case status and payment status issues
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { eq } from 'drizzle-orm';

async function checkCaseStatus() {
  try {
    console.log('🔍 Checking case status...\n');

    // Get the specific case
    const caseId = 'CTE-82863';
    
    const [caseData] = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.claimReference, caseId))
      .limit(1);

    if (!caseData) {
      console.log(`❌ Case ${caseId} not found`);
      return;
    }

    console.log('📋 Case Details:');
    console.log(`  ID: ${caseData.id}`);
    console.log(`  Claim Reference: ${caseData.claimReference}`);
    console.log(`  Status: ${caseData.status}`);
    console.log(`  Asset Type: ${caseData.assetType}`);
    console.log(`  Reserve Price: ₦${parseFloat(caseData.reservePrice).toLocaleString()}`);
    console.log(`  Created At: ${caseData.createdAt}`);
    console.log(`  Approved At: ${caseData.approvedAt || 'Not approved'}`);
    console.log(`  Approved By: ${caseData.approvedBy || 'N/A'}`);
    console.log('');

    // Check if there's an auction for this case
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.caseId, caseData.id))
      .limit(1);

    if (auction) {
      console.log('🎯 Auction Details:');
      console.log(`  ID: ${auction.id}`);
      console.log(`  Status: ${auction.status}`);
      console.log(`  Start Time: ${auction.startTime}`);
      console.log(`  End Time: ${auction.endTime}`);
      console.log(`  Current Bid: ${auction.currentBid ? `₦${parseFloat(auction.currentBid).toLocaleString()}` : 'No bids'}`);
      console.log(`  Current Bidder: ${auction.currentBidder || 'None'}`);
      console.log('');

      // Check if there's a payment for this auction
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.auctionId, auction.id))
        .limit(1);

      if (payment) {
        console.log('💰 Payment Details:');
        console.log(`  ID: ${payment.id}`);
        console.log(`  Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
        console.log(`  Status: ${payment.status}`);
        console.log(`  Payment Method: ${payment.paymentMethod}`);
        console.log(`  Escrow Status: ${payment.escrowStatus}`);
        console.log(`  Auto Verified: ${payment.autoVerified}`);
        console.log(`  Payment Deadline: ${payment.paymentDeadline}`);
        console.log(`  Created At: ${payment.createdAt}`);
        console.log('');
      } else {
        console.log('💰 No payment record found for this auction\n');
      }
    } else {
      console.log('🎯 No auction found for this case\n');
    }

    // Get all cases and their statuses
    console.log('📊 All Cases Summary:');
    const allCases = await db.select().from(salvageCases);
    
    const statusCounts: Record<string, number> = {};
    allCases.forEach(c => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });

    console.log(`  Total Cases: ${allCases.length}`);
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    console.log('');

    // Analysis
    console.log('🔬 Analysis:');
    if (caseData.status === 'sold' && auction && auction.status === 'closed') {
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.auctionId, auction.id))
        .limit(1);

      if (payment && payment.status === 'pending') {
        console.log('  ⚠️  ISSUE FOUND: Case is marked as "sold" but payment is still "pending"');
        console.log('  ✅ EXPECTED: Case should be "active_auction" or "payment_pending" until payment is verified');
        console.log('  🔧 FIX NEEDED: Update auction closure logic to not mark case as "sold" until payment is verified');
      }
    }

    if (caseData.approvedBy && caseData.status !== 'approved') {
      console.log('  ℹ️  Case was approved but status changed to:', caseData.status);
      console.log('  ✅ This is expected behavior - approved cases move to "active_auction" status');
      console.log('  🔧 FIX NEEDED: Approvals page should show cases with approvedBy field, not just status="approved"');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkCaseStatus();
