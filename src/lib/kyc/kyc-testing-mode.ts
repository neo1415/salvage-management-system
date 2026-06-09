/**
 * KYC runs against live provider state.
 *
 * This module remains as a compatibility shim for older imports, but the old
 * env-driven testing override is intentionally disabled so live keys cannot be
 * paired with stale status resets or client-side testing banners.
 */
export function isKycTestingMode(): boolean {
  return false;
}

/** Client compatibility shim. */
export function isKycTestingModeClient(): boolean {
  return false;
}

/**
 * Legacy list retained for old tests/imports. It is no longer used to rewrite
 * status responses.
 */
export const KYC_TIER2_BLOCKING_STATUSES = [
  'expired',
  'in_progress',
] as const;

export function applyKycTestingStatusOverride<T extends { status: string }>(
  kycStatus: T
): T {
  return kycStatus;
}
