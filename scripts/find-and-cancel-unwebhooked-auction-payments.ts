/**
 * Find and Cancel Unwebhooked Auction Payments
 * 
 * This script finds auction payments that are stuck in 'pending' status
 * because they haven't been processed by Paystack webhooks yet.
 * 
 * It will:
 * 1. Find all pending auction payments
 * 2. Check if they're older than a threshold (e.g., 30 minutes)
 * 3. Optionally cancel them to clean up the database
 */

import { db } from '@/lib/db/drizzle';
import { eq, and, lt, isNotNull, sql } from 'drizzle-orm';

async function findAndCancelUnwebhookedPayments(dryRun: boolean = true) {
  console.log('🔍 FINDING UNWEBHOOKED AUCTION PAYMENTS\n');
  console.log('=' .repeat(60));
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No payments will be cancelled');
  } else {
    console.log('🚨 LIVE MODE - Payments will be cancelled!');
  }
  console.log('=' .repeat(60));

  try {
    // Find all pending auction payments that haven't been webhhooked
    // A payment is considered "unwebhooked" if:
    // 1. Status is 'pending'
    // 2. auctionId is NOT NULL (it's an auction payment)
    // 3. It's older than 30 minutes (to avoid cancelling legitimate pending payments)
    
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    
    // Use raw SQL to avoid schema import issues
    const result = await db.execute(sql`
      SELECT *
      FROM payments
      WHERE status = 'pending'
        AND auction_id IS NOT NULL
        AND created_at < ${thirtyMinutesAgo.toISOString()}
      ORDER BY created_at DESC
    `);
    
    const pendingPayments = Array.isArray(result) ? result : (result.rows || []);

    console.log(`\n📊 FOUND ${pendingPayments.length} UNWEBHOOKED AUCTION PAYMENTS\n`);

    if (pendingPayments.length === 0) {
      console.log('✅ No unwebhooked auction payments found!');
      return;
    }

    // Display details of each payment
    console.log('Payment Details:');
    console.log('-'.repeat(60));
    
    for (const payment of pendingPayments) {
      const age = Math.floor((Date.now() - new Date(payment.created_at).getTime()) / (1000 * 60));
      
      console.log(`\nPayment ID: ${payment.id}`);
      console.log(`  Auction ID: ${payment.auction_id}`);
      console.log(`  Vendor ID: ${payment.vendor_id}`);
      console.log(`  Amount: ₦${Number(payment.amount).toLocaleString()}`);
      console.log(`  Method: ${payment.method}`);
      console.log(`  Status: ${payment.status}`);
      console.log(`  Reference: ${payment.reference || 'N/A'}`);
      console.log(`  Created: ${payment.created_at} (${age} minutes ago)`);
      console.log(`  Paystack Ref: ${payment.paystack_reference || 'N/A'}`);
    }

    console.log('\n' + '='.repeat(60));

    if (dryRun) {
      console.log('\n⚠️  DRY RUN - No changes made');
      console.log('\nTo actually cancel these payments, run:');
      console.log('npx tsx scripts/find-and-cancel-unwebhooked-auction-payments.ts --live');
      return;
    }

    // Cancel the payments
    console.log('\n🚨 CANCELLING PAYMENTS...\n');
    
    let successCount = 0;
    let errorCount = 0;

    for (const payment of pendingPayments) {
      try {
        await db.execute(sql`
          UPDATE payments
          SET status = 'cancelled',
              updated_at = NOW()
          WHERE id = ${payment.id}
        `);

        console.log(`✅ Cancelled payment ${payment.id}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to cancel payment ${payment.id}:`, error);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n✅ Successfully cancelled: ${successCount}`);
    console.log(`❌ Failed to cancel: ${errorCount}`);
    console.log(`📊 Total processed: ${pendingPayments.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isLiveMode = args.includes('--live') || args.includes('-l');

findAndCancelUnwebhookedPayments(!isLiveMode)
  .then(() => {
    console.log('\n✅ Script completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
