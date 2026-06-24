import { Resend } from 'resend';
import {
  getWelcomeEmailTemplate,
  getOTPEmailTemplate,
  getCaseApprovalEmailTemplate,
  getAuctionStartEmailTemplate,
  getBidAlertEmailTemplate,
  getPaymentConfirmationEmailTemplate,
  type WelcomeTemplateData,
  type OTPTemplateData,
  type CaseApprovalTemplateData,
  type AuctionStartTemplateData,
  type BidAlertTemplateData,
  type PaymentConfirmationTemplateData,
} from '../templates';
import { wrapProfessionalEmail } from '../templates/wrap-professional-email';
import { businessPolicyService } from '@/features/business-policy';
import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';
import { canUserReceiveEmail } from './notification-channel-guard';

// Validate required environment variables
if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY is not set. Email functionality will be disabled.');
}

if (!process.env.EMAIL_FROM) {
  console.warn('EMAIL_FROM is not set. Using support email as sender address.');
}

// Initialize Resend with a dummy key if not configured (for testing)
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy_key_for_testing');

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  category?: 'auth' | 'notification' | 'system';
  critical?: boolean;
  userId?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    encoding?: string;
    contentType?: string;
  }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Email Service
 * Production-ready email service with error handling, logging, and retry logic
 */
export class EmailService {
  private readonly fromAddress: string;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 1000; // 1 second

  constructor() {
    const fallbackSender = process.env.SUPPORT_EMAIL || DEFAULT_BUSINESS_POLICY.branding.supportEmail;
    this.fromAddress = process.env.EMAIL_FROM || `Salvage Portal <${fallbackSender}>`;
  }

  private async getSupportEmail(): Promise<string> {
    try {
      const policy = await businessPolicyService.getPublicPolicy();
      return policy.branding.supportEmail;
    } catch {
      return process.env.SUPPORT_EMAIL || DEFAULT_BUSINESS_POLICY.branding.supportEmail;
    }
  }

  private async canSendPolicyEmail(options: EmailOptions): Promise<boolean> {
    if (options.category === 'auth' || options.critical) {
      return true;
    }

    try {
      const policy = await businessPolicyService.getEffectivePolicy();
      if (!policy.notifications.emailEnabled) {
        console.log(`[EMAIL SKIPPED] Email disabled by business policy for ${options.to}: ${options.subject}`);
        return false;
      }
    } catch (error) {
      console.warn('[Email] Business policy unavailable; allowing email send', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    if (options.userId && !(await canUserReceiveEmail(options.userId, { critical: options.critical }))) {
      console.log(`[EMAIL SKIPPED] User disabled email channel for ${options.to}: ${options.subject}`);
      return false;
    }

    return true;
  }

  /**
   * Send welcome email to new user
   * @param email - User email address
   * @param fullName - User full name
   * @returns Email result with success status
   */
  async sendWelcomeEmail(email: string, fullName: string): Promise<EmailResult> {
    try {
      // Validate inputs
      if (!email || !fullName) {
        throw new Error('Email and fullName are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      const templateData: WelcomeTemplateData = {
        fullName: this.escapeHtml(fullName),
      };

      const result = await this.sendEmailWithRetry({
        to: email,
        subject: 'Welcome to your salvage recovery account',
        html: await getWelcomeEmailTemplate(templateData),
      });

      if (result.success) {
        console.log(`✅ Welcome email sent successfully to ${email} (Message ID: ${result.messageId})`);
      } else {
        console.error(`❌ Failed to send welcome email to ${email}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Welcome email error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send email with retry logic
   * @param options - Email options
   * @returns Email result
   */
  private async sendEmailWithRetry(options: EmailOptions): Promise<EmailResult> {
    if (!await this.canSendPolicyEmail(options)) {
      return {
        success: true,
        messageId: 'policy-email-disabled',
        skipped: true,
      };
    }

    // Check if API key is configured BEFORE retry loop
    if (!process.env.RESEND_API_KEY) {
      console.warn('Email not sent: RESEND_API_KEY not configured');
      return {
        success: false,
        error: 'Email service not configured',
      };
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await resend.emails.send({
          from: this.fromAddress,
          to: options.to,
          subject: options.subject,
          html: options.html,
          replyTo: options.replyTo || await this.getSupportEmail(),
          attachments: options.attachments,
        });

        // Resend returns { data: { id: string } } on success or { error: object } on failure
        if (response.data && 'id' in response.data) {
          return {
            success: true,
            messageId: response.data.id,
          };
        } else if (response.error) {
          throw new Error(JSON.stringify(response.error));
        } else {
          throw new Error('Unexpected response from email service');
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Email send attempt ${attempt}/${this.maxRetries} failed:`, lastError.message);

        // Wait before retrying (exponential backoff)
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Failed to send email after multiple attempts',
    };
  }

  /**
   * Send generic email
   * @param options - Email options
   * @returns Email result
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      // Validate inputs
      if (!options.to || !options.subject || !options.html) {
        throw new Error('Email to, subject, and html are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(options.to)) {
        throw new Error('Invalid email format');
      }

      const result = await this.sendEmailWithRetry(options);

      if (result.success) {
        console.log(`Email sent successfully to ${options.to} (Message ID: ${result.messageId})`);
      } else {
        console.error(`Failed to send email to ${options.to}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Email send error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Escape HTML to prevent XSS
   * @param text - Text to escape
   * @returns Escaped text
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Send OTP verification email
   * @param email - User email address
   * @param fullName - User full name
   * @param otpCode - 6-digit OTP code
   * @param expiryMinutes - OTP expiry time in minutes
   * @returns Email result with success status
   */
  async sendOTPEmail(email: string, fullName: string, otpCode: string, expiryMinutes: number = 5): Promise<EmailResult> {
    try {
      // Validate inputs
      if (!email || !fullName || !otpCode) {
        throw new Error('Email, fullName, and otpCode are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      // Validate OTP format (6 digits)
      if (!/^\d{6}$/.test(otpCode)) {
        throw new Error('OTP must be a 6-digit code');
      }

      const templateData: OTPTemplateData = {
        fullName: this.escapeHtml(fullName),
        otpCode,
        expiryMinutes,
      };

      const result = await this.sendEmailWithRetry({
        to: email,
        subject: `Your OTP Verification Code: ${otpCode}`,
        html: await getOTPEmailTemplate(templateData),
        category: 'auth',
      });

      if (result.success) {
        console.log(`✅ OTP email sent successfully to ${email} (Message ID: ${result.messageId})`);
      } else {
        console.error(`❌ Failed to send OTP email to ${email}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('OTP email error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send case approval/rejection notification email
   * @param email - Adjuster email address
   * @param data - Case approval template data
   * @returns Email result with success status
   */
  async sendCaseApprovalEmail(email: string, data: CaseApprovalTemplateData): Promise<EmailResult> {
    try {
      // Validate inputs
      if (!email || !data) {
        throw new Error('Email and data are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      // Escape HTML in user-provided data
      const safeData: CaseApprovalTemplateData = {
        ...data,
        adjusterName: this.escapeHtml(data.adjusterName),
        caseId: this.escapeHtml(data.caseId),
        claimReference: this.escapeHtml(data.claimReference),
        assetType: this.escapeHtml(data.assetType),
        managerName: this.escapeHtml(data.managerName),
        comment: data.comment ? this.escapeHtml(data.comment) : undefined,
      };

      const subject = data.status === 'approved' 
        ? `Case Approved: ${data.claimReference}`
        : `Case Rejected: ${data.claimReference}`;

      const result = await this.sendEmailWithRetry({
        to: email,
        subject,
        html: await getCaseApprovalEmailTemplate(safeData),
      });

      if (result.success) {
        console.log(`✅ Case approval email sent successfully to ${email} (Message ID: ${result.messageId})`);
      } else {
        console.error(`❌ Failed to send case approval email to ${email}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Case approval email error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send auction start notification email
   * @param email - Vendor email address
   * @param data - Auction start template data
   * @returns Email result with success status
   */
  async sendAuctionStartEmail(email: string, data: AuctionStartTemplateData): Promise<EmailResult> {
    try {
      // Validate inputs
      if (!email || !data) {
        throw new Error('Email and data are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      // Escape HTML in user-provided data
      const safeData: AuctionStartTemplateData = {
        ...data,
        vendorName: this.escapeHtml(data.vendorName),
        auctionId: this.escapeHtml(data.auctionId),
        assetType: this.escapeHtml(data.assetType),
        assetName: this.escapeHtml(data.assetName),
        location: this.escapeHtml(data.location),
      };

      const result = await this.sendEmailWithRetry({
        to: email,
        subject: `New Auction: ${data.assetName} - Starting at ₦${data.reservePrice.toLocaleString()}`,
        html: await getAuctionStartEmailTemplate(safeData),
      });

      if (result.success) {
        console.log(`✅ Auction start email sent successfully to ${email} (Message ID: ${result.messageId})`);
      } else {
        console.error(`❌ Failed to send auction start email to ${email}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Auction start email error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async sendManagerScheduledAuctionLiveEmail(
    email: string,
    data: {
      managerName: string;
      claimReference: string;
      assetType: string;
      auctionId: string;
      reservePrice: number;
      location: string;
      endTime: string;
      managerAuctionUrl: string;
      approvalsUrl: string;
      managerUserId?: string;
    }
  ): Promise<EmailResult> {
    try {
      if (!email) throw new Error('Email is required');

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) throw new Error('Invalid email format');

      const subject = `Scheduled auction is now live — ${data.claimReference}`;
      const bodyHtml = `
        <p>Hello ${this.escapeHtml(data.managerName)},</p>
        <p>Your scheduled auction for <strong>${this.escapeHtml(data.claimReference)}</strong> is now <strong>active</strong>.</p>
        <ul>
          <li><strong>Asset:</strong> ${this.escapeHtml(data.assetType)}</li>
          <li><strong>Reserve:</strong> ₦${data.reservePrice.toLocaleString()}</li>
          <li><strong>Location:</strong> ${this.escapeHtml(data.location)}</li>
          <li><strong>Ends:</strong> ${this.escapeHtml(data.endTime)} (WAT)</li>
        </ul>
        <p>
          <a href="${data.managerAuctionUrl}">Open auction details</a>
          ·
          <a href="${data.approvalsUrl}">Approval queue</a>
        </p>
      `;

      return await this.sendEmailWithRetry({
        to: email,
        subject,
        html: await wrapProfessionalEmail(
          'Scheduled auction is live',
          bodyHtml,
          'Reminder: a scheduled auction you approved has started.'
        ),
        category: 'notification',
        userId: data.managerUserId,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Manager scheduled auction email error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send bid alert notification email
   * @param email - Vendor email address
   * @param data - Bid alert template data
   * @returns Email result with success status
   */
  async sendBidAlertEmail(email: string, data: BidAlertTemplateData): Promise<EmailResult> {
    try {
      // Validate inputs
      if (!email || !data) {
        throw new Error('Email and data are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      // Escape HTML in user-provided data
      const safeData: BidAlertTemplateData = {
        ...data,
        vendorName: this.escapeHtml(data.vendorName),
        auctionId: this.escapeHtml(data.auctionId),
        assetName: this.escapeHtml(data.assetName),
        currentBidder: data.currentBidder ? this.escapeHtml(data.currentBidder) : undefined,
        timeRemaining: data.timeRemaining ? this.escapeHtml(data.timeRemaining) : undefined,
      };

      let subject = '';
      if (data.alertType === 'outbid') {
        subject = `You've Been Outbid: ${data.assetName}`;
      } else if (data.alertType === 'winning') {
        subject = `You're Winning: ${data.assetName}`;
      } else if (data.alertType === 'won') {
        subject = `Congratulations! You Won: ${data.assetName}`;
      }

      const result = await this.sendEmailWithRetry({
        to: email,
        subject,
        html: await getBidAlertEmailTemplate(safeData),
      });

      if (result.success) {
        console.log(`✅ Bid alert email sent successfully to ${email} (Message ID: ${result.messageId})`);
      } else {
        console.error(`❌ Failed to send bid alert email to ${email}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Bid alert email error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send payment confirmation email with pickup authorization
   * @param email - Vendor email address
   * @param data - Payment confirmation template data
   * @returns Email result with success status
   */
  async sendPaymentConfirmationEmail(email: string, data: PaymentConfirmationTemplateData): Promise<EmailResult> {
    try {
      // Validate inputs
      if (!email || !data) {
        throw new Error('Email and data are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new Error('Invalid email format');
      }

      // Escape HTML in user-provided data
      const safeData: PaymentConfirmationTemplateData = {
        ...data,
        vendorName: this.escapeHtml(data.vendorName),
        auctionId: this.escapeHtml(data.auctionId),
        assetName: this.escapeHtml(data.assetName),
        paymentMethod: this.escapeHtml(data.paymentMethod),
        paymentReference: this.escapeHtml(data.paymentReference),
        pickupAuthCode: this.escapeHtml(data.pickupAuthCode),
        pickupLocation: this.escapeHtml(data.pickupLocation),
        pickupDeadline: this.escapeHtml(data.pickupDeadline),
      };

      const result = await this.sendEmailWithRetry({
        to: email,
        subject: `Payment Confirmed - Pickup Authorization for ${data.assetName}`,
        html: await getPaymentConfirmationEmailTemplate(safeData),
      });

      if (result.success) {
        console.log(`✅ Payment confirmation email sent successfully to ${email} (Message ID: ${result.messageId})`);
      } else {
        console.error(`❌ Failed to send payment confirmation email to ${email}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Payment confirmation email error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Validate email service configuration
   * @returns True if email service is properly configured
   */
  isConfigured(): boolean {
    return !!process.env.RESEND_API_KEY;
  }
}

export const emailService = new EmailService();
