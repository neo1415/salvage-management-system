/**
 * Diagnostic Script: Payment UI Mismatch Investigation
 * 
 * This script investigates why the UI shows "Payment Required" even though:
 * 1. Payment is verified in database
 * 2. Wallet transactions are correct
 * 3. Finance dashboard shows payment
 * 
 * It checks:
 * - Database auction status
 * - Payment status
 * - What the polling API would return
 * - Cache state
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { eq, and } from 'drizzle-orm';
import { redis } from '@/lib/redis/client';

const AUCTION_ID = 'c1c20342-25ba-4d1a-9132-0d79ba0efd42';

async function diagnose() {
  console.log('🔍 PAYMENT UI MISMATCH DIAGNOSTIC');
  console.log('='.repeat(60));
  console.log(`Auction ID: ${AUCTION_ID}\n`);

  try {
    // 1. Check auction status in database
    console.log('1️⃣  DATABASE AUCTION STATUS');
    console.log('-'.repeat(60));
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, AUCTION_ID))
      .limit(1);

    if (!auction) {
      console.log('❌ Auction not found in database');
      return;
    }

    console.log(`Status: ${auction.status}`);
    console.log(`Current Bid: ₦${auction.currentBid}`);
    console.log(`Current Bidder: ${auction.currentBidder}`);
    console.log(`Updated At: ${auction.updatedAt}`);
    console.log();

    // 2. Check payment status
    console.log('2️⃣  PAYMENT STATUS');
    console.log('-'.repeat(60));
    const allPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.auctionId, AUCTION_ID));

    console.log(`Total payments found: ${allPayments.length}`);
    allPayments.forEach((payment, index) => {
      console.log(`\nPayment ${index + 1}:`);
      console.log(`  ID: ${payment.id}`);
      console.log(`  Status: ${payment.status}`);
      console.log(`  Amount: ₦${payment.amount}`);
      console.log(`  Source: ${payment.source}`);
      console.log(`  Reference: ${payment.reference}`);
      console.log(`  Created: ${payment.createdAt}`);
      console.log(`  Updated: ${payment.updatedAt}`);
    });

    // Check for verified payment
    const [verifiedPayment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, AUCTION_ID),
          eq(payments.status, 'verified')
        )
      )
      .limit(1);

    console.log(`\n✅ Has verified payment: ${!!verifiedPayment}`);
    console.log();

    // 3. Simulate what polling API would return
    console.log('3️⃣  POLLING API SIMULATION');
    console.log('-'.repeat(60));
    
    let hasVerifiedPayment = false;
    if (auction.status === 'awaiting_payment') {
      hasVerifiedPayment = !!verifiedPayment;
    }

    const pollingResponse = {
      auctionId: auction.id,
      currentBid: auction.currentBid ? parseFloat(auction.currentBid) : null,
      currentBidder: auction.currentBidder,
      status: auction.status,
      endTime: auction.endTime,
      hasVerifiedPayment,
      timestamp: new Date().toISOString(),
    };

    console.log('Polling API would return:');
    console.log(JSON.stringify(pollingResponse, null, 2));
    console.log();

    // 4. Check Redis cache
    console.log('4️⃣  REDIS CACHE STATE');
    console.log('-'.repeat(60));
    
    try {
      const cacheKey = `auction:details:${AUCTION_ID}`;
      const cachedData = await redis.get(cacheKey);
      
      if (cachedData) {
        console.log('✅ Cached auction data found:');
        console.log(JSON.stringify(cachedData, null, 2));
      } else {
        console.log('❌ No cached auction data found');
      }
    } catch (error) {
      console.log('⚠️  Redis error:', error);
    }
    console.log();

    // 5. Root cause analysis
    console.log('5️⃣  ROOT CAUSE ANALYSIS');
    console.log('-'.repeat(60));
    
    if (auction.status === 'awaiting_payment' && verifiedPayment) {
      console.log('🔴 PROBLEM IDENTIFIED:');
      console.log('   Auction status is "awaiting_payment" but payment is verified');
      console.log('   The auction status should have been updated to "payment_complete"');
      console.log();
      console.log('💡 LIKELY CAUSE:');
      console.log('   The Paystack webhook did not update the auction status');
      console.log('   OR the status update transaction failed');
      console.log();
      console.log('🔧 SOLUTION:');
      console.log('   Need to check webhook handler and ensure it updates auction status');
    } else if (auction.status === 'payment_complete') {
      console.log('✅ Auction status is correct: payment_complete');
      console.log();
      console.log('🔴 PROBLEM:');
      console.log('   UI is not reflecting the correct status');
      console.log();
      console.log('💡 LIKELY CAUSES:');
      console.log('   1. Client-side cache not being cleared');
      console.log('   2. Polling not picking up the status change');
      console.log('   3. React state not updating properly');
    } else {
      console.log(`⚠️  Unexpected status: ${auction.status}`);
    }

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  } finally {
    process.exit(0);
  }
}

diagnose();
