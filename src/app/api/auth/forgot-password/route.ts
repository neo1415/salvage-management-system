import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { redis } from '@/lib/redis/client';
import { emailService } from '@/features/notifications/services/email.service';
import crypto from 'crypto';

/**
 * POST /api/auth/forgot-password
 * Send password reset link to user's email
 */
export async function POST(request: NextRequest) {
  try {
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
      const resetTokenExpiry = Date.now() + 3600000; // 1 hour

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
      
      await emailService.sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #800020;">Password Reset Request</h2>
            <p>Hello ${user.fullName},</p>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #800020; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${resetUrl}</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              NEM Insurance Salvage Management System
            </p>
          </div>
        `,
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
