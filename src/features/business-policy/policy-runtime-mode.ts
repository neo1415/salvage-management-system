export type BusinessPolicyRuntimeMode = 'shadow' | 'enforce';

export function getBusinessPolicyRuntimeMode(): BusinessPolicyRuntimeMode {
  return process.env.BUSINESS_POLICY_RUNTIME_MODE === 'enforce' ? 'enforce' : 'shadow';
}

export function isBusinessPolicyEnforcementEnabled(): boolean {
  return getBusinessPolicyRuntimeMode() === 'enforce';
}
