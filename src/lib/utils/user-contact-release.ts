import { db } from '@/lib/db/drizzle';
import { users } from '@/lib/db/schema/users';
import { and, eq, ne } from 'drizzle-orm';
import { tombstoneEmail, tombstonePhone } from '@/lib/utils/user-tombstone';

/** Tombstone email/phone so the originals can be registered again. */
export async function tombstoneUserContactFields(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      email: tombstoneEmail(userId),
      phone: tombstonePhone(userId),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Soft-deleted users should not keep real phone numbers. Repairs legacy rows
 * where status was set to deleted without tombstoning contact fields.
 */
export async function releasePhoneHeldByDeletedUsers(phone: string): Promise<number> {
  const holders = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.phone, phone), eq(users.status, 'deleted')));

  for (const holder of holders) {
    await tombstoneUserContactFields(holder.id);
  }

  return holders.length;
}

export async function findActiveUserWithPhone(phone: string, excludeUserId: string) {
  const [conflict] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(eq(users.phone, phone), ne(users.id, excludeUserId), ne(users.status, 'deleted'))
    )
    .limit(1);

  return conflict;
}
