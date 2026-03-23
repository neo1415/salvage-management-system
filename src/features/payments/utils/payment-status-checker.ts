/**
 * Payment Status Checker Utility
 * 
 * Centralized function to check if payment has been processed for an auction.
 * Used by retroactive payment processing to prevent duplicate processing.
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { notifications } from '@/lib/db/schema/notifications';
import { eq, and } from 'drizzle-orm';

/**
 * Check if payment has been processed for an auction
 * 
 * Returns true if ANY of the following are true:
 * 1. PAYMENT_UNLOCKED notification exists
 * 2. Payment status is 'verified'
 * 3. Escrow status is 'released'
 * 
 * @param auctionId - The auction ID to check
 * @param vendorId - The vendor ID to check
 * @returns Promise<boolean> - True if payment has been processed
 */
export async function checkPaymentProcessed(
  auctionId: string,
  vendorId: string
): Promise<boolean> {
  try {
    console.log(`🔍 Checking payment status for auction ${auctionId}, vendor ${vendorId}...`);

    // Check 1: Get payment record
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.auctionId, auctionId),
          eq(payments.vendorId, vendorId),
          eq(payments.paymentMethod, 'escrow_wallet')
        )
      )
      .limit(1);

    if (!payment) {
      console.log(`⚠️  No payment record found for auction ${auctionId}`);
      return false;
    }

    // Check 2: Payment status is 'verified'
    if (payment.status === 'verified') {
      console.log(`✅ Payment already verified for auction ${auctionId}`);
      return true;
    }

    // Check 3: Escrow status is 'released'
    if (payment.escrowStatus === 'released') {
      console.log(`✅ Escrow funds already released for auction ${auctionId}`);
      return true;
    }

    // Check 4: PAYMENT_UNLOCKED notification exists
    const [notification] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.type, 'PAYMENT_UNLOCKED')
        )
      )
      .limit(1);

    // Check if notification data matches this auction
    if (notification) {
      const notificationData = notification.data as { auctionId?: string; paymentId?: string };
      if (notificationData?.auctionId === auctionId || notificationData?.paymentId === payment.id) {
        console.log(`✅ PAYMENT_UNLOCKED notification already exists for auction ${auctionId}`);
        return true;
      }
    }

    console.log(`⏸️  Payment not yet processed for auction ${auctionId}`);
    return false;
  } catch (error) {
    console.error('Error checking payment status:', error);
    // Return true on error to prevent duplicate processing attempts
    return true;
  }
}
