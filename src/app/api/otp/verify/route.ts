import { NextRequest, NextResponse } from 'next/server';
import { otpService } from '@/features/auth/services/otp.service';
import { redis } from '@/lib/redis/client';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';
import { Ratelimit } from '@upstash/ratelimit';

// SECURITY: Rate limiting for OTP verification endpoint
// Prevents brute force OTP guessing attacks
const verifyOtpRateLimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, '15 m'), // 10 attempts per 15 minutes per IP
  analytics: true,
  prefix: 'ratelimit:verify-otp',
});



/**
 * POST /api/auth/verify-otp
 * Verify OTP for phone number verification
 * Supports both regular registration and OAuth completion
 * 
 * Security features:
 * - Rate limiting: 10 verification attempts per 15 minutes per IP
 * - Audit logging
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting check
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    const { success, limit, remaining, reset } = await verifyOtpRateLimit.limit(ipAddress);

    if (!success) {
      console.warn('[Security] OTP verification rate limit exceeded', {
        ip: ipAddress,
        limit,
        remaining,
        resetAt: new Date(reset).toISOString(),
      });

      return NextResponse.json(
        {
          error: 'Too many verification attempts. Please try again later.',
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

    const body = await request.json();
    const { phone, otp, email, type } = body;

    // Validate input
    if (!phone || !otp) {
      return NextResponse.json(
        { error: 'Phone number and OTP are required' },
        { status: 400 }
      );
    }

    // Get device type
    const userAgent = request.headers.get('user-agent') || '';
    const deviceType = userAgent.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

    // Verify OTP
    const result = await otpService.verifyOTP(
      phone,
      otp,
      ipAddress,
      deviceType as 'mobile' | 'desktop' | 'tablet'
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    // Update user's last login timestamp after successful OTP verification
    if (result.userId) {
      await db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, result.userId));
      
      // IMPORTANT: After OTP verification, the user needs to be authenticated
      // The client should call signIn() with the userId to create a session
      // Then the middleware will check BVN verification status and redirect if needed
    }

    // If this is OAuth completion, create the user account now
    if (type === 'oauth' && email) {
      const tempKey = `oauth_temp:${email}`;
      const tempDataStr = await redis.get(tempKey);

      if (!tempDataStr) {
        return NextResponse.json(
          { error: 'OAuth session expired. Please try again.' },
          { status: 400 }
        );
      }

      const tempData = JSON.parse(tempDataStr as string);

      // Create user account
      try {
        const [newUser] = await db
          .insert(users)
          .values({
            email: tempData.email,
            phone: tempData.phone,
            passwordHash: '', // No password for OAuth users
            fullName: tempData.name,
            dateOfBirth: new Date('1990-01-01'), // Placeholder, will be updated during KYC
            role: 'vendor',
            status: 'unverified_tier_0',
            lastLoginAt: new Date(),
          })
          .returning();

        // Create audit log
        await db.insert(auditLogs).values({
          userId: newUser.id,
          actionType: 'oauth_registration_completed',
          entityType: 'user',
          entityId: newUser.id,
          ipAddress,
          deviceType: deviceType as 'mobile' | 'desktop' | 'tablet',
          userAgent,
          afterState: {
            email: tempData.email,
            phone: tempData.phone,
            provider: tempData.provider,
            registrationMethod: 'oauth',
          },
        });

        // Clean up temporary data
        await redis.del(tempKey);

        return NextResponse.json({
          success: true,
          message: 'Registration completed successfully',
          userId: newUser.id,
          isOAuthComplete: true,
        });
      } catch (error) {
        console.error('OAuth user creation error:', error);
        return NextResponse.json(
          { error: 'Failed to create user account' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      userId: result.userId,
    });
  } catch (error) {
    console.error('Verify OTP API error:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP. Please try again.' },
      { status: 500 }
    );
  }
}

