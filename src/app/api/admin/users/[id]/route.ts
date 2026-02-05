import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Validation schema for user updates
const updateUserSchema = z.object({
  fullName: z.string().min(2).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/).optional(),
  role: z.enum(['vendor', 'claims_adjuster', 'salvage_manager', 'finance_officer', 'system_admin']).optional(),
  status: z.enum(['unverified_tier_0', 'phone_verified_tier_0', 'verified_tier_1', 'verified_tier_2', 'suspended', 'deleted']).optional(),
});

/**
 * GET /api/admin/users/[id]
 * Get detailed user information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'system_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Remove sensitive data
    const { passwordHash, ...userWithoutPassword } = user;

    return NextResponse.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Update user details
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'system_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const body = await request.json();
    const validationResult = updateUserSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    // Get existing user
    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent self-demotion
    if (id === session.user.id && validationResult.data.role && validationResult.data.role !== 'system_admin') {
      return NextResponse.json(
        { error: 'Cannot change your own role' },
        { status: 403 }
      );
    }

    // Update user
    const [updatedUser] = await db
      .update(users)
      .set({
        ...validationResult.data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'user_updated',
      entityType: 'user',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      deviceType: 'desktop',
      userAgent: request.headers.get('user-agent')?.substring(0, 500) || 'unknown',
      beforeState: existingUser,
      afterState: updatedUser,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Soft delete a user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'system_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 403 }
      );
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Soft delete by setting status to 'deleted'
    const [deletedUser] = await db
      .update(users)
      .set({
        status: 'deleted',
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      userId: session.user.id,
      actionType: 'user_deleted',
      entityType: 'user',
      entityId: id,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      deviceType: 'desktop',
      userAgent: request.headers.get('user-agent')?.substring(0, 500) || 'unknown',
      beforeState: existingUser,
      afterState: deletedUser,
    });

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
