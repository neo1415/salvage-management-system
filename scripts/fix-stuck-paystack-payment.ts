/**
 * Fix Stuck Paystack Payment
 * 
 * This script fixes payments that are stuck in "pending" state
 * and manually processes them as if the webhook was received.
 * 
 * Usage:
 *   npx tsx scripts/fix-stuck-paystack-payment.ts <auction-id>
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, and } from 'drizzle-orm';
import { paymentService } from '@/features/auction-deposit/services/payment.service';

async function fixStuckPayment(auctionId: string) {
  console.log('🔧 Fixing Stuck Paystack Payment');
  console.log('='.repeat(60));
  console.log(`Auction ID: ${auctionId}`);
  console.log('');

  // Get auction
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .limit(1);

  if (!auction) {
    console.error('❌ Auction not found');
    return;
  }

  console.log(`Auction Status: ${auction.status}`);
  console.log(`Winner: ${auction.currentBidder?.substring(0, 8) || 'None'}...`);
  console.log('');

  if (!auction.currentBidder) {
    console.error('❌ No winner for this auction');
    return;
  }

  // Get pending payment
  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, auctionId),
        eq(payments.vendorId, auction.currentBidder),
        eq(payments.status, 'pending'),
        eq(payments.paymentMethod, 'paystack')
      )
    )
    .limit(1);

  if (!payment) {
    console.log('ℹ️  No pending Paystack payment found');
    console.log('   - Payment may have already been processed');
    console.log('   - Or payment was never initialized');
    return;
  }

  console.log('📋 Found Pending Payment:');
  console.log(`   - Payment ID: ${payment.id.substring(0, 8)}...`);
  console.log(`   - Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
  console.log(`   - Reference: ${payment.paymentReference}`);
  console.log(`   - Created: ${payment.createdAt.toLocaleString()}`);
  console.log('');

  // Ask for confirmation
  console.log('⚠️  WARNING: This will process the payment as if Paystack webhook was received');
  console.log('   - Deposit will be unfrozen');
  console.log('   - Payment status will be set to "verified"');
  console.log('   - Pickup authorization will be generated');
  console.log('   - Funds will be transferred to finance');
  console.log('');
  console.log('❓ Did the vendor actually pay via Paystack? (Check Paystack dashboard)');
  console.log('');
  console.log('To proceed, run:');
  console.log(`   npx tsx scripts/fix-stuck-paystack-payment.ts ${auctionId} --confirm`);
  console.log('');

  // Check for --confirm flag
  if (!process.argv.includes('--confirm')) {
    console.log('⏸️  Aborted - no changes made');
    return;
  }

  console.log('✅ Confirmed - processing payment...');
  console.log('');

  try {
    // Process the webhook manually
    await paymentService.handlePaystackWebhook(payment.paymentReference!, true);
    
    console.log('✅ Payment processed successfully!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Verify deposit was unfrozen in transaction history');
    console.log('   2. Verify pickup authorization was generated');
    console.log('   3. Verify funds were transferred to finance');
    console.log('   4. Vendor should now be able to see payment options');
  } catch (error) {
    console.error('❌ Error processing payment:', error);
    if (error instanceof Error) {
      console.error('   - Message:', error.message);
      console.error('   - Stack:', error.stack);
    }
  }
}

// Get auction ID from command line
const auctionId = process.argv[2];

if (!auctionId || auctionId === '--confirm') {
  console.error('❌ Please provide an auction ID');
  console.error('Usage: npx tsx scripts/fix-stuck-paystack-payment.ts <auction-id>');
  process.exit(1);
}

fixStuckPayment(auctionId)
  .then(() => {
    console.log('');
    console.log('✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
