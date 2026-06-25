import type { BusinessPolicy, PublicBusinessPolicy } from '@/features/business-policy/types';

type OnboardingModeSource = Pick<BusinessPolicy, 'onboarding'> | Pick<PublicBusinessPolicy, 'onboarding'>;

export function usesSingleFullKycFlow(policy: OnboardingModeSource): boolean {
  return policy.onboarding.mode === 'single_full_kyc';
}

export function usesTierLanguage(policy: OnboardingModeSource): boolean {
  return !usesSingleFullKycFlow(policy);
}

export function fullVerificationLabel(policy: OnboardingModeSource): string {
  return usesSingleFullKycFlow(policy) ? 'Business verification' : 'Full verification';
}

export function kycVerificationPageTitle(policy: OnboardingModeSource): string {
  if (usesSingleFullKycFlow(policy)) {
    return 'Complete your KYC';
  }
  if (policy.onboarding.mode === 'full_kyc_before_bidding') {
    return 'Complete verification';
  }
  return 'Tier 2 verification';
}

export function kycVerifiedBadgeLabel(policy: OnboardingModeSource): string {
  return usesSingleFullKycFlow(policy) ? 'KYC verified' : 'Tier 2 verified';
}

export function tier1SuccessRedirectPath(): string {
  return '/vendor/dashboard';
}
