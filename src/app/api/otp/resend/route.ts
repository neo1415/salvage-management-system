import { NextRequest, NextResponse } from 'next/server';
import { otpService } from '@/features/auth/services/otp.service';
import { redis } from '@/lib/redis/client';
import { Ratelimit } from '@upstash/ratelimit';

// SECURITY: Rate limiting for OTP resend endpoint
// Prevents SMS/email spam
const resendOtpRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(3, '15 m'), // 3 resends per 15 minutes per phone
  analytics: true,
  prefix: 'ratelimit:resend-otp',
});

/**
 * GET /api/otp/resend
 * Resend OTP to phone number
 * 
 * Security features:
 * - Rate limiting: 3 resends per 15 minutes per phone number
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // SECURITY: Rate limiting check (per phone number to prevent spam)
    const { success, limit, remaining, reset } = await resendOtpRateLimit.limit(phone);

    if (!success) {
      console.warn('[Security] OTP resend rate limit exceeded', {
        phone,
        limit,
        remaining,
        resetAt: new Date(reset).toISOString(),
      });

      return NextResponse.json(
        {
          error: 'Too many OTP resend requests. Please try again later.',
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

    // Get IP address and device type
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

    // Get user email and fullName for backup OTP delivery
    let email: string | undefined;
    let fullName: string | undefined;
    
    try {
      const { db } = await import('@/lib/db/drizzle');
      const { users } = await import('@/lib/db/schema/users');
      const { eq } = await import('drizzle-orm');
      
      const user = await db
        .select()
        .from(users)
        .where(eq(users.phone, phone))
        .limit(1);
      
      if (user.length > 0) {
        email = user[0].email;
        fullName = user[0].fullName;
      }
    } catch (error) {
      // Log error but don't fail - SMS is primary
      console.warn('Failed to fetch user for email backup:', error);
    }

    // Send OTP (with email backup if user exists)
    const result = await otpService.sendOTP(
      phone,
      ipAddress,
      deviceType as 'mobile' | 'desktop' | 'tablet',
      email,
      fullName
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Resend OTP API error:', error);
    return NextResponse.json(
      { error: 'Failed to resend OTP. Please try again.' },
      { status: 500 }
    );
  }
}
