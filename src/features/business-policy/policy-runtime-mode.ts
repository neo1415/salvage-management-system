export type BusinessPolicyRuntimeMode = 'shadow' | 'enforce';

export function getBusinessPolicyRuntimeMode(): BusinessPolicyRuntimeMode {
  return process.env.BUSINESS_POLICY_RUNTIME_MODE === 'enforce' ? 'enforce' : 'shadow';
}

export function isBusinessPolicyEnforcementEnabled(): boolean {
  return getBusinessPolicyRuntimeMode() === 'enforce';
}

/** Onboarding, KYC gates, and bid eligibility always follow published policy. */
export function isOnboardingPolicyEnforced(): boolean {
  return true;
}
