import { SMSService } from '@/features/notifications/services/sms.service';
import { createKYCUpdateNotification } from '@/features/notifications/services/notification.service';
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
    await Promise.allSettled([
      this.sendSMSWithRetry(
        vendor.phone,
        `Hi ${vendor.fullName}, your Tier 2 KYC application has been received. We'll review it within 24-48 hours and notify you of the outcome.`
      ),
      createKYCUpdateNotification(vendor.userId, 'submitted').catch((e) =>
        console.error('[KYCNotification] in-app notification failed', e)
      ),
    ]);
  }

  /** Vendor auto-approved (Low AML risk, all scores pass) */
  async sendKYCApprovalNotification(vendor: VendorNotificationTarget): Promise<void> {
    await Promise.allSettled([
      this.sendSMSWithRetry(
        vendor.phone,
        `Congratulations ${vendor.fullName}! Your Tier 2 KYC has been approved. You can now bid on unlimited high-value auctions. Login to your dashboard to get started.`
      ),
      createKYCUpdateNotification(vendor.userId, 'approved').catch((e) =>
        console.error('[KYCNotification] in-app notification failed', e)
      ),
    ]);
  }

  /** Vendor flagged for manual review */
  async sendKYCUnderReviewNotification(vendor: VendorNotificationTarget): Promise<void> {
    await Promise.allSettled([
      this.sendSMSWithRetry(
        vendor.phone,
        `Hi ${vendor.fullName}, your Tier 2 KYC application is under review. Our team will complete the review within 24-48 hours. You'll be notified of the outcome.`
      ),
      createKYCUpdateNotification(vendor.userId, 'pending').catch((e) =>
        console.error('[KYCNotification] in-app notification failed', e)
      ),
    ]);
  }

  /** Manager approved the application */
  async sendManagerApprovalNotification(vendor: VendorNotificationTarget): Promise<void> {
    await this.sendKYCApprovalNotification(vendor);
  }

  /** Manager rejected the application */
  async sendKYCRejectionNotification(
    vendor: VendorNotificationTarget,
    reason: string
  ): Promise<void> {
    await Promise.allSettled([
      this.sendSMSWithRetry(
        vendor.phone,
        `Hi ${vendor.fullName}, your Tier 2 KYC application was not approved. Reason: ${reason}. You may resubmit after 24 hours. Contact support for assistance.`
      ),
      createKYCUpdateNotification(vendor.userId, 'rejected').catch((e) =>
        console.error('[KYCNotification] in-app notification failed', e)
      ),
    ]);
  }

  /** Alert all managers about a high-risk AML result */
  async sendManagerAlert(
    managers: ManagerNotificationTarget[],
    vendor: VendorNotificationTarget,
    riskLevel: AMLRiskLevel
  ): Promise<void> {
    await Promise.allSettled(
      managers.map((m) =>
        this.sendSMSWithRetry(
          m.phone,
          `[NEM Salvage Alert] Tier 2 KYC application from ${vendor.fullName} flagged with ${riskLevel} AML risk. Please review in the manager dashboard.`
        )
      )
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
        `Hi ${vendor.fullName}, your Tier 2 KYC verification expires in ${daysUntilExpiry} days. Please renew to maintain unlimited bidding access.`
      ),
      createKYCUpdateNotification(vendor.userId, 'expiry_reminder').catch((e) =>
        console.error('[KYCNotification] in-app notification failed', e)
      ),
    ]);
  }

  /** Tier 2 expired — downgraded to Tier 1 */
  async sendExpiryNotification(vendor: VendorNotificationTarget): Promise<void> {
    await Promise.allSettled([
      this.sendSMSWithRetry(
        vendor.phone,
        `Hi ${vendor.fullName}, your Tier 2 KYC verification has expired. You have been downgraded to Tier 1. Please re-verify to restore unlimited bidding access.`
      ),
      createKYCUpdateNotification(vendor.userId, 'expired').catch((e) =>
        console.error('[KYCNotification] in-app notification failed', e)
      ),
    ]);
  }

  /** Send SMS with one retry after 5 minutes on failure */
  private async sendSMSWithRetry(phone: string, message: string): Promise<void> {
    try {
      const result = await this.sms.sendSMS({ to: phone, message });
      if (!result.success) {
        console.warn('[KYCNotification] SMS failed, scheduling retry', { phone });
        setTimeout(async () => {
          try {
            await this.sms.sendSMS({ to: phone, message });
          } catch (e) {
            console.error('[KYCNotification] SMS retry failed', { phone, error: e });
          }
        }, 5 * 60 * 1000);
      }
    } catch (e) {
      console.error('[KYCNotification] SMS send error', { phone, error: e });
    }
  }
}

let _instance: KYCNotificationService | null = null;

export function getKYCNotificationService(): KYCNotificationService {
  if (!_instance) _instance = new KYCNotificationService();
  return _instance;
}
