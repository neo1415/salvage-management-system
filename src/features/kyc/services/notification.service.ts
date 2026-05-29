import { SMSService } from '@/features/notifications/services/sms.service';
import { emailService } from '@/features/notifications/services/email.service';
import { brandTeamName, getEmailBranding } from '@/features/notifications/templates/email-branding';
import { wrapProfessionalEmail } from '@/features/notifications/templates/wrap-professional-email';
import { appPath } from '@/features/notifications/templates/email-urls';
import { createKYCUpdateNotification } from '@/features/notifications/services/notification.service';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import type { AMLRiskLevel } from '../types/kyc.types';

interface VendorNotificationTarget {
  vendorId: string;
  userId: string;
  phone: string;
  email: string;
  fullName: string;
}

interface ManagerNotificationTarget {
  userId: string;
  phone: string;
  email: string;
  fullName: string;
}

interface KYCEmailResult {
  emailSent: boolean;
  emailError?: string;
}

/**
 * KYC Notification Service
 *
 * Sends SMS and in-app notifications for all KYC lifecycle events.
 * Retries SMS once after 5 min on failure; logs all failures.
 */
export class KYCNotificationService {
  private sms: SMSService;

  constructor() {
    this.sms = new SMSService();
  }

  /** Vendor submitted Tier 2 application */
  async sendKYCSubmissionConfirmation(vendor: VendorNotificationTarget): Promise<void> {
    const branding = await getEmailBranding();
    await Promise.allSettled([
      this.sendSMSWithRetry(
        vendor.phone,
        `Hi ${vendor.fullName}, your verification application has been received. Our team will review it and notify you of the outcome.`
      ),
      this.sendEmailNotification(
        vendor.email,
        'KYC Application Received',
        `
          <h2>KYC Application Received</h2>
          <p>Hi ${vendor.fullName},</p>
          <p>Your verification application has been successfully received and is now under review.</p>
          <p><strong>What happens next:</strong></p>
          <ul>
            <li>Our team will review your submitted documents and checks</li>
            <li>You'll receive an SMS and email notification once the review is complete</li>
            <li>If approved, your account access will follow the active verification rules</li>
          </ul>
          <p>Thank you for your patience!</p>
          <p>Best regards,<br>${brandTeamName(branding)}</p>
        `
      ),
      createKYCUpdateNotification(
        vendor.userId,
        'tier2',
        'pending',
        'Your verification application has been received and is under review.'
      ).catch((e) =>
        console.error('[KYCNotification] in-app notification failed', e)
      ),
    ]);
  }

  /** Vendor auto-approved (Low AML risk, all scores pass) */
  async sendKYCApprovalNotification(vendor: VendorNotificationTarget): Promise<KYCEmailResult> {
    const branding = await getEmailBranding();
    const email = await this.sendEmailWithResult(
      vendor.email,
      'Your Tier 2 verification has been approved',
      tier2ApprovalEmail(vendor.fullName, branding)
    );

    await Promise.allSettled([
      this.sendSMSWithRetry(
        vendor.phone,
        `Congratulations ${vendor.fullName}! Your full verification has been approved. Sign in to your dashboard to continue.`
      ),
      createKYCUpdateNotification(
        vendor.userId,
        'tier2',
        'approved',
        'Congratulations! Your full verification has been approved. Your access has been updated.'
      ).catch((e) =>
        console.error('[KYCNotification] in-app notification failed', e)
      ),
    ]);

    return { emailSent: email.success, emailError: email.error };
  }

  /** Vendor flagged for manual review */
  async sendKYCUnderReviewNotification(vendor: VendorNotificationTarget): Promise<void> {
    const branding = await getEmailBranding();
    await Promise.allSettled([
      this.sendSMSWithRetry(
        vendor.phone,
        `Hi ${vendor.fullName}, your verification application is under review. You'll be notified of the outcome.`
      ),
      this.sendEmailNotification(
        vendor.email,
        'KYC Application Under Review',
        `
          <h2>KYC Application Under Review</h2>
          <p>Hi ${vendor.fullName},</p>
          <p>Your verification application is currently under review by our team.</p>
          <p><strong>What happens next:</strong></p>
          <ul>
            <li>Our team will review the submitted checks and documents</li>
            <li>You'll receive an SMS and email notification once the review is complete</li>
            <li>If you have any questions, please contact our support team</li>
          </ul>
          <p>Thank you for your patience!</p>
          <p>Best regards,<br>${brandTeamName(branding)}</p>
        `
      ),
      createKYCUpdateNotification(
        vendor.userId,
        'tier2',
        'pending',
        'Your verification application is under review by our team. You will be notified once it is complete.'
      ).catch((e) =>
        console.error('[KYCNotification] in-app notification failed', e)
      ),
    ]);
  }

  /** Manager approved the application */
  async sendManagerApprovalNotification(vendor: VendorNotificationTarget): Promise<KYCEmailResult> {
    return this.sendKYCApprovalNotification(vendor);
  }

  /** Manager rejected the application */
  async sendKYCRejectionNotification(
    vendor: VendorNotificationTarget,
    reason: string,
    rejectedSections: string[] = []
  ): Promise<KYCEmailResult> {
    const email = await this.sendEmailWithResult(
      vendor.email,
      'Action required on your Tier 2 verification',
      tier2RejectionEmail(vendor.fullName, reason, rejectedSections)
    );

    const safeSmsReason = reason.length > 120 ? `${reason.slice(0, 117)}...` : reason;
    await Promise.allSettled([
      this.sendSMSWithRetry(
        vendor.phone,
        `Hi ${vendor.fullName}, your verification application needs correction. Reason: ${safeSmsReason}. Please sign in to resubmit.`
      ),
      createKYCUpdateNotification(
        vendor.userId,
        'tier2',
        'rejected',
        `Your verification application needs correction. Please review the requested sections and resubmit.`
      ).catch((e) =>
        console.error('[KYCNotification] in-app notification failed', e)
      ),
    ]);

    return { emailSent: email.success, emailError: email.error };
  }

  /** Alert all managers about a high-risk AML result */
  async sendManagerAlert(
    managers: ManagerNotificationTarget[],
    vendor: VendorNotificationTarget,
    riskLevel: AMLRiskLevel
  ): Promise<void> {
    const branding = await getEmailBranding();
    await Promise.allSettled(
      managers.map((m) =>
        this.sendSMSWithRetry(
          m.phone,
          `[${branding.brandName} Alert] Tier 2 KYC application from ${vendor.fullName} flagged with ${riskLevel} AML risk. Please review in the manager dashboard.`
        )
      )
    );
  }

  /** Email salvage managers when a Tier 2 submission needs visibility or action. */
  async sendTier2SubmissionManagerEmails(input: {
    vendorName: string;
    businessName?: string | null;
    riskLevel?: string | null;
    reviewUrl: string;
    outcome: 'pending_review' | 'auto_approved';
    reason?: string;
  }): Promise<void> {
    const managers = await db
      .select({
        email: users.email,
        fullName: users.fullName,
      })
      .from(users)
      .where(eq(users.role, 'salvage_manager'));

    const branding = await getEmailBranding();
    const subject = input.outcome === 'auto_approved'
      ? `Tier 2 KYC Auto-Approved - ${branding.brandName}`
      : `Tier 2 KYC Ready for Review - ${branding.brandName}`;
    const html = tier2ManagerSubmissionEmail(input, branding);

    await Promise.allSettled(
      managers
        .filter((manager) => Boolean(manager.email))
        .map((manager) => this.sendEmailNotification(manager.email, subject, html.replace('{{managerName}}', escapeHtml(manager.fullName || 'Manager'))))
    );
  }

  /** Expiry reminder (30 or 7 days before) */
  async sendExpiryReminder(
    vendor: VendorNotificationTarget,
    daysUntilExpiry: number
  ): Promise<void> {
    await Promise.allSettled([
      this.sendSMSWithRetry(
        vendor.phone,
        `Hi ${vendor.fullName}, your verification expires in ${daysUntilExpiry} days. Please renew to maintain your approved access.`
      ),
      createKYCUpdateNotification(
        vendor.userId,
        'tier2',
        'pending',
        `Your verification expires in ${daysUntilExpiry} days. Please renew to maintain your approved access.`
      ).catch((e) =>
        console.error('[KYCNotification] in-app notification failed', e)
      ),
    ]);
  }

  /** Tier 2 expired — downgraded to Tier 1 */
  async sendExpiryNotification(vendor: VendorNotificationTarget): Promise<void> {
    await Promise.allSettled([
      this.sendSMSWithRetry(
        vendor.phone,
        `Hi ${vendor.fullName}, your verification has expired. Your account access has been adjusted. Please re-verify to restore full access.`
      ),
      createKYCUpdateNotification(
        vendor.userId,
        'tier2',
        'rejected',
        'Your verification has expired. Your account access has been adjusted. Please re-verify to restore full access.'
      ).catch((e) =>
        console.error('[KYCNotification] in-app notification failed', e)
      ),
    ]);
  }

  /** Send SMS with one retry after 5 minutes on failure */
  private async sendSMSWithRetry(phone: string, message: string): Promise<void> {
    try {
      const result = await this.sms.sendSMS({ to: phone, message, category: 'routine' });
      if (!result.success) {
        console.warn('[KYCNotification] SMS failed, scheduling retry', { phone });
        setTimeout(async () => {
          try {
            await this.sms.sendSMS({ to: phone, message, category: 'routine' });
          } catch (e) {
            console.error('[KYCNotification] SMS retry failed', { phone, error: e });
          }
        }, 5 * 60 * 1000);
      }
    } catch (e) {
      console.error('[KYCNotification] SMS send error', { phone, error: e });
    }
  }

  /** Send email notification */
  private async sendEmailNotification(email: string, subject: string, html: string): Promise<void> {
    try {
      const result = await emailService.sendEmail({
        to: email,
        subject,
        html: await wrapProfessionalEmail(subject, html),
      });
      
      if (!result.success) {
        console.error('[KYCNotification] Email failed', { email, error: result.error });
      }
    } catch (e) {
      console.error('[KYCNotification] Email send error', { email, error: e });
    }
  }

  private async sendEmailWithResult(email: string, subject: string, html: string) {
    try {
      return await emailService.sendEmail({
        to: email,
        subject,
        html: await wrapProfessionalEmail(subject, html),
      });
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e.message : 'Email send error',
      };
    }
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char] ?? char));
}

function tier2ApprovalEmail(fullName: string, branding: Awaited<ReturnType<typeof getEmailBranding>>): string {
  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2 style="color: ${branding.primaryColor};">Tier 2 Verification Approved</h2>
      <p>Hi ${escapeHtml(fullName)},</p>
      <p>Your Tier 2 verification has been approved by ${escapeHtml(branding.brandName)}.</p>
      <p>You now have Tier 2 access, including the bidding privileges available to verified Tier 2 vendors.</p>
      <p>No sensitive identity, document, or provider data is included in this email for your security.</p>
      <p>Best regards,<br>${brandTeamName(branding)}</p>
    </div>
  `;
}

function tier2RejectionEmail(fullName: string, reason: string, rejectedSections: string[]): string {
  const sectionItems = rejectedSections.length
    ? rejectedSections.map((section) => `<li>${escapeHtml(section)}</li>`).join('')
    : '<li>Correction details are available in your Tier 2 verification page.</li>';

  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2>Action Required on Your Tier 2 Verification</h2>
      <p>Hi ${escapeHtml(fullName)},</p>
      <p>Your Tier 2 verification could not be approved based on the submitted information.</p>
      <p><strong>Manager reason:</strong> ${escapeHtml(reason)}</p>
      <p><strong>Sections to review:</strong></p>
      <ul>${sectionItems}</ul>
      <p>Please sign in and return to your Tier 2 verification page to correct the requested items and resubmit:</p>
      <p><a href="${appPath('/vendor/kyc/tier2')}">Open Tier 2 verification</a></p>
      <p>For your security, this email does not include BVN, NIN, raw document links, raw provider payloads, or sensitive fraud/AML details.</p>
      <p>Best regards,<br>Support Team</p>
    </div>
  `;
}

function tier2ManagerSubmissionEmail(input: {
  vendorName: string;
  businessName?: string | null;
  riskLevel?: string | null;
  reviewUrl: string;
  outcome: 'pending_review' | 'auto_approved';
  reason?: string;
}, branding: Awaited<ReturnType<typeof getEmailBranding>>): string {
  const heading = input.outcome === 'auto_approved'
    ? 'Tier 2 Verification Auto-Approved'
    : 'Tier 2 Verification Ready for Review';
  const summary = input.outcome === 'auto_approved'
    ? 'A clean Tier 2 verification was automatically approved based on the current review mode.'
    : 'A Tier 2 verification has been submitted and is waiting for manager review.';

  return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
      <h2 style="color: ${branding.primaryColor};">${heading}</h2>
      <p>Hi {{managerName}},</p>
      <p>${summary}</p>
      <ul>
        <li><strong>Vendor:</strong> ${escapeHtml(input.vendorName || 'Vendor')}</li>
        <li><strong>Business:</strong> ${escapeHtml(input.businessName || 'Individual')}</li>
        <li><strong>Risk level:</strong> ${escapeHtml(input.riskLevel || 'Low')}</li>
        ${input.reason ? `<li><strong>Reason:</strong> ${escapeHtml(input.reason)}</li>` : ''}
      </ul>
      <p><a href="${escapeHtml(input.reviewUrl)}" style="background-color:${branding.primaryColor};color:#ffffff;padding:10px 16px;text-decoration:none;border-radius:6px;display:inline-block;">Open KYC Review</a></p>
      <p>Best regards,<br>${brandTeamName(branding)}</p>
    </div>
  `;
}

let _instance: KYCNotificationService | null = null;

export function getKYCNotificationService(): KYCNotificationService {
  if (!_instance) _instance = new KYCNotificationService();
  return _instance;
}
