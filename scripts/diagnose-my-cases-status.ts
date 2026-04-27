/**
 * Diagnostic Script: My Cases Status Issues
 * 
 * This script diagnoses the status issues reported in the My Cases page:
 * 1. Active auctions showing when they should be closed/sold
 * 2. Pending approvals showing when they've been approved/rejected
 * 3. Payment verification status vs case status mismatch
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { eq, and, sql } from 'drizzle-orm';

async function diagnoseMyCasesStatus() {
  console.log('🔍 Diagnosing My Cases Status Issues\n');
  console.log('=' .repeat(80));

  // 1. Check cases with active_auction status
  console.log('\n📊 ISSUE 1: Active Auction Status Analysis');
  console.log('-'.repeat(80));
  
  const activeAuctionCases = await db
    .select({
      caseId: salvageCases.id,
      claimRef: salvageCases.claimReference,
      caseStatus: salvageCases.status,
      auctionId: auctions.id,
      auctionStatus: auctions.status,
      auctionEndTime: auctions.endTime,
      paymentId: payments.id,
      paymentStatus: payments.status,
    })
    .from(salvageCases)
    .leftJoin(auctions, eq(auctions.caseId, salvageCases.id))
    .leftJoin(payments, eq(payments.auctionId, auctions.id))
    .where(eq(salvageCases.status, 'active_auction'));

  console.log(`\nFound ${activeAuctionCases.length} cases with status 'active_auction'`);
  
  let trulyClosed = 0;
  let awaitingPayment = 0;
  let paymentVerified = 0;
  let trulyActive = 0;

  for (const c of activeAuctionCases) {
    const now = new Date();
    const endTime = c.auctionEndTime ? new Date(c.auctionEndTime) : null;
    const isClosed = c.auctionStatus === 'closed' || (endTime && endTime < now);
    
    if (isClosed) {
      trulyClosed++;
      if (c.paymentStatus === 'verified') {
        paymentVerified++;
        console.log(`  ❌ ${c.claimRef}: Auction closed, payment verified, but case still 'active_auction' (should be 'sold')`);
      } else if (c.paymentId) {
        awaitingPayment++;
        console.log(`  ⚠️  ${c.claimRef}: Auction closed, payment ${c.paymentStatus}, case still 'active_auction' (should show 'awaiting_payment')`);
      } else {
        console.log(`  ⚠️  ${c.claimRef}: Auction closed, no payment record, case still 'active_auction'`);
      }
    } else {
      trulyActive++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  - Truly active auctions: ${trulyActive}`);
  console.log(`  - Closed auctions (should not show as active): ${trulyClosed}`);
  console.log(`    - With verified payment (should be 'sold'): ${paymentVerified}`);
  console.log(`    - Awaiting payment: ${awaitingPayment}`);

  // 2. Check pending approval cases
  console.log('\n📊 ISSUE 2: Pending Approval Status Analysis');
  console.log('-'.repeat(80));
  
  const pendingCases = await db
    .select({
      caseId: salvageCases.id,
      claimRef: salvageCases.claimReference,
      caseStatus: salvageCases.status,
      approvedBy: salvageCases.approvedBy,
      approvedAt: salvageCases.approvedAt,
    })
    .from(salvageCases)
    .where(eq(salvageCases.status, 'pending_approval'));

  console.log(`\nFound ${pendingCases.length} cases with status 'pending_approval'`);
  
  let trulyPending = 0;
  let alreadyApproved = 0;

  for (const c of pendingCases) {
    if (c.approvedBy) {
      alreadyApproved++;
      console.log(`  ❌ ${c.claimRef}: Status 'pending_approval' but approvedBy is set (approved at ${c.approvedAt})`);
    } else {
      trulyPending++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  - Truly pending approval: ${trulyPending}`);
  console.log(`  - Already approved (should not show as pending): ${alreadyApproved}`);

  // 3. Check sold cases
  console.log('\n📊 ISSUE 3: Sold Status Analysis');
  console.log('-'.repeat(80));
  
  const soldCases = await db
    .select({
      caseId: salvageCases.id,
      claimRef: salvageCases.claimReference,
      caseStatus: salvageCases.status,
      auctionId: auctions.id,
      auctionStatus: auctions.status,
      paymentId: payments.id,
      paymentStatus: payments.status,
    })
    .from(salvageCases)
    .leftJoin(auctions, eq(auctions.caseId, salvageCases.id))
    .leftJoin(payments, eq(payments.auctionId, auctions.id))
    .where(eq(salvageCases.status, 'sold'));

  console.log(`\nFound ${soldCases.length} cases with status 'sold'`);
  
  let correctlySold = 0;
  let soldWithoutPayment = 0;

  for (const c of soldCases) {
    if (c.paymentStatus === 'verified') {
      correctlySold++;
    } else {
      soldWithoutPayment++;
      console.log(`  ⚠️  ${c.claimRef}: Status 'sold' but payment is ${c.paymentStatus || 'missing'}`);
    }
  }

  console.log(`\nSummary:`);
  console.log(`  - Correctly sold (with verified payment): ${correctlySold}`);
  console.log(`  - Sold without verified payment: ${soldWithoutPayment}`);

  // 4. Recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('='.repeat(80));
  
  if (paymentVerified > 0) {
    console.log(`\n1. Update ${paymentVerified} cases from 'active_auction' to 'sold' where payment is verified`);
    console.log('   Run: UPDATE salvage_cases SET status = \'sold\' WHERE id IN (...)');
  }
  
  if (alreadyApproved > 0) {
    console.log(`\n2. ${alreadyApproved} cases show 'pending_approval' but are already approved`);
    console.log('   These should have been updated to \'approved\' when approvedBy was set');
  }
  
  if (trulyClosed > 0) {
    console.log(`\n3. ${trulyClosed} auctions are closed but cases still show 'active_auction'`);
    console.log('   The UI should check auction real-time status and show "Awaiting Payment" instead');
  }

  console.log('\n✅ Diagnosis complete!\n');
}

diagnoseMyCasesStatus().catch(console.error);
