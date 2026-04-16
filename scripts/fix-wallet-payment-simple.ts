/**
 * Fix Wallet Payment - Complete Version
 * 
 * Fixes the test auction that was paid via wallet but is missing:
 * 1. Transaction history entries (debit + fund release)
 * 2. Pickup authorization document and notifications
 * 3. Duplicate payment cleanup
 */

import { db } from '@/lib/db/drizzle';
import { payments, walletTransactions, auctions, auctionWinners, vendors, users, salvageCases, escrowWallets } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const AUCTION_ID = '8dbeba4b-6b2f-4f02-ba88-fd954e397a70';

async function main() {
  console.log('🔧 Fixing wallet payment for auction:', AUCTION_ID);
  console.log('');

  // Step 1: Get auction and payment details
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
  const remainingAmount = finalBid - depositAmount;

  console.log('📊 Payment Details:');
  console.log(`   - Final Bid: ₦${finalBid.toLocaleString()}`);
  console.log(`   - Deposit: ₦${depositAmount.toLocaleString()}`);
  console.log(`   - Remaining Paid: ₦${remainingAmount.toLocaleString()}`);
  console.log('');

  // Step 2: Delete duplicate pending payment
  const allPayments = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.auctionId, AUCTION_ID),
        eq(payments.vendorId, vendorId)
      )
    );

  const pendingPayments = allPayments.filter(p => p.status === 'pending');
  if (pendingPayments.length > 0) {
    console.log(`🗑️  Deleting ${pendingPayments.length} duplicate pending payment(s)...`);
    for (const p of pendingPayments) {
      await db.delete(payments).where(eq(payments.id, p.id));
      console.log(`   ✅ Deleted: ${p.id}`);
    }
    console.log('');
  }

  // Step 3: Get wallet ID for transaction history
  const [wallet] = await db
    .select()
    .from(escrowWallets)
    .where(eq(escrowWallets.vendorId, vendorId))
    .limit(1);

  if (!wallet) {
    console.error('❌ Wallet not found');
    process.exit(1);
  }

  console.log(`💳 Creating transaction history entries for wallet ${wallet.id}...`);
  
  // Get current wallet balance for balanceAfter
  const currentBalance = parseFloat(wallet.balance);
  
  // Debit for remaining amount paid from wallet
  await db.insert(walletTransactions).values({
    walletId: wallet.id,
    type: 'debit',
    amount: remainingAmount.toFixed(2),
    balanceAfter: currentBalance.toFixed(2), // Current balance (already deducted)
    description: `Payment for auction ${AUCTION_ID.substring(0, 8)} - Remaining amount`,
    reference: `WALLET_PAYMENT_${AUCTION_ID.substring(0, 8)}`,
  });
  console.log(`   ✅ Debit transaction: ₦${remainingAmount.toLocaleString()}`);

  // Fund release transaction (debit for deposit amount)
  await db.insert(walletTransactions).values({
    walletId: wallet.id,
    type: 'debit',
    amount: depositAmount.toFixed(2),
    balanceAfter: currentBalance.toFixed(2), // Current balance (already deducted)
    description: `Funds released for auction ${AUCTION_ID.substring(0, 8)} - Transferred to NEM Insurance`,
    reference: `TRANSFER_${AUCTION_ID.substring(0, 8)}_${Date.now()}`,
  });
  console.log(`   ✅ Fund release transaction: ₦${depositAmount.toLocaleString()}`);

  // Unfreeze transaction (for audit trail)
  await db.insert(walletTransactions).values({
    walletId: wallet.id,
    type: 'unfreeze',
    amount: depositAmount.toFixed(2),
    balanceAfter: currentBalance.toFixed(2),
    description: `Funds unfrozen for auction ${AUCTION_ID.substring(0, 8)} - Part of atomic release`,
    reference: `UNFREEZE_${AUCTION_ID}`,
  });
  console.log(`   ✅ Unfreeze transaction: ₦${depositAmount.toLocaleString()}`);
  console.log('');

  // Step 4: Generate pickup authorization
  console.log(`🎫 Generating pickup authorization...`);
  
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, vendor!.userId))
    .limit(1);

  const pickupAuthCode = `AUTH-${AUCTION_ID.substring(0, 8).toUpperCase()}`;
  
  // Generate document
  const { generateDocument } = await import('@/features/documents/services/document.service');
  
  try {
    const doc = await generateDocument(
      AUCTION_ID,
      vendorId,
      'pickup_authorization',
      'system'
    );
    console.log(`   ✅ Document generated: ${doc.id}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log(`   ℹ️  Document already exists`);
    } else {
      console.error('   ❌ Document error:', error);
    }
  }

  // Get auction details
  const [auctionDetails] = await db
    .select({
      assetName: salvageCases.assetType,
      locationName: salvageCases.locationName,
    })
    .from(auctions)
    .leftJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
    .where(eq(auctions.id, AUCTION_ID))
    .limit(1);

  const assetName = auctionDetails?.assetName || 'vehicle';
  const locationName = auctionDetails?.locationName || 'TBD';

  // Send notifications
  const { smsService } = await import('@/features/notifications/services/sms.service');
  const { emailService } = await import('@/features/notifications/services/email.service');
  const { createNotification } = await import('@/features/notifications/services/notification.service');

  if (user!.phone) {
    try {
      await smsService.sendSMS({
        to: user!.phone,
        message: `NEM Salvage: Payment confirmed! Pickup code: ${pickupAuthCode}. Location: ${locationName}. Deadline: 48 hours. Bring valid ID.`,
      });
      console.log(`   ✅ SMS sent to ${user!.phone}`);
    } catch (error) {
      console.error('   ❌ SMS error:', error);
    }
  }

  if (user!.email) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      await emailService.sendPaymentConfirmationEmail(user!.email, {
        vendorName: vendor!.businessName || 'Vendor',
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
      console.log(`   ✅ Email sent to ${user!.email}`);
    } catch (error) {
      console.error('   ❌ Email error:', error);
    }
  }

  try {
    await createNotification({
      userId: user!.id,
      type: 'payment_success',
      title: 'Pickup Authorization Ready',
      message: `Your pickup code is ${pickupAuthCode}. Collect ${assetName} within 48 hours.`,
      data: {
        auctionId: AUCTION_ID,
        pickupAuthCode,
        type: 'pickup_authorization',
      },
    });
    console.log(`   ✅ In-app notification created`);
  } catch (error) {
    console.error('   ❌ Notification error:', error);
  }

  console.log('');
  console.log('✅ Fix complete!');
  console.log('');
  console.log('📋 Summary:');
  console.log(`   - Duplicate payment deleted`);
  console.log(`   - Transaction history created`);
  console.log(`   - Pickup code: ${pickupAuthCode}`);
  console.log(`   - Notifications sent`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
