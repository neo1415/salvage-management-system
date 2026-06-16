import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth/next-auth.config';
import { db } from '@/lib/db';
import {
  notificationPreferences,
  pushSubscriptions,
} from '@/lib/db/schema/push-subscriptions';
import { sendPushToUser } from '@/features/notifications/services/push-subscription.service';

function configuredStatus() {
  return {
    vapidPublicKey: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    vapidPrivateKey: Boolean(process.env.VAPID_PRIVATE_KEY),
    vapidSubject: Boolean(process.env.VAPID_SUBJECT || process.env.SUPPORT_EMAIL),
  };
}

async function getUserPushState(userId: string) {
  const [subscriptions, [preferences]] = await Promise.all([
    db
      .select({
        id: pushSubscriptions.id,
        userAgent: pushSubscriptions.userAgent,
        createdAt: pushSubscriptions.createdAt,
        updatedAt: pushSubscriptions.updatedAt,
        lastUsedAt: pushSubscriptions.lastUsedAt,
      })
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.active, true)
        )
      ),
    db
      .select({
        pushEnabled: notificationPreferences.pushEnabled,
      })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1),
  ]);

  return {
    activeSubscriptionCount: subscriptions.length,
    pushEnabled: preferences?.pushEnabled ?? true,
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      userAgent: subscription.userAgent,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      lastUsedAt: subscription.lastUsedAt,
    })),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pushState = await getUserPushState(session.user.id);

  return NextResponse.json({
    success: true,
    configured: configuredStatus(),
    ...pushState,
  });
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const configured = configuredStatus();
  if (!configured.vapidPublicKey || !configured.vapidPrivateKey) {
    return NextResponse.json(
      {
        success: false,
        configured,
        error: 'Push notifications are not fully configured',
      },
      { status: 503 }
    );
  }

  const pushState = await getUserPushState(session.user.id);
  if (pushState.activeSubscriptionCount === 0) {
    return NextResponse.json(
      {
        success: false,
        configured,
        ...pushState,
        error: 'No active push subscription found for this device account',
      },
      { status: 409 }
    );
  }

  const result = await sendPushToUser(session.user.id, {
    title: 'Push notifications are working',
    body: 'This device can receive Salvage Bridge push notifications.',
    tag: `push-test-${session.user.id}`,
    requireInteraction: false,
    data: {
      type: 'push_test',
      url: '/notifications',
    },
  });

  return NextResponse.json({
    success: result.success,
    configured,
    ...pushState,
    sentCount: result.sentCount,
    errors: result.errors,
    requestedAt: new Date().toISOString(),
  }, { status: result.success ? 200 : 502 });
}
