import { describe, expect, it } from 'vitest';
import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';
import { applyRuntimePolicyOverrides } from '@/features/business-policy/runtime-policy-overrides';

describe('applyRuntimePolicyOverrides', () => {
  it('keeps auction deposits disabled unless deployment explicitly opts in', () => {
    const publishedPolicy = structuredClone(DEFAULT_BUSINESS_POLICY);
    publishedPolicy.escrow.depositSystemEnabled = true;

    const result = applyRuntimePolicyOverrides(publishedPolicy, false);

    expect(result.escrow.depositSystemEnabled).toBe(false);
    expect(publishedPolicy.escrow.depositSystemEnabled).toBe(true);
  });

  it('retains a published deposit policy after explicit deployment opt-in', () => {
    const publishedPolicy = structuredClone(DEFAULT_BUSINESS_POLICY);
    publishedPolicy.escrow.depositSystemEnabled = true;

    expect(applyRuntimePolicyOverrides(publishedPolicy, true).escrow.depositSystemEnabled).toBe(true);
  });
});
