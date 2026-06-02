import type { DojahVerificationResult } from '../schemas/dojah.schemas';
import type { NormalizedVerificationResult } from '../types/provider-verification.types';

export type Tier2ReadinessRequirements = {
  businessData?: boolean;
  governmentId?: boolean;
  liveness?: boolean;
  address?: boolean;
};

export interface Tier2SubmissionReadiness {
  ready: boolean;
  providerStatus: string;
  missingBlockingEvidence: string[];
  missingReviewEvidence: string[];
  completedEvidence: string[];
  reason: 'provider_not_completed' | 'provider_failed' | 'missing_core_evidence' | 'ready';
}

const DEFAULT_REQUIREMENTS: Required<Tier2ReadinessRequirements> = {
  businessData: true,
  governmentId: true,
  liveness: true,
  address: true,
};

/**
 * True when Dojah returned any Tier 2 evidence. Evidence can still be too partial
 * to submit the vendor for review.
 */
export function hasTier2VerificationEvidence(result: DojahVerificationResult): boolean {
  const data = result.data;
  if (!data) return false;

  return Boolean(
    hasNinEvidence(result) ||
      hasSelfieEvidence(result) ||
      hasGovernmentIdEvidence(result) ||
      hasBusinessEvidence(result) ||
      hasAddressEvidence(result)
  );
}

export function getTier2SubmissionReadiness(
  result: DojahVerificationResult,
  normalized?: Pick<NormalizedVerificationResult, 'status' | 'checksCompleted' | 'pendingChecks' | 'failedChecks'>,
  requirements: Tier2ReadinessRequirements = DEFAULT_REQUIREMENTS
): Tier2SubmissionReadiness {
  const required = { ...DEFAULT_REQUIREMENTS, ...requirements };
  const providerStatus = workflowStatusText(result, normalized);
  const completedEvidence = collectCompletedEvidence(result, normalized);

  if (isFailedProviderStatus(providerStatus)) {
    return {
      ready: false,
      providerStatus,
      missingBlockingEvidence: [],
      missingReviewEvidence: collectMissingReviewEvidence(result, required),
      completedEvidence,
      reason: 'provider_failed',
    };
  }

  if (!isCompletedProviderStatus(providerStatus)) {
    return {
      ready: false,
      providerStatus,
      missingBlockingEvidence: [],
      missingReviewEvidence: collectMissingReviewEvidence(result, required),
      completedEvidence,
      reason: 'provider_not_completed',
    };
  }

  const missingBlockingEvidence = collectMissingBlockingEvidence(result, required);
  const missingReviewEvidence = collectMissingReviewEvidence(result, required);

  return {
    ready: missingBlockingEvidence.length === 0,
    providerStatus,
    missingBlockingEvidence,
    missingReviewEvidence,
    completedEvidence,
    reason: missingBlockingEvidence.length === 0 ? 'ready' : 'missing_core_evidence',
  };
}

export function isTier2ReadyForVendorSubmission(
  result: DojahVerificationResult,
  normalized?: Pick<NormalizedVerificationResult, 'status' | 'checksCompleted' | 'pendingChecks' | 'failedChecks'>,
  requirements?: Tier2ReadinessRequirements
): boolean {
  return getTier2SubmissionReadiness(result, normalized, requirements).ready;
}

function workflowStatusText(
  result: DojahVerificationResult,
  normalized?: Pick<NormalizedVerificationResult, 'status'>
): string {
  return String(
    result.verification_status ??
      result.verificationStatus ??
      (typeof result.status === 'string' ? result.status : undefined) ??
      normalized?.status ??
      ''
  )
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
}

function isCompletedProviderStatus(statusText: string): boolean {
  return statusText === 'completed' || statusText === 'complete';
}

function isFailedProviderStatus(statusText: string): boolean {
  return ['failed', 'fail', 'rejected', 'reject', 'abandoned', 'cancelled', 'canceled'].some((status) =>
    statusText.includes(status)
  );
}

function collectMissingBlockingEvidence(
  result: DojahVerificationResult,
  required: Required<Tier2ReadinessRequirements>
): string[] {
  const missing: string[] = [];
  const hasIdentityCore = hasNinEvidence(result) || hasGovernmentIdEvidence(result);

  if (!hasIdentityCore) missing.push('government_data_or_id');
  if (required.liveness && !hasSelfieEvidence(result)) missing.push('liveness');
  if (required.businessData && !hasBusinessEvidence(result)) missing.push('business_data_or_id');

  return missing;
}

function collectMissingReviewEvidence(
  result: DojahVerificationResult,
  required: Required<Tier2ReadinessRequirements>
): string[] {
  const missing: string[] = [];
  if (!hasNinEvidence(result)) missing.push('government_data');
  if (required.governmentId && !hasGovernmentIdEvidence(result)) missing.push('government_id');
  if (required.liveness && !hasSelfieEvidence(result)) missing.push('liveness');
  if (required.businessData && !hasBusinessEvidence(result)) missing.push('business_data_or_id');
  if (required.address && !hasAddressEvidence(result)) missing.push('address');
  return missing;
}

function collectCompletedEvidence(
  result: DojahVerificationResult,
  normalized?: Pick<NormalizedVerificationResult, 'checksCompleted'>
): string[] {
  const completed = new Set(normalized?.checksCompleted ?? []);
  if (hasNinEvidence(result)) completed.add('government_data');
  if (hasGovernmentIdEvidence(result)) completed.add('government_id');
  if (hasSelfieEvidence(result)) completed.add('liveness');
  if (hasBusinessEvidence(result)) completed.add('business_data_or_id');
  if (hasAddressEvidence(result)) completed.add('address');
  return [...completed];
}

function hasNinEvidence(result: DojahVerificationResult): boolean {
  const nin = result.data?.government_data?.data?.nin?.entity;
  return Boolean(nin?.nin || nin?.firstname || nin?.surname);
}

function hasSelfieEvidence(result: DojahVerificationResult): boolean {
  const selfie = result.data?.selfie?.data;
  return Boolean(selfie?.selfie_url || typeof selfie?.liveness_score === 'number' || result.selfie_url);
}

function hasGovernmentIdEvidence(result: DojahVerificationResult): boolean {
  const id = result.data?.id?.data;
  return Boolean(id?.id_data || id?.id_url || id?.back_url || result.id_url);
}

function hasBusinessEvidence(result: DojahVerificationResult): boolean {
  const businessId = result.data?.business_id;
  const businessData = result.data?.business_data;
  return Boolean(
    businessId?.business_name ||
      businessId?.business_number ||
      businessId?.image_url ||
      businessData?.business_name ||
      businessData?.business_number ||
      businessData?.business_type
  );
}

function hasAddressEvidence(result: DojahVerificationResult): boolean {
  const address = result.data?.address;
  return Boolean(address?.status || address?.reference_id || address?.data);
}

/** Used by reconcile: fetch is worthwhile, but may not be submittable yet. */
export function isDojahResultFetchable(result: DojahVerificationResult): boolean {
  if (hasTier2VerificationEvidence(result)) {
    return true;
  }

  const statusText = workflowStatusText(result);
  return (
    isCompletedProviderStatus(statusText) ||
    isFailedProviderStatus(statusText) ||
    statusText.includes('review') ||
    statusText.includes('pending')
  );
}
