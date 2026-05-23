import { otpCache, rateLimiter } from '@/lib/redis/client';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';
import { smsService } from '@/features/notifications/services/sms.service';

/**
 * OTP Service
 * Handles SMS OTP generation, sending, and verification using Termii REST API
 */
// OTP Context Types
export type OTPContext = 'authentication' | 'bidding' | 'phone_change';

let termiiConfigLogged = false;

// Rate limit configurations
const RATE_LIMITS = {
  authentication: {
    maxAttempts: 3,
    windowSeconds: 30 * 60, // 30 minutes
  },
  bidding: {
    maxAttempts: 15, // Allow 15 bids per 30 minutes
    windowSeconds: 30 * 60, // 30 minutes
    perAuctionMax: 5, // Max 5 bids per auction per 5 minutes
    perAuctionWindowSeconds: 5 * 60, // 5 minutes
  },
  phone_change: {
    maxAttempts: 5,
    windowSeconds: 30 * 60,
  },
};

export class OTPService {
  private termiiApiKey: string | null;
  private readonly OTP_EXPIRY_SECONDS = 5 * 60; // 5 minutes
  private readonly MAX_ATTEMPTS = 3;
  constructor() {
    // Initialize Termii API key
    const apiKey = process.env.TERMII_API_KEY;
    
    if (!apiKey) {
      console.warn('TERMII_API_KEY not configured. OTP service will work in dev mode only.');
      this.termiiApiKey = null;
    } else {
      this.termiiApiKey = apiKey;
      if (!termiiConfigLogged) {
        console.log('✅ Termii configured for production SMS sending');
        termiiConfigLogged = true;
      }
    }
  }

  /**
   * Generate a random 6-digit OTP
   * @returns 6-digit OTP string
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private normalizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('234')) return cleaned;
    if (cleaned.startsWith('0')) return `234${cleaned.substring(1)}`;
    if (cleaned.length === 10) return `234${cleaned}`;
    return cleaned;
  }

  /**
   * Send OTP via SMS using Termii API and Email as backup
   * @param phone - Phone number in international format (e.g., +2348012345678)
   * @param ipAddress - IP address of the requester
   * @param deviceType - Device type
   * @param email - Email address (optional, for backup OTP delivery)
   * @param fullName - User full name (optional, for email personalization)
   * @param context - Context of OTP request ('authentication' or 'bidding')
   * @param auctionId - Auction ID (required for bidding context)
   * @returns Success status and message
   */
  async sendOTP(
    phone: string,
    ipAddress: string,
    deviceType: 'mobile' | 'desktop' | 'tablet',
    email?: string,
    fullName?: string,
    context: OTPContext = 'authentication',
    auctionId?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phone);

      // Context-aware rate limiting
      const limits = RATE_LIMITS[context];
      const rateLimitKey = `otp:ratelimit:${context}:${normalizedPhone}`;
      
      const isLimited = await rateLimiter.isLimited(
        rateLimitKey,
        limits.maxAttempts,
        limits.windowSeconds
      );

      if (isLimited) {
        const minutes = Math.ceil(limits.windowSeconds / 60);
        return {
          success: false,
          message: `Too many OTP requests. Please try again in ${minutes} minutes.`,
        };
      }

      // For bidding context, check per-auction rate limit
      if (context === 'bidding' && auctionId) {
        const biddingLimits = RATE_LIMITS.bidding;
        const auctionRateLimitKey = `otp:auction:${auctionId}:${normalizedPhone}`;
        const isAuctionLimited = await rateLimiter.isLimited(
          auctionRateLimitKey,
          biddingLimits.perAuctionMax,
          biddingLimits.perAuctionWindowSeconds
        );

        if (isAuctionLimited) {
          return {
            success: false,
            message: `Too many bid attempts for this auction. Please wait ${Math.ceil(biddingLimits.perAuctionWindowSeconds / 60)} minutes.`,
          };
        }
      }

      // Fraud detection monitoring (log but don't block)
      await this.monitorFraudPatterns(normalizedPhone, ipAddress, context, auctionId);

      // Generate OTP
      const otp = this.generateOTP();

      // Store OTP in Redis with 5-minute expiry BEFORE sending SMS
      // This ensures OTP is available even if SMS sending fails
      await otpCache.set(normalizedPhone, otp);

      const message = `Your NEM Salvage verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;

      try {
        if (this.termiiApiKey) {
          const smsResult = await smsService.sendSMS({
            to: normalizedPhone,
            message,
            category: 'otp',
          });

          if (!smsResult.success) {
            throw new Error(smsResult.error || 'Failed to send OTP SMS');
          }

          if (smsResult.skipped) {
            console.warn(`📱 OTP SMS skipped for ${normalizedPhone}: ${smsResult.messageId}`);
          } else {
            console.log(
              `✅ OTP SMS accepted by Termii for ${normalizedPhone} (id: ${smsResult.messageId}). ` +
                'Check Termii inbox for Sent vs Failed — "Successfully Sent" is not handset delivery.'
            );
          }
        } else {
          // In development/test mode without Termii, just log
          if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            console.log(`[DEV] OTP for ${phone}: ${otp}`);
            // Don't throw error in dev/test mode
          } else {
            throw new Error('Termii API key not configured');
          }
        }
      } catch (termiiError) {
        console.error('Termii SMS send error:', termiiError);
        
        // In development/test, log OTP to console
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
          console.log(`[DEV] OTP for ${phone}: ${otp}`);
          // Return success in dev/test mode even if SMS fails
          // OTP is already stored in Redis
          return {
            success: true,
            message: 'OTP sent successfully (dev mode)',
          };
        }
        
        // In production, if SMS fails, delete the OTP and return error
        await otpCache.del(normalizedPhone);
        return {
          success: false,
          message: 'Failed to send OTP. Please try again.',
        };
      }

      // Create audit log entry (optional - only if user exists)
      try {
        const user = await db
          .select()
          .from(users)
          .where(eq(users.phone, phone))
          .limit(1);

        if (user.length > 0) {
          await db.insert(auditLogs).values({
            userId: user[0].id,
            actionType: 'otp_sent',
            entityType: 'user',
            entityId: user[0].id,
            ipAddress,
            deviceType,
            userAgent: 'web',
            afterState: {
              phone,
              expirySeconds: this.OTP_EXPIRY_SECONDS,
            },
          });
        }
      } catch (auditError) {
        // Log error but don't fail the OTP send
        console.error('Failed to create audit log for OTP send:', auditError);
      }

      // Send OTP via email as backup (if email provided)
      if (email && fullName) {
        try {
          const { emailService } = await import('@/features/notifications/services/email.service');
          const emailResult = await emailService.sendOTPEmail(email, fullName, otp, 5);
          if (emailResult.success) {
            console.log(`✅ OTP email sent successfully to ${email}`);
          } else {
            console.warn(`⚠️ OTP email failed (non-critical): ${emailResult.error}`);
          }
        } catch (emailError) {
          console.warn('⚠️ OTP email backup failed (non-critical):', emailError);
          // Don't fail if email sending fails - SMS is primary
        }
      }

      return {
        success: true,
        message: 'OTP sent successfully',
      };
    } catch (error) {
      console.error('Send OTP error:', error);
      return {
        success: false,
        message: 'Failed to send OTP. Please try again.',
      };
    }
  }

  /**
   * Verify OTP
   * @param phone - Phone number
   * @param otp - OTP to verify
   * @param ipAddress - IP address of the requester
   * @param deviceType - Device type
   * @returns Verification result
   */
  /**
   * Verify OTP code only (no user status updates). Used for phone change and future login MFA.
   */
  async verifyOTPCode(
    phone: string,
    otp: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const normalizedPhone = this.normalizePhoneNumber(phone);
      const otpData = await otpCache.get(normalizedPhone);

      if (!otpData) {
        return {
          success: false,
          message: 'OTP expired or not found. Please request a new code.',
        };
      }

      if (otpData.attempts >= this.MAX_ATTEMPTS) {
        await otpCache.del(normalizedPhone);
        return {
          success: false,
          message: 'Maximum verification attempts exceeded. Please request a new code.',
        };
      }

      if (otpData.otp !== otp) {
        const newAttempts = await otpCache.incrementAttempts(normalizedPhone);
        const remainingAttempts = this.MAX_ATTEMPTS - newAttempts;
        return {
          success: false,
          message: `Invalid code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
        };
      }

      await otpCache.del(normalizedPhone);
      return { success: true, message: 'Verified' };
    } catch (error) {
      console.error('Verify OTP code error:', error);
      return { success: false, message: 'Verification failed. Please try again.' };
    }
  }

  async verifyOTP(
    phone: string,
    otp: string,
    ipAddress: string,
    deviceType: 'mobile' | 'desktop' | 'tablet'
  ): Promise<{ success: boolean; message: string; userId?: string }> {
    try {
      const codeCheck = await this.verifyOTPCode(phone, otp);
      if (!codeCheck.success) {
        return { success: false, message: codeCheck.message };
      }

      const normalizedPhone = this.normalizePhoneNumber(phone);

      // OTP is valid - update user status (registration flow)
      const user = await db
        .select()
        .from(users)
        .where(eq(users.phone, phone))
        .limit(1);

      if (user.length === 0) {
        return {
          success: false,
          message: 'User not found.',
        };
      }

      // Update user status to phone_verified_tier_0
      await db
        .update(users)
        .set({
          status: 'phone_verified_tier_0',
          updatedAt: new Date(),
        })
        .where(eq(users.id, user[0].id));

      // Delete OTP from cache
      await otpCache.del(normalizedPhone);

      // Create audit log entry (optional)
      try {
        await db.insert(auditLogs).values({
          userId: user[0].id,
          actionType: 'phone_verification_completed',
          entityType: 'user',
          entityId: user[0].id,
          ipAddress,
          deviceType,
          userAgent: 'web',
          afterState: {
            phone,
            status: 'phone_verified_tier_0',
          },
        });
      } catch (auditError) {
        // Log error but don't fail the verification
        console.error('Failed to create audit log for OTP verification:', auditError);
      }

      return {
        success: true,
        message: 'Phone verified successfully',
        userId: user[0].id,
      };
    } catch (error) {
      console.error('Verify OTP error:', error);
      return {
        success: false,
        message: 'Failed to verify OTP. Please try again.',
      };
    }
  }

  /**
   * Check if OTP exists for a phone number
   * @param phone - Phone number
   * @returns True if OTP exists
   */
  async otpExists(phone: string): Promise<boolean> {
    const otpData = await otpCache.get(phone);
    return otpData !== null;
  }

  /**
   * Get remaining attempts for a phone number
   * @param phone - Phone number
   * @returns Remaining attempts or null if no OTP exists
   */
  async getRemainingAttempts(phone: string): Promise<number | null> {
    const otpData = await otpCache.get(phone);
    
    if (!otpData) {
      return null;
    }

    return this.MAX_ATTEMPTS - otpData.attempts;
  }

  /**
   * Monitor fraud patterns without blocking legitimate users
   * Logs suspicious activity for admin review
   * @param phone - Phone number
   * @param ipAddress - IP address
   * @param context - OTP context
   * @param auctionId - Auction ID (optional)
   */
  private async monitorFraudPatterns(
    phone: string,
    ipAddress: string,
    context: OTPContext,
    auctionId?: string
  ): Promise<void> {
    try {
      // Track OTP requests in Redis for fraud analysis
      const fraudKey = `fraud:otp:${ipAddress}:${phone}`;
      const count = await rateLimiter.increment(fraudKey, 60 * 60); // 1 hour window

      // Log suspicious patterns (>20 OTP requests from same IP+phone in 1 hour)
      if (count > 20) {
        console.warn(`⚠️ Suspicious OTP activity detected:`, {
          phone,
          ipAddress,
          context,
          auctionId,
          count,
          timestamp: new Date().toISOString(),
        });

        // Create fraud alert in database (non-blocking)
        this.createFraudAlert(phone, ipAddress, context, count, auctionId).catch(err => {
          console.error('Failed to create fraud alert:', err);
        });
      }
    } catch (error) {
      // Don't block OTP send if fraud monitoring fails
      console.error('Fraud monitoring error:', error);
    }
  }

  /**
   * Create fraud alert in database
   * @param phone - Phone number
   * @param ipAddress - IP address
   * @param context - OTP context
   * @param requestCount - Number of requests
   * @param auctionId - Auction ID (optional)
   */
  private async createFraudAlert(
    phone: string,
    ipAddress: string,
    context: OTPContext,
    requestCount: number,
    auctionId?: string
  ): Promise<void> {
    try {
      const { db } = await import('@/lib/db/drizzle');
      const { auditLogs } = await import('@/lib/db/schema/audit-logs');

      await db.insert(auditLogs).values({
        userId: 'system',
        actionType: 'fraud_alert',
        entityType: 'otp_request',
        entityId: phone,
        ipAddress,
        deviceType: 'desktop' as const,
        userAgent: 'system',
        afterState: {
          phone,
          context,
          auctionId,
          requestCount,
          severity: requestCount > 50 ? 'high' : 'medium',
          detectedAt: new Date().toISOString(),
        },
      });

      console.log(`🚨 Fraud alert logged for ${phone} (${requestCount} OTP requests)`);
    } catch (error) {
      console.error('Failed to create fraud alert:', error);
    }
  }
}

// Export singleton instance
export const otpService = new OTPService();
