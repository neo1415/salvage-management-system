/**
 * Single Notification API Routes
 * 
 * PATCH  /api/notifications/[id] - Mark notification as read
 * DELETE /api/notifications/[id] - Delete notification
 * 
 * Requirements: Phase 3 - Global Notification System
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import {
  markAsRead,
  deleteNotification,
} from '@/features/notifications/services/notification.service';

/**
 * PATCH /api/notifications/[id]
 * Mark notification as read
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: 'error', error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Await params in Next.js 15+
    const { id: notificationId } = await params;

    // Mark as read
    const notification = await markAsRead(notificationId, session.user.id);

    return NextResponse.json({
      status: 'success',
      data: { notification },
    });
  } catch (error: any) {
    console.error('Error marking notification as read:', error);

    if (error.message === 'Notification not found or unauthorized') {
      return NextResponse.json(
        { status: 'error', error: { code: 'NOT_FOUND', message: error.message } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { status: 'error', error: { code: 'INTERNAL_ERROR', message: 'Failed to mark notification as read' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/[id]
 * Delete notification
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: 'error', error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Await params in Next.js 15+
    const { id: notificationId } = await params;

    // Delete notification
    await deleteNotification(notificationId, session.user.id);

    return NextResponse.json(
      {
        status: 'success',
        data: { message: 'Notification deleted successfully' },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting notification:', error);

    if (error.message === 'Notification not found or unauthorized') {
      return NextResponse.json(
        { status: 'error', error: { code: 'NOT_FOUND', message: error.message } },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { status: 'error', error: { code: 'INTERNAL_ERROR', message: 'Failed to delete notification' } },
      { status: 500 }
    );
  }
}
