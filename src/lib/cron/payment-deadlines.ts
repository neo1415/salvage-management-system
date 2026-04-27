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
  // Get grace extension duration from config (default 24 hours)
  const { configService } = await import('@/features/auction-deposit/services/config.service');
  const config = await configService.getConfig();
  const graceExtensionHours = config.graceExtensionDuration;
  
  // Send reminders 12 hours before grace extension expires
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
  // Get grace extension duration from config (default 24 hours)
  const { configService } = await import('@/features/auction-deposit/services/config.service');
  const config = await configService.getConfig();
  const graceExtensionHours = config.graceExtensionDuration;
  
  const graceExtensionMs = graceExtensionHours * 60 * 60 * 1000;
  const graceExtensionAgo = new Date(now.getTime() - graceExtensionMs);

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
          lte(payments.paymentDeadline, graceExtensionAgo)
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
  // Get payment deadline from config (default 72 hours)
  const { configService } = await import('@/features/auction-deposit/services/config.service');
  const config = await configService.getConfig();
  const paymentDeadlineHours = config.paymentDeadlineAfterSigning;
  
  const paymentDeadlineMs = paymentDeadlineHours * 60 * 60 * 1000;
  const paymentDeadlineAgo = new Date(now.getTime() - paymentDeadlineMs);

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
          lte(payments.paymentDeadline, paymentDeadlineAgo)
        )
      );

    for (const { payment, auction, vendor, user } of forfeitPayments) {
      try {
        // Mark auction as forfeited
        await db
          .update(auctions)
          .set({
            status: 'forfeited',
            updatedAt: now,
          })
          .where(eq(auctions.id, auction.id));

        // Disable documents for this auction
        const { releaseForms } = await import('@/lib/db/schema/release-forms');
        await db
          .update(releaseForms)
          .set({
            disabled: true,
            updatedAt: now,
          })
          .where(
            and(
              eq(releaseForms.auctionId, auction.id),
              eq(releaseForms.vendorId, vendor.id)
            )
          );

        // Update payment status to forfeited
        await db
          .update(payments)
          .set({
            status: 'forfeited',
            updatedAt: now,
          })
          .where(eq(payments.id, payment.id));

        // Send notification to vendor (NO suspension)
        await smsService.sendSMS({
          to: user.phone,
          message: `Auction forfeited after ${paymentDeadlineHours} hours. Your funds remain frozen. Contact support at ${process.env.SUPPORT_PHONE || '234-02-014489560'} if still interested.`,
        });

        await emailService.sendEmail({
          to: user.email,
          subject: 'Auction Forfeited - Contact Support',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">Auction Forfeited</h2>
              <p>Dear ${user.fullName},</p>
              <p>Your auction win for auction #${auction.id} has been forfeited after ${paymentDeadlineHours} hours without payment completion.</p>
              
              <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #991b1b;">What This Means</h3>
                <p><strong>Amount:</strong> ₦${parseFloat(payment.amount).toLocaleString()}</p>
                <p><strong>Status:</strong> Forfeited</p>
                <p><strong>Funds:</strong> Frozen in your wallet</p>
                <p><strong>Documents:</strong> Disabled</p>
              </div>

              <h3>Next Steps</h3>
              <p>If you are still interested in this item, please contact our support team immediately:</p>
              <ul>
                <li>Phone: ${process.env.SUPPORT_PHONE || '234-02-014489560'}</li>
                <li>Email: ${process.env.SUPPORT_EMAIL || 'nemsupport@nem-insurance.com'}</li>
              </ul>
              
              <p>A Finance Officer will review your case and may grant a grace period to restore document access.</p>

              <p style="margin-top: 30px;">Best regards,<br><strong>NEM Insurance Team</strong></p>
            </div>
          `,
        });

        // Alert Finance Officers for manual review
        await alertFinanceOfficersForForfeiture(payment, auction, vendor, user);

        results.winnersForfeited++;
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

/**
 * Alert Finance Officers when an auction is forfeited
 */
async function alertFinanceOfficersForForfeiture(
  payment: typeof payments.$inferSelect,
  auction: typeof auctions.$inferSelect,
  vendor: typeof vendors.$inferSelect,
  user: typeof users.$inferSelect
): Promise<void> {
  try {
    // Get Finance Officer users
    const financeOfficers = await db
      .select()
      .from(users)
      .where(eq(users.role, 'finance_officer'))
      .limit(5);

    if (financeOfficers.length === 0) {
      console.warn('⚠️  No Finance Officers found for forfeiture alert');
      return;
    }

    for (const officer of financeOfficers) {
      await emailService.sendEmail({
        to: officer.email,
        subject: `🚨 Auction Forfeited - Manual Review Required - ${auction.id.substring(0, 8)}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Auction Forfeited - Manual Review Required</h2>
            <p>Dear ${officer.fullName},</p>
            <p>An auction has been automatically forfeited after 72 hours without payment completion.</p>
            
            <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #991b1b;">Forfeiture Details</h3>
              <p><strong>Auction ID:</strong> ${auction.id}</p>
              <p><strong>Payment ID:</strong> ${payment.id}</p>
              <p><strong>Amount:</strong> ₦${parseFloat(payment.amount).toLocaleString()}</p>
              <p><strong>Vendor:</strong> ${user.fullName} (${user.email})</p>
              <p><strong>Vendor Phone:</strong> ${user.phone}</p>
              <p><strong>Forfeited At:</strong> ${new Date().toLocaleString('en-NG')}</p>
            </div>

            <h3>Actions Taken</h3>
            <ul>
              <li>Auction status changed to 'forfeited'</li>
              <li>Documents disabled (cannot be signed)</li>
              <li>Funds remain frozen in vendor wallet</li>
              <li>Vendor notified to contact support</li>
              <li>NO account suspension applied</li>
              <li>Forfeited after ${paymentDeadlineHours} hours without payment</li>
            </ul>

            <h3>Manual Review Required</h3>
            <p>Please review this case and decide:</p>
            <ol>
              <li>Grant grace period to restore documents (if vendor contacts support)</li>
              <li>Unfreeze funds and re-list item for auction</li>
              <li>Other action as appropriate</li>
            </ol>

            <p style="margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com'}/finance/payments" 
                 style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Review Payment
              </a>
            </p>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated alert from the NEM Salvage Management System.
            </p>
          </div>
        `,
      });
    }

    console.log(`✅ Forfeiture alerts sent to ${financeOfficers.length} Finance Officers`);
  } catch (error) {
    console.error('❌ Error sending forfeiture alerts:', error);
    // Don't throw - best effort
  }
}
