import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';
import { redis } from '@/lib/redis/client';
import { hash } from 'bcryptjs';

/**
 * POST /api/auth/reset-password
 * Reset user password using a valid reset token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    // Validate password
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Get token data from Redis
    const resetKey = `password_reset:${token}`;
    const tokenDataStr = await redis.get(resetKey);

    if (!tokenDataStr) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Parse token data - handle both string and object responses from Redis
    let tokenData;
    if (typeof tokenDataStr === 'string') {
      tokenData = JSON.parse(tokenDataStr);
    } else {
      tokenData = tokenDataStr;
    }
    
    const { userId, email } = tokenData;

    // Hash new password
    const passwordHash = await hash(password, 12);

    // Update user password and remove requirePasswordChange flag
    await db
      .update(users)
      .set({
        passwordHash,
        requirePasswordChange: 'false',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Delete the reset token
    await redis.del(resetKey);

    // Create audit log
    const ipAddress = 
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    await db.insert(auditLogs).values({
      userId,
      actionType: 'password_reset',
      entityType: 'user',
      entityId: userId,
      ipAddress,
      deviceType: 'desktop',
      userAgent: request.headers.get('user-agent') || 'unknown',
      afterState: {
        method: 'reset_link',
        email,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Password reset successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
