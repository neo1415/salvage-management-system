import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';

/**
 * DELETE /api/admin/delete-user?email=xxx
 * GET /api/admin/delete-user?email=xxx (for browser convenience)
 * Delete a user by email (for testing purposes)
 */
export async function GET(request: NextRequest) {
  return handleDeleteUser(request);
}

export async function DELETE(request: NextRequest) {
  return handleDeleteUser(request);
}

async function handleDeleteUser(request: NextRequest) {
  try {
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

    // Delete user
    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.email, email))
      .returning();

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
