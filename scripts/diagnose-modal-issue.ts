/**
 * Diagnose Modal Issue
 * Comprehensive check for why payment unlocked modal isn't showing
 */

import { db } from '@/lib/db/drizzle';
import { notifications } from '@/lib/db/schema/notifications';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { payments } from '@/lib/db/schema/payments';
import { eq, and, desc } from 'drizzle-orm';

async function diagnose(auctionId: string) {
  console.log(`\n🔍 DIAGNOSING MODAL ISSUE FOR AUCTION: ${auctionId}\n`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Step 1: Check auction status
  console.log(`STEP 1: Checking auction status...`);
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .limit(1);

  if (!auction) {
    console.log(`❌ Auction not found!`);
    return;
  }

  console.log(`✅ Auction found:`);
  console.log(`   Status: ${auction.status}`);
  console.log(`   Current Bidder: ${auction.currentBidder || 'None'}`);
  console.log(`   Current Bid: ₦${auction.currentBid ? parseFloat(auction.currentBid).toLocaleString() : '0'}`);
  
  if (auction.status !== 'awaiting_payment') {
    console.log(`\n⚠️  ISSUE: Auction status is "${auction.status}", not "awaiting_payment"`);
    console.log(`   Modal only shows when status is "awaiting_payment"`);
  } else {
    console.log(`   ✓ Status is correct for modal`);
  }

  if (!auction.currentBidder) {
    console.log(`\n❌ ISSUE: No winner (currentBidder is null)`);
    return;
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Step 2: Get winner details
  console.log(`STEP 2: Getting winner details...`);
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.id, auction.currentBidder))
    .limit(1);

  if (!vendor) {
    console.log(`❌ Vendor not found!`);
    return;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, vendor.userId))
    .limit(1);

  if (!user) {
    console.log(`❌ User not found!`);
    return;
  }

  console.log(`✅ Winner found:`);
  console.log(`   User ID: ${user.id}`);
  console.log(`   Vendor ID: ${vendor.id}`);
  console.log(`   Name: ${user.fullName}`);
  console.log(`   Email: ${user.email}`);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Step 3: Check payment record
  console.log(`STEP 3: Checking payment record...`);
  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, auctionId),
        eq(payments.vendorId, vendor.id)
      )
    )
    .orderBy(desc(payments.createdAt))
    .limit(1);

  if (!payment) {
    console.log(`❌ No payment record found!`);
    console.log(`   This means fund release hasn't happened yet.`);
  } else {
    console.log(`✅ Payment record found:`);
    console.log(`   Payment ID: ${payment.id}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Escrow Status: ${payment.escrowStatus || 'N/A'}`);
    console.log(`   Amount: ₦${parseFloat(payment.amount).toLocaleString()}`);
    console.log(`   Payment Method: ${payment.paymentMethod}`);
    console.log(`   Verified At: ${payment.verifiedAt?.toISOString() || 'Not verified'}`);
    
    if (payment.status !== 'verified') {
      console.log(`\n⚠️  ISSUE: Payment status is "${payment.status}", not "verified"`);
      console.log(`   Fund release may not have completed.`);
    } else {
      console.log(`   ✓ Payment is verified`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Step 4: Check for PAYMENT_UNLOCKED notification
  console.log(`STEP 4: Checking for PAYMENT_UNLOCKED notification...`);
  const [notification] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, user.id),
        eq(notifications.type, 'PAYMENT_UNLOCKED')
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1);

  if (!notification) {
    console.log(`❌ NO NOTIFICATION FOUND!`);
    console.log(`\n🔥 ROOT CAUSE: Notification was never created!`);
    console.log(`\nThis means:`);
    console.log(`   1. Fund release didn't complete successfully, OR`);
    console.log(`   2. Notification creation failed after fund release`);
    console.log(`\nCheck document service logs for fund release errors.`);
  } else {
    const data = notification.data as any;
    console.log(`✅ Notification found:`);
    console.log(`   Notification ID: ${notification.id}`);
    console.log(`   Created: ${notification.createdAt.toISOString()}`);
    console.log(`   Read: ${notification.read ? 'YES' : 'NO'}`);
    console.log(`   Title: ${notification.title}`);
    console.log(`   Message: ${notification.message}`);
    console.log(`\n   Data:`);
    console.log(`     Auction ID: ${data?.auctionId || 'N/A'}`);
    console.log(`     Payment ID: ${data?.paymentId || 'N/A'}`);
    console.log(`     Pickup Code: ${data?.pickupAuthCode || 'N/A'}`);
    console.log(`     Pickup Location: ${data?.pickupLocation || 'N/A'}`);
    console.log(`     Pickup Deadline: ${data?.pickupDeadline || 'N/A'}`);

    if (data?.auctionId !== auctionId) {
      console.log(`\n⚠️  ISSUE: Notification is for different auction!`);
      console.log(`   Expected: ${auctionId}`);
      console.log(`   Got: ${data?.auctionId}`);
    } else {
      console.log(`\n   ✓ Notification is for correct auction`);
    }

    if (!data?.paymentId) {
      console.log(`\n⚠️  ISSUE: No paymentId in notification data!`);
      console.log(`   Modal needs paymentId to work properly.`);
    } else {
      console.log(`   ✓ Payment ID present in notification`);
    }

    if (!data?.pickupAuthCode) {
      console.log(`\n⚠️  ISSUE: No pickup code in notification data!`);
      console.log(`   Modal needs pickup code to display.`);
    } else {
      console.log(`   ✓ Pickup code present in notification`);
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Step 5: Check localStorage (simulated)
  console.log(`STEP 5: Checking localStorage blockers...`);
  console.log(`\nThe modal checks localStorage for:`);
  if (payment) {
    console.log(`   1. payment-visited-${payment.id}`);
    console.log(`   2. payment-unlocked-modal-${payment.id}-dismissed`);
  } else {
    console.log(`   (Cannot check - no payment ID)`);
  }
  console.log(`\nIf either exists, modal won't show.`);
  console.log(`To test: Open browser console and run:`);
  if (payment) {
    console.log(`   localStorage.removeItem('payment-visited-${payment.id}')`);
    console.log(`   localStorage.removeItem('payment-unlocked-modal-${payment.id}-dismissed')`);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  // Summary
  console.log(`SUMMARY:\n`);
  
  const issues: string[] = [];
  const checks: string[] = [];

  if (auction.status !== 'awaiting_payment') {
    issues.push(`Auction status is "${auction.status}" (needs "awaiting_payment")`);
  } else {
    checks.push(`✓ Auction status is correct`);
  }

  if (!payment) {
    issues.push(`No payment record found`);
  } else if (payment.status !== 'verified') {
    issues.push(`Payment status is "${payment.status}" (needs "verified")`);
  } else {
    checks.push(`✓ Payment is verified`);
  }

  if (!notification) {
    issues.push(`No PAYMENT_UNLOCKED notification found`);
  } else {
    const data = notification.data as any;
    if (data?.auctionId !== auctionId) {
      issues.push(`Notification is for wrong auction`);
    } else if (!data?.paymentId) {
      issues.push(`Notification missing paymentId`);
    } else if (!data?.pickupAuthCode) {
      issues.push(`Notification missing pickup code`);
    } else {
      checks.push(`✓ Notification exists with correct data`);
    }
  }

  if (issues.length > 0) {
    console.log(`❌ ISSUES FOUND:\n`);
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
  }

  if (checks.length > 0) {
    console.log(`\n✅ PASSING CHECKS:\n`);
    checks.forEach(check => {
      console.log(`   ${check}`);
    });
  }

  if (issues.length === 0) {
    console.log(`\n🎉 ALL CHECKS PASSED!`);
    console.log(`\nThe modal SHOULD be showing. If it's not:`);
    console.log(`   1. Check browser console for errors`);
    console.log(`   2. Clear localStorage (see Step 5 above)`);
    console.log(`   3. Hard refresh the page (Ctrl+Shift+R)`);
    console.log(`   4. Check if polling is working (should see logs every 5 seconds)`);
  } else {
    console.log(`\n🔥 FIX THESE ISSUES TO MAKE MODAL APPEAR\n`);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

const auctionId = process.argv[2];

if (!auctionId) {
  console.error('Usage: npx tsx scripts/diagnose-modal-issue.ts <auctionId>');
  console.error('Example: npx tsx scripts/diagnose-modal-issue.ts 091f2626-...');
  process.exit(1);
}

diagnose(auctionId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
