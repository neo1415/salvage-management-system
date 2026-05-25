/**
 * KYC testing mode — allows repeating Tier 1 (BVN) and Tier 2 (Dojah) verification
 * for the same user/documents during local/staging QA.
 *
 * Set KYC_TESTING_MODE=true (server) and NEXT_PUBLIC_KYC_TESTING_MODE=true (client UI).
 * Never enable in production.
 */
export function isKycTestingMode(): boolean {
  return process.env.KYC_TESTING_MODE === 'true';
}

/** Client components (must mirror KYC_TESTING_MODE in .env). */
export function isKycTestingModeClient(): boolean {
  return process.env.NEXT_PUBLIC_KYC_TESTING_MODE === 'true';
}

/**
 * Status values that block the Tier 2 widget; in testing mode the portal treats these as not started.
 */
export const KYC_TIER2_BLOCKING_STATUSES = [
  'approved',
  'pending_review',
  'rejected',
  'expired',
  'in_progress',
] as const;

export function applyKycTestingStatusOverride<T extends { status: string }>(
  kycStatus: T
): T & { kycTestingMode: true } {
  if (!KYC_TIER2_BLOCKING_STATUSES.includes(kycStatus.status as (typeof KYC_TIER2_BLOCKING_STATUSES)[number])) {
    return { ...kycStatus, kycTestingMode: true };
  }
  return {
    ...kycStatus,
    status: 'not_started',
    kycTestingMode: true,
  };
}
