/**
 * Payment Deadline Enforcement Cron Job
 * 
 * Validates: Requirements 29.1, 30.2-30.8
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { auctions } from '@/lib/db/schema/auctions';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq, and, lte, gte } from 'drizzle-orm';
import { smsService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';

export interface EnforcementResults {
  remindersSent: number;
  paymentsMarkedOverdue: number;
  winnersForfeited: number;
  vendorsSuspended: number;
  errors: string[];
}

export async function enforcePaymentDeadlines(): Promise<EnforcementResults> {
  const now = new Date();
  const results: EnforcementResults = {
    remindersSent: 0,
    paymentsMarkedOverdue: 0,
    winnersForfeited: 0,
    vendorsSuspended: 0,
    errors: [],
  };

  try {
    await sendPaymentReminders(now, results);
    await markPaymentsOverdue(now, results);
    await forfeitAuctionWinners(now, results);

    console.log('Payment deadline enforcement completed:', results);
    return results;
  } catch (error) {
    console.error('Error in payment deadline enforcement:', error);
    results.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return results;
  }
}

async function sendPaymentReminders(now: Date, results: EnforcementResults) {
  const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const elevenHoursFromNow = new Date(now.getTime() + 11 * 60 * 60 * 1000);

  try {
    const pendingPayments = await db
      .select({
        payment: payments,
        auction: auctions,
        vendor: vendors,
        user: users,
      })
      .from(payments)
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(vendors, eq(payments.vendorId, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(
        and(
          eq(payments.status, 'pending'),
          gte(payments.paymentDeadline, elevenHoursFromNow),
          lte(payments.paymentDeadline, twelveHoursFromNow)
        )
      );

    for (const { payment, auction, vendor: _vendor, user } of pendingPayments) {
      try {
        await smsService.sendSMS({
          to: user.phone,
          message: `Payment reminder: Your payment of ₦${payment.amount} for auction #${auction.id} is due in 12 hours.`,
        });

        await emailService.sendEmail({
          to: user.email,
          subject: 'Payment Deadline Reminder',
          html: `<p>Your payment for auction #${auction.id} is due in 12 hours. Amount: ₦${payment.amount}</p>`,
        });

        results.remindersSent++;
      } catch (error) {
        console.error(`Error sending reminder for payment ${payment.id}:`, error);
        results.errors.push(`Reminder failed for payment ${payment.id}`);
      }
    }
  } catch (error) {
    console.error('Error in sendPaymentReminders:', error);
    results.errors.push('Failed to send payment reminders');
  }
}

async function markPaymentsOverdue(now: Date, results: EnforcementResults) {
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    const overduePayments = await db
      .select({
        payment: payments,
        auction: auctions,
        vendor: vendors,
        user: users,
      })
      .from(payments)
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(vendors, eq(payments.vendorId, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(
        and(
          eq(payments.status, 'pending'),
          lte(payments.paymentDeadline, twentyFourHoursAgo)
        )
      );

    for (const { payment, auction, vendor: _vendor, user } of overduePayments) {
      try {
        await db
          .update(payments)
          .set({ 
            status: 'overdue',
            updatedAt: now,
          })
          .where(eq(payments.id, payment.id));

        await smsService.sendSMS({
          to: user.phone,
          message: `OVERDUE: Your payment of ₦${payment.amount} for auction #${auction.id} is now overdue.`,
        });

        await emailService.sendEmail({
          to: user.email,
          subject: 'URGENT: Payment Overdue',
          html: `<p>Your payment is now overdue. Amount: ₦${payment.amount}</p>`,
        });

        results.paymentsMarkedOverdue++;
      } catch (error) {
        console.error(`Error marking payment ${payment.id} as overdue:`, error);
        results.errors.push(`Failed to mark payment ${payment.id} as overdue`);
      }
    }
  } catch (error) {
    console.error('Error in markPaymentsOverdue:', error);
    results.errors.push('Failed to mark payments as overdue');
  }
}

async function forfeitAuctionWinners(now: Date, results: EnforcementResults) {
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  try {
    const forfeitPayments = await db
      .select({
        payment: payments,
        auction: auctions,
        vendor: vendors,
        user: users,
      })
      .from(payments)
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(vendors, eq(payments.vendorId, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .where(
        and(
          eq(payments.status, 'overdue'),
          lte(payments.paymentDeadline, fortyEightHoursAgo)
        )
      );

    for (const { payment, auction, vendor, user } of forfeitPayments) {
      try {
        const suspensionEndDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        await db
          .update(vendors)
          .set({ 
            status: 'suspended',
            updatedAt: now,
          })
          .where(eq(vendors.id, vendor.id));

        await smsService.sendSMS({
          to: user.phone,
          message: `FORFEITED: Your auction win #${auction.id} has been forfeited. Account suspended for 7 days.`,
        });

        await emailService.sendEmail({
          to: user.email,
          subject: 'Auction Forfeited - Account Suspended',
          html: `<p>Your auction win has been forfeited. Account suspended until ${suspensionEndDate.toLocaleString()}.</p>`,
        });

        results.winnersForfeited++;
        results.vendorsSuspended++;
      } catch (error) {
        console.error(`Error forfeiting payment ${payment.id}:`, error);
        results.errors.push(`Failed to forfeit payment ${payment.id}`);
      }
    }
  } catch (error) {
    console.error('Error in forfeitAuctionWinners:', error);
    results.errors.push('Failed to forfeit auction winners');
  }
}
