/**
 * Script: Find and Delete Duplicate Payment Records
 * 
 * Problem: User found duplicate payment records for auction GIA-8823 (8170710b):
 * - Record 1: ✅ Verified, ₦370,000, Released, Reference: PAY_8170710b_1774198978061
 * - Record 2: ⏳ Pending, ₦370,000, Frozen, Reference: PAY_8170710b_1774198978065
 * 
 * This script:
 * 1. Finds all duplicate payment records (same auctionId)
 * 2. Keeps the oldest payment record (first created)
 * 3. Deletes newer duplicates
 * 4. Logs all deletions for audit trail
 * 
 * Pattern: Based on find-and-delete-duplicate-documents.ts
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { eq, sql } from 'drizzle-orm';

interface DuplicateGroup {
  auctionId: string;
  count: number;
}

interface PaymentRecord {
  id: string;
  auctionId: string;
  vendorId: string;
  amount: string;
  paymentMethod: string;
  paymentReference: string | null;
  escrowStatus: string;
  status: string;
  createdAt: Date;
}

async function findDuplicatePayments(): Promise<DuplicateGroup[]> {
  console.log('🔍 Searching for duplicate payment records...\n');

  // Find auctions with more than 1 payment record
  const duplicates = await db
    .select({
      auctionId: payments.auctionId,
      count: sql<number>`count(*)::int`,
    })
    .from(payments)
    .groupBy(payments.auctionId)
    .having(sql`count(*) > 1`);

  return duplicates as DuplicateGroup[];
}

async function deleteDuplicates(dryRun: boolean = true): Promise<void> {
  const duplicateGroups = await findDuplicatePayments();

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicate payment records found!\n');
    return;
  }

  console.log(`⚠️  Found ${duplicateGroups.length} duplicate payment groups:\n`);

  let totalDeleted = 0;
  const deletionLog: Array<{
    auctionId: string;
    deletedPayments: Array<{
      id: string;
      vendorId: string;
      amount: string;
      status: string;
      escrowStatus: string;
      paymentReference: string | null;
      createdAt: Date;
    }>;
    keptPayment: {
      id: string;
      vendorId: string;
      amount: string;
      status: string;
      escrowStatus: string;
      paymentReference: string | null;
      createdAt: Date;
    };
  }> = [];

  for (const group of duplicateGroups) {
    console.log(`💳 Duplicate Payment Group:`);
    console.log(`   - Auction ID: ${group.auctionId}`);
    console.log(`   - Count: ${group.count}`);

    // Get all payments for this auction, ordered by creation date (oldest first)
    const paymentRecords = await db
      .select({
        id: payments.id,
        auctionId: payments.auctionId,
        vendorId: payments.vendorId,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        paymentReference: payments.paymentReference,
        escrowStatus: payments.escrowStatus,
        status: payments.status,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.auctionId, group.auctionId))
      .orderBy(payments.createdAt); // Oldest first

    if (paymentRecords.length <= 1) {
      console.log('   ⏭️  Skipping - only 1 payment found\n');
      continue;
    }

    // Keep the oldest payment (first in array)
    const [keepPayment, ...deletePaymentsArray] = paymentRecords;

    console.log(`   ✅ Keeping oldest payment:`);
    console.log(`      - ID: ${keepPayment.id}`);
    console.log(`      - Vendor: ${keepPayment.vendorId}`);
    console.log(`      - Amount: ₦${parseFloat(keepPayment.amount).toLocaleString()}`);
    console.log(`      - Status: ${keepPayment.status}`);
    console.log(`      - Escrow Status: ${keepPayment.escrowStatus}`);
    console.log(`      - Reference: ${keepPayment.paymentReference || 'N/A'}`);
    console.log(`      - Created: ${keepPayment.createdAt.toISOString()}`);

    console.log(`   🗑️  Deleting ${deletePaymentsArray.length} duplicate(s):`);
    const deletedPayments: Array<{
      id: string;
      vendorId: string;
      amount: string;
      status: string;
      escrowStatus: string;
      paymentReference: string | null;
      createdAt: Date;
    }> = [];

    for (const payment of deletePaymentsArray) {
      console.log(`      - ID: ${payment.id}`);
      console.log(`        Vendor: ${payment.vendorId}`);
      console.log(`        Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
      console.log(`        Status: ${payment.status}`);
      console.log(`        Escrow Status: ${payment.escrowStatus}`);
      console.log(`        Reference: ${payment.paymentReference || 'N/A'}`);
      console.log(`        Created: ${payment.createdAt.toISOString()}`);

      if (!dryRun) {
        await db
          .delete(payments)
          .where(eq(payments.id, payment.id));
        
        deletedPayments.push({
          id: payment.id,
          vendorId: payment.vendorId,
          amount: payment.amount,
          status: payment.status,
          escrowStatus: payment.escrowStatus,
          paymentReference: payment.paymentReference,
          createdAt: payment.createdAt,
        });
        totalDeleted++;
      }
    }

    deletionLog.push({
      auctionId: group.auctionId,
      deletedPayments,
      keptPayment: {
        id: keepPayment.id,
        vendorId: keepPayment.vendorId,
        amount: keepPayment.amount,
        status: keepPayment.status,
        escrowStatus: keepPayment.escrowStatus,
        paymentReference: keepPayment.paymentReference,
        createdAt: keepPayment.createdAt,
      },
    });

    console.log('');
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Total duplicate groups found: ${duplicateGroups.length}`);
  console.log(`Total payments to delete: ${totalDeleted}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes made)' : 'LIVE (changes applied)'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (dryRun) {
    console.log('💡 This was a DRY RUN. No payments were deleted.');
    console.log('💡 Run with --live flag to actually delete duplicates.\n');
  } else {
    console.log('✅ Duplicate payment records deleted successfully!\n');
    
    // Write deletion log to file
    const fs = await import('fs/promises');
    const logPath = `./payment-deletion-log-${Date.now()}.json`;
    await fs.writeFile(logPath, JSON.stringify(deletionLog, null, 2));
    console.log(`📝 Deletion log saved to: ${logPath}\n`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isLive = args.includes('--live');

  console.log('═══════════════════════════════════════════════════════');
  console.log('DUPLICATE PAYMENT CLEANUP SCRIPT');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    await deleteDuplicates(!isLive);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
