/**
 * Cleanup ALL Duplicate Payments
 * 
 * Finds and removes all duplicate payment records across all auctions
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { eq, sql } from 'drizzle-orm';

async function cleanupAllDuplicates() {
  console.log('\n🧹 CLEANUP ALL DUPLICATE PAYMENTS');
  console.log('==================================\n');

  try {
    // Find all auctions with duplicate payments
    const duplicates = await db.execute(sql`
      SELECT auction_id, vendor_id, COUNT(*) as count
      FROM payments
      GROUP BY auction_id, vendor_id
      HAVING COUNT(*) > 1
    `);

    const rows = Array.isArray(duplicates) ? duplicates : duplicates.rows || [];

    if (rows.length === 0) {
      console.log('✅ No duplicate payments found\n');
      return;
    }

    console.log(`⚠️  Found ${rows.length} auction(s) with duplicate payments\n`);

    let totalDeleted = 0;

    for (const row of rows) {
      const auctionId = row.auction_id as string;
      const vendorId = row.vendor_id as string;
      const count = row.count as number;

      console.log(`\n📦 Auction: ${auctionId.substring(0, 8)}...`);
      console.log(`   Vendor: ${vendorId.substring(0, 8)}...`);
      console.log(`   Duplicate count: ${count}`);

      // Get all payments for this auction-vendor pair
      const allPayments = await db
        .select()
        .from(payments)
        .where(
          sql`${payments.auctionId} = ${auctionId} AND ${payments.vendorId} = ${vendorId}`
        )
        .orderBy(sql`${payments.createdAt} DESC`);

      if (allPayments.length === 0) continue;

      // Keep the most recent one
      const keepPayment = allPayments[0];
      const deletePayments = allPayments.slice(1);

      console.log(`   ✅ Keeping: ${keepPayment.id} (${keepPayment.paymentReference})`);

      // Delete duplicates
      for (const payment of deletePayments) {
        await db
          .delete(payments)
          .where(eq(payments.id, payment.id));
        
        console.log(`   🗑️  Deleted: ${payment.id} (${payment.paymentReference})`);
        totalDeleted++;
      }
    }

    console.log(`\n✅ Cleanup complete! Removed ${totalDeleted} duplicate payment(s)\n`);

    // Verify cleanup
    const remainingDuplicates = await db.execute(sql`
      SELECT auction_id, vendor_id, COUNT(*) as count
      FROM payments
      GROUP BY auction_id, vendor_id
      HAVING COUNT(*) > 1
    `);

    const remainingRows = Array.isArray(remainingDuplicates) ? remainingDuplicates : remainingDuplicates.rows || [];

    console.log('📊 VERIFICATION:');
    if (remainingRows.length === 0) {
      console.log('   ✅ Success! No duplicate payments remain\n');
    } else {
      console.log(`   ⚠️  Warning: ${remainingRows.length} auction(s) still have duplicates\n`);
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// Run cleanup
cleanupAllDuplicates()
  .then(() => {
    console.log('✅ Script complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script error:', error);
    process.exit(1);
  });
