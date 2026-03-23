/**
 * Mark All Read API Route
 * 
 * POST /api/notifications/mark-all-read - Mark all notifications as read
 * 
 * Requirements: Phase 3 - Global Notification System
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { markAllAsRead } from '@/features/notifications/services/notification.service';

/**
 * POST /api/notifications/mark-all-read
 * Mark all notifications as read for authenticated user
 */
export async function POST(_request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: 'error', error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Mark all as read
    const count = await markAllAsRead(session.user.id);

    return NextResponse.json({
      status: 'success',
      data: {
        message: `${count} notification${count !== 1 ? 's' : ''} marked as read`,
        count,
      },
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      { status: 'error', error: { code: 'INTERNAL_ERROR', message: 'Failed to mark all notifications as read' } },
      { status: 500 }
    );
  }
}
