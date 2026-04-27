/**
 * Fix Script: My Cases Status Issues
 * 
 * This script fixes the status issues in the database:
 * 1. Updates cases to 'sold' where payment is verified
 * 2. Updates cases to 'approved' where they have approvedBy but status is still 'pending_approval'
 */

import { db } from '@/lib/db/drizzle';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { eq, and } from 'drizzle-orm';

async function fixMyCasesStatus() {
  console.log('🔧 Fixing My Cases Status Issues\n');
  console.log('=' .repeat(80));

  // 1. Fix cases with verified payments that should be 'sold'
  console.log('\n📝 FIX 1: Updating cases with verified payments to \'sold\'');
  console.log('-'.repeat(80));
  
  const casesWithVerifiedPayments = await db
    .select({
      caseId: salvageCases.id,
      claimRef: salvageCases.claimReference,
      caseStatus: salvageCases.status,
      paymentStatus: payments.status,
    })
    .from(salvageCases)
    .innerJoin(auctions, eq(auctions.caseId, salvageCases.id))
    .innerJoin(payments, eq(payments.auctionId, auctions.id))
    .where(
      and(
        eq(salvageCases.status, 'active_auction'),
        eq(payments.status, 'verified')
      )
    );

  console.log(`\nFound ${casesWithVerifiedPayments.length} cases to update`);

  for (const c of casesWithVerifiedPayments) {
    console.log(`  Updating ${c.claimRef}: active_auction → sold`);
    
    await db
      .update(salvageCases)
      .set({
        status: 'sold',
        updatedAt: new Date(),
      })
      .where(eq(salvageCases.id, c.caseId));
  }

  console.log(`✅ Updated ${casesWithVerifiedPayments.length} cases to 'sold'`);

  // 2. Fix cases that are approved but still show 'pending_approval'
  console.log('\n📝 FIX 2: Updating approved cases from \'pending_approval\' to \'approved\'');
  console.log('-'.repeat(80));
  
  const approvedButPending = await db
    .select({
      caseId: salvageCases.id,
      claimRef: salvageCases.claimReference,
      approvedBy: salvageCases.approvedBy,
      approvedAt: salvageCases.approvedAt,
    })
    .from(salvageCases)
    .where(
      and(
        eq(salvageCases.status, 'pending_approval'),
        // Check if approvedBy is not null using SQL
      )
    );

  // Filter in JavaScript since Drizzle doesn't have isNotNull for this case
  const toUpdate = approvedButPending.filter(c => c.approvedBy !== null);

  console.log(`\nFound ${toUpdate.length} cases to update`);

  for (const c of toUpdate) {
    console.log(`  Updating ${c.claimRef}: pending_approval → approved`);
    
    await db
      .update(salvageCases)
      .set({
        status: 'approved',
        updatedAt: new Date(),
      })
      .where(eq(salvageCases.id, c.caseId));
  }

  console.log(`✅ Updated ${toUpdate.length} cases to 'approved'`);

  // Summary
  console.log('\n📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`  - Cases updated to 'sold': ${casesWithVerifiedPayments.length}`);
  console.log(`  - Cases updated to 'approved': ${toUpdate.length}`);
  console.log(`  - Total fixes applied: ${casesWithVerifiedPayments.length + toUpdate.length}`);
  
  console.log('\n✅ Fix complete!\n');
  console.log('💡 Note: The UI has also been updated to:');
  console.log('   - Show "Awaiting Payment" for closed auctions without verified payment');
  console.log('   - Filter out closed auctions from "Active Auction" tab');
  console.log('   - Only show truly pending cases in "Pending Approval" tab');
}

fixMyCasesStatus().catch(console.error);
