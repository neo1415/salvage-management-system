/**
 * Registration Fee Service
 * Handles vendor registration fee payment processing
 * 
 * Flow:
 * 1. Vendor completes Tier 1 KYC (BVN verification)
 * 2. Registration fee payment modal appears
 * 3. Vendor pays ₦12,500 via Paystack
 * 4. Webhook confirms payment
 * 5. Vendor can now access Tier 2 KYC
 */

import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { payments } from '@/lib/db/schema/payments';
import { users } from '@/lib/db/schema/users';
import { eq, and, isNull } from 'drizzle-orm';
import { appPath } from '@/features/notifications/templates/email-urls';
import { businessPolicyService } from '@/features/business-policy';
import { isRegistrationFeeRequiredForPolicy } from '@/features/business-policy/onboarding-decisions';
import { brandTeamName, getEmailBranding, getSupportEmail, getSupportPhone } from '@/features/notifications/templates/email-branding';
import { wrapProfessionalEmail } from '@/features/notifications/templates/wrap-professional-email';

export interface InitializeRegistrationFeePaymentParams {
  vendorId: string;
  userEmail: string;
  userName: string;
}

export interface RegistrationFeePaymentResult {
  paymentId: string;
  authorizationUrl: string;
  accessCode: string;
  amount: number;
  reference: string;
}

export interface RegistrationFeeStatus {
  paid: boolean;
  amount: number | null;
  paidAt: Date | null;
  reference: string | null;
  required: boolean;
  feeAmount: number;
}

export class RegistrationFeeService {
  /**
   * Get registration fee amount from the active business policy.
   * Falls back to legacy config/env/default so rollout remains backward-compatible.
   */
  private async getRegistrationFeeAmount(): Promise<number> {
    try {
      const policy = await businessPolicyService.getEffectivePolicy();
      return policy.onboarding.registrationFeeAmount;
    } catch (policyError) {
      console.warn('[Registration Fee] Business policy unavailable, falling back to legacy config:', policyError);
    }

    try {
      const { configService } = await import('@/features/auction-deposit/services/config.service');
      const config = await configService.getConfig();
      return config.registrationFee;
    } catch (error) {
      console.error('Failed to fetch registration fee from config, using fallback:', error);
      // Fallback to environment variable or default
      return parseFloat(process.env.REGISTRATION_FEE_AMOUNT || '12500');
    }
  }
  
  /**
   * Initialize registration fee payment with Paystack
   * 
   * @param params - Payment initialization parameters
   * @returns Payment result with Paystack authorization URL
   * @throws Error if payment already exists or initialization fails
   */
  async initializeRegistrationFeePayment(
    params: InitializeRegistrationFeePaymentParams
  ): Promise<RegistrationFeePaymentResult> {
    const { vendorId, userEmail, userName } = params;

    // Get current registration fee amount from config
    const feeAmount = await this.getRegistrationFeeAmount();

    // 1. Check if vendor has already paid
    const [vendor] = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      throw new Error(`Vendor not found: ${vendorId}`);
    }

    if (vendor.registrationFeePaid) {
      throw new Error('Registration fee already paid');
    }

    // 2. Check for existing pending payment
    const [existingPayment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.vendorId, vendorId),
          isNull(payments.auctionId), // Registration fee payments have no auction
          eq(payments.status, 'pending')
        )
      )
      .limit(1);

    if (existingPayment) {
      console.log(`⚠️  Registration fee payment already pending for vendor ${vendorId}`);
      return {
        paymentId: existingPayment.id,
        authorizationUrl: 'ALREADY_PENDING',
        accessCode: 'ALREADY_PENDING',
        amount: parseFloat(existingPayment.amount),
        reference: existingPayment.paymentReference || '',
      };
    }

    // 3. Generate unique payment reference
    const reference = this.generatePaymentReference(vendorId);

    // 4. Create pending payment record
    const [payment] = await db
      .insert(payments)
      .values({
        auctionId: null, // No auction for registration fees
        vendorId,
        amount: feeAmount.toFixed(2),
        paymentMethod: 'paystack',
        paymentReference: reference,
        status: 'pending',
        paymentDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning();

    await businessPolicyService.createCurrentPolicySnapshot({
      entityType: 'payment',
      entityId: payment.id,
      actorId: undefined,
      reason: `Vendor registration fee payment created for vendor ${vendorId}.`,
    });

    // 5. Initialize Paystack transaction
    const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY not configured');
    }

    const amountInKobo = Math.round(feeAmount * 100);

    const paystackPayload = {
      email: userEmail,
      amount: amountInKobo,
      reference,
      callback_url: appPath('/vendor/registration-fee?payment=success'),
      metadata: {
        paymentId: payment.id,
        vendorId,
        paymentType: 'registration_fee',
        userName,
        custom_fields: [
          {
            display_name: 'Payment Type',
            variable_name: 'payment_type',
            value: 'Vendor Registration Fee',
          },
          {
            display_name: 'Amount',
            variable_name: 'amount',
            value: `₦${feeAmount.toLocaleString()}`,
          },
        ],
      },
    };

    console.log('[Registration Fee] Initializing Paystack payment:', {
      vendorId,
      reference,
      amount: feeAmount,
      hasVendorEmail: !!userEmail,
    });

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    if (!paystackResponse.ok) {
      const error = await paystackResponse.json();
      console.error('[Registration Fee] Paystack initialization failed:', error);
      
      // Delete the pending payment record
      await db.delete(payments).where(eq(payments.id, payment.id));
      
      throw new Error(`Paystack initialization failed: ${error.message || 'Unknown error'}`);
    }

    const paystackData = await paystackResponse.json();

    if (!paystackData.data || !paystackData.data.authorization_url) {
      console.error('[Registration Fee] Invalid Paystack response:', paystackData);
      
      // Delete the pending payment record
      await db.delete(payments).where(eq(payments.id, payment.id));
      
      throw new Error('Invalid response from Paystack: missing authorization_url');
    }

    console.log('[Registration Fee] Paystack payment initialized successfully:', {
      paymentId: payment.id,
      reference,
      hasAuthorizationUrl: !!paystackData.data.authorization_url,
      hasAccessCode: !!paystackData.data.access_code,
    });

    return {
      paymentId: payment.id,
      authorizationUrl: paystackData.data.authorization_url,
      accessCode: paystackData.data.access_code,
      amount: feeAmount,
      reference,
    };
  }

  /**
   * Handle Paystack webhook for registration fee payment
   * 
   * @param reference - Paystack payment reference
   * @param success - Whether payment succeeded
   * @throws Error if payment not found or already processed
   */
  async handleRegistrationFeeWebhook(
    reference: string,
    success: boolean
  ): Promise<void> {
    console.log('[Registration Fee Webhook] Processing:', { reference, success });

    // 1. Find payment record
    const [payment] = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.paymentReference, reference),
          isNull(payments.auctionId) // Registration fee payments have no auction
        )
      )
      .limit(1);

    if (!payment) {
      throw new Error(`Registration fee payment not found for reference: ${reference}`);
    }

    // 2. Check if already processed (idempotency)
    if (payment.status === 'verified' || payment.status === 'rejected') {
      console.log(`✅ Registration fee payment ${payment.id} already processed with status: ${payment.status}`);
      return;
    }

    // 3. Handle payment failure
    if (!success) {
      await db
        .update(payments)
        .set({
          status: 'rejected',
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
      
      console.log(`❌ Registration fee payment ${payment.id} rejected`);
      return;
    }

    // 4. Payment succeeded - update vendor and payment records
    const vendorId = payment.vendorId;
    const now = new Date();
    const feeAmount = parseFloat(payment.amount);

    await db.transaction(async (tx) => {
      // Update payment status
      await tx
        .update(payments)
        .set({
          status: 'verified',
          autoVerified: true,
          verifiedAt: now,
          updatedAt: now,
        })
        .where(eq(payments.id, payment.id));

      // Update vendor registration fee status
      await tx
        .update(vendors)
        .set({
          registrationFeePaid: true,
          registrationFeeAmount: feeAmount.toFixed(2),
          registrationFeePaidAt: now,
          registrationFeeReference: reference,
          updatedAt: now,
        })
        .where(eq(vendors.id, vendorId));
    });

    console.log(`✅ Registration fee payment ${payment.id} verified successfully`);
    console.log(`   - Vendor ${vendorId} can now access Tier 2 KYC`);

    // 5. Send confirmation notifications (non-blocking)
    this.sendPaymentConfirmationNotifications(vendorId, feeAmount).catch((error) => {
      console.error('[Registration Fee] Failed to send notifications:', error);
    });
  }

  /**
   * Check if vendor has paid registration fee
   * 
   * @param vendorId - Vendor ID
   * @returns Registration fee status
   */
  async checkRegistrationFeePaid(vendorId: string): Promise<RegistrationFeeStatus> {
    const policy = await businessPolicyService.getEffectivePolicy();
    const required = isRegistrationFeeRequiredForPolicy(policy);
    const feeAmount = policy.onboarding.registrationFeeAmount;

    const [vendor] = await db
      .select({
        registrationFeePaid: vendors.registrationFeePaid,
        registrationFeeAmount: vendors.registrationFeeAmount,
        registrationFeePaidAt: vendors.registrationFeePaidAt,
        registrationFeeReference: vendors.registrationFeeReference,
      })
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    if (!vendor) {
      throw new Error(`Vendor not found: ${vendorId}`);
    }

    if (!required) {
      if (!vendor.registrationFeePaid) {
        const now = new Date();
        await db
          .update(vendors)
          .set({
            registrationFeePaid: true,
            registrationFeeAmount: '0',
            registrationFeePaidAt: now,
            registrationFeeReference: 'POLICY_WAIVED',
            updatedAt: now,
          })
          .where(eq(vendors.id, vendorId));
      }

      return {
        paid: true,
        required: false,
        feeAmount,
        amount: 0,
        paidAt: vendor.registrationFeePaidAt ?? new Date(),
        reference: vendor.registrationFeeReference ?? 'POLICY_WAIVED',
      };
    }

    return {
      paid: vendor.registrationFeePaid,
      required: true,
      feeAmount,
      amount: vendor.registrationFeeAmount ? parseFloat(vendor.registrationFeeAmount) : null,
      paidAt: vendor.registrationFeePaidAt,
      reference: vendor.registrationFeeReference,
    };
  }

  /**
   * Generate unique payment reference
   * Format: REG-{first 8 chars of vendor ID}-{timestamp}
   * 
   * @param vendorId - Vendor ID
   * @returns Payment reference
   */
  private generatePaymentReference(vendorId: string): string {
    const vendorPrefix = vendorId.substring(0, 8).toUpperCase();
    const timestamp = Date.now();
    return `REG-${vendorPrefix}-${timestamp}`;
  }

  /**
   * Send payment confirmation notifications
   * 
   * @param vendorId - Vendor ID
   * @param amount - Payment amount
   */
  private async sendPaymentConfirmationNotifications(vendorId: string, amount: number): Promise<void> {
    try {
      // Get vendor and user details
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(eq(vendors.id, vendorId))
        .limit(1);

      if (!vendor) {
        throw new Error(`Vendor not found: ${vendorId}`);
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, vendor.userId))
        .limit(1);

      if (!user) {
        throw new Error(`User not found for vendor: ${vendorId}`);
      }

      // Send SMS notification
      try {
        const { smsService } = await import('@/features/notifications/services/sms.service');
        const branding = await getEmailBranding();
        await smsService.sendSMS({
          to: user.phone,
          message: `${branding.brandName}: Registration fee payment confirmed. You can now continue to full verification from your dashboard.`,
        });
        console.log(`✅ Registration fee SMS sent to ${user.phone}`);
      } catch (smsError) {
        console.error('SMS notification error (non-blocking):', smsError);
      }

      // Send email notification
      try {
        const { emailService } = await import('@/features/notifications/services/email.service');
        await emailService.sendEmail({
          to: user.email,
          subject: 'Registration Fee Payment Confirmed',
          html: await this.getPaymentConfirmationEmailTemplate(user.fullName, amount),
        });
        console.log(`✅ Registration fee email sent to ${user.email}`);
      } catch (emailError) {
        console.error('Email notification error (non-blocking):', emailError);
      }

      console.log(`✅ Registration fee notifications sent for vendor ${vendorId}`);
    } catch (error) {
      console.error('Error sending registration fee notifications:', error);
      // Don't throw - notifications are non-critical
    }
  }

  /**
   * Get payment confirmation email template
   * 
   * @param fullName - User's full name
   * @param amount - Payment amount
   * @returns HTML email template
   */
  private async getPaymentConfirmationEmailTemplate(fullName: string, amount: number): Promise<string> {
    const branding = await getEmailBranding();
    const supportEmail = getSupportEmail(branding);
    const supportPhone = getSupportPhone(branding);

    return wrapProfessionalEmail(
      'Registration Fee Payment Confirmed',
      `
        <p><strong>Dear ${this.escapeHtml(fullName)},</strong></p>
        <p>Your registration fee payment has been successfully confirmed.</p>
        <div style="background-color: #f9f9f9; border: 2px solid ${branding.accentColor}; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
          <p style="margin: 0; color: #666; font-size: 14px;">Amount Paid</p>
          <h2 style="margin: 0 0 10px 0; color: ${branding.primaryColor}; font-size: 32px;">₦${amount.toLocaleString()}</h2>
          <p style="margin: 0; color: #666; font-size: 14px;">One-time Registration Fee</p>
        </div>
        <div style="background-color: #f9f9f9; border-left: 4px solid ${branding.accentColor}; padding: 15px 20px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: ${branding.primaryColor};">What's Next?</h3>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Continue verification:</strong> Complete full business verification.</li>
            <li><strong>Unlock high-value auctions:</strong> Bid according to your verified access level.</li>
            <li><strong>Keep records current:</strong> Maintain accurate business and contact details.</li>
          </ul>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${appPath('/vendor/kyc/tier2')}" class="button" style="display: inline-block; padding: 14px 28px; background-color: ${branding.primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600;">Continue Verification</a>
        </div>
        <p>Thank you for choosing ${branding.brandName}.</p>
        <p style="margin-top: 30px;">Best regards,<br><strong style="color: ${branding.primaryColor};">${brandTeamName(branding)}</strong></p>
        <p style="font-size: 13px; color: #666;">Need help? ${supportPhone} | ${supportEmail}</p>
      `,
      `Your ${branding.brandName} registration fee payment is confirmed.`
    );
  }

  /**
   * Escape HTML to prevent XSS
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
}

// Export singleton instance
export const registrationFeeService = new RegistrationFeeService();
