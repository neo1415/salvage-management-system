/**
 * Clear Stuck Pending Payments
 * 
 * This script identifies and clears pending payments that are blocking new payment attempts.
 * It checks for:
 * 1. Pending payments older than 24 hours (expired)
 * 2. Duplicate pending payments for the same auction
 * 3. Pending escrow_wallet payments that should be deleted (user chose different method)
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { eq, and, lt } from 'drizzle-orm';

async function clearStuckPendingPayments() {
  console.log('🔍 Checking for stuck pending payments...\n');

  // Find all pending payments
  const pendingPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.status, 'pending'));

  console.log(`Found ${pendingPayments.length} pending payments\n`);

  if (pendingPayments.length === 0) {
    console.log('✅ No stuck pending payments found');
    return;
  }

  // Group by auction ID to find duplicates
  const paymentsByAuction = new Map<string, typeof pendingPayments>();
  for (const payment of pendingPayments) {
    const existing = paymentsByAuction.get(payment.auctionId) || [];
    existing.push(payment);
    paymentsByAuction.set(payment.auctionId, existing);
  }

  let deletedCount = 0;
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  for (const [auctionId, auctionPayments] of paymentsByAuction.entries()) {
    console.log(`\n📋 Auction ${auctionId}:`);
    console.log(`   Found ${auctionPayments.length} pending payment(s)`);

    for (const payment of auctionPayments) {
      const age = now.getTime() - payment.createdAt.getTime();
      const ageHours = Math.floor(age / (1000 * 60 * 60));
      const ageMinutes = Math.floor((age % (1000 * 60 * 60)) / (1000 * 60));

      console.log(`\n   Payment ${payment.id}:`);
      console.log(`   - Method: ${payment.paymentMethod}`);
      console.log(`   - Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
      console.log(`   - Created: ${payment.createdAt.toLocaleString()}`);
      console.log(`   - Age: ${ageHours}h ${ageMinutes}m`);
      console.log(`   - Reference: ${payment.paymentReference}`);

      let shouldDelete = false;
      let reason = '';

      // Check if expired (older than 24 hours)
      if (payment.createdAt < twentyFourHoursAgo) {
        shouldDelete = true;
        reason = 'Expired (>24 hours old)';
      }

      // Check if it's a pending escrow_wallet payment (likely from closure, user chose different method)
      if (payment.paymentMethod === 'escrow_wallet' && auctionPayments.length > 1) {
        shouldDelete = true;
        reason = 'Duplicate escrow_wallet payment (user chose different method)';
      }

      // If there are multiple pending payments for same auction, keep only the most recent
      if (auctionPayments.length > 1) {
        const mostRecent = auctionPayments.reduce((latest, current) => 
          current.createdAt > latest.createdAt ? current : latest
        );
        
        if (payment.id !== mostRecent.id) {
          shouldDelete = true;
          reason = 'Duplicate payment (keeping most recent)';
        }
      }

      if (shouldDelete) {
        console.log(`   ❌ DELETING: ${reason}`);
        await db.delete(payments).where(eq(payments.id, payment.id));
        deletedCount++;
      } else {
        console.log(`   ✅ KEEPING: Active pending payment`);
      }
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   Total pending payments found: ${pendingPayments.length}`);
  console.log(`   Deleted: ${deletedCount}`);
  console.log(`   Remaining: ${pendingPayments.length - deletedCount}`);
  
  if (deletedCount > 0) {
    console.log('\n✅ Stuck pending payments cleared successfully');
    console.log('   Users can now initiate new payments');
  } else {
    console.log('\n✅ No stuck payments to clear');
  }
}

// Run the script
clearStuckPendingPayments()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
