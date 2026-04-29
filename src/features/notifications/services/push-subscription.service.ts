/**
 * Push Subscription Service
 * Server-side service for managing push subscriptions and sending notifications
 */

import { db } from '@/lib/db';
import { pushSubscriptions, notificationPreferences } from '@/lib/db/schema/push-subscriptions';
import { eq, and } from 'drizzle-orm';
import webpush from 'web-push';

// Configure VAPID details
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:nemsupport@nem-insurance.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

/**
 * Get all active push subscriptions for a user
 */
export async function getUserPushSubscriptions(
  userId: string
): Promise<PushSubscriptionData[]> {
  try {
    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.active, true)
        )
      );

    return subscriptions.map((sub) => ({
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    }));
  } catch (error) {
    console.error('Error getting user push subscriptions:', error);
    return [];
  }
}

/**
 * Get user notification preferences
 */
export async function getUserNotificationPreferences(userId: string) {
  try {
    const [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    return preferences || null;
  } catch (error) {
    console.error('Error getting user notification preferences:', error);
    return null;
  }
}

/**
 * Send push notification to a user
 */
export async function sendPushToUser(
  userId: string,
  payload: NotificationPayload
): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
  try {
    // Get user's push subscriptions
    const subscriptions = await getUserPushSubscriptions(userId);

    if (subscriptions.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return { success: false, sentCount: 0, errors: ['No subscriptions'] };
    }

    // Get user preferences
    const preferences = await getUserNotificationPreferences(userId);

    // Check if push is enabled
    if (preferences && !preferences.pushEnabled) {
      console.log(`Push notifications disabled for user ${userId}`);
      return { success: false, sentCount: 0, errors: ['Push disabled'] };
    }

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map((subscription) =>
        webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.keys.p256dh,
              auth: subscription.keys.auth,
            },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/icons/Nem-insurance-Logo.jpg',
            badge: payload.badge || '/icons/Nem-insurance-Logo.jpg',
            data: payload.data || {},
            tag: payload.tag || 'default',
            requireInteraction: payload.requireInteraction || false,
            actions: payload.actions || [],
          })
        )
      )
    );

    // Count successes and collect errors
    let sentCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        sentCount++;
        
        // Update last used timestamp
        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.endpoint, subscriptions[i].endpoint));
      } else {
        errors.push(result.reason?.message || 'Unknown error');
        
        // If subscription is invalid (410 Gone), deactivate it
        if (result.reason?.statusCode === 410) {
          await db
            .update(pushSubscriptions)
            .set({ active: false })
            .where(eq(pushSubscriptions.endpoint, subscriptions[i].endpoint));
        }
      }
    }

    return {
      success: sentCount > 0,
      sentCount,
      errors,
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return {
      success: false,
      sentCount: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/**
 * Send outbid alert
 */
export async function sendOutbidAlert(
  userId: string,
  auctionId: string,
  auctionTitle: string,
  newBidAmount: string,
  timeRemaining: string
): Promise<{ success: boolean; sentCount: number }> {
  const preferences = await getUserNotificationPreferences(userId);

  // Check if bid alerts are enabled
  if (preferences && !preferences.bidAlerts) {
    console.log(`Bid alerts disabled for user ${userId}`);
    return { success: false, sentCount: 0 };
  }

  const result = await sendPushToUser(userId, {
    title: "You've Been Outbid!",
    body: `${auctionTitle} - New bid: ${newBidAmount}. ${timeRemaining} remaining.`,
    tag: 'outbid-alert',
    requireInteraction: true,
    data: {
      type: 'outbid',
      auctionId,
      auctionTitle,
      newBidAmount,
      timeRemaining,
    },
    actions: [
      { action: 'view', title: 'View Auction' },
      { action: 'bid', title: 'Place Bid' },
    ],
  });

  return { success: result.success, sentCount: result.sentCount };
}

/**
 * Send auction ending soon alert
 */
export async function sendAuctionEndingSoon(
  userId: string,
  auctionId: string,
  auctionTitle: string,
  timeRemaining: string
): Promise<{ success: boolean; sentCount: number }> {
  const preferences = await getUserNotificationPreferences(userId);

  // Check if auction ending alerts are enabled
  if (preferences && !preferences.auctionEnding) {
    console.log(`Auction ending alerts disabled for user ${userId}`);
    return { success: false, sentCount: 0 };
  }

  const result = await sendPushToUser(userId, {
    title: '⏰ Auction Ending Soon!',
    body: `${auctionTitle} ends in ${timeRemaining}. Place your bid now!`,
    tag: 'auction-ending',
    requireInteraction: true,
    data: {
      type: 'auction-ending',
      auctionId,
      auctionTitle,
      timeRemaining,
    },
    actions: [{ action: 'view', title: 'View Auction' }],
  });

  return { success: result.success, sentCount: result.sentCount };
}

/**
 * Send payment confirmation
 */
export async function sendPaymentConfirmation(
  userId: string,
  auctionTitle: string,
  amount: string,
  pickupAuthCode: string
): Promise<{ success: boolean; sentCount: number }> {
  const preferences = await getUserNotificationPreferences(userId);

  // Check if payment reminders are enabled
  if (preferences && !preferences.paymentReminders) {
    console.log(`Payment reminders disabled for user ${userId}`);
    return { success: false, sentCount: 0 };
  }

  const result = await sendPushToUser(userId, {
    title: '✅ Payment Confirmed!',
    body: `${amount} payment confirmed for ${auctionTitle}. Pickup code: ${pickupAuthCode}`,
    tag: 'payment-confirmation',
    requireInteraction: false,
    data: {
      type: 'payment-confirmation',
      auctionTitle,
      amount,
      pickupAuthCode,
    },
    actions: [{ action: 'view', title: 'View Details' }],
  });

  return { success: result.success, sentCount: result.sentCount };
}

/**
 * Send leaderboard update
 */
export async function sendLeaderboardUpdate(
  userId: string,
  position: number,
  change: string
): Promise<{ success: boolean; sentCount: number }> {
  const preferences = await getUserNotificationPreferences(userId);

  // Check if leaderboard updates are enabled
  if (preferences && !preferences.leaderboardUpdates) {
    console.log(`Leaderboard updates disabled for user ${userId}`);
    return { success: false, sentCount: 0 };
  }

  const result = await sendPushToUser(userId, {
    title: '🏆 Leaderboard Update!',
    body: `You're now #${position} on the leaderboard (${change})!`,
    tag: 'leaderboard-update',
    requireInteraction: false,
    data: {
      type: 'leaderboard-update',
      position,
      change,
    },
    actions: [{ action: 'view', title: 'View Leaderboard' }],
  });

  return { success: result.success, sentCount: result.sentCount };
}
