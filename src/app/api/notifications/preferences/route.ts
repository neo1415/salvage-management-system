import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db';
import { notificationPreferences } from '@/lib/db/schema/push-subscriptions';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const preferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  bidAlerts: z.boolean().optional(),
  auctionEnding: z.boolean().optional(),
  paymentReminders: z.boolean().optional(),
  leaderboardUpdates: z.boolean().optional(),
});

/**
 * GET /api/notifications/preferences
 * Get user notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create preferences
    let [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, session.user.id))
      .limit(1);

    if (!preferences) {
      // Create default preferences with conflict handling
      try {
        [preferences] = await db
          .insert(notificationPreferences)
          .values({
            userId: session.user.id,
            pushEnabled: true,
            smsEnabled: true,
            emailEnabled: true,
            bidAlerts: true,
            auctionEnding: true,
            paymentReminders: true,
            leaderboardUpdates: false,
          })
          .onConflictDoNothing()
          .returning();

        // If onConflictDoNothing returned nothing, fetch the existing record
        if (!preferences) {
          [preferences] = await db
            .select()
            .from(notificationPreferences)
            .where(eq(notificationPreferences.userId, session.user.id))
            .limit(1);
        }
      } catch (error) {
        // If insert fails due to race condition, fetch the existing record
        console.log('Notification preferences already exist, fetching...');
        [preferences] = await db
          .select()
          .from(notificationPreferences)
          .where(eq(notificationPreferences.userId, session.user.id))
          .limit(1);
      }
    }

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    return NextResponse.json(
      { error: 'Failed to get notification preferences' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/preferences
 * Update user notification preferences
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = preferencesSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid preferences data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Check if preferences exist
    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, session.user.id))
      .limit(1);

    let preferences;

    if (existing) {
      // Update existing preferences
      [preferences] = await db
        .update(notificationPreferences)
        .set({
          ...updates,
          updatedAt: new Date(),
        })
        .where(eq(notificationPreferences.userId, session.user.id))
        .returning();
    } else {
      // Create new preferences
      [preferences] = await db
        .insert(notificationPreferences)
        .values({
          userId: session.user.id,
          pushEnabled: updates.pushEnabled ?? true,
          smsEnabled: updates.smsEnabled ?? true,
          emailEnabled: updates.emailEnabled ?? true,
          bidAlerts: updates.bidAlerts ?? true,
          auctionEnding: updates.auctionEnding ?? true,
          paymentReminders: updates.paymentReminders ?? true,
          leaderboardUpdates: updates.leaderboardUpdates ?? false,
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      message: 'Preferences updated',
      preferences,
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}
