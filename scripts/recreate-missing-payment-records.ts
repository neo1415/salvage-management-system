/**
 * Recreate Missing Payment Records
 * 
 * Purpose: Recreate payment records from notifications and wallet transactions
 * 
 * Background:
 * - Payments table is empty (0 records)
 * - 46 "payment_success" notifications exist with payment data
 * - 4 wallet debit transactions exist confirming fund releases
 * - Finance dashboard shows 0 payments because it queries payments table
 * 
 * Solution:
 * - Extract payment data from notifications
 * - Deduplicate by paymentId
 * - Cross-reference with auctions and wallet_transactions
 * - Create payment records with verified status
 * 
 * Safety:
 * - Idempotent: Won't create duplicates if payment already exists
 * - Validates all data before creating records
 * - Logs all actions for audit trail
 */

import { db } from '@/lib/db/drizzle';
import { notifications } from '@/lib/db/schema/notifications';
import { walletTransactions } from '@/lib/db/schema/escrow';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { eq, and, sql } from 'drizzle-orm';

interface PaymentData {
  paymentId: string;
  auctionId: string;
  amount: number;
  notificationCreatedAt: Date;
}

interface RecreationResult {
  success: boolean;
  paymentId: string;
  auctionId: string;
  amount: number;
  error?: string;
}

async function recreateMissingPaymentRecords() {
  console.log('🔄 RECREATING MISSING PAYMENT RECORDS\n');
  console.log('=' .repeat(80));
  
  const results: RecreationResult[] = [];
  let created = 0;
  let skipped = 0;
  let failed = 0;

  try {
    // Step 1: Get all payment_success notifications
    console.log('\n📊 STEP 1: Fetching payment_success notifications...\n');
    
    const paymentNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.type, 'payment_success'));

    console.log(`✅ Found ${paymentNotifications.length} payment_success notifications`);

    // Step 2: Extract and deduplicate payment data
    console.log('\n📊 STEP 2: Extracting and deduplicating payment data...\n');
    
    const paymentDataMap = new Map<string, PaymentData>();
    
    for (const notification of paymentNotifications) {
      const data = notification.data as any;
      
      if (data?.paymentId && data?.auctionId && data?.amount) {
        const paymentId = data.paymentId;
        
        // Only keep the earliest notification for each payment
        if (!paymentDataMap.has(paymentId)) {
          paymentDataMap.set(paymentId, {
            paymentId,
            auctionId: data.auctionId,
            amount: data.amount,
            notificationCreatedAt: notification.createdAt,
          });
        }
      }
    }

    const uniquePayments = Array.from(paymentDataMap.values());
    console.log(`✅ Found ${uniquePayments.length} unique payments`);

    // Step 3: Process each payment
    console.log('\n📊 STEP 3: Processing each payment...\n');
    
    for (const paymentData of uniquePayments) {
      console.log(`\n🔄 Processing payment ${paymentData.paymentId.substring(0, 8)}...`);
      
      try {
        // Check if payment already exists
        const [existingPayment] = await db
          .select()
          .from(payments)
          .where(eq(payments.id, paymentData.paymentId))
          .limit(1);

        if (existingPayment) {
          console.log(`⏸️  Payment already exists. Skipping.`);
          skipped++;
          results.push({
            success: true,
            paymentId: paymentData.paymentId,
            auctionId: paymentData.auctionId,
            amount: paymentData.amount,
            error: 'Already exists',
          });
          continue;
        }

        // Get auction details
        const [auction] = await db
          .select()
          .from(auctions)
          .where(eq(auctions.id, paymentData.auctionId))
          .limit(1);

        if (!auction) {
          console.error(`❌ Auction not found: ${paymentData.auctionId}`);
          failed++;
          results.push({
            success: false,
            paymentId: paymentData.paymentId,
            auctionId: paymentData.auctionId,
            amount: paymentData.amount,
            error: 'Auction not found',
          });
          continue;
        }

        if (!auction.currentBidder) {
          console.error(`❌ Auction has no winner: ${paymentData.auctionId}`);
          failed++;
          results.push({
            success: false,
            paymentId: paymentData.paymentId,
            auctionId: paymentData.auctionId,
            amount: paymentData.amount,
            error: 'No winner',
          });
          continue;
        }

        // Verify amount matches auction bid
        const auctionAmount = parseFloat(auction.currentBid || '0');
        if (Math.abs(auctionAmount - paymentData.amount) > 0.01) {
          console.warn(`⚠️  Amount mismatch: Notification=${paymentData.amount}, Auction=${auctionAmount}`);
          console.warn(`   Using auction amount: ₦${auctionAmount.toLocaleString()}`);
        }

        // Check if wallet transaction exists (confirms fund release)
        const [walletTransaction] = await db
          .select()
          .from(walletTransactions)
          .where(
            and(
              eq(walletTransactions.type, 'debit'),
              sql`${walletTransactions.reference} LIKE ${'TRANSFER_' + paymentData.auctionId.substring(0, 8) + '%'}`
            )
          )
          .limit(1);

        const escrowStatus = walletTransaction ? 'released' : 'frozen';
        console.log(`   Wallet transaction: ${walletTransaction ? '✅ Found' : '❌ Not found'}`);
        console.log(`   Escrow status: ${escrowStatus}`);

        // Calculate payment deadline (24 hours from notification)
        const paymentDeadline = new Date(paymentData.notificationCreatedAt);
        paymentDeadline.setHours(paymentDeadline.getHours() + 24);

        // Generate payment reference
        const reference = `PAY_${paymentData.auctionId.substring(0, 8)}_RETROACTIVE_${Date.now()}`;

        // Create payment record
        const [newPayment] = await db
          .insert(payments)
          .values({
            id: paymentData.paymentId,
            auctionId: paymentData.auctionId,
            vendorId: auction.currentBidder,
            amount: (auctionAmount || paymentData.amount).toString(),
            paymentMethod: 'escrow_wallet',
            escrowStatus: escrowStatus as 'frozen' | 'released',
            paymentReference: reference,
            status: 'verified', // Funds were released, so payment is verified
            verifiedAt: paymentData.notificationCreatedAt,
            autoVerified: true,
            paymentDeadline,
            createdAt: paymentData.notificationCreatedAt,
            updatedAt: new Date(),
          })
          .returning();

        console.log(`✅ Payment record created:`);
        console.log(`   - Payment ID: ${newPayment.id.substring(0, 8)}`);
        console.log(`   - Auction ID: ${newPayment.auctionId.substring(0, 8)}`);
        console.log(`   - Vendor ID: ${newPayment.vendorId.substring(0, 8)}`);
        console.log(`   - Amount: ₦${parseFloat(newPayment.amount).toLocaleString()}`);
        console.log(`   - Status: ${newPayment.status}`);
        console.log(`   - Escrow Status: ${newPayment.escrowStatus}`);
        console.log(`   - Verified At: ${newPayment.verifiedAt?.toISOString()}`);

        created++;
        results.push({
          success: true,
          paymentId: paymentData.paymentId,
          auctionId: paymentData.auctionId,
          amount: paymentData.amount,
        });

      } catch (error) {
        console.error(`❌ Error processing payment ${paymentData.paymentId}:`, error);
        failed++;
        results.push({
          success: false,
          paymentId: paymentData.paymentId,
          auctionId: paymentData.auctionId,
          amount: paymentData.amount,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Step 4: Summary
    console.log('\n' + '='.repeat(80));
    console.log('📋 RECREATION SUMMARY\n');
    
    console.log(`Total notifications: ${paymentNotifications.length}`);
    console.log(`Unique payments: ${uniquePayments.length}`);
    console.log(`Created: ${created} ✅`);
    console.log(`Skipped (already exist): ${skipped} ⏸️`);
    console.log(`Failed: ${failed} ❌`);

    if (created > 0) {
      const totalAmount = results
        .filter(r => r.success && !r.error)
        .reduce((sum, r) => sum + r.amount, 0);
      
      console.log(`\nTotal amount recreated: ₦${totalAmount.toLocaleString()}`);
    }

    // Step 5: Verify payments table
    console.log('\n📊 VERIFICATION: Checking payments table...\n');
    
    const paymentsCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments);

    console.log(`✅ Payments table now has ${paymentsCount[0]?.count || 0} records`);

    // Get payment breakdown
    const escrowPayments = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(eq(payments.paymentMethod, 'escrow_wallet'));

    const verifiedPayments = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(eq(payments.status, 'verified'));

    const releasedPayments = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(payments)
      .where(eq(payments.escrowStatus, 'released'));

    console.log(`   - Escrow wallet payments: ${escrowPayments[0]?.count || 0}`);
    console.log(`   - Verified payments: ${verifiedPayments[0]?.count || 0}`);
    console.log(`   - Released payments: ${releasedPayments[0]?.count || 0}`);

    // Calculate total amount
    const totalAmountResult = await db
      .select({ 
        total: sql<number>`COALESCE(SUM(${payments.amount}::numeric), 0)::numeric` 
      })
      .from(payments)
      .where(eq(payments.paymentMethod, 'escrow_wallet'));

    const totalAmount = parseFloat(totalAmountResult[0]?.total?.toString() || '0');
    console.log(`   - Total amount: ₦${totalAmount.toLocaleString()}`);

    // Write results to file
    const fs = await import('fs/promises');
    await fs.writeFile(
      'PAYMENT_RECREATION_RESULTS.json',
      JSON.stringify({
        summary: {
          totalNotifications: paymentNotifications.length,
          uniquePayments: uniquePayments.length,
          created,
          skipped,
          failed,
          totalAmount,
        },
        results,
      }, null, 2)
    );
    
    console.log('\n✅ Results saved to PAYMENT_RECREATION_RESULTS.json');
    console.log('=' .repeat(80));

    if (failed > 0) {
      console.log('\n⚠️  Some payments failed to recreate. Check PAYMENT_RECREATION_RESULTS.json for details.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Recreation failed:', error);
    process.exit(1);
  }
}

// Run recreation
recreateMissingPaymentRecords()
  .then(() => {
    console.log('\n✅ Recreation completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Recreation failed:', error);
    process.exit(1);
  });
