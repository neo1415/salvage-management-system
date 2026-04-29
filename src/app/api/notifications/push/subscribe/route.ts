import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db';
import { pushSubscriptions } from '@/lib/db/schema/push-subscriptions';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
  userAgent: z.string().optional(),
});

/**
 * POST /api/notifications/push/subscribe
 * Subscribe user to push notifications
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = subscribeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid subscription data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { endpoint, keys, userAgent } = validation.data;

    // Check if subscription already exists
    const existing = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .limit(1);

    if (existing.length > 0) {
      // Update existing subscription
      await db
        .update(pushSubscriptions)
        .set({
          active: true,
          updatedAt: new Date(),
          lastUsedAt: new Date(),
        })
        .where(eq(pushSubscriptions.endpoint, endpoint));

      return NextResponse.json({
        success: true,
        message: 'Subscription updated',
        subscriptionId: existing[0].id,
      });
    }

    // Create new subscription
    const [subscription] = await db
      .insert(pushSubscriptions)
      .values({
        userId: session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || request.headers.get('user-agent') || undefined,
        active: true,
        lastUsedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Subscribed to push notifications',
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error('Push subscription error:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe to push notifications' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/push/subscribe
 * Unsubscribe user from push notifications
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint required' }, { status: 400 });
    }

    // Deactivate subscription
    await db
      .update(pushSubscriptions)
      .set({
        active: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pushSubscriptions.userId, session.user.id),
          eq(pushSubscriptions.endpoint, endpoint)
        )
      );

    return NextResponse.json({
      success: true,
      message: 'Unsubscribed from push notifications',
    });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Failed to unsubscribe from push notifications' },
      { status: 500 }
    );
  }
}
