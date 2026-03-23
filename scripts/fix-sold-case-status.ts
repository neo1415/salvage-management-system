/**
 * Fix Sold Case Status Script
 * Updates cases marked as 'sold' with pending payments back to 'active_auction'
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { eq, and } from 'drizzle-orm';

async function fixSoldCaseStatus() {
  try {
    console.log('🔧 Fixing sold case status...\n');

    // Find all cases marked as 'sold'
    const soldCases = await db
      .select()
      .from(salvageCases)
      .where(eq(salvageCases.status, 'sold'));

    console.log(`Found ${soldCases.length} cases marked as 'sold'\n`);

    let fixedCount = 0;

    for (const caseData of soldCases) {
      // Get the auction for this case
      const [auction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.caseId, caseData.id))
        .limit(1);

      if (!auction) {
        console.log(`⚠️  No auction found for case ${caseData.claimReference}`);
        continue;
      }

      // Get the payment for this auction
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.auctionId, auction.id))
        .limit(1);

      if (!payment) {
        console.log(`⚠️  No payment found for case ${caseData.claimReference}`);
        continue;
      }

      // Check if payment is still pending
      if (payment.status === 'pending' || payment.status === 'overdue') {
        console.log(`📋 Case: ${caseData.claimReference}`);
        console.log(`   Current Status: ${caseData.status}`);
        console.log(`   Payment Status: ${payment.status}`);
        console.log(`   Payment Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
        console.log(`   Fixing...`);

        // Update case status back to 'active_auction'
        await db
          .update(salvageCases)
          .set({
            status: 'active_auction',
            updatedAt: new Date(),
          })
          .where(eq(salvageCases.id, caseData.id));

        console.log(`   ✅ Updated to 'active_auction'\n`);
        fixedCount++;
      } else {
        console.log(`✓ Case ${caseData.claimReference} has ${payment.status} payment - no fix needed\n`);
      }
    }

    console.log(`\n✅ Fixed ${fixedCount} case(s)`);
    console.log(`\nℹ️  Cases will be marked as 'sold' when payment is verified by finance officer`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

fixSoldCaseStatus();
