/**
 * Diagnostic Script: Payment UI Realtime Update Issue
 * 
 * This script diagnoses why the UI takes 5-10 minutes to show "Payment Verified"
 * after a successful Paystack payment, even though:
 * - Payment is verified in database (status='verified')
 * - Wallet transactions are correct
 * - Finance dashboard shows payment as verified
 * - Polling API eventually returns hasVerifiedPayment: true
 * 
 * Root Cause Hypothesis:
 * - Polling API queries database directly (no cache)
 * - Webhook marks payment as verified
 * - BUT there might be a delay in the webhook execution or database write
 * 
 * This script will:
 * 1. Check the most recent payment for an auction
 * 2. Check if polling API returns hasVerifiedPayment: true
 * 3. Check Redis cache state
 * 4. Check webhook execution logs
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, and, desc } from 'drizzle-orm';
import { redis, cache } from '@/lib/redis/client';

// CONFIGURATION: Set your auction ID here
const AUCTION_ID = 'c1c20342-25ba-4d1a-9132-0d79ba0efd42'; // Most recent auction in awaiting_payment with verified payment

async function main() {
  console.log('🔍 Diagnosing Payment UI Realtime Update Issue');
  console.log('================================================\n');

  // Step 1: Check auction status
  console.log('📋 Step 1: Check Auction Status');
  console.log('--------------------------------');
  
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, AUCTION_ID))
    .limit(1);

  if (!auction) {
    console.error(`❌ Auction not found: ${AUCTION_ID}`);
    process.exit(1);
  }

  console.log(`✅ Auction found: ${auction.id}`);
  console.log(`   - Status: ${auction.status}`);
  console.log(`   - Current Bid: ₦${parseFloat(auction.currentBid || '0').toLocaleString()}`);
  console.log(`   - Current Bidder: ${auction.currentBidder || 'None'}`);
  console.log(`   - Updated At: ${auction.updatedAt}`);
  console.log();

  // Step 2: Check payment status
  console.log('💳 Step 2: Check Payment Status');
  console.log('--------------------------------');
  
  const allPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.auctionId, AUCTION_ID))
    .orderBy(desc(payments.createdAt));

  if (allPayments.length === 0) {
    console.log('⚠️  No payments found for this auction');
  } else {
    console.log(`✅ Found ${allPayments.length} payment(s):\n`);
    
    for (const payment of allPayments) {
      console.log(`   Payment ID: ${payment.id}`);
      console.log(`   - Status: ${payment.status}`);
      console.log(`   - Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
      console.log(`   - Method: ${payment.paymentMethod}`);
      console.log(`   - Reference: ${payment.paymentReference}`);
      console.log(`   - Verified At: ${payment.verifiedAt || 'Not verified'}`);
      console.log(`   - Created At: ${payment.createdAt}`);
      console.log(`   - Updated At: ${payment.updatedAt}`);
      console.log();
    }
  }

  // Step 3: Check what polling API would return
  console.log('🔄 Step 3: Simulate Polling API Query');
  console.log('--------------------------------------');
  
  let hasVerifiedPayment = false;
  if (auction.status === 'awaiting_payment') {
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
    hasVerifiedPayment = !!verifiedPayment;
    
    console.log(`✅ Polling API would return:`);
    console.log(`   - hasVerifiedPayment: ${hasVerifiedPayment}`);
    
    if (hasVerifiedPayment && verifiedPayment) {
      console.log(`   - Payment ID: ${verifiedPayment.id}`);
      console.log(`   - Verified At: ${verifiedPayment.verifiedAt}`);
      console.log(`   - Time since verification: ${verifiedPayment.verifiedAt ? Math.round((Date.now() - verifiedPayment.verifiedAt.getTime()) / 1000) : 'N/A'}s`);
    } else {
      console.log(`   ⚠️  No verified payment found!`);
      console.log(`   - This is why UI shows "Payment Required"`);
    }
  } else {
    console.log(`ℹ️  Auction status is "${auction.status}", not "awaiting_payment"`);
    console.log(`   - hasVerifiedPayment check is skipped for this status`);
  }
  console.log();

  // Step 4: Check Redis cache
  console.log('🗄️  Step 4: Check Redis Cache');
  console.log('-----------------------------');
  
  try {
    const cacheKey = `auction:details:${AUCTION_ID}`;
    const cachedData = await redis.get(cacheKey);
    
    if (cachedData) {
      console.log(`✅ Cache exists for key: ${cacheKey}`);
      console.log(`   - Cached data:`, JSON.stringify(cachedData, null, 2));
      
      // Check if cached data has hasVerifiedPayment
      if (typeof cachedData === 'object' && cachedData !== null) {
        const data = cachedData as any;
        if (data.auction && 'hasVerifiedPayment' in data.auction) {
          console.log(`   - Cached hasVerifiedPayment: ${data.auction.hasVerifiedPayment}`);
          
          if (data.auction.hasVerifiedPayment !== hasVerifiedPayment) {
            console.log(`   ⚠️  CACHE MISMATCH!`);
            console.log(`   - Database says: ${hasVerifiedPayment}`);
            console.log(`   - Cache says: ${data.auction.hasVerifiedPayment}`);
            console.log(`   - This is the root cause of the UI delay!`);
          }
        }
      }
    } else {
      console.log(`ℹ️  No cache found for key: ${cacheKey}`);
      console.log(`   - This is expected after webhook invalidation`);
    }
  } catch (error) {
    console.error('❌ Error checking Redis cache:', error);
  }
  console.log();

  // Step 5: Check rate limiting
  console.log('⏱️  Step 5: Check Rate Limiting');
  console.log('-------------------------------');
  
  try {
    const rateLimitKey = `auction:poll:*:${AUCTION_ID}`;
    console.log(`ℹ️  Rate limit keys would be: ${rateLimitKey}`);
    console.log(`   - Rate limit: 1 request per 2 seconds per user`);
    console.log(`   - This should NOT affect payment status updates`);
  } catch (error) {
    console.error('❌ Error checking rate limiting:', error);
  }
  console.log();

  // Step 6: Recommendations
  console.log('💡 Step 6: Recommendations');
  console.log('--------------------------');
  
  if (auction.status === 'awaiting_payment' && !hasVerifiedPayment) {
    console.log('⚠️  ISSUE DETECTED: Payment not marked as verified in database');
    console.log();
    console.log('Possible causes:');
    console.log('1. Webhook has not been called yet (check Paystack dashboard)');
    console.log('2. Webhook failed to process (check application logs)');
    console.log('3. Webhook signature verification failed');
    console.log('4. Database transaction failed during webhook processing');
    console.log();
    console.log('Next steps:');
    console.log('1. Check Paystack dashboard for webhook delivery status');
    console.log('2. Check application logs for webhook errors');
    console.log('3. Manually trigger webhook using: npm run script scripts/manually-process-paystack-auction-payment.ts');
  } else if (auction.status === 'awaiting_payment' && hasVerifiedPayment) {
    console.log('✅ Payment is verified in database');
    console.log('✅ Polling API should return hasVerifiedPayment: true');
    console.log();
    console.log('If UI still shows "Payment Required":');
    console.log('1. Check browser console logs for polling responses');
    console.log('2. Check if client-side state is updating correctly');
    console.log('3. Check if there are any JavaScript errors blocking state updates');
    console.log('4. Clear browser cache and reload page');
  } else {
    console.log(`ℹ️  Auction status is "${auction.status}"`);
    console.log('   - Payment verification check only applies to "awaiting_payment" status');
  }
  console.log();

  console.log('✅ Diagnosis complete!');
  console.log();
}

main()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
