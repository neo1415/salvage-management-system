import { db } from '@/lib/db/drizzle';
import { notificationPreferences } from '@/lib/db/schema/push-subscriptions';
import { eq } from 'drizzle-orm';

export type ChannelGuardOptions = {
  critical?: boolean;
};

async function getUserPreferences(userId: string) {
  try {
    const [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    return preferences ?? null;
  } catch (error) {
    console.warn('[Notifications] Could not load user channel preferences; defaulting to allowed', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/** Non-critical email respects user channel toggle; auth/OTP always allowed. */
export async function canUserReceiveEmail(userId: string, options?: ChannelGuardOptions): Promise<boolean> {
  if (options?.critical) return true;
  const preferences = await getUserPreferences(userId);
  if (!preferences) return true;
  return preferences.emailEnabled;
}

/** Non-critical SMS respects user channel toggle; transactional categories bypass at call site. */
export async function canUserReceiveSms(userId: string, options?: ChannelGuardOptions): Promise<boolean> {
  if (options?.critical) return true;
  const preferences = await getUserPreferences(userId);
  if (!preferences) return true;
  return preferences.smsEnabled;
}

export async function canUserReceivePush(userId: string): Promise<boolean> {
  const preferences = await getUserPreferences(userId);
  if (!preferences) return true;
  return preferences.pushEnabled;
}
