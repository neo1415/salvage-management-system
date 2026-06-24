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
