/**
 * Notification Service
 * 
 * Handles creation, retrieval, and management of in-app notifications.
 * Integrates with Socket.IO for real-time delivery.
 * 
 * Requirements: Phase 3 - Global Notification System
 */

import { db } from '@/lib/db/drizzle';
import { notifications, NotificationType, NotificationData } from '@/lib/db/schema/notifications';
import { notificationPreferences } from '@/lib/db/schema/push-subscriptions';
import { users } from '@/lib/db/schema/users';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { sendNotificationToUser } from '@/lib/socket/server';
import { sendPushToUser } from './push-subscription.service';
import { isTestOrPlaceholderEmail } from '@/lib/utils/notification-recipients';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
}

export interface GetNotificationsOptions {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

type NotificationRole = 'vendor' | 'claims_adjuster' | 'salvage_manager' | 'finance_officer' | 'system_admin';
type PreferenceToggle = 'bidAlerts' | 'auctionEnding' | 'paymentReminders' | 'leaderboardUpdates';

const DOCUMENT_SIGNING_TYPES = new Set<string>([
  'DOCUMENT_GENERATED',
  'DOCUMENT_SIGNED',
  'SIGNATURE_REQUIRED',
]);

function preferenceKeyForType(type: string): PreferenceToggle | null {
  switch (type) {
    case 'outbid':
      return 'bidAlerts';
    case 'auction_closing_soon':
      return 'auctionEnding';
    case 'payment_reminder':
    case 'PAYMENT_UNLOCKED':
    case 'PAYMENT_METHOD_SELECTION_REQUIRED':
    case 'payment_success':
      return 'paymentReminders';
    case 'leaderboard_update':
      return 'leaderboardUpdates';
    default:
      return null;
  }
}

async function getPreferences(userId: string) {
  const [preferences] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  return preferences || null;
}

async function shouldCreateInAppNotification(userId: string, type: string): Promise<boolean> {
  const preferences = await getPreferences(userId);
  const preferenceKey = preferenceKeyForType(type);

  if (!preferences) {
    return true;
  }

  if (preferenceKey && preferences[preferenceKey] === false) {
    return false;
  }

  return true;
}

function shouldSendBrowserPush(type: string): boolean {
  return !DOCUMENT_SIGNING_TYPES.has(type);
}

function notificationUrl(data?: NotificationData): string | undefined {
  const explicitUrl = data?.url;
  if (typeof explicitUrl === 'string' && explicitUrl.startsWith('/')) {
    return explicitUrl;
  }

  if (data?.paymentId) {
    return `/vendor/payments/${data.paymentId}`;
  }

  if (data?.auctionId) {
    return `/vendor/auctions/${data.auctionId}`;
  }

  if (data?.caseId) {
    return `/adjuster/cases/${data.caseId}`;
  }

  return undefined;
}

/**
 * Create a new notification
 * Stores in database and sends real-time via Socket.IO
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    const shouldCreate = await shouldCreateInAppNotification(input.userId, input.type);
    if (!shouldCreate) {
      console.log(`Notification skipped by user preferences for ${input.userId}: ${input.type}`);
      return null;
    }

    // Insert notification into database
    const [notification] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data || null,
        read: false,
      })
      .returning();

    // Send real-time notification via Socket.IO
    await sendNotificationToUser(input.userId, notification);

    if (shouldSendBrowserPush(input.type)) {
      void sendPushToUser(input.userId, {
        title: input.title,
        body: input.message.length > 140 ? `${input.message.slice(0, 137)}...` : input.message,
        tag: input.type,
        data: {
          ...(input.data || {}),
          type: input.type,
          url: notificationUrl(input.data),
          notificationId: notification.id,
        },
      }).catch((pushError) => {
        console.error('Error sending browser push notification:', pushError);
      });
    }

    console.log(`✅ Notification created for user ${input.userId}: ${input.type}`);

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw new Error('Failed to create notification');
  }
}

/**
 * Create the same notification for all users with the supplied roles.
 */
export async function createRoleNotifications(
  roles: NotificationRole[],
  notification: Omit<CreateNotificationInput, 'userId'>,
  options?: { excludeTestRecipients?: boolean }
) {
  const excludeTest = options?.excludeTestRecipients ?? false;

  const roleUsers = await db
    .select({ id: users.id, email: users.email, status: users.status })
    .from(users)
    .where(inArray(users.role, roles));

  const activeRoleUsers = roleUsers.filter((user) => user.status !== 'suspended' && user.status !== 'deleted');

  const recipients = excludeTest
    ? activeRoleUsers.filter((user) => !isTestOrPlaceholderEmail(user.email))
    : activeRoleUsers;

  const results = await Promise.allSettled(
    recipients.map((user) =>
      createNotification({
        ...notification,
        userId: user.id,
      })
    )
  );

  const sentCount = results.filter((result) => result.status === 'fulfilled').length;
  console.log(
    `Created ${sentCount}/${recipients.length} role notifications for ${roles.join(', ')}` +
      (activeRoleUsers.length < roleUsers.length
        ? ` (${roleUsers.length - activeRoleUsers.length} inactive accounts skipped)`
        : '') +
      (excludeTest && recipients.length < roleUsers.length
        ? ` (${activeRoleUsers.length - recipients.length} test accounts skipped)`
        : '')
  );

  return { sentCount, targetCount: recipients.length };
}

/**
 * Get notifications for a user
 * Supports pagination and filtering by read status
 */
export async function getNotifications(
  userId: string,
  options: GetNotificationsOptions = {}
) {
  try {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    // Build query conditions
    const conditions = [eq(notifications.userId, userId)];
    if (unreadOnly) {
      conditions.push(eq(notifications.read, false));
    }

    // Fetch notifications
    const results = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw new Error('Failed to fetch notifications');
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.read, false)
        )
      );

    return result[0]?.count || 0;
  } catch (error) {
    console.error('Error fetching unread count:', error);
    throw new Error('Failed to fetch unread count');
  }
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string, userId: string) {
  try {
    const [updated] = await db
      .update(notifications)
      .set({
        read: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        )
      )
      .returning();

    if (!updated) {
      throw new Error('Notification not found or unauthorized');
    }

    console.log(`✅ Notification ${notificationId} marked as read`);

    return updated;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
  try {
    const result = await db
      .update(notifications)
      .set({
        read: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.read, false)
        )
      )
      .returning();

    console.log(`✅ Marked ${result.length} notifications as read for user ${userId}`);

    return result.length;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw new Error('Failed to mark all notifications as read');
  }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, userId: string) {
  try {
    const [deleted] = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId)
        )
      )
      .returning();

    if (!deleted) {
      throw new Error('Notification not found or unauthorized');
    }

    console.log(`✅ Notification ${notificationId} deleted`);

    return deleted;
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
}

/**
 * Helper: Create outbid notification
 */
export async function createOutbidNotification(
  userId: string,
  auctionId: string,
  newBidAmount: number,
  auctionTitle: string
) {
  return createNotification({
    userId,
    type: 'outbid',
    title: "You've been outbid!",
    message: `Someone placed a higher bid on "${auctionTitle}". Current bid: ₦${newBidAmount.toLocaleString()}`,
    data: {
      auctionId,
      bidAmount: newBidAmount,
    },
  });
}

/**
 * Helper: Create auction won notification
 */
export async function createAuctionWonNotification(
  userId: string,
  auctionId: string,
  winningBid: number,
  auctionTitle: string,
  paymentId?: string,
  auctionDetailsUrl?: string
) {
  return createNotification({
    userId,
    type: 'auction_won',
    title: 'Congratulations! You won the auction',
    message: `You won "${auctionTitle}" with a bid of ₦${winningBid.toLocaleString()}. Sign 3 documents to complete payment.`,
    data: {
      auctionId,
      bidAmount: winningBid,
      paymentId,
      // FIXED: Route to auction details page where documents can be signed
      url: auctionDetailsUrl || `/vendor/auctions/${auctionId}`,
    },
  });
}

/**
 * Helper: Create auction lost notification
 */
export async function createAuctionLostNotification(
  userId: string,
  auctionId: string,
  auctionTitle: string
) {
  return createNotification({
    userId,
    type: 'auction_lost',
    title: 'Auction closed',
    message: `The auction for "${auctionTitle}" has ended. Better luck next time!`,
    data: {
      auctionId,
    },
  });
}

/**
 * Helper: Create auction closing soon notification
 */
export async function createAuctionClosingSoonNotification(
  userId: string,
  auctionId: string,
  auctionTitle: string,
  minutesRemaining: number
) {
  return createNotification({
    userId,
    type: 'auction_closing_soon',
    title: 'Auction ending soon!',
    message: `"${auctionTitle}" ends in ${minutesRemaining} minutes. Place your bid now!`,
    data: {
      auctionId,
      minutesRemaining,
    },
  });
}

/**
 * Helper: Create OTP sent notification
 */
export async function createOTPSentNotification(
  userId: string,
  phone: string,
  context: 'authentication' | 'bidding'
) {
  return createNotification({
    userId,
    type: 'otp_sent',
    title: 'OTP sent',
    message: `A one-time password has been sent to ${phone}. Valid for 10 minutes.`,
    data: {
      context,
    },
  });
}

/**
 * Helper: Create payment reminder notification
 */
export async function createPaymentReminderNotification(
  userId: string,
  auctionId: string,
  auctionTitle: string,
  deadline: string,
  amount: number
) {
  return createNotification({
    userId,
    type: 'payment_reminder',
    title: 'Payment deadline approaching',
    message: `Payment of ₦${amount.toLocaleString()} for "${auctionTitle}" is due by ${deadline}.`,
    data: {
      auctionId,
      amount,
      deadline,
    },
  });
}

/**
 * Helper: Create KYC update notification
 */
export async function createKYCUpdateNotification(
  userId: string,
  tier: string,
  status: 'approved' | 'rejected' | 'pending',
  message: string
) {
  return createNotification({
    userId,
    type: 'kyc_update',
    title: 'KYC status updated',
    message,
    data: {
      tier,
      status,
    },
  });
}

/**
 * Helper: Create document generated notification
 */
export async function notifyDocumentGenerated(
  userId: string,
  documentId: string,
  documentType: string
) {
  return createNotification({
    userId,
    type: 'DOCUMENT_GENERATED',
    title: 'Document Ready',
    message: `Your ${documentType} is ready for review and signature`,
    data: {
      documentId,
      documentType,
    },
  });
}

/**
 * Helper: Create signature required notification
 */
export async function notifySignatureRequired(
  userId: string,
  documentId: string
) {
  return createNotification({
    userId,
    type: 'SIGNATURE_REQUIRED',
    title: 'Signature Required',
    message: 'Please sign the liability waiver to proceed with payment',
    data: {
      documentId,
    },
  });
}

/**
 * Helper: Create document signed notification
 */
export async function notifyDocumentSigned(
  userId: string,
  documentId: string
) {
  return createNotification({
    userId,
    type: 'DOCUMENT_SIGNED',
    title: 'Document Signed',
    message: 'Your document has been signed successfully',
    data: {
      documentId,
    },
  });
}

/**
 * Helper: Create payment unlocked notification
 */
export async function notifyPaymentUnlocked(
  userId: string,
  auctionId: string,
  paymentId: string
) {
  return createNotification({
    userId,
    type: 'PAYMENT_UNLOCKED',
    title: 'Payment Unlocked',
    message: 'You can now proceed with payment for your won auction',
    data: {
      auctionId,
      paymentId,
    },
  });
}

/**
 * Helper: Create pickup authorization ready notification
 */
export async function notifyPickupAuthReady(
  userId: string,
  documentId: string
) {
  return createNotification({
    userId,
    type: 'PICKUP_AUTHORIZATION_READY',
    title: 'Pickup Authorization Ready',
    message: 'Your pickup authorization has been generated',
    data: {
      documentId,
    },
  });
}
