import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';

/**
 * POST /api/admin/users/[id]/unsuspend
 * Unsuspend a user account
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

    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existingUser.status !== 'suspended') {
      return NextResponse.json(
        { error: 'User is not suspended' },
        { status: 400 }
      );
    }

    // Restore to phone_verified_tier_0 as default
    const [unsuspendedUser] = await db
      .update(users)
      .set({
        status: 'phone_verified_tier_0',
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'user_unsuspended',
      entityType: 'user',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      deviceType: 'desktop',
      userAgent: request.headers.get('user-agent')?.substring(0, 500) || 'unknown',
      beforeState: existingUser,
      afterState: {
        ...unsuspendedUser,
        unsuspendedBy: session.user.id,
        unsuspendedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User unsuspended successfully',
      user: unsuspendedUser,
    });
  } catch (error) {
    console.error('Failed to unsuspend user:', error);
    return NextResponse.json({ error: 'Failed to unsuspend user' }, { status: 500 });
  }
}
