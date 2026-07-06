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
import { brandTeamName, getEmailBranding, getSupportEmail, getSupportPhone } from '@/features/notifications/templates/email-branding';
import { appPath } from '@/features/notifications/templates/email-urls';
import { wrapProfessionalEmail } from '@/features/notifications/templates/wrap-professional-email';

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
  // Send reminders 12 hours before grace extension expires
  const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const elevenHoursFromNow = new Date(now.getTime() + 11 * 60 * 60 * 1000);

  try {
    const branding = await getEmailBranding();

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

    for (const { payment, user } of pendingPayments) {
      try {
        await smsService.sendSMS({
          to: user.phone,
          message: `Payment reminder: Your payment of ₦${payment.amount} is due in 12 hours.`,
        });

        await emailService.sendEmail({
          to: user.email,
          subject: 'Payment Deadline Reminder',
          html: await wrapProfessionalEmail(
            'Payment Deadline Reminder',
            `<p>Your payment is due in 12 hours.</p><p><strong>Amount:</strong> ₦${payment.amount}</p>`,
            `Your ${branding.brandName} payment is due in 12 hours.`
          ),
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
    const branding = await getEmailBranding();

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

    for (const { payment, user } of overduePayments) {
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
          message: `OVERDUE: Your payment of ₦${payment.amount} is now overdue.`,
        });

        await emailService.sendEmail({
          to: user.email,
          subject: 'URGENT: Payment Overdue',
          html: await wrapProfessionalEmail(
            'Payment Overdue',
            `<p>Your payment is now overdue.</p><p><strong>Amount:</strong> ₦${payment.amount}</p>`,
            `Your ${branding.brandName} payment is overdue.`
          ),
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
    const branding = await getEmailBranding();
    const supportPhone = getSupportPhone(branding);
    const supportEmail = getSupportEmail(branding);

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

        // Keep payment in the supported overdue terminal state while the auction is forfeited.
        await db
          .update(payments)
          .set({
            status: 'overdue',
            updatedAt: now,
          })
          .where(eq(payments.id, payment.id));

        // Send notification to vendor (NO suspension)
        await smsService.sendSMS({
          to: user.phone,
          message: `Auction forfeited after ${paymentDeadlineHours} hours. Your funds remain frozen. Contact support at ${supportPhone} if still interested.`,
        });

        await emailService.sendEmail({
          to: user.email,
          subject: 'Auction Forfeited - Contact Support',
          html: await wrapProfessionalEmail(
            'Auction Forfeited',
            `
              <p>Dear ${user.fullName},</p>
              <p>Your auction win has been forfeited after ${paymentDeadlineHours} hours without payment completion.</p>
              <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #991b1b;">What This Means</h3>
                <p><strong>Amount:</strong> ₦${parseFloat(payment.amount).toLocaleString()}</p>
                <p><strong>Status:</strong> Forfeited</p>
                <p><strong>Funds:</strong> Frozen in your wallet</p>
                <p><strong>Documents:</strong> Disabled</p>
              </div>
              <h3>Next Steps</h3>
              <p>If you are still interested in this item, please contact support immediately:</p>
              <ul>
                <li>Phone: ${supportPhone}</li>
                <li>Email: ${supportEmail}</li>
              </ul>
              <p>A Finance Officer will review your case and may grant a grace period to restore document access.</p>
              <p style="margin-top: 30px;">Best regards,<br><strong>${brandTeamName(branding)}</strong></p>
            `,
            `Your ${branding.brandName} auction win has been forfeited.`
          ),
        });

        // Alert Finance Officers for manual review
        await alertFinanceOfficersForForfeiture(payment, auction, vendor, user, paymentDeadlineHours);

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
  user: typeof users.$inferSelect,
  paymentDeadlineHours: number
): Promise<void> {
  try {
    const branding = await getEmailBranding();

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
        subject: `Auction Forfeited - Manual Review Required - ${auction.id.substring(0, 8)}`,
        html: await wrapProfessionalEmail(
          'Auction Forfeited - Manual Review Required',
          `
            <p>Dear ${officer.fullName},</p>
            <p>An auction has been automatically forfeited after ${paymentDeadlineHours} hours without payment completion.</p>
            <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #991b1b;">Forfeiture Details</h3>
              <p><strong>Amount:</strong> ₦${parseFloat(payment.amount).toLocaleString()}</p>
              <p><strong>Vendor:</strong> ${user.fullName} (${user.email})</p>
              <p><strong>Vendor Phone:</strong> ${user.phone}</p>
              <p><strong>Forfeited At:</strong> ${new Date().toLocaleString('en-NG')}</p>
            </div>
            <h3>Actions Taken</h3>
            <ul>
              <li>Auction status changed to forfeited</li>
              <li>Documents disabled until review</li>
              <li>Funds remain frozen in vendor wallet</li>
              <li>Vendor notified to contact support</li>
              <li>No account suspension was applied</li>
            </ul>
            <h3>Manual Review Required</h3>
            <ol>
              <li>Grant grace period to restore documents if appropriate</li>
              <li>Unfreeze funds and re-list item if appropriate</li>
              <li>Record any other action taken</li>
            </ol>
            <p style="margin-top: 30px;">
              <a href="${appPath('/finance/payments')}" style="background-color: ${branding.primaryColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Review Payment</a>
            </p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">This is an automated alert from ${branding.brandName}.</p>
          `,
          `Auction ${auction.id.substring(0, 8)} requires finance review.`
        ),
      });
    }

    console.log(`✅ Forfeiture alerts sent to ${financeOfficers.length} Finance Officers`);
  } catch (error) {
    console.error('❌ Error sending forfeiture alerts:', error);
    // Don't throw - best effort
  }
}
