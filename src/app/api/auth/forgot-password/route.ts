import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { redis } from '@/lib/redis/client';
import { emailService } from '@/features/notifications/services/email.service';
import { getEmailBranding } from '@/features/notifications/templates/email-branding';
import { wrapProfessionalEmail } from '@/features/notifications/templates/wrap-professional-email';
import crypto from 'crypto';
import { Ratelimit } from '@upstash/ratelimit';

const forgotPasswordRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  analytics: true,
  prefix: 'ratelimit:forgot-password',
});

/**
 * POST /api/auth/forgot-password
 * Send password reset link to user's email
 */
export async function POST(request: NextRequest) {
  try {
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rateLimitResult = await forgotPasswordRateLimit.limit(ipAddress);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: true,
          message: 'If an account exists with that email, a password reset link has been sent.',
        },
        {
          status: 200,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString(),
            'Retry-After': Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user && user.status !== 'deleted' && user.status !== 'suspended') {
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');

      // Store reset token in Redis
      const resetKey = `password_reset:${resetToken}`;
      await redis.set(
        resetKey,
        JSON.stringify({
          userId: user.id,
          email: user.email,
          createdAt: Date.now(),
        }),
        { ex: 3600 } // 1 hour expiry
      );

      // Send reset email
      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;
      const branding = await getEmailBranding();
      
      await emailService.sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        category: 'auth',
        html: await wrapProfessionalEmail(
          'Password Reset Request',
          `
            <p style="font-size: 18px; color: ${branding.primaryColor}; font-weight: 600;">Dear ${user.fullName},</p>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" class="button" style="display: inline-block; padding: 16px 32px; background: ${branding.primaryColor}; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 700;">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">${resetUrl}</p>
            <p style="color: #666; font-size: 14px; margin-top: 24px;">
              This link will expire in 1 hour. If you did not request a password reset, please ignore this email.
            </p>
          `,
          `Reset your ${branding.brandName} account password`
        ),
      });
    }

    // Always return success (security best practice)
    return NextResponse.json(
      {
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}
