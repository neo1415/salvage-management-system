/**
 * SMS Service
 * Production-ready SMS service with Termii integration and Africa's Talking fallback
 * 
 * Features:
 * - Smart testing mode (only sends to verified numbers)
 * - Template-based SMS
 * - Delivery logging
 * - Error handling
 * - Cost optimization
 * - Automatic fallback to Africa's Talking if Termii fails
 * 
 * Requirements: 40, Enterprise Standards Section 7
 */

import axios from 'axios';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';
import { businessPolicyService } from '@/features/business-policy';
import { getAppUrl } from '@/features/notifications/templates/email-urls';

// Validate required environment variables
if (!process.env.TERMII_API_KEY) {
  console.warn('⚠️  TERMII_API_KEY is not set. SMS functionality will be disabled.');
}

if (!process.env.TERMII_SENDER_ID) {
  console.warn('⚠️  TERMII_SENDER_ID is not set. Using default sender ID.');
}

// Termii API configuration
const TERMII_API_URL = 'https://api.ng.termii.com/api/sms/send';
const TERMII_API_KEY = process.env.TERMII_API_KEY || '';
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || 'Salvage';
const TERMII_CHANNEL = process.env.TERMII_CHANNEL || 'generic';
/** Termii requires dnd for OTP/transactional; generic is promotional-only. */
const TERMII_TRANSACTIONAL_CHANNEL = process.env.TERMII_TRANSACTIONAL_CHANNEL || 'dnd';
const TRANSACTIONAL_SMS_CATEGORIES = new Set([
  'otp',
  'auction_won',
  'forfeiture',
  'grace_period',
  'pickup_code',
]);
const SMS_TEST_MODE = process.env.SMS_TEST_MODE === 'true';
const SMS_ENABLED_CATEGORIES = (process.env.SMS_ENABLED_CATEGORIES || 'otp,auction_won,forfeiture,grace_period,pickup_code')
  .split(',')
  .map(category => category.trim())
  .filter(Boolean);

// Africa's Talking API configuration (fallback)
const AFRICAS_TALKING_API_URL = 'https://api.africastalking.com/version1/messaging';
const AFRICAS_TALKING_API_KEY = process.env.AFRICAS_TALKING_API_KEY || '';
const AFRICAS_TALKING_USERNAME = process.env.AFRICAS_TALKING_USERNAME || 'sandbox';
const AFRICAS_TALKING_SENDER_ID = process.env.AFRICAS_TALKING_SENDER_ID || 'Salvage';

// Verified phone numbers for testing (to avoid wasting money)
const VERIFIED_TEST_NUMBERS = [
  '2348141252812', // Your primary number
  '08141252812',
  '+2348141252812',
  '2347067275658', // Your secondary number
  '07067275658',
  '+2347067275658',
];

export interface SMSOptions {
  to: string;
  message: string;
  userId?: string;
  category?: 'otp' | 'auction_won' | 'forfeiture' | 'grace_period' | 'pickup_code' | 'routine' | 'manual';
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * SMS Service Class
 */
export class SMSService {
  private readonly maxRetries: number = 2; // Reduced retries to save money
  private readonly retryDelay: number = 2000; // 2 seconds

  private async getBrandName(): Promise<string> {
    try {
      const policy = await businessPolicyService.getPublicPolicy();
      return policy.branding.brandName;
    } catch {
      return 'Salvage';
    }
  }

  /**
   * Normalize phone number to international format
   * @param phone - Phone number in any format
   * @returns Normalized phone number (234XXXXXXXXXX)
   */
  private normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle different formats
    if (cleaned.startsWith('234')) {
      // Already in international format
      return cleaned;
    } else if (cleaned.startsWith('0')) {
      // Nigerian format (0XXXXXXXXXX) → 234XXXXXXXXXX
      return '234' + cleaned.substring(1);
    } else if (cleaned.length === 10) {
      // 10 digits without prefix → 234XXXXXXXXXX
      return '234' + cleaned;
    }

    return cleaned;
  }

  /**
   * Check if phone number is verified for testing
   * @param phone - Phone number to check
   * @returns True if verified
   */
  private isVerifiedNumber(phone: string): boolean {
    const normalized = this.normalizePhoneNumber(phone);
    return VERIFIED_TEST_NUMBERS.some(verified => 
      this.normalizePhoneNumber(verified) === normalized
    );
  }

  /**
   * Send SMS with smart testing mode and automatic fallback
   * @param options - SMS options
   * @returns SMS result
   */
  async sendSMS(options: SMSOptions): Promise<SMSResult> {
    try {
      // Validate inputs
      if (!options.to || !options.message) {
        throw new Error('Phone number and message are required');
      }

      // Normalize phone number
      const normalizedPhone = this.normalizePhoneNumber(options.to);

      // Validate phone number format
      if (!/^234\d{10}$/.test(normalizedPhone)) {
        throw new Error('Invalid Nigerian phone number format');
      }

      // Check if API key is configured
      if (!TERMII_API_KEY && !AFRICAS_TALKING_API_KEY) {
        console.log(`📱 [NO API KEY] SMS to ${normalizedPhone}: ${options.message}`);
        return {
          success: true, // Return success to not block functionality
          messageId: 'no-api-key',
        };
      }

      const category = options.category || 'routine';
      try {
        const policy = await businessPolicyService.getEffectivePolicy();
        if (!policy.notifications.smsEnabled) {
          console.log(`[SMS SKIPPED] SMS disabled by business policy for ${normalizedPhone}`);
          return {
            success: true,
            skipped: true,
            messageId: 'policy-sms-disabled',
          };
        }

        if (!policy.notifications.smsCategories.includes(category)) {
          console.log(`[SMS SKIPPED] Category "${category}" disabled by business policy for ${normalizedPhone}`);
          return {
            success: true,
            skipped: true,
            messageId: `policy-category-skipped-${category}`,
          };
        }
      } catch (policyError) {
        console.warn('[SMS] Business policy unavailable; using environment SMS controls', {
          error: policyError instanceof Error ? policyError.message : 'Unknown error',
        });
      }

      if (!SMS_ENABLED_CATEGORIES.includes(category)) {
        console.log(`[SMS SKIPPED] Category "${category}" disabled for ${normalizedPhone}`);
        console.log(`   Enabled categories: ${SMS_ENABLED_CATEGORIES.join(', ')}`);
        return {
          success: true,
          skipped: true,
          messageId: `category-skipped-${category}`,
        };
      }

      // Optional testing mode: Only send to verified numbers when SMS_TEST_MODE=true
      if (SMS_TEST_MODE && !this.isVerifiedNumber(normalizedPhone)) {
        console.log(`📱 [TEST MODE] SMS blocked to ${normalizedPhone} (not verified)`);
        console.log(`   Message: ${options.message}`);
        console.log(`   To send to this number, add it to VERIFIED_TEST_NUMBERS in sms.service.ts`);
        console.log(`   Verified numbers: ${VERIFIED_TEST_NUMBERS.join(', ')}`);
        return {
          success: true, // Return success to not block functionality
          skipped: true,
          messageId: 'test-mode-blocked',
        };
      }

      // Try Termii first, then fallback to Africa's Talking
      let result: SMSResult;
      
      if (TERMII_API_KEY) {
        result = await this.sendViaTermii(normalizedPhone, options.message, category);
        
        // If Termii fails and Africa's Talking is configured, try fallback
        if (!result.success && AFRICAS_TALKING_API_KEY) {
          console.log('⚠️  Termii failed, falling back to Africa\'s Talking...');
          result = await this.sendViaAfricasTalking(normalizedPhone, options.message);
        }
      } else if (AFRICAS_TALKING_API_KEY) {
        // Use Africa's Talking directly if Termii is not configured
        result = await this.sendViaAfricasTalking(normalizedPhone, options.message);
      } else {
        result = {
          success: false,
          error: 'No SMS provider configured',
        };
      }

      // Log to audit trail
      if (options.userId) {
        await logAction({
          userId: options.userId,
          actionType: AuditActionType.NOTIFICATION_SENT,
          entityType: AuditEntityType.NOTIFICATION,
          entityId: result.messageId || 'unknown',
          ipAddress: 'system',
          deviceType: DeviceType.DESKTOP,
          userAgent: 'sms-service',
          afterState: {
            channel: 'sms',
            to: normalizedPhone,
            success: result.success,
            messageLength: options.message.length,
          },
        });
      }

      if (result.success) {
        console.log(`✅ SMS sent successfully to ${normalizedPhone} (Message ID: ${result.messageId})`);
      } else {
        console.error(`❌ Failed to send SMS to ${normalizedPhone}: ${result.error}`);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('SMS send error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Termii routes for transactional vs promotional SMS (see developers.termii.com/messaging-api).
   */
  private resolveTermiiChannels(category: string): string[] {
    if (TRANSACTIONAL_SMS_CATEGORIES.has(category)) {
      const channels = [TERMII_TRANSACTIONAL_CHANNEL];
      if (TERMII_TRANSACTIONAL_CHANNEL !== 'generic') {
        channels.push('generic');
      }
      return channels;
    }
    return [TERMII_CHANNEL];
  }

  /**
   * Send SMS via Termii with retry logic and transactional channel selection.
   */
  private async sendViaTermii(
    phone: string,
    message: string,
    category: string = 'routine'
  ): Promise<SMSResult> {
    let lastError: Error | null = null;
    const channels = this.resolveTermiiChannels(category);

    for (const channel of channels) {
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const response = await axios.post(
            TERMII_API_URL,
            {
              to: phone,
              from: TERMII_SENDER_ID,
              sms: message,
              type: 'plain',
              channel,
              api_key: TERMII_API_KEY,
            },
            {
              headers: {
                'Content-Type': 'application/json',
              },
              timeout: 10000,
            }
          );

          if (response.data?.message_id) {
            if (
              channel === 'generic' &&
              TRANSACTIONAL_SMS_CATEGORIES.has(category)
            ) {
              console.warn(
                `⚠️ [SMS] ${category} sent on Termii "generic" (promotional) route. ` +
                  'Handset delivery is unreliable for OTP/transactional until Termii activates the DND route on your account. ' +
                  'Email support@termii.com to enable DND for Nigeria.'
              );
            }
            return {
              success: true,
              messageId: `termii-${response.data.message_id}`,
            };
          }
          if (response.data?.message) {
            throw new Error(response.data.message);
          }
          throw new Error('Unexpected response from Termii API');
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const termiiMessage = axios.isAxiosError(error)
            ? String(error.response?.data?.message || '')
            : '';

          if (
            channel === TERMII_TRANSACTIONAL_CHANNEL &&
            termiiMessage.includes('Country Inactive')
          ) {
            console.error(
              '❌ [SMS] Termii DND (transactional) route is not activated on this account. ' +
                'Contact support@termii.com to enable it. Falling back to generic (limited delivery).'
            );
            break;
          }

          console.error(
            `📱 Termii (${channel}) attempt ${attempt}/${this.maxRetries} failed:`,
            lastError.message
          );

          if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            if (
              status === 401 ||
              status === 400 ||
              termiiMessage.includes('Invalid')
            ) {
              break;
            }
          }

          if (attempt < this.maxRetries) {
            await this.sleep(this.retryDelay);
          }
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Failed to send SMS via Termii after multiple attempts',
    };
  }

  /**
   * Send SMS via Africa's Talking with retry logic
   * @param phone - Normalized phone number
   * @param message - SMS message
   * @returns SMS result
   */
  private async sendViaAfricasTalking(phone: string, message: string): Promise<SMSResult> {
    let lastError: Error | null = null;

    // Africa's Talking expects phone number with + prefix
    const formattedPhone = `+${phone}`;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post(
          AFRICAS_TALKING_API_URL,
          new URLSearchParams({
            username: AFRICAS_TALKING_USERNAME,
            to: formattedPhone,
            message: message,
            from: AFRICAS_TALKING_SENDER_ID,
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'apiKey': AFRICAS_TALKING_API_KEY,
              'Accept': 'application/json',
            },
            timeout: 10000, // 10 second timeout
          }
        );

        // Africa's Talking returns { SMSMessageData: { Message: string, Recipients: [...] } }
        if (response.data && response.data.SMSMessageData) {
          const recipients = response.data.SMSMessageData.Recipients;
          if (recipients && recipients.length > 0) {
            const recipient = recipients[0];
            if (recipient.status === 'Success' || recipient.statusCode === 101) {
              return {
                success: true,
                messageId: `africas-talking-${recipient.messageId || Date.now()}`,
              };
            } else {
              throw new Error(recipient.status || 'Failed to send SMS');
            }
          } else {
            throw new Error('No recipients in response');
          }
        } else {
          throw new Error('Unexpected response from Africa\'s Talking API');
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`📱 Africa's Talking attempt ${attempt}/${this.maxRetries} failed:`, lastError.message);

        // Don't retry on certain errors
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          const errorMessage = error.response?.data?.message || '';
          
          // Don't retry on authentication or validation errors
          if (status === 401 || status === 400 || errorMessage.includes('Invalid')) {
            console.error('❌ Africa\'s Talking error (no retry):', errorMessage);
            break;
          }
        }

        // Wait before retrying
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Failed to send SMS via Africa\'s Talking after multiple attempts',
    };
  }

  /**
   * Send OTP SMS
   * @param phone - Phone number
   * @param otp - OTP code
   * @param userId - User ID for audit logging
   * @returns SMS result
   */
  async sendOTP(phone: string, otp: string, userId?: string): Promise<SMSResult> {
    const brandName = await this.getBrandName();
    const message = `Your ${brandName} verification code is: ${otp}. Valid for 10 minutes. Do not share this code.`;
    return this.sendSMS({ to: phone, message, userId, category: 'otp' });
  }

  /**
   * Send auction ending soon alert
   * @param phone - Phone number
   * @param auctionTitle - Auction title
   * @param timeRemaining - Time remaining (e.g., "30 minutes")
   * @param userId - User ID for audit logging
   * @returns SMS result
   */
  async sendAuctionEndingSoon(
    phone: string,
    auctionTitle: string,
    timeRemaining: string,
    userId?: string
  ): Promise<SMSResult> {
    const message = `Auction ending soon! "${auctionTitle}" ends in ${timeRemaining}. Place your bid now at ${getAppUrl()}`;
    return this.sendSMS({ to: phone, message, userId, category: 'routine' });
  }

  /**
   * Send outbid alert
   * @param phone - Phone number
   * @param auctionTitle - Auction title
   * @param newBidAmount - New bid amount
   * @param userId - User ID for audit logging
   * @returns SMS result
   */
  async sendOutbidAlert(
    phone: string,
    auctionTitle: string,
    newBidAmount: string,
    userId?: string
  ): Promise<SMSResult> {
    const message = `🔔 You've been outbid! "${auctionTitle}" - New bid: ${newBidAmount}. Bid again to stay in the lead!`;
    return this.sendSMS({ to: phone, message, userId, category: 'routine' });
  }

  /**
   * Send payment reminder
   * @param phone - Phone number
   * @param auctionTitle - Auction title
   * @param amount - Payment amount
   * @param deadline - Payment deadline
   * @param userId - User ID for audit logging
   * @returns SMS result
   */
  async sendPaymentReminder(
    phone: string,
    auctionTitle: string,
    amount: string,
    deadline: string,
    userId?: string
  ): Promise<SMSResult> {
    const message = `💰 Payment reminder: ${amount} due for "${auctionTitle}" by ${deadline}. Pay now to avoid suspension.`;
    return this.sendSMS({ to: phone, message, userId, category: 'routine' });
  }

  /**
   * Send pickup authorization code
   * @param phone - Phone number
   * @param authCode - Authorization code
   * @param auctionTitle - Auction title
   * @param userId - User ID for audit logging
   * @returns SMS result
   */
  async sendPickupAuthorization(
    phone: string,
    authCode: string,
    auctionTitle: string,
    userId?: string
  ): Promise<SMSResult> {
    const message = `✅ Pickup authorized for "${auctionTitle}". Show this code: ${authCode}. Valid for 7 days.`;
    return this.sendSMS({ to: phone, message, userId, category: 'pickup_code' });
  }

  /**
   * Send Tier 1 approval SMS
   * @param phone - Phone number
   * @param fullName - User full name
   * @returns SMS result
   */
  async sendTier1ApprovalSMS(phone: string, fullName: string): Promise<SMSResult> {
    const brandName = await this.getBrandName();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const loginUrl = appUrl ? `${appUrl}/login` : 'your dashboard';
    const message = `Congratulations ${fullName}! Your ${brandName} identity verification is complete. You can now bid on eligible salvage items. Login to start bidding: ${loginUrl}`;
    
    return this.sendSMS({
      to: phone,
      message,
      category: 'routine',
    });
  }

  /**
   * Sleep for specified milliseconds
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate SMS service configuration
   * @returns True if SMS service is properly configured
   */
  isConfigured(): boolean {
    return !!TERMII_API_KEY;
  }
}

export const smsService = new SMSService();
