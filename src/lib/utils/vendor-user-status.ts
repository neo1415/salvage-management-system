import type { users } from '@/lib/db/schema/users';

type UserStatus = (typeof users.$inferSelect)['status'];

export interface VendorStatusSnapshot {
  bvnVerifiedAt: Date | null;
  tier: 'tier0' | 'tier1_bvn' | 'tier2_full';
  tier2ApprovedAt: Date | null;
}

/**
 * Effective vendor account status from KYC facts (not stale users.status alone).
 */
export function resolveVendorUserStatus(
  storedStatus: UserStatus,
  vendor: VendorStatusSnapshot | null | undefined
): UserStatus {
  if (storedStatus === 'deleted' || storedStatus === 'suspended') {
    return storedStatus;
  }

  if (!vendor) {
    return storedStatus;
  }

  if (vendor.tier2ApprovedAt || vendor.tier === 'tier2_full') {
    return 'verified_tier_2';
  }

  if (vendor.bvnVerifiedAt) {
    return 'verified_tier_1';
  }

  return storedStatus;
}
