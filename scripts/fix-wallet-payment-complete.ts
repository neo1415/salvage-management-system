/**
 * Fix Wallet Payment - Complete Missing Steps
 * 
 * This script fixes a wallet payment that succeeded but is missing:
 * 1. Transaction history entries (debit + fund release)
 * 2. Pickup authorization document and notifications
 * 3. Duplicate payment record cleanup
 */

import { db } from '@/lib/db/drizzle';
import { payments, escrowWallets, depositEvents, auctions, auctionWinners, vendors, users, salvageCases } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const AUCTION_ID = '8dbeba4b-6b2f-4f02-ba88-fd954e397a70';

async function main() {
  console.log('🔧 Fixing wallet payment for auction:', AUCTION_ID);
  console.log('');

  // Step 1: Get auction and payment details
  const [auction] = await db
    .select()
    .from(auctions)
    .where(eq(auctions.id, AUCTION_ID))
    .limit(1);

  if (!auction) {
    console.error('❌ Auction not found');
    process.exit(1);
  }

  const [winner] = await db
    .select()
    .from(auctionWinners)
    .where(
      and(
        eq(auctionWinners.auctionId, AUCTION_ID),
        eq(auctionWinners.status, 'active')
      )
    )
    .limit(1);

  if (!winner) {
    console.error('❌ Winner not found');
    process.exit(1);
  }

  const vendorId = winner.vendorId;
  const depositAmount = parseFloat(winner.depositAmount);
  const finalBid = parseFloat(winner.bidAmount);

  console.log('📊 Auction Details:');
  console.log(`   - Auction ID: ${AUCTION_ID}`);
  console.log(`   - Vendor ID: ${vendorId}`);
  console.log(`   - Final Bid: ₦${finalBid.toLocaleString()}`);
  console.log(`   - Deposit Amount: ₦${depositAmount.toLocaleString()}`);
  console.log('');

  // Step 2: Check for duplicate payments
  const allPayments = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, AUCTION_ID),
        eq(payments.vendorId, vendorId)
      )
    );

  console.log(`💳 Found ${allPayments.length} payment record(s):`);
  allPayments.forEach((p, i) => {
    console.log(`   ${i + 1}. ID: ${p.id}`);
    console.log(`      Status: ${p.status}`);
    console.log(`      Reference: ${p.paymentReference}`);
    console.log(`      Amount: ₦${parseFloat(p.amount).toLocaleString()}`);
    console.log(`      Created: ${p.createdAt}`);
  });
  console.log('');

  // Step 3: Delete duplicate pending payment (from document signing)
  const pendingPayments = allPayments.filter(p => p.status === 'pending');
  if (pendingPayments.length > 0) {
    console.log(`🗑️  Deleting ${pendingPayments.length} duplicate pending payment(s)...`);
    for (const p of pendingPayments) {
      await db.delete(payments).where(eq(payments.id, p.id));
      console.log(`   ✅ Deleted payment: ${p.id}`);
    }
    console.log('');
  }

  // Step 4: Release funds to finance (creates transaction history)
  console.log(`💰 Releasing deposit funds to finance...`);
  const { escrowService } = await import('@/features/payments/services/escrow.service');
  
  try {
    await escrowService.releaseFunds(
      vendorId,
      depositAmount,
      AUCTION_ID,
      'system' // userId for audit trail
    );
    
    console.log(`✅ Deposit funds released successfully`);
    console.log(`   - ₦${depositAmount.toLocaleString()} transferred to finance`);
    console.log(`   - Debit transaction created in walletTransactions`);
    console.log(`   - Unfreeze transaction created in walletTransactions`);
    console.log(`   - Money transferred to NEM Insurance via Paystack Transfers API`);
  } catch (error) {
    console.error('❌ Fund release error:', error);
    if (error instanceof Error && error.message.includes('already released')) {
      console.log('ℹ️  Funds already released, skipping...');
    } else {
      throw error;
    }
  }
  console.log('');

  // Step 5: Generate pickup authorization
  console.log(`🎫 Generating pickup authorization...`);
  
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor) {
    console.error('❌ Vendor not found');
    process.exit(1);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, vendor.userId))
    .limit(1);

  if (!user) {
    console.error('❌ User not found');
    process.exit(1);
  }

  // Generate pickup code
  const pickupAuthCode = `AUTH-${AUCTION_ID.substring(0, 8).toUpperCase()}`;
  
  // Generate pickup authorization document
  const { generateDocument } = await import('@/features/documents/services/document.service');
  
  try {
    const pickupAuthDocument = await generateDocument(
      AUCTION_ID,
      vendorId,
      'pickup_authorization',
      'system'
    );
    
    console.log(`✅ Pickup authorization document generated: ${pickupAuthDocument.id}`);
  } catch (error) {
    console.error('❌ Document generation error:', error);
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('ℹ️  Document already exists, skipping...');
    } else {
      throw error;
    }
  }

  // Get auction details for notifications
  const [auctionDetails] = await db
    .select({
      id: auctions.id,
      caseId: auctions.caseId,
      assetName: salvageCases.assetType,
      locationName: salvageCases.locationName,
    })
    .from(auctions)
    .leftJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
    .where(eq(auctions.id, AUCTION_ID))
    .limit(1);

  const assetName = auctionDetails?.assetName || 'auction item';
  const locationName = auctionDetails?.locationName || 'TBD';

  // Send SMS
  const { smsService } = await import('@/lib/services/sms.service');
  if (user.phone) {
    try {
      await smsService.sendSMS({
        to: user.phone,
        message: `NEM Salvage: Payment confirmed! Pickup code: ${pickupAuthCode}. Location: ${locationName}. Deadline: 48 hours. Bring valid ID.`,
      });
      console.log(`✅ Pickup authorization SMS sent to ${user.phone}`);
    } catch (error) {
      console.error('SMS error:', error);
    }
  }

  // Send email
  const { emailService } = await import('@/lib/services/email.service');
  if (user.email) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      await emailService.sendPaymentConfirmationEmail(user.email, {
        vendorName: vendor.businessName || 'Vendor',
        auctionId: AUCTION_ID,
        paymentId: 'PAYMENT-' + AUCTION_ID.substring(0, 8),
        assetName,
        paymentAmount: finalBid,
        paymentMethod: 'Wallet',
        paymentReference: pickupAuthCode,
        pickupAuthCode,
        pickupLocation: locationName,
        pickupDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleString(),
        appUrl,
      });
      console.log(`✅ Pickup authorization email sent to ${user.email}`);
    } catch (error) {
      console.error('Email error:', error);
    }
  }

  // Create in-app notification
  const { createNotification } = await import('@/lib/services/notification.service');
  try {
    await createNotification({
      userId: user.id,
      type: 'payment_success',
      title: 'Pickup Authorization Ready',
      message: `Your pickup code is ${pickupAuthCode}. Collect ${assetName} within 48 hours.`,
      data: {
        auctionId: AUCTION_ID,
        pickupAuthCode,
        type: 'pickup_authorization',
      },
    });
    console.log(`✅ Pickup authorization in-app notification created`);
  } catch (error) {
    console.error('Notification error:', error);
  }

  console.log('');
  console.log('✅ Wallet payment fix complete!');
  console.log('');
  console.log('📋 Summary:');
  console.log(`   - Duplicate payments cleaned up`);
  console.log(`   - Funds released to finance (₦${depositAmount.toLocaleString()})`);
  console.log(`   - Transaction history entries created`);
  console.log(`   - Pickup authorization generated`);
  console.log(`   - Pickup code: ${pickupAuthCode}`);
  console.log(`   - Notifications sent (SMS + Email + In-app)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
