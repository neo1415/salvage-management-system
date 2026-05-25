import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_POLICY,
  resolveDocumentDeadlineHours,
  resolveFallbackBufferHours,
  resolveForfeiturePercentage,
  resolveGraceExtensionDurationHours,
  resolveGraceExtensionLimit,
  resolvePaymentDeadlineHours,
} from '@/features/business-policy';

describe('auction timing policy decisions', () => {
  it('resolves the document signing deadline from default NEM policy', () => {
    const result = resolveDocumentDeadlineHours(DEFAULT_BUSINESS_POLICY);

    expect(result.value).toBe(48);
    expect(result.decision.policyVersion).toBe(DEFAULT_BUSINESS_POLICY.version);
    expect(result.decision.rulePath).toBe('auctions.documentValidityHours');
  });

  it('resolves the payment deadline after document signing', () => {
    const result = resolvePaymentDeadlineHours(DEFAULT_BUSINESS_POLICY);

    expect(result.value).toBe(72);
    expect(result.decision.decisionType).toBe('payment_deadline_resolved');
    expect(result.decision.rulePath).toBe('payments.paymentDeadlineAfterSigningHours');
  });

  it('resolves fallback buffer hours', () => {
    const result = resolveFallbackBufferHours(DEFAULT_BUSINESS_POLICY);

    expect(result.value).toBe(24);
    expect(result.decision.decisionType).toBe('fallback_buffer_resolved');
    expect(result.decision.entityType).toBe('auction');
  });

  it('resolves forfeiture percentage', () => {
    const result = resolveForfeiturePercentage(DEFAULT_BUSINESS_POLICY);

    expect(result.value).toBe(100);
    expect(result.decision.rulePath).toBe('escrow.forfeiturePercentage');
  });

  it('resolves grace extension duration from default NEM policy', () => {
    const result = resolveGraceExtensionDurationHours(DEFAULT_BUSINESS_POLICY);

    expect(result.value).toBe(24);
    expect(result.decision.decisionType).toBe('grace_extension_duration_resolved');
    expect(result.decision.rulePath).toBe('auctions.graceExtensionDurationHours');
  });

  it('allows grace extension while current count is below the policy maximum', () => {
    const result = resolveGraceExtensionLimit(DEFAULT_BUSINESS_POLICY, 1);

    expect(result.allowed).toBe(true);
    expect(result.value).toBe(2);
    expect(result.decision.outcome).toBe('allow');
    expect(result.decision.inputs).toEqual({ currentExtensionCount: 1 });
  });

  it('denies grace extension when current count reaches the policy maximum', () => {
    const result = resolveGraceExtensionLimit(DEFAULT_BUSINESS_POLICY, 2);

    expect(result.allowed).toBe(false);
    expect(result.value).toBe(2);
    expect(result.decision.outcome).toBe('deny');
  });
});
