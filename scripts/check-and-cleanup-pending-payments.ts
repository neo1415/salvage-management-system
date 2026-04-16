/**
 * Check and Cleanup Pending Payments
 * Diagnose and optionally clean up pending payment records
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { eq, and } from 'drizzle-orm';

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Pending Payments Diagnostic');
  console.log('═══════════════════════════════════════════════════════\n');

  // Get all pending payments
  const pendingPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.status, 'pending'));

  console.log(`Found ${pendingPayments.length} pending payment(s)\n`);

  if (pendingPayments.length === 0) {
    console.log('✅ No pending payments found. System is clean.\n');
    return;
  }

  // Show details of each pending payment
  for (const payment of pendingPayments) {
    console.log('─────────────────────────────────────────────────────');
    console.log(`Payment ID: ${payment.id}`);
    console.log(`Auction ID: ${payment.auctionId}`);
    console.log(`Vendor ID: ${payment.vendorId}`);
    console.log(`Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`Method: ${payment.paymentMethod}`);
    console.log(`Reference: ${payment.paymentReference || 'N/A'}`);
    console.log(`Created: ${payment.createdAt}`);
    console.log(`Deadline: ${payment.paymentDeadline || 'N/A'}`);

    // Get auction details
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, payment.auctionId))
      .limit(1);

    if (auction) {
      console.log(`Auction Status: ${auction.status}`);
    }

    // Get vendor details
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, payment.vendorId))
      .limit(1);

    if (vendor) {
      console.log(`Vendor: ${vendor.businessName || 'N/A'}`);
    }

    // Check if payment is expired (older than 24 hours)
    const createdAt = new Date(payment.createdAt);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    const isExpired = hoursSinceCreation > 24;

    console.log(`Age: ${hoursSinceCreation.toFixed(1)} hours`);
    console.log(`Status: ${isExpired ? '⚠️  EXPIRED (>24h)' : '✅ Active (<24h)'}`);
    console.log('');
  }

  // Ask if user wants to clean up expired payments
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Cleanup Options');
  console.log('═══════════════════════════════════════════════════════\n');

  const expiredPayments = pendingPayments.filter(p => {
    const createdAt = new Date(p.createdAt);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation > 24;
  });

  if (expiredPayments.length > 0) {
    console.log(`Found ${expiredPayments.length} expired pending payment(s) (>24 hours old)`);
    console.log('\nTo clean up expired payments, run:');
    console.log('  npx tsx scripts/cleanup-expired-pending-payments.ts\n');
  }

  const recentPayments = pendingPayments.filter(p => {
    const createdAt = new Date(p.createdAt);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceCreation <= 24;
  });

  if (recentPayments.length > 0) {
    console.log(`Found ${recentPayments.length} recent pending payment(s) (<24 hours old)`);
    console.log('These are likely legitimate pending payments.');
    console.log('Wait for them to complete or expire naturally.\n');
  }

  // Show specific auction IDs with pending payments
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Auctions with Pending Payments');
  console.log('═══════════════════════════════════════════════════════\n');

  const auctionIds = [...new Set(pendingPayments.map(p => p.auctionId))];
  for (const auctionId of auctionIds) {
    const auctionPayments = pendingPayments.filter(p => p.auctionId === auctionId);
    console.log(`Auction: ${auctionId}`);
    console.log(`  Pending payments: ${auctionPayments.length}`);
    
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);
    
    if (auction) {
      console.log(`  Status: ${auction.status}`);
    }
    console.log('');
  }
}

main().catch(console.error);
