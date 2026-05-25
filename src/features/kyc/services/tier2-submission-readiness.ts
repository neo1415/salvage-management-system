import type { DojahVerificationResult } from '../schemas/dojah.schemas';
import type { NormalizedVerificationResult } from '../types/provider-verification.types';

/**
 * True when Dojah returned enough data to treat as a vendor submission (not merely workflow started).
 */
export function hasTier2VerificationEvidence(result: DojahVerificationResult): boolean {
  const data = result.data;
  if (!data) return false;

  const ninEntity = data.government_data?.data?.nin?.entity;
  const hasNin = Boolean(ninEntity?.nin || ninEntity?.firstname);
  const hasSelfie = Boolean(data.selfie?.data);
  const hasId = Boolean(data.id?.data?.id_data || data.id?.data);
  const hasBusiness = Boolean(data.business_id || data.business_data);

  return hasNin || hasSelfie || hasId || hasBusiness;
}

export function isTier2ReadyForVendorSubmission(
  result: DojahVerificationResult,
  normalized?: Pick<NormalizedVerificationResult, 'status' | 'checksCompleted' | 'pendingChecks'>
): boolean {
  if (!hasTier2VerificationEvidence(result)) {
    return false;
  }

  const statusText = String(
    result.verification_status ?? result.verificationStatus ?? result.status ?? normalized?.status ?? ''
  ).toLowerCase();

  const hasNin = hasNinEvidence(result);
  const hasSelfie = Boolean(result.data?.selfie?.data);
  const hasId = Boolean(result.data?.id?.data?.id_data || result.data?.id?.data);
  const hasBusiness = Boolean(result.data?.business_id || result.data?.business_data);

  // Liveness-only (selfie) is an intermediate step — not a full Tier 2 submission.
  if (hasSelfie && !hasNin && !hasId && !hasBusiness) {
    if (
      !statusText.includes('complete') &&
      !statusText.includes('success') &&
      !statusText.includes('pass')
    ) {
      return false;
    }
  }

  if (statusText.includes('fail') || statusText.includes('reject')) {
    return hasNin || hasId || hasBusiness;
  }

  if (
    statusText.includes('complete') ||
    statusText.includes('success') ||
    statusText.includes('pass') ||
    statusText.includes('review')
  ) {
    return true;
  }

  const completedChecks = normalized?.checksCompleted?.length ?? 0;
  if (completedChecks > 0 && (hasNin || hasId || hasBusiness)) {
    return true;
  }

  if (statusText.includes('pending') || statusText.includes('submitted')) {
    return hasNin && (hasSelfie || hasId || hasBusiness);
  }

  return hasNin && (hasSelfie || hasId || hasBusiness);
}

function hasNinEvidence(result: DojahVerificationResult): boolean {
  const nin = result.data?.government_data?.data?.nin?.entity;
  return Boolean(nin?.nin);
}

/** Used by reconcile: fetch is worthwhile, but may not be submittable yet. */
export function isDojahResultFetchable(result: DojahVerificationResult): boolean {
  if (hasTier2VerificationEvidence(result)) {
    return true;
  }

  const statusText = String(result.verification_status ?? result.verificationStatus ?? result.status ?? '').toLowerCase();
  return (
    statusText.includes('complete') ||
    statusText.includes('success') ||
    statusText.includes('pass') ||
    statusText.includes('review') ||
    statusText.includes('fail')
  );
}
