/**
 * Free unique email/phone on soft-delete while keeping the user row for audit.
 */

export function tombstoneEmail(userId: string): string {
  return `deleted.${userId}@salvage-deleted.internal`;
}

/** Fits users.phone varchar(20); unique per user id. */
export function tombstonePhone(userId: string): string {
  const compact = userId.replace(/-/g, '').slice(0, 17);
  return `+9${compact}`;
}
