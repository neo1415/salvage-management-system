/**
 * Investigation Script: Payment Data Location
 * 
 * Purpose: Find where the actual payment data is stored
 * 
 * User Report:
 * - Finance dashboard shows 0 payments
 * - BUT 10+ "Escrow Payment Released" notifications exist with amounts
 * - Payments table is empty (0 records)
 * - Total: ₦1,720,000 across 10 auctions
 * 
 * Investigation Steps:
 * 1. Check notifications table for payment data
 * 2. Check wallet_transactions table for escrow payments
 * 3. Check auctions table for payment-related fields
 * 4. Check if payments were deleted or never created
 * 5. Identify the source of truth for payment data
 */

import { db } from '@/lib/db/drizzle';
import { notifications } from '@/lib/db/schema/notifications';
import { walletTransactions, escrowWallets } from '@/lib/db/schema/escrow';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, and, sql, desc } from 'drizzle-orm';

interface InvestigationResult {
  section: string;
  findings: string[];
  data?: any[];
}

async function investigatePaymentDataLocation() {
  console.log('🔍 INVESTIGATION: Payment Data Location\n');
  console.log('=' .repeat(80));
  
  const results: InvestigationResult[] = [];

  // 1. Check payments table
  console.log('\n📊 STEP 1: Checking payments table...\n');
  const paymentsCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(payments);
  
  const allPayments = await db
    .select()
    .from(payments)
    .orderBy(desc(payments.createdAt))
    .limit(20);

  results.push({
    section: 'Payments Table',
    findings: [
      `Total records: ${paymentsCount[0]?.count || 0}`,
      `Sample records: ${allPayments.length}`,
    ],
    data: allPayments.map(p => ({
      id: p.id,
      auctionId: p.auctionId,
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      status: p.status,
      escrowStatus: p.escrowStatus,
      createdAt: p.createdAt,
    })),
  });

  console.log(`✅ Payments table: ${paymentsCount[0]?.count || 0} records`);
  if (allPayments.length > 0) {
    console.log('Sample payments:');
    allPayments.slice(0, 5).forEach(p => {
      console.log(`  - ${p.id.substring(0, 8)}: ₦${p.amount} (${p.paymentMethod}, ${p.status})`);
    });
  }

  // 2. Check notifications for payment data
  console.log('\n📊 STEP 2: Checking notifications for "Escrow Payment Released"...\n');
  
  const escrowNotifications = await db
    .select()
    .from(notifications)
    .where(eq(notifications.type, 'payment_success'))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  console.log(`✅ Found ${escrowNotifications.length} "payment_success" notifications`);
  
  const notificationPaymentData = escrowNotifications.map(n => {
    const data = n.data as any;
    return {
      id: n.id,
      userId: n.userId,
      title: n.title,
      message: n.message,
      auctionId: data?.auctionId,
      paymentId: data?.paymentId,
      amount: data?.amount,
      createdAt: n.createdAt,
    };
  });

  results.push({
    section: 'Notifications (payment_success)',
    findings: [
      `Total notifications: ${escrowNotifications.length}`,
      `Notifications with payment data: ${notificationPaymentData.filter(n => n.paymentId).length}`,
      `Total amount from notifications: ₦${notificationPaymentData.reduce((sum, n) => sum + (n.amount || 0), 0).toLocaleString()}`,
    ],
    data: notificationPaymentData,
  });

  if (notificationPaymentData.length > 0) {
    console.log('\nNotification payment data:');
    notificationPaymentData.slice(0, 10).forEach(n => {
      console.log(`  - Auction: ${n.auctionId?.substring(0, 8)}, Payment: ${n.paymentId?.substring(0, 8)}, Amount: ₦${n.amount?.toLocaleString()}`);
    });
  }

  // 3. Check wallet_transactions for escrow payments
  console.log('\n📊 STEP 3: Checking wallet_transactions for escrow payments...\n');
  
  const debitTransactions = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.type, 'debit'))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(50);

  console.log(`✅ Found ${debitTransactions.length} debit transactions`);
  
  const debitData = debitTransactions.map(t => ({
    id: t.id,
    walletId: t.walletId,
    amount: t.amount,
    reference: t.reference,
    description: t.description,
    createdAt: t.createdAt,
  }));

  results.push({
    section: 'Wallet Transactions (debit)',
    findings: [
      `Total debit transactions: ${debitTransactions.length}`,
      `Total amount debited: ₦${debitTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0).toLocaleString()}`,
    ],
    data: debitData,
  });

  if (debitData.length > 0) {
    console.log('\nDebit transactions:');
    debitData.slice(0, 10).forEach(t => {
      console.log(`  - ${t.reference}: ₦${parseFloat(t.amount).toLocaleString()} - ${t.description}`);
    });
  }

  // 4. Check auctions table for payment-related data
  console.log('\n📊 STEP 4: Checking auctions table for closed/sold auctions...\n');
  
  const closedAuctions = await db
    .select()
    .from(auctions)
    .where(eq(auctions.status, 'closed'))
    .orderBy(desc(auctions.updatedAt))
    .limit(50);

  console.log(`✅ Found ${closedAuctions.length} closed auctions`);
  
  const auctionData = closedAuctions.map(a => ({
    id: a.id,
    currentBid: a.currentBid,
    currentBidder: a.currentBidder,
    status: a.status,
    pickupConfirmedVendor: a.pickupConfirmedVendor,
    pickupConfirmedAdmin: a.pickupConfirmedAdmin,
    updatedAt: a.updatedAt,
  }));

  results.push({
    section: 'Auctions (closed)',
    findings: [
      `Total closed auctions: ${closedAuctions.length}`,
      `Auctions with pickup confirmed: ${closedAuctions.filter(a => a.pickupConfirmedVendor && a.pickupConfirmedAdmin).length}`,
    ],
    data: auctionData,
  });

  if (auctionData.length > 0) {
    console.log('\nClosed auctions:');
    auctionData.slice(0, 10).forEach(a => {
      console.log(`  - ${a.id.substring(0, 8)}: ₦${a.currentBid} (Pickup: V=${a.pickupConfirmedVendor}, A=${a.pickupConfirmedAdmin})`);
    });
  }

  // 5. Cross-reference: Find auctions mentioned in notifications but missing from payments
  console.log('\n📊 STEP 5: Cross-referencing data...\n');
  
  const auctionIdsFromNotifications = notificationPaymentData
    .filter(n => n.auctionId)
    .map(n => n.auctionId!);

  const paymentIdsFromNotifications = notificationPaymentData
    .filter(n => n.paymentId)
    .map(n => n.paymentId!);

  console.log(`Auction IDs from notifications: ${auctionIdsFromNotifications.length}`);
  console.log(`Payment IDs from notifications: ${paymentIdsFromNotifications.length}`);

  // Check if these payment IDs exist in payments table
  if (paymentIdsFromNotifications.length > 0) {
    const existingPayments = await db
      .select()
      .from(payments)
      .where(sql`${payments.id} = ANY(${paymentIdsFromNotifications})`);

    console.log(`\n❗ Payment IDs from notifications that exist in payments table: ${existingPayments.length}`);
    console.log(`❗ Payment IDs from notifications that are MISSING: ${paymentIdsFromNotifications.length - existingPayments.length}`);

    results.push({
      section: 'Cross-Reference Analysis',
      findings: [
        `Notifications reference ${paymentIdsFromNotifications.length} payment IDs`,
        `${existingPayments.length} of these payments exist in payments table`,
        `${paymentIdsFromNotifications.length - existingPayments.length} payments are MISSING from payments table`,
        `Missing payment IDs: ${paymentIdsFromNotifications.filter(id => !existingPayments.find(p => p.id === id)).join(', ')}`,
      ],
    });
  }

  // 6. Check specific auction IDs mentioned in user report
  console.log('\n📊 STEP 6: Checking specific auctions from user report...\n');
  
  const reportedAuctionIds = [
    '795d7412', '2474b8f4', '42713765', '59b36e29', '44032670', '185c0657', '112ba03e',
    'cc350b7c', '6fac712e', 'ebe0b7e6'
  ];

  console.log('Checking auctions from user report:');
  for (const shortId of reportedAuctionIds) {
    // Find auction by partial ID
    const auction = await db
      .select()
      .from(auctions)
      .where(sql`${auctions.id}::text LIKE ${shortId + '%'}`)
      .limit(1);

    if (auction.length > 0) {
      const auctionId = auction[0].id;
      
      // Check if payment exists
      const payment = await db
        .select()
        .from(payments)
        .where(eq(payments.auctionId, auctionId))
        .limit(1);

      // Check if notification exists
      const notification = await db
        .select()
        .from(notifications)
        .where(sql`${notifications.data}->>'auctionId' = ${auctionId}`)
        .limit(1);

      console.log(`  - ${shortId}: Auction=${auction.length > 0 ? '✅' : '❌'}, Payment=${payment.length > 0 ? '✅' : '❌'}, Notification=${notification.length > 0 ? '✅' : '❌'}`);
    } else {
      console.log(`  - ${shortId}: Auction not found`);
    }
  }

  // 7. Summary and recommendations
  console.log('\n' + '='.repeat(80));
  console.log('📋 INVESTIGATION SUMMARY\n');
  
  console.log('KEY FINDINGS:');
  console.log(`1. Payments table has ${paymentsCount[0]?.count || 0} records`);
  console.log(`2. ${escrowNotifications.length} "Escrow Payment Released" notifications exist`);
  console.log(`3. ${debitTransactions.length} wallet debit transactions exist`);
  console.log(`4. ${closedAuctions.length} closed auctions exist`);
  
  if (paymentIdsFromNotifications.length > 0) {
    const missingCount = paymentIdsFromNotifications.length - (await db.select().from(payments).where(sql`${payments.id} = ANY(${paymentIdsFromNotifications})`)).length;
    console.log(`5. ${missingCount} payments referenced in notifications are MISSING from payments table`);
  }

  console.log('\n💡 RECOMMENDATIONS:');
  
  if (paymentsCount[0]?.count === 0 && escrowNotifications.length > 0) {
    console.log('❗ CRITICAL: Payments table is empty but notifications exist!');
    console.log('   → Payments were likely deleted or never created');
    console.log('   → Need to recreate payment records from notifications and wallet transactions');
  } else if (paymentIdsFromNotifications.length > 0) {
    const existingPayments = await db.select().from(payments).where(sql`${payments.id} = ANY(${paymentIdsFromNotifications})`);
    if (existingPayments.length < paymentIdsFromNotifications.length) {
      console.log('❗ ISSUE: Some payments referenced in notifications are missing');
      console.log('   → Need to investigate why payments were deleted');
      console.log('   → Consider recreating missing payment records');
    }
  }

  console.log('\n📊 DATA SOURCES:');
  console.log('1. Notifications table: Contains payment metadata (auctionId, paymentId, amount)');
  console.log('2. Wallet transactions: Contains actual money movement (debit records)');
  console.log('3. Auctions table: Contains bid amounts and pickup confirmation status');
  console.log('4. Payments table: SHOULD be the source of truth but may be incomplete');

  // Write results to file
  const fs = await import('fs/promises');
  await fs.writeFile(
    'PAYMENT_DATA_LOCATION_INVESTIGATION.json',
    JSON.stringify(results, null, 2)
  );
  
  console.log('\n✅ Investigation complete! Results saved to PAYMENT_DATA_LOCATION_INVESTIGATION.json');
  console.log('=' .repeat(80));
}

// Run investigation
investigatePaymentDataLocation()
  .then(() => {
    console.log('\n✅ Investigation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Investigation failed:', error);
    process.exit(1);
  });
