import { afterEach, describe, expect, it } from 'vitest';
import { getBusinessPolicyRuntimeMode, isBusinessPolicyEnforcementEnabled } from '@/features/business-policy';

describe('business policy runtime mode', () => {
  const originalMode = process.env.BUSINESS_POLICY_RUNTIME_MODE;

  afterEach(() => {
    if (originalMode === undefined) {
      delete process.env.BUSINESS_POLICY_RUNTIME_MODE;
    } else {
      process.env.BUSINESS_POLICY_RUNTIME_MODE = originalMode;
    }
  });

  it('defaults to shadow mode for safety', () => {
    delete process.env.BUSINESS_POLICY_RUNTIME_MODE;

    expect(getBusinessPolicyRuntimeMode()).toBe('shadow');
    expect(isBusinessPolicyEnforcementEnabled()).toBe(false);
  });

  it('only enables live enforcement with the explicit enforce value', () => {
    process.env.BUSINESS_POLICY_RUNTIME_MODE = 'true';
    expect(getBusinessPolicyRuntimeMode()).toBe('shadow');

    process.env.BUSINESS_POLICY_RUNTIME_MODE = 'enforce';
    expect(getBusinessPolicyRuntimeMode()).toBe('enforce');
    expect(isBusinessPolicyEnforcementEnabled()).toBe(true);
  });
});
