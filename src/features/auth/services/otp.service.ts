import { otpCache, rateLimiter } from '@/lib/redis/client';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';

/**
 * OTP Service
 * Handles SMS OTP generation, sending, and verification using Termii REST API
 */
export class OTPService {
  private termiiApiKey: string | null;
  private readonly OTP_EXPIRY_SECONDS = 5 * 60; // 5 minutes
  private readonly MAX_ATTEMPTS = 3;
  private readonly RATE_LIMIT_WINDOW = 30 * 60; // 30 minutes
  private readonly MAX_RESEND_ATTEMPTS = 3;
  private readonly TERMII_API_URL = 'https://api.ng.termii.com/api/sms/send';

  constructor() {
    // Initialize Termii API key
    const apiKey = process.env.TERMII_API_KEY;
    
    if (!apiKey) {
      console.warn('TERMII_API_KEY not configured. OTP service will work in dev mode only.');
      this.termiiApiKey = null;
    } else {
      this.termiiApiKey = apiKey;
      console.log('✅ Termii configured for production SMS sending');
    }
  }

  /**
   * Generate a random 6-digit OTP
   * @returns 6-digit OTP string
   */
  private generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP via SMS using Termii API and Email as backup
   * @param phone - Phone number in international format (e.g., +2348012345678)
   * @param ipAddress - IP address of the requester
   * @param deviceType - Device type
   * @param email - Email address (optional, for backup OTP delivery)
   * @param fullName - User full name (optional, for email personalization)
   * @returns Success status and message
   */
  async sendOTP(
    phone: string,
    ipAddress: string,
    deviceType: 'mobile' | 'desktop' | 'tablet',
    email?: string,
    fullName?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check rate limiting (max 3 OTP requests per 30 minutes per phone)
      const rateLimitKey = `otp:ratelimit:${phone}`;
      const isLimited = await rateLimiter.isLimited(
        rateLimitKey,
        this.MAX_RESEND_ATTEMPTS,
        this.RATE_LIMIT_WINDOW
      );

      if (isLimited) {
        return {
          success: false,
          message: 'Too many OTP requests. Please try again in 30 minutes.',
        };
      }

      // Generate OTP
      const otp = this.generateOTP();

      // Store OTP in Redis with 5-minute expiry BEFORE sending SMS
      // This ensures OTP is available even if SMS sending fails
      await otpCache.set(phone, otp);

      // Send SMS via Termii REST API
      const senderId = process.env.TERMII_SENDER_ID || 'NEMSAL';
      const message = `Your NEM Salvage verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;

      try {
        if (this.termiiApiKey) {
          // Send SMS via Termii REST API
          const response = await fetch(this.TERMII_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: phone,
              from: senderId,
              sms: message,
              type: 'plain',
              channel: 'generic',
              api_key: this.termiiApiKey,
            }),
          });

          const result = await response.json();

          // Log the full Termii response for debugging
          console.log('📱 Termii API Response:', JSON.stringify(result, null, 2));

          if (!response.ok) {
            throw new Error(`Termii API error: ${result.message || 'Failed to send SMS'}`);
          }

          console.log(`✅ SMS sent successfully to ${phone} via Termii`);
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
        await otpCache.del(phone);
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
          await emailService.sendOTPEmail(email, fullName, otp, 5);
          console.log(`✅ OTP email sent successfully to ${email}`);
        } catch (emailError) {
          console.error('Failed to send OTP email:', emailError);
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
  async verifyOTP(
    phone: string,
    otp: string,
    ipAddress: string,
    deviceType: 'mobile' | 'desktop' | 'tablet'
  ): Promise<{ success: boolean; message: string; userId?: string }> {
    try {
      // Get OTP data from cache
      const otpData = await otpCache.get(phone);

      if (!otpData) {
        return {
          success: false,
          message: 'OTP expired or not found. Please request a new OTP.',
        };
      }

      // Check if max attempts exceeded
      if (otpData.attempts >= this.MAX_ATTEMPTS) {
        // Delete OTP to force resend
        await otpCache.del(phone);
        
        return {
          success: false,
          message: 'Maximum verification attempts exceeded. Please request a new OTP.',
        };
      }

      // Verify OTP
      if (otpData.otp !== otp) {
        // Increment attempts and get the new count
        const newAttempts = await otpCache.incrementAttempts(phone);
        
        // Calculate remaining attempts using the NEW attempts value
        const remainingAttempts = this.MAX_ATTEMPTS - newAttempts;
        
        return {
          success: false,
          message: `Invalid OTP. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
        };
      }

      // OTP is valid - update user status
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
      await otpCache.del(phone);

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
}

export const otpService = new OTPService();
