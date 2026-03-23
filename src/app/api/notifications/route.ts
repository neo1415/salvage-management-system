/**
 * Notifications API Routes
 * 
 * GET  /api/notifications - List notifications for authenticated user
 * POST /api/notifications - Create notification (admin/system only)
 * 
 * Requirements: Phase 3 - Global Notification System
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import {
  getNotifications,
  createNotification,
  CreateNotificationInput,
} from '@/features/notifications/services/notification.service';

/**
 * GET /api/notifications
 * List notifications for authenticated user
 * 
 * Query params:
 * - limit: number (default: 20)
 * - offset: number (default: 0)
 * - unreadOnly: boolean (default: false)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: 'error', error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    // Validate parameters
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { status: 'error', error: { code: 'VALIDATION_ERROR', message: 'Limit must be between 1 and 100' } },
        { status: 400 }
      );
    }

    if (offset < 0) {
      return NextResponse.json(
        { status: 'error', error: { code: 'VALIDATION_ERROR', message: 'Offset must be non-negative' } },
        { status: 400 }
      );
    }

    // Fetch notifications
    const notifications = await getNotifications(session.user.id, {
      limit,
      offset,
      unreadOnly,
    });

    return NextResponse.json({
      status: 'success',
      data: {
        notifications,
        meta: {
          limit,
          offset,
          count: notifications.length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { status: 'error', error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notifications' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Create notification (admin/system only)
 * 
 * Body:
 * - userId: string
 * - type: NotificationType
 * - title: string
 * - message: string
 * - data?: NotificationData
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { status: 'error', error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check if user is admin/system
    const isAdmin = session.user.role === 'system_admin' || session.user.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json(
        { status: 'error', error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    // Parse request body
    const body: CreateNotificationInput = await request.json();

    // Validate required fields
    if (!body.userId || !body.type || !body.title || !body.message) {
      return NextResponse.json(
        { status: 'error', error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Create notification
    const notification = await createNotification(body);

    return NextResponse.json(
      {
        status: 'success',
        data: { notification },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { status: 'error', error: { code: 'INTERNAL_ERROR', message: 'Failed to create notification' } },
      { status: 500 }
    );
  }
}
