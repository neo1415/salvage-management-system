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
import { smsService } from '@/features/notifications/services/sms.service';
import { createNotification } from '@/features/notifications/services/notification.service';

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
            auctionId: payment.auctionId,
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
        subject: `🚨 Payment Overdue - ${daysOverdue} Day(s) - Action Required`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Payment Overdue - Action Required</h2>
            <p>Dear ${officer.fullName},</p>
            <p>A payment has exceeded its deadline and requires your attention.</p>
            
            <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #991b1b;">Overdue Payment Details</h3>
              <p><strong>Payment ID:</strong> ${payment.id}</p>
              <p><strong>Auction ID:</strong> ${payment.auctionId}</p>
              <p><strong>Amount:</strong> ₦${parseFloat(payment.amount).toLocaleString()}</p>
              <p><strong>Asset:</strong> ${assetDescription}</p>
              <p><strong>Vendor:</strong> ${user.fullName} (${user.email})</p>
              <p><strong>Payment Method:</strong> ${payment.paymentMethod}</p>
              <p><strong>Deadline:</strong> ${payment.paymentDeadline.toLocaleDateString('en-NG')}</p>
              <p><strong>Days Overdue:</strong> <span style="color: #dc2626; font-weight: bold;">${daysOverdue} day(s)</span></p>
            </div>

            <h3>Recommended Actions</h3>
            <ol>
              <li>Contact vendor to follow up on payment status</li>
              <li>Review payment proof if submitted</li>
              <li>Consider grace period extension (if applicable)</li>
              <li>If no response after ${daysOverdue + 2} days, consider auction cancellation</li>
            </ol>

            <p style="margin-top: 30px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://salvage.nem-insurance.com'}/finance/payments?view=overdue" 
                 style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                View Overdue Payments
              </a>
            </p>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated escalation from the NEM Salvage Management System.
            </p>
          </div>
        `,
      });

      // Send push notification
      await createNotification({
        userId: officer.id,
        type: 'payment_reminder',
        title: '🚨 Payment Overdue',
        message: `Payment ${payment.id.substring(0, 8)} is ${daysOverdue} day(s) overdue. Amount: ₦${parseFloat(payment.amount).toLocaleString()}`,
        data: {
          paymentId: payment.id,
          auctionId: payment.auctionId,
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

    // Send SMS reminder
    await smsService.sendSMS({
      to: user.phone,
      message: `URGENT: Your payment of ₦${parseFloat(payment.amount).toLocaleString()} for ${assetDescription} is ${daysOverdue} day(s) overdue. Complete payment immediately to avoid auction cancellation. Contact: ${process.env.SUPPORT_PHONE || '234-02-014489560'}`,
      userId: user.id,
    });

    // Send email reminder
    await emailService.sendEmail({
      to: user.email,
      subject: `🚨 URGENT: Payment Overdue - ${daysOverdue} Day(s)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Payment Overdue - Immediate Action Required</h2>
          <p>Dear ${user.fullName},</p>
          <p>Your payment for the auction you won is now <strong style="color: #dc2626;">${daysOverdue} day(s) overdue</strong>.</p>
          
          <div style="background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #991b1b;">Payment Details</h3>
            <p><strong>Amount Due:</strong> ₦${parseFloat(payment.amount).toLocaleString()}</p>
            <p><strong>Asset:</strong> ${assetDescription}</p>
            <p><strong>Original Deadline:</strong> ${payment.paymentDeadline.toLocaleDateString('en-NG')}</p>
            <p><strong>Days Overdue:</strong> ${daysOverdue}</p>
          </div>

          <h3 style="color: #dc2626;">⚠️ Important Notice</h3>
          <p>If payment is not received within the next 2 days, your auction win may be cancelled and the item will be re-auctioned. You may also be subject to penalties as per our terms and conditions.</p>

          <h3>How to Complete Payment</h3>
          <ol>
            <li>Log in to your vendor dashboard</li>
            <li>Navigate to "My Payments"</li>
            <li>Complete payment using one of the available methods</li>
            <li>Upload payment proof if using bank transfer</li>
          </ol>

          <p style="margin-top: 30px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/vendor/payments/${payment.id}" 
               style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Complete Payment Now
            </a>
          </p>

          <p style="margin-top: 30px;">If you're experiencing difficulties, please contact our support team immediately:</p>
          <ul>
            <li>Phone: ${process.env.SUPPORT_PHONE || '234-02-014489560'}</li>
            <li>Email: ${process.env.SUPPORT_EMAIL || 'nemsupport@nem-insurance.com'}</li>
          </ul>

          <p style="margin-top: 30px;">Best regards,<br><strong>NEM Insurance Finance Team</strong></p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            This is an automated reminder from the NEM Salvage Management System.
          </p>
        </div>
      `,
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

    // Calculate new deadline (current deadline + 3 days)
    const newDeadline = new Date(payment.paymentDeadline);
    newDeadline.setDate(newDeadline.getDate() + 3);

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
      message: `You have been granted a 3-day grace period. New deadline: ${newDeadline.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}. You can now sign documents to complete payment.`,
      data: {
        paymentId: payment.id,
        auctionId: payment.auctionId,
        newDeadline: newDeadline.toISOString(),
        documentsEnabled: auction.status === 'forfeited',
      },
    });

    // Send SMS notification
    await smsService.sendSMS({
      to: user.phone,
      message: `Grace period granted! New deadline: ${newDeadline.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}. You can now sign documents to complete payment. Visit: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/vendor/documents`,
      userId: user.id,
    });

    // Send email notification
    const assetDescription = `${caseData.assetType} - ${caseData.claimReference}`;
    await emailService.sendEmail({
      to: user.email,
      subject: '✅ Grace Period Granted - Documents Re-enabled',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">Grace Period Granted</h2>
          <p>Dear ${user.fullName},</p>
          <p>Good news! You have been granted a <strong>3-day grace period</strong> for your payment.</p>
          
          <div style="background-color: #d1fae5; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #065f46;">Updated Payment Details</h3>
            <p><strong>Amount Due:</strong> ₦${parseFloat(payment.amount).toLocaleString()}</p>
            <p><strong>Asset:</strong> ${assetDescription}</p>
            <p><strong>Original Deadline:</strong> ${payment.paymentDeadline.toLocaleDateString('en-NG')}</p>
            <p><strong>New Deadline:</strong> <span style="color: #10b981; font-weight: bold;">${newDeadline.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</span></p>
            ${auction.status === 'forfeited' ? '<p><strong>Documents:</strong> <span style="color: #10b981;">✅ Re-enabled</span></p>' : ''}
          </div>

          <h3>✅ Documents Available for Signing</h3>
          <p>You can now sign the required documents to complete your payment:</p>
          <ul>
            <li>Bill of Sale</li>
            <li>Release & Waiver of Liability</li>
          </ul>

          <h3>⚠️ Important Notice</h3>
          <p>This is a one-time extension. If all documents are not signed by the new deadline, your auction win will be permanently forfeited.</p>

          <p style="margin-top: 30px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/vendor/documents" 
               style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Sign Documents Now
            </a>
          </p>

          <p style="margin-top: 30px;">If you're experiencing difficulties, please contact our support team:</p>
          <ul>
            <li>Phone: ${process.env.SUPPORT_PHONE || '234-02-014489560'}</li>
            <li>Email: ${process.env.SUPPORT_EMAIL || 'nemsupport@nem-insurance.com'}</li>
          </ul>

          <p style="margin-top: 30px;">Best regards,<br><strong>NEM Insurance Finance Team</strong></p>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            This grace period was granted by Finance Officer on ${new Date().toLocaleDateString('en-NG')}.
          </p>
        </div>
      `,
    });

    console.log(`✅ Grace period notifications sent to vendor ${user.email}`);

    // Log the grace period grant
    const { logAction, AuditActionType, AuditEntityType, DeviceType } = await import('@/lib/utils/audit-logger');
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

    // TODO: Implement cancellation logic
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
