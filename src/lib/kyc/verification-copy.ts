import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';

/** User-facing label — never expose vendor/integration names. */
export function verificationBrandName(brandName?: string | null): string {
  const trimmed = brandName?.trim();
  if (trimmed) return trimmed;
  return DEFAULT_BUSINESS_POLICY.branding.brandName || 'Our platform';
}

export function verificationTeamLabel(brandName?: string | null): string {
  return `${verificationBrandName(brandName)} review team`;
}

export const VERIFICATION_COPY = {
  checkingDetails: 'Checking your details against official records…',
  checkUnavailable:
    'We could not complete the automated check right now. You can still submit your documents for review.',
  checkUnavailableManagerReview:
    'Automated check is unavailable. Our review team can still assess your uploaded documents.',
  bvnCheckUnavailable:
    'BVN check is unavailable right now. You can still submit for review.',
  ninCheckUnavailable:
    'NIN check is unavailable right now. You can still submit for review.',
  cacCheckUnavailable:
    'Business registration check is unavailable right now. You can still submit for review.',
  cacCheckTemporarilyUnavailable:
    'Business registration check is temporarily unavailable. Our review team can still assess your uploaded business document.',
  submittingDocuments: 'Uploading your documents and preparing them for review…',
  finishFaceCheck:
    'Finish the face check in the secure verification step. Your documents have already been saved for review.',
  livenessReferenceMissing:
    'Face check completed, but we could not confirm the session. Your documents are still under review.',
  loadingVerification: 'Loading verification…',
  identityCheckCouldNotComplete: (brandName?: string | null) =>
    `${verificationBrandName(brandName)} could not complete this identity check right now. Wait a few minutes and try again, or contact support.`,
} as const;
