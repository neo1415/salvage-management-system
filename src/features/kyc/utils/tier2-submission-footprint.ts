type Tier2EvidenceLike = {
  workflowReference?: string | null;
  status?: string | null;
  checksCompleted?: string[] | null;
  normalizedResult?: unknown;
};

type VendorTier2Footprint = {
  tier2SubmittedAt?: Date | null;
  tier2ApprovedAt?: Date | null;
  tier2DojahReferenceId?: string | null;
  ninVerified?: Date | null;
  livenessScore?: string | number | null;
  biometricMatchScore?: string | number | null;
  photoIdUrl?: string | null;
  addressProofUrl?: string | null;
  cacCertificateUrl?: string | null;
};

const SUBMITTED_PROVIDER_STATUSES = new Set([
  'review_required',
  'pending_review',
  'submitted',
  'submitted_for_review',
  'manual_review',
  'completed',
  'approved',
  'rejected',
]);

export function isManualHybridTier2Evidence(evidence: Tier2EvidenceLike | null | undefined): boolean {
  if (!evidence) return false;
  const normalized = evidence.normalizedResult as Record<string, unknown> | null;
  const checks = evidence.checksCompleted ?? [];
  return (
    evidence.workflowReference === 'nem-hybrid-tier2' ||
    normalized?.verificationMode === 'nem_hybrid_manual_review' ||
    checks.includes('nem_documents_uploaded') ||
    checks.includes('documents_uploaded')
  );
}

/** Open widget workflow with no uploaded documents or hybrid submission markers. */
export function isBareOpenTier2Workflow(evidence: Tier2EvidenceLike | null | undefined): boolean {
  if (!evidence) return false;
  const status = String(evidence.status ?? '').toLowerCase();
  if (!['pending', 'provider_unavailable'].includes(status)) return false;
  return !isManualHybridTier2Evidence(evidence);
}

export function vendorHasManualDocumentFootprint(vendor: VendorTier2Footprint): boolean {
  return Boolean(
    vendor.tier2DojahReferenceId?.startsWith('nem-') ||
      vendor.photoIdUrl ||
      vendor.addressProofUrl ||
      vendor.cacCertificateUrl
  );
}

export function vendorHasTier2VerificationScores(vendor: VendorTier2Footprint): boolean {
  return Boolean(vendor.ninVerified || vendor.livenessScore || vendor.biometricMatchScore);
}

export function vendorHasRealTier2SubmissionFootprint(vendor: VendorTier2Footprint): boolean {
  return vendorHasManualDocumentFootprint(vendor) || vendorHasTier2VerificationScores(vendor);
}

export function providerEvidenceCountsAsTier2Submission(
  evidence: Tier2EvidenceLike | null | undefined,
  vendor?: VendorTier2Footprint | null
): boolean {
  if (!evidence) return false;
  if (isBareOpenTier2Workflow(evidence)) return false;
  if (isManualHybridTier2Evidence(evidence)) return true;

  const status = String(evidence.status ?? '').toLowerCase();
  if (SUBMITTED_PROVIDER_STATUSES.has(status)) return true;

  return Boolean(vendor?.tier2SubmittedAt && vendorHasRealTier2SubmissionFootprint(vendor));
}
