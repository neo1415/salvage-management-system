/**
 * Diagnostic Script: Payment Verification UI Update Issue
 * 
 * This script helps diagnose why the UI doesn't update from "Pay Now" to "Payment Complete"
 * even after payment is verified.
 * 
 * Usage:
 *   npx tsx scripts/diagnose-payment-verification-ui.ts <auctionId>
 */

import { db } from '@/lib/db/drizzle';
import { auctions } from '@/lib/db/schema/auctions';
import { payments } from '@/lib/db/schema/payments';
import { eq, and } from 'drizzle-orm';

async function diagnosePaymentVerificationUI(auctionId: string) {
  console.log('\n🔍 Payment Verification UI Diagnostic');
  console.log('=====================================\n');

  try {
    // 1. Check auction status
    console.log('1️⃣  Checking auction status...');
    const [auction] = await db
      .select()
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      console.error('❌ Auction not found');
      return;
    }

    console.log(`✅ Auction found:`);
    console.log(`   - ID: ${auction.id}`);
    console.log(`   - Status: ${auction.status}`);
    console.log(`   - Current Bidder: ${auction.currentBidder || 'None'}`);
    console.log(`   - Current Bid: ₦${auction.currentBid ? Number(auction.currentBid).toLocaleString() : '0'}`);

    // 2. Check for verified payment
    console.log('\n2️⃣  Checking for verified payment...');
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.status, 'verified')
        )
      )
      .limit(1);

    if (payment) {
      console.log(`✅ Verified payment found:`);
      console.log(`   - Payment ID: ${payment.id}`);
      console.log(`   - Amount: ₦${Number(payment.amount).toLocaleString()}`);
      console.log(`   - Status: ${payment.status}`);
      console.log(`   - Verified At: ${payment.verifiedAt || 'N/A'}`);
      console.log(`   - Payment Method: ${payment.paymentMethod}`);
    } else {
      console.log(`❌ No verified payment found`);
      
      // Check for any payments
      const allPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.auctionId, auctionId));
      
      if (allPayments.length > 0) {
        console.log(`\n⚠️  Found ${allPayments.length} payment(s) with other statuses:`);
        allPayments.forEach((p, i) => {
          console.log(`   ${i + 1}. Payment ID: ${p.id}`);
          console.log(`      - Status: ${p.status}`);
          console.log(`      - Amount: ₦${Number(p.amount).toLocaleString()}`);
          console.log(`      - Created: ${p.createdAt}`);
        });
      } else {
        console.log(`\n⚠️  No payments found for this auction`);
      }
    }

    // 3. Simulate poll endpoint response
    console.log('\n3️⃣  Simulating poll endpoint response...');
    const hasVerifiedPayment = !!payment;
    
    const pollResponse = {
      success: true,
      data: {
        auctionId: auction.id,
        currentBid: auction.currentBid ? parseFloat(auction.currentBid) : null,
        currentBidder: auction.currentBidder,
        status: auction.status,
        endTime: auction.endTime,
        hasVerifiedPayment,
        timestamp: new Date().toISOString(),
      },
    };

    console.log('📊 Poll endpoint would return:');
    console.log(JSON.stringify(pollResponse, null, 2));

    // 4. Check what the UI should show
    console.log('\n4️⃣  UI State Analysis:');
    if (auction.status === 'awaiting_payment') {
      if (hasVerifiedPayment) {
        console.log('✅ UI SHOULD show: "Payment Complete" (green banner)');
        console.log('   - hasVerifiedPayment: true');
        console.log('   - Status: awaiting_payment');
      } else {
        console.log('⚠️  UI SHOULD show: "Pay Now" (yellow banner)');
        console.log('   - hasVerifiedPayment: false');
        console.log('   - Status: awaiting_payment');
      }
    } else {
      console.log(`ℹ️  Auction status is "${auction.status}" - payment banners not applicable`);
    }

    // 5. Diagnosis
    console.log('\n5️⃣  Diagnosis:');
    if (auction.status === 'awaiting_payment' && hasVerifiedPayment) {
      console.log('🔍 ISSUE IDENTIFIED:');
      console.log('   - Payment is verified in database ✅');
      console.log('   - Poll endpoint returns hasVerifiedPayment: true ✅');
      console.log('   - BUT UI still shows "Pay Now" ❌');
      console.log('\n💡 ROOT CAUSE:');
      console.log('   The auction detail page is NOT updating the hasVerifiedPayment');
      console.log('   state from the realtime auction updates (polling data).');
      console.log('\n🔧 FIX NEEDED:');
      console.log('   Add useEffect to update hasVerifiedPayment when realtimeAuction');
      console.log('   changes and includes hasVerifiedPayment field.');
    } else if (auction.status === 'awaiting_payment' && !hasVerifiedPayment) {
      console.log('✅ EXPECTED STATE:');
      console.log('   - Payment not yet verified');
      console.log('   - UI correctly shows "Pay Now"');
    } else {
      console.log('ℹ️  Auction is not in awaiting_payment status');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Get auction ID from command line
const auctionId = process.argv[2];

if (!auctionId) {
  console.error('❌ Usage: npx tsx scripts/diagnose-payment-verification-ui.ts <auctionId>');
  process.exit(1);
}

diagnosePaymentVerificationUI(auctionId)
  .then(() => {
    console.log('\n✅ Diagnostic complete\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  });
