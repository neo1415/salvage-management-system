import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const suspendSchema = z.object({
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
});

/**
 * POST /api/admin/users/[id]/suspend
 * Suspend a user account
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'system_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Prevent self-suspension
    if (id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot suspend your own account' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validationResult = suspendSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existingUser.status === 'suspended') {
      return NextResponse.json(
        { error: 'User is already suspended' },
        { status: 400 }
      );
    }

    // Suspend user
    const [suspendedUser] = await db
      .update(users)
      .set({
        status: 'suspended',
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'user_suspended',
      entityType: 'user',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      deviceType: 'desktop',
      userAgent: request.headers.get('user-agent')?.substring(0, 500) || 'unknown',
      beforeState: existingUser,
      afterState: {
        ...suspendedUser,
        suspensionReason: validationResult.data.reason,
        suspendedBy: session.user.id,
        suspendedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User suspended successfully',
      user: suspendedUser,
    });
  } catch (error) {
    console.error('Failed to suspend user:', error);
    return NextResponse.json({ error: 'Failed to suspend user' }, { status: 500 });
  }
}
