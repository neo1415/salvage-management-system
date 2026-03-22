/**
 * Unread Count API Route
 * 
 * GET /api/notifications/unread-count - Get unread notification count
 * 
 * Requirements: Phase 3 - Global Notification System
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { getUnreadCount } from '@/features/notifications/services/notification.service';

/**
 * GET /api/notifications/unread-count
 * Get unread notification count for authenticated user
 */
export async function GET(_request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: 'error', error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Get unread count
    const count = await getUnreadCount(session.user.id);

    return NextResponse.json({
      status: 'success',
      data: { count },
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return NextResponse.json(
      { status: 'error', error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch unread count' } },
      { status: 500 }
    );
  }
}
