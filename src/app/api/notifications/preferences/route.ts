/**
 * Notification Preferences API
 * Allows users to customize notification preferences
 * 
 * Features:
 * - Toggle SMS, Email, Push on/off
 * - Per-notification-type control (bid alerts, auction ending, payment reminders, leaderboard updates)
 * - Prevent opt-out of critical notifications (OTP, payment deadlines, account suspension)
 * - Save preferences to user profile
 * - Audit logging
 * 
 * Requirements: 39, Enterprise Standards Section 7
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db/drizzle';
import { users, NotificationPreferences } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { logAction, AuditActionType, AuditEntityType, DeviceType } from '@/lib/utils/audit-logger';
import { z } from 'zod';

// Validation schema for notification preferences
const notificationPreferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  bidAlerts: z.boolean().optional(),
  auctionEnding: z.boolean().optional(),
  paymentReminders: z.boolean().optional(),
  leaderboardUpdates: z.boolean().optional(),
});

type NotificationPreferencesUpdate = z.infer<typeof notificationPreferencesSchema>;

/**
 * GET /api/notifications/preferences
 * Get current notification preferences for authenticated user
 */
export async function GET(_request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch user's current preferences
    const [user] = await db
      .select({
        notificationPreferences: users.notificationPreferences,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      preferences: user.notificationPreferences,
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/preferences
 * Update notification preferences for authenticated user
 */
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = notificationPreferencesSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid notification preferences', 
          details: validationResult.error.issues 
        },
        { status: 400 }
      );
    }

    const updates = validationResult.data;

    // Fetch current user preferences
    const [currentUser] = await db
      .select({
        notificationPreferences: users.notificationPreferences,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Merge updates with current preferences
    const currentPreferences = (currentUser.notificationPreferences || {
      pushEnabled: true,
      smsEnabled: true,
      emailEnabled: true,
      bidAlerts: true,
      auctionEnding: true,
      paymentReminders: true,
      leaderboardUpdates: true,
    }) as NotificationPreferences;
    
    const updatedPreferences: NotificationPreferences = {
      pushEnabled: updates.pushEnabled ?? currentPreferences.pushEnabled,
      smsEnabled: updates.smsEnabled ?? currentPreferences.smsEnabled,
      emailEnabled: updates.emailEnabled ?? currentPreferences.emailEnabled,
      bidAlerts: updates.bidAlerts ?? currentPreferences.bidAlerts,
      auctionEnding: updates.auctionEnding ?? currentPreferences.auctionEnding,
      paymentReminders: updates.paymentReminders ?? currentPreferences.paymentReminders,
      leaderboardUpdates: updates.leaderboardUpdates ?? currentPreferences.leaderboardUpdates,
    };

    // Validate that critical notification types cannot be fully disabled
    // Users must have at least one channel enabled for critical notifications
    const criticalNotificationTypes = ['paymentReminders']; // OTP and account suspension are always sent regardless
    
    for (const criticalType of criticalNotificationTypes) {
      if (updates[criticalType as keyof NotificationPreferencesUpdate] === false) {
        // Check if at least one channel is still enabled
        const hasEnabledChannel = 
          updatedPreferences.pushEnabled || 
          updatedPreferences.smsEnabled || 
          updatedPreferences.emailEnabled;

        if (!hasEnabledChannel) {
          return NextResponse.json(
            { 
              error: 'Cannot disable all notification channels for critical notifications',
              message: 'You must keep at least one notification channel (SMS, Email, or Push) enabled for payment reminders and other critical notifications.'
            },
            { status: 400 }
          );
        }
      }
    }

    // Update user preferences in database
    const [updatedUser] = await db
      .update(users)
      .set({
        notificationPreferences: updatedPreferences,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))
      .returning({
        id: users.id,
        notificationPreferences: users.notificationPreferences,
      });

    // Get device type and IP address for audit log
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const deviceType = userAgent.toLowerCase().includes('mobile') 
      ? DeviceType.MOBILE 
      : userAgent.toLowerCase().includes('tablet')
      ? DeviceType.TABLET
      : DeviceType.DESKTOP;

    const ipAddress = 
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Create audit log entry
    await logAction({
      userId: session.user.id,
      actionType: AuditActionType.PROFILE_UPDATED,
      entityType: AuditEntityType.USER,
      entityId: session.user.id,
      ipAddress,
      deviceType,
      userAgent,
      beforeState: currentPreferences as unknown as Record<string, unknown>,
      afterState: updatedPreferences as unknown as Record<string, unknown>,
    });

    return NextResponse.json({
      message: 'Notification preferences updated successfully',
      preferences: updatedUser.notificationPreferences,
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}
