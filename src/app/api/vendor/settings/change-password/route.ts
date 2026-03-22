import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { logAction, AuditActionType, AuditEntityType, createAuditLogData } from '@/lib/utils/audit-logger';

/**
 * POST /api/vendor/settings/change-password
 * Change user password with validation
 * 
 * Body:
 * - currentPassword: string
 * - newPassword: string
 * 
 * Validates:
 * - Current password is correct
 * - New password meets requirements
 * - Rate limiting (3 attempts per hour)
 */

// Simple in-memory rate limiter for password changes
const passwordChangeAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userAttempts = passwordChangeAttempts.get(userId);

  if (!userAttempts || now > userAttempts.resetAt) {
    // Reset or initialize
    passwordChangeAttempts.set(userId, {
      count: 1,
      resetAt: now + 60 * 60 * 1000, // 1 hour
    });
    return true;
  }

  if (userAttempts.count >= 3) {
    return false;
  }

  userAttempts.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check rate limit
    if (!checkRateLimit(session.user.id)) {
      return NextResponse.json(
        { error: 'Too many password change attempts. Please try again in 1 hour.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    // Validate new password requirements
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    if (!/[a-z]/.test(newPassword)) {
      return NextResponse.json(
        { error: 'New password must contain at least one lowercase letter' },
        { status: 400 }
      );
    }

    if (!/[A-Z]/.test(newPassword)) {
      return NextResponse.json(
        { error: 'New password must contain at least one uppercase letter' },
        { status: 400 }
      );
    }

    if (!/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { error: 'New password must contain at least one number' },
        { status: 400 }
      );
    }

    if (!/[^a-zA-Z0-9]/.test(newPassword)) {
      return NextResponse.json(
        { error: 'New password must contain at least one special character' },
        { status: 400 }
      );
    }

    // Fetch user
    const [user] = await db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      await logAction(
        createAuditLogData(
          request,
          session.user.id,
          AuditActionType.PASSWORD_RESET,
          AuditEntityType.USER,
          session.user.id,
          undefined,
          { reason: 'Invalid current password', success: false }
        )
      );

      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    // Log successful password change
    await logAction(
      createAuditLogData(
        request,
        session.user.id,
        AuditActionType.PASSWORD_RESET,
        AuditEntityType.USER,
        session.user.id,
        undefined,
        { email: user.email, success: true }
      )
    );

    // Clear rate limit on success
    passwordChangeAttempts.delete(session.user.id);

    return NextResponse.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
}
