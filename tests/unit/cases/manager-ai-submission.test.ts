import { describe, expect, it } from 'vitest';
import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy';

describe('salvage manager case submission policy', () => {
  it('default policy uses claims adjuster for AI assessment', () => {
    expect(DEFAULT_BUSINESS_POLICY.cases.aiDamageAssessmentRunner).toBe('claims_adjuster');
  });

  it('manager mode is a valid policy runner value', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.cases.aiDamageAssessmentRunner = 'salvage_manager';
    expect(policy.cases.aiDamageAssessmentRunner).toBe('salvage_manager');
  });
});
