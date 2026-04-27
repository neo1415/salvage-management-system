import { NextRequest, NextResponse } from 'next/server';
import { registrationSchema } from '@/lib/utils/validation';
import { authService } from '@/features/auth/services/auth.service';
import { emailService } from '@/features/notifications/services/email.service';
import { otpService } from '@/features/auth/services/otp.service';
import { ZodError } from 'zod';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/redis/client';

// SECURITY: Rate limiting for registration endpoint
// Prevents spam registrations and abuse
const registerRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'), // 3 registrations per hour per IP
  analytics: true,
  prefix: 'ratelimit:register',
});

/**
 * POST /api/auth/register
 * Register a new vendor user
 * 
 * Security features:
 * - Rate limiting: 3 registrations per hour per IP
 * - Input validation with Zod
 * - Audit logging
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting check
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    
    const { success, limit, remaining, reset } = await registerRateLimit.limit(ipAddress);

    if (!success) {
      console.warn('[Security] Registration rate limit exceeded', {
        ip: ipAddress,
        limit,
        remaining,
        resetAt: new Date(reset).toISOString(),
      });

      return NextResponse.json(
        {
          error: 'Too many registration attempts. Please try again later.',
          retryAfter: Math.ceil((reset - Date.now()) / 1000), // seconds until reset
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': new Date(reset).toISOString(),
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate input
    const validatedInput = registrationSchema.parse(body);

    // Get device type
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = getDeviceType(userAgent);

    // Register user
    const result = await authService.register(validatedInput, ipAddress, deviceType);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // Send welcome email (async, don't wait for it)
    // Only send if using a verified custom domain (not resend.dev)
    const emailFrom = process.env.EMAIL_FROM || 'onboarding@resend.dev';
    if (!emailFrom.includes('resend.dev')) {
      emailService.sendWelcomeEmail(validatedInput.email, validatedInput.fullName).catch((error) => {
        console.error('Failed to send welcome email:', error);
      });
    } else {
      console.log('📧 Welcome email skipped (using Resend test domain - verify a custom domain to enable)');
    }

    // Send OTP for phone verification (with email backup)
    const otpResult = await otpService.sendOTP(
      validatedInput.phone, 
      ipAddress, 
      deviceType,
      validatedInput.email, // Pass email for backup OTP delivery
      validatedInput.fullName // Pass fullName for email personalization
    );
    
    if (!otpResult.success) {
      console.error('Failed to send OTP:', otpResult.message);
      // Don't fail registration if OTP fails, user can request resend
    }

    return NextResponse.json(
      {
        success: true,
        userId: result.userId,
        message: 'Registration successful. Please verify your phone number.',
        phone: validatedInput.phone, // Include phone for OTP verification page
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    console.error('Registration API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to detect device type from user agent
 */
function getDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' {
  const ua = userAgent.toLowerCase();
  
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    return 'mobile';
  }
  
  return 'desktop';
}
