/**
 * Payment Overdue Checker Cron Job
 * 
 * Runs daily at midnight to check for payments past their deadline
 * and update their status to 'overdue'.
 * 
 * Also sends escalation emails to:
 * - Finance Officers (for manual intervention)
 * - Vendors (reminder to complete payment)
 * 
 * Schedule: Daily at midnight (0 0 * * *)
 * Changed from hourly to daily for Vercel free tier compatibility
 */

import { db } from '@/lib/db/drizzle';
import { payments } from '@/lib/db/schema/payments';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { auctions } from '@/lib/db/schema/auctions';
import { salvageCases } from '@/lib/db/schema/cases';
import { eq, and, lt } from 'drizzle-orm';
import { emailService } from '@/features/notifications/services/email.service';
import { wrapProfessionalEmail } from '@/features/notifications/templates/wrap-professional-email';
import { appPath } from '@/features/notifications/templates/email-urls';
import { smsService } from '@/features/notifications/services/sms.service';
import { createNotification } from '@/features/notifications/services/notification.service';
import { configService } from '@/features/auction-deposit/services/config.service';
import { getEmailBranding, getSupportEmail, getSupportPhone } from '@/features/notifications/templates/email-branding';
import {
  businessPolicyService,
  logPolicyDecision,
  resolveGraceExtensionDurationHours,
} from '@/features/business-policy';
import { AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';

/**
 * Check for overdue payments and update their status
 */
export async function checkOverduePayments(): Promise<void> {
  try {
    console.log('🔍 Checking for overdue payments...');

    const now = new Date();

    // Find all pending payments past their deadline
    const overduePayments = await db
      .select({
        payment: payments,
        vendor: vendors,
        user: users,
        auction: auctions,
        case: salvageCases,
      })
      .from(payments)
      .innerJoin(vendors, eq(payments.vendorId, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(
        and(
          eq(payments.status, 'pending'),
          lt(payments.paymentDeadline, now)
        )
      );

    if (overduePayments.length === 0) {
      console.log('✅ No overdue payments found');
      return;
    }

    console.log(`⚠️  Found ${overduePayments.length} overdue payment(s)`);

    // Process each overdue payment
    for (const { payment, vendor, user, auction, case: caseData } of overduePayments) {
      try {
        // Calculate days overdue
        const daysOverdue = Math.floor(
          (now.getTime() - payment.paymentDeadline.getTime()) / (1000 * 60 * 60 * 24)
        );

        console.log(`⏰ Payment ${payment.id} is ${daysOverdue} day(s) overdue`);

        // Update payment status to overdue
        await db
          .update(payments)
          .set({
            status: 'overdue',
            updatedAt: new Date(),
          })
          .where(eq(payments.id, payment.id));

        console.log(`✅ Updated payment ${payment.id} status to 'overdue'`);

        // Send escalation to Finance Officers
        await sendOverdueEscalationToFinanceOfficers(
          payment,
          vendor,
          user,
          auction,
          caseData,
          daysOverdue
        );

        // Send reminder to Vendor
        await sendOverdueReminderToVendor(
          payment,
          user,
          auction,
          caseData,
          daysOverdue
        );

        // Create in-app notification for vendor
        await createNotification({
          userId: user.id,
          type: 'payment_reminder',
          title: '🚨 Payment Overdue',
          message: `Your payment of ₦${parseFloat(payment.amount).toLocaleString()} is ${daysOverdue} day(s) overdue. Please complete payment immediately to avoid auction cancellation.`,
          data: {
            paymentId: payment.id,
            ...(payment.auctionId ? { auctionId: payment.auctionId } : {}),
            daysOverdue,
          },
        });

        console.log(`✅ Sent overdue notifications for payment ${payment.id}`);
      } catch (error) {
        console.error(`❌ Error processing overdue payment ${payment.id}:`, error);
        // Continue with next payment
      }
    }

    console.log(`✅ Overdue payment check completed. Processed ${overduePayments.length} payment(s)`);
  } catch (error) {
    console.error('❌ Error in overdue payment checker:', error);
    throw error;
  }
}

/**
 * Send overdue escalation email to Finance Officers
 */
async function sendOverdueEscalationToFinanceOfficers(
  payment: typeof payments.$inferSelect,
  vendor: typeof vendors.$inferSelect,
  user: typeof users.$inferSelect,
  auction: typeof auctions.$inferSelect,
  caseData: typeof salvageCases.$inferSelect,
  daysOverdue: number
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
      console.warn('⚠️  No Finance Officers found for escalation');
      return;
    }

    const assetDescription = `${caseData.assetType} - ${caseData.claimReference}`;

    for (const officer of financeOfficers) {
      await emailService.sendEmail({
        to: officer.email,
        subject: `Payment Overdue - ${daysOverdue} Day(s) - Action Required`,
        html: await wrapProfessionalEmail(
          'Payment Overdue - Action Required',
          `
            <p style="font-size: 18px; color: ${branding.primaryColor}; font-weight: 600;">Dear ${officer.fullName},</p>
            <p>A payment has exceeded its deadline and requires your attention.</p>
            <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #991b1b;">Overdue Payment Details</h3>
              <p><strong>Amount:</strong> ₦${parseFloat(payment.amount).toLocaleString()}</p>
              <p><strong>Asset:</strong> ${assetDescription}</p>
              <p><strong>Vendor:</strong> ${user.fullName} (${user.email})</p>
              <p><strong>Payment Method:</strong> ${payment.paymentMethod}</p>
              <p><strong>Deadline:</strong> ${payment.paymentDeadline.toLocaleDateString('en-NG')}</p>
              <p><strong>Days Overdue:</strong> <span style="color: #dc2626; font-weight: bold;">${daysOverdue} day(s)</span></p>
            </div>
            <h3 style="color: ${branding.primaryColor};">Recommended Actions</h3>
            <ol style="line-height: 1.8;">
              <li>Contact vendor to follow up on payment status</li>
              <li>Review payment proof if submitted</li>
              <li>Consider grace period extension (if applicable)</li>
              <li>If no response after ${daysOverdue + 2} days, consider auction cancellation</li>
            </ol>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${appPath('/finance/payments?view=overdue')}" class="button" style="display: inline-block; padding: 14px 28px; background: ${branding.primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 700;">View Overdue Payments</a>
            </div>
          `,
          `Payment overdue ${daysOverdue} day(s) — finance review required`
        ),
      });

      // Send push notification
      await createNotification({
        userId: officer.id,
        type: 'payment_reminder',
        title: '🚨 Payment Overdue',
        message: `Payment ${payment.id.substring(0, 8)} is ${daysOverdue} day(s) overdue. Amount: ₦${parseFloat(payment.amount).toLocaleString()}`,
          data: {
            paymentId: payment.id,
            ...(payment.auctionId ? { auctionId: payment.auctionId } : {}),
            daysOverdue,
          },
      });
    }

    console.log(`✅ Sent overdue escalation to ${financeOfficers.length} Finance Officers`);
  } catch (error) {
    console.error('❌ Error sending overdue escalation:', error);
    // Don't throw - best effort
  }
}

/**
 * Send overdue reminder to Vendor
 */
async function sendOverdueReminderToVendor(
  payment: typeof payments.$inferSelect,
  user: typeof users.$inferSelect,
  auction: typeof auctions.$inferSelect,
  caseData: typeof salvageCases.$inferSelect,
  daysOverdue: number
): Promise<void> {
  try {
    const assetDescription = `${caseData.assetType} - ${caseData.claimReference}`;
    const branding = await getEmailBranding();
    const supportPhone = getSupportPhone(branding);
    const supportEmail = getSupportEmail(branding);

    // Send SMS reminder
    await smsService.sendSMS({
      to: user.phone,
      message: `URGENT: Your payment of ₦${parseFloat(payment.amount).toLocaleString()} for ${assetDescription} is ${daysOverdue} day(s) overdue. Complete payment immediately to avoid auction cancellation. Contact: ${supportPhone}`,
      userId: user.id,
      category: 'routine',
    });

    // Send email reminder
    await emailService.sendEmail({
      to: user.email,
      subject: `URGENT: Payment Overdue - ${daysOverdue} Day(s)`,
      html: await wrapProfessionalEmail(
        'Payment Overdue - Immediate Action Required',
        `
          <p style="font-size: 18px; color: ${branding.primaryColor}; font-weight: 600;">Dear ${user.fullName},</p>
          <p>Your payment for the auction you won is now <strong style="color: #dc2626;">${daysOverdue} day(s) overdue</strong>.</p>
          <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #991b1b;">Payment Details</h3>
            <p><strong>Amount Due:</strong> ₦${parseFloat(payment.amount).toLocaleString()}</p>
            <p><strong>Asset:</strong> ${assetDescription}</p>
            <p><strong>Original Deadline:</strong> ${payment.paymentDeadline.toLocaleDateString('en-NG')}</p>
            <p><strong>Days Overdue:</strong> ${daysOverdue}</p>
          </div>
          <h3 style="color: ${branding.primaryColor};">Important Notice</h3>
          <p>If payment is not received within the next 2 days, your auction win may be cancelled and the item may be re-auctioned.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appPath(`/vendor/payments/${payment.id}`)}" class="button" style="display: inline-block; padding: 14px 28px; background: ${branding.primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 700;">Complete Payment Now</a>
          </div>
          <p>Support: ${supportPhone} | ${supportEmail}</p>
        `,
        `Your payment is ${daysOverdue} day(s) overdue`
      ),
    });

    console.log(`✅ Sent overdue reminder to vendor ${user.email}`);
  } catch (error) {
    console.error('❌ Error sending overdue reminder to vendor:', error);
    // Don't throw - best effort
  }
}

/**
 * Grace period configuration
 * After this many days overdue, auction may be cancelled
 */
export const OVERDUE_GRACE_PERIOD_DAYS = 3;

/**
 * Grant grace period to an overdue payment
 * Extends deadline by 3 days, re-enables documents, and sends notifications
 */
export async function grantGracePeriod(
  paymentId: string,
  financeOfficerId: string
): Promise<void> {
  try {
    console.log(`🔄 Granting grace period for payment ${paymentId}...`);

    // Get payment details
    const [paymentData] = await db
      .select({
        payment: payments,
        vendor: vendors,
        user: users,
        auction: auctions,
        case: salvageCases,
      })
      .from(payments)
      .innerJoin(vendors, eq(payments.vendorId, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!paymentData) {
      throw new Error('Payment not found');
    }

    const { payment, vendor, user, auction, case: caseData } = paymentData;
    const branding = await getEmailBranding();

    const config = await configService.getConfig();
    const extensionHours = config.graceExtensionDuration;
    const policy = await businessPolicyService.getEffectivePolicy();
    const durationDecision = resolveGraceExtensionDurationHours(policy);

    // Extend from the later of the current deadline or now, so overdue payments get a real grace window.
    const baseDeadline = payment.paymentDeadline > new Date() ? payment.paymentDeadline : new Date();
    const newDeadline = new Date(baseDeadline.getTime() + extensionHours * 60 * 60 * 1000);

    await logPolicyDecision({
      userId: financeOfficerId,
      entityType: AuditEntityType.PAYMENT,
      entityId: paymentId,
      ipAddress: 'system',
      userAgent: 'payment-grace-period-service',
      deviceType: DeviceType.DESKTOP,
      decision: {
        ...durationDecision.decision,
        entityType: 'payment',
        entityId: paymentId,
      },
      context: {
        mode: 'shadow',
        surface: 'payment_grace_period_service',
        paymentId,
        auctionId: auction.id,
        vendorId: vendor.id,
        legacyExtensionHours: extensionHours,
        policyExtensionHours: durationDecision.value,
      },
    });

    // Update payment deadline and status
    await db
      .update(payments)
      .set({
        paymentDeadline: newDeadline,
        status: 'pending', // Reset from 'overdue' or 'forfeited' to 'pending'
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));

    // Re-enable documents if auction was forfeited
    if (auction.status === 'forfeited') {
      const { releaseForms } = await import('@/lib/db/schema/release-forms');
      await db
        .update(releaseForms)
        .set({
          disabled: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(releaseForms.auctionId, auction.id),
            eq(releaseForms.vendorId, vendor.id)
          )
        );

      // Update auction status back to closed
      await db
        .update(auctions)
        .set({
          status: 'closed',
          updatedAt: new Date(),
        })
        .where(eq(auctions.id, auction.id));

      console.log(`✅ Documents re-enabled and auction status restored for ${auction.id}`);
    }

    console.log(`✅ Grace period granted: New deadline ${newDeadline.toLocaleDateString('en-NG')}`);

    // Send in-app notification to vendor
    await createNotification({
      userId: user.id,
      type: 'payment_reminder',
      title: '✅ Grace Period Granted',
      message: `You have been granted a ${extensionHours}-hour grace period. New deadline: ${newDeadline.toLocaleString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}. Please complete payment before this deadline.`,
      data: {
        paymentId: payment.id,
        ...(payment.auctionId ? { auctionId: payment.auctionId } : {}),
        newDeadline: newDeadline.toISOString(),
        documentsEnabled: auction.status === 'forfeited',
      },
    });

    // Send SMS notification
    await smsService.sendSMS({
      to: user.phone,
      message: `Grace period granted! You have ${extensionHours} hours. New deadline: ${newDeadline.toLocaleString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}. Pay now: ${appPath(`/vendor/auctions/${auction.id}`)}`,
      userId: user.id,
      category: 'grace_period',
    });

    // Send email notification
    const assetDescription = `${caseData.assetType} - ${caseData.claimReference}`;
    await emailService.sendEmail({
      to: user.email,
      subject: 'Grace Period Granted - Documents Re-enabled',
      html: await wrapProfessionalEmail(
        'Grace Period Granted',
        `
          <p style="font-size: 18px; color: ${branding.primaryColor}; font-weight: 600;">Dear ${user.fullName},</p>
          <p>You have been granted a <strong>${extensionHours}-hour grace period</strong> for your payment.</p>
          <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #065f46;">Updated Payment Details</h3>
            <p><strong>Amount Due:</strong> ₦${parseFloat(payment.amount).toLocaleString()}</p>
            <p><strong>Asset:</strong> ${assetDescription}</p>
            <p><strong>Original Deadline:</strong> ${payment.paymentDeadline.toLocaleDateString('en-NG')}</p>
            <p><strong>New Deadline:</strong> <span style="color: #10b981; font-weight: bold;">${newDeadline.toLocaleString('en-NG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></p>
            ${auction.status === 'forfeited' ? '<p><strong>Documents:</strong> Re-enabled</p>' : ''}
          </div>
          <p>Please complete payment before the new deadline. Required documents include Bill of Sale and Release and Waiver of Liability.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appPath(`/vendor/auctions/${auction.id}`)}" class="button" style="display: inline-block; padding: 14px 28px; background: ${branding.primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 700;">Complete Payment Now</a>
          </div>
          <p style="font-size: 14px; color: #666;">Grace period granted on ${new Date().toLocaleDateString('en-NG')}.</p>
        `,
        `New payment deadline: ${newDeadline.toLocaleDateString('en-NG')}`
      ),
    });

    console.log(`✅ Grace period notifications sent to vendor ${user.email}`);

    // Log the grace period grant
    const { logAction, AuditActionType } = await import('@/lib/utils/audit-logger');
    await logAction({
      userId: financeOfficerId,
      actionType: AuditActionType.PAYMENT_VERIFIED,
      entityType: AuditEntityType.PAYMENT,
      entityId: paymentId,
      ipAddress: 'system',
      deviceType: DeviceType.DESKTOP,
      userAgent: 'grace-period-service',
      beforeState: {
        paymentDeadline: payment.paymentDeadline,
        status: payment.status,
        auctionStatus: auction.status,
      },
      afterState: {
        paymentDeadline: newDeadline,
        status: 'pending',
        auctionStatus: auction.status === 'forfeited' ? 'closed' : auction.status,
        gracePeriodGranted: true,
        extensionHours,
        grantedBy: financeOfficerId,
        documentsReEnabled: auction.status === 'forfeited',
      },
    });

    console.log(`✅ Grace period granted successfully for payment ${paymentId}`);
  } catch (error) {
    console.error('❌ Error granting grace period:', error);
    throw error;
  }
}

/**
 * Check if payment should be cancelled due to extended overdue period
 */
export async function checkForCancellations(): Promise<void> {
  try {
    console.log('🔍 Checking for payments to cancel...');

    const now = new Date();
    const cancellationThreshold = new Date(now.getTime() - OVERDUE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    // Find overdue payments past grace period
    const paymentsToCancel = await db
      .select({
        payment: payments,
        vendor: vendors,
        user: users,
        auction: auctions,
        case: salvageCases,
      })
      .from(payments)
      .innerJoin(vendors, eq(payments.vendorId, vendors.id))
      .innerJoin(users, eq(vendors.userId, users.id))
      .innerJoin(auctions, eq(payments.auctionId, auctions.id))
      .innerJoin(salvageCases, eq(auctions.caseId, salvageCases.id))
      .where(
        and(
          eq(payments.status, 'overdue'),
          lt(payments.paymentDeadline, cancellationThreshold)
        )
      );

    if (paymentsToCancel.length === 0) {
      console.log('✅ No payments to cancel');
      return;
    }

    console.log(`⚠️  Found ${paymentsToCancel.length} payment(s) to cancel`);

    // Business-policy gate: implement automatic cancellation only after legal/finance approval.
    // This would involve:
    // 1. Updating payment status to 'cancelled'
    // 2. Updating auction status to 'cancelled' or 're-auction'
    // 3. Releasing frozen escrow funds (if applicable)
    // 4. Notifying vendor of cancellation
    // 5. Notifying finance officers
    // 6. Re-listing the item for auction (if business rules allow)

    console.log('⚠️  Cancellation logic not yet implemented');
  } catch (error) {
    console.error('❌ Error checking for cancellations:', error);
    throw error;
  }
}
