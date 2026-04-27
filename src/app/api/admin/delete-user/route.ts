import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { auditLogs } from '@/lib/db/schema/audit-logs';
import { eq } from 'drizzle-orm';

/**
 * DELETE /api/admin/delete-user?email=xxx
 * Delete a user by email (for testing/admin purposes)
 * 
 * SECURITY: This endpoint is protected by:
 * 1. NextAuth session authentication (system_admin role required)
 * 2. OR CRON_SECRET for automated cleanup scripts
 * 
 * NOTE: This is a HARD DELETE for testing purposes only.
 * Production should use soft delete via /api/admin/users/[id]
 */
export async function DELETE(request: NextRequest) {
  return handleDeleteUser(request);
}

async function handleDeleteUser(request: NextRequest) {
  try {
    // SECURITY: Verify authentication - either admin user OR cron secret
    const session = await auth();
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    const isAdmin = session?.user?.role === 'system_admin';
    const isCronJob = cronSecret && authHeader === `Bearer ${cronSecret}`;
    
    if (!isAdmin && !isCronJob) {
      console.warn('[Security] Unauthorized delete-user attempt', {
        hasSession: !!session,
        userRole: session?.user?.role,
        hasAuthHeader: !!authHeader,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });
      
      return NextResponse.json(
        { error: 'Unauthorized: Admin access required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // Find user first
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found', email },
        { status: 404 }
      );
    }

    // Prevent self-deletion for admin users
    if (isAdmin && session?.user?.id === existingUser.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 403 }
      );
    }

    // Delete user (HARD DELETE - for testing only)
    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.email, email))
      .returning();

    // Create audit log
    if (isAdmin && session?.user?.id) {
      await db.insert(auditLogs).values({
        userId: session.user.id,
        actionType: 'user_hard_deleted',
        entityType: 'user',
        entityId: deletedUser.id,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        deviceType: 'desktop',
        userAgent: request.headers.get('user-agent')?.substring(0, 500) || 'unknown',
        beforeState: {
          email: existingUser.email,
          role: existingUser.role,
          status: existingUser.status,
        },
        afterState: {
          deleted: true,
          deletedBy: session.user.email,
          deletedAt: new Date().toISOString(),
        },
      });
    }

    console.log(`[Admin] User hard deleted: ${email} by ${isAdmin ? session?.user?.email : 'CRON'}`);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
      user: {
        id: deletedUser.id,
        email: deletedUser.email,
        name: deletedUser.fullName,
        phone: deletedUser.phone,
      },
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
