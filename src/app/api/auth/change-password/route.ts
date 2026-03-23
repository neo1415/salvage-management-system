import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { hash, compare } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for password change
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

/**
 * POST /api/auth/change-password
 * Change user password (including forced password change for new staff accounts)
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = changePasswordSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues.map((err: z.ZodIssue) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validationResult.data;

    // Get user from database
    const [user] = await db
      .select()
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
    const isValidPassword = await compare(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Check if new password is same as current password
    const isSamePassword = await compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    // Hash new password with bcrypt (12 rounds)
    const newPasswordHash = await hash(newPassword, 12);

    // Update password and clear requirePasswordChange flag
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        requirePasswordChange: 'false',
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    // Get IP address and user agent for audit log
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Create audit log entry
    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'password_changed',
      entityType: 'user',
      entityId: session.user.id,
      ipAddress,
      deviceType: 'desktop',
      userAgent: userAgent.substring(0, 500),
      afterState: {
        passwordChangedAt: new Date().toISOString(),
        wasForced: user.requirePasswordChange === 'true',
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Password changed successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json(
      {
        error: 'Failed to change password',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
