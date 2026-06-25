import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_POLICY,
  resolveTier2Access,
  resolveTier2ReviewRequirement,
  resolveRegistrationFeePaymentAccess,
  resolveVendorBidEligibility,
  resolveVendorBidLimit,
  resolveVendorBvnGate,
  vendorMustPayRegistrationFeeBeforeTier1,
} from '@/features/business-policy';

describe('onboarding policy decisions', () => {
  it('requires vendor BVN under the default NEM policy', () => {
    const result = resolveVendorBvnGate(DEFAULT_BUSINESS_POLICY, {
      role: 'vendor',
      bvnVerified: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.value).toBe('bvn_required');
    expect(result.decision.policyVersion).toBe(DEFAULT_BUSINESS_POLICY.version);
    expect(result.decision.rulePath).toBe('kyc.tier1RequiresBvn');
  });

  it('does not apply BVN gate to staff users', () => {
    const result = resolveVendorBvnGate(DEFAULT_BUSINESS_POLICY, {
      role: 'system_admin',
      bvnVerified: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.value).toBe('bvn_gate_clear');
  });

  it('skips BVN gate when browsing before KYC is allowed', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.onboarding.mode = 'full_kyc_before_bidding';
    policy.onboarding.allowBrowseBeforeKyc = true;

    const result = resolveVendorBvnGate(policy, {
      role: 'vendor',
      bvnVerified: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.value).toBe('bvn_gate_clear');
  });

  it('resolves Tier 1 bid limit from the default policy', () => {
    const result = resolveVendorBidLimit(DEFAULT_BUSINESS_POLICY, {
      tier: 'tier1_bvn',
    });

    expect(result.allowed).toBe(true);
    expect(result.value).toBe(500000);
    expect(result.decision.rulePath).toBe('onboarding.tier1BidLimit');
  });

  it('allows Tier 2 vendors to bid without the Tier 1 cap', () => {
    const result = resolveVendorBidEligibility(
      DEFAULT_BUSINESS_POLICY,
      { tier: 'tier2_full', bvnVerified: true },
      5_000_000
    );

    expect(result.allowed).toBe(true);
    expect(result.value?.bidLimit).toBeNull();
  });

  it('denies Tier 1 bids above the default configured limit', () => {
    const result = resolveVendorBidEligibility(
      DEFAULT_BUSINESS_POLICY,
      { tier: 'tier1_bvn', bvnVerified: true },
      500_001
    );

    expect(result.allowed).toBe(false);
    expect(result.value?.bidLimit).toBe(500000);
    expect(result.decision.decisionType).toBe('vendor_bid_denied');
    expect(result.decision.rulePath).toBe('onboarding.tier1BidLimit');
  });

  it('allows Tier 1 bids at the default configured limit', () => {
    const result = resolveVendorBidEligibility(
      DEFAULT_BUSINESS_POLICY,
      { tier: 'tier1_bvn', bvnVerified: true },
      500_000
    );

    expect(result.allowed).toBe(true);
    expect(result.value?.bidLimit).toBe(500000);
  });

  it('requires registration fee before Tier 2 under the default NEM flow', () => {
    const result = resolveTier2Access(DEFAULT_BUSINESS_POLICY, {
      tier: 'tier1_bvn',
      bvnVerified: true,
      registrationFeePaid: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.value).toBe('registration_fee_required');
    expect(result.decision.rulePath).toBe('onboarding.registrationFeeRequired');
    expect(result.decision.resolvedValue).toBe(12500);
  });

  it('requires BVN before registration fee under the default NEM flow', () => {
    const result = resolveRegistrationFeePaymentAccess(DEFAULT_BUSINESS_POLICY, {
      tier: 'tier0',
      bvnVerified: false,
      registrationFeePaid: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.value).toBe('bvn_required');
    expect(result.decision.rulePath).toBe('kyc.tier1RequiresBvn');
  });

  it('allows registration fee before BVN when fee-before-tier1 is configured', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.onboarding.mode = 'fee_before_tier1';

    const result = resolveRegistrationFeePaymentAccess(policy, {
      tier: 'tier0',
      bvnVerified: false,
      registrationFeePaid: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.value).toBe('payment_available');
    expect(result.decision.resolvedValue).toBe(policy.onboarding.registrationFeeAmount);
  });

  it('requires fee-before-tier1 payment even if registration fee toggle is off', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.onboarding.mode = 'fee_before_tier1';
    policy.onboarding.registrationFeeRequired = false;

    expect(
      vendorMustPayRegistrationFeeBeforeTier1(policy, { registrationFeePaid: false })
    ).toBe(true);
  });

  it('marks registration fee payment unavailable when no fee is configured', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.onboarding.mode = 'no_registration_fee';
    policy.onboarding.registrationFeeRequired = false;
    policy.onboarding.registrationFeeAmount = 0;

    const result = resolveRegistrationFeePaymentAccess(policy, {
      tier: 'tier1_bvn',
      bvnVerified: true,
      registrationFeePaid: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.value).toBe('fee_not_required');
    expect(result.decision.outcome).toBe('not_applicable');
  });

  it('allows Tier 2 start after BVN and registration fee', () => {
    const result = resolveTier2Access(DEFAULT_BUSINESS_POLICY, {
      tier: 'tier1_bvn',
      bvnVerified: true,
      registrationFeePaid: true,
    });

    expect(result.allowed).toBe(true);
    expect(result.value).toBe('tier2_available');
  });

  it('keeps Tier 2 as manual review by default', () => {
    const result = resolveTier2ReviewRequirement(DEFAULT_BUSINESS_POLICY);

    expect(result.allowed).toBe(true);
    expect(result.value).toBe('manual_review');
    expect(result.decision.outcome).toBe('require_review');
  });

  it('honors changed policy for no registration fee deployments', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.onboarding.mode = 'no_registration_fee';
    policy.onboarding.registrationFeeRequired = false;
    policy.onboarding.registrationFeeAmount = 0;

    const result = resolveTier2Access(policy, {
      tier: 'tier1_bvn',
      bvnVerified: true,
      registrationFeePaid: false,
    });

    expect(result.allowed).toBe(true);
    expect(result.value).toBe('tier2_available');
  });

  it('blocks all non-Tier-2 bidding when full KYC is required before bidding', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.onboarding.mode = 'full_kyc_before_bidding';
    policy.onboarding.allowBidAfterTier1 = false;

    const result = resolveVendorBidEligibility(
      policy,
      { tier: 'tier1_bvn', bvnVerified: true, registrationFeePaid: true },
      100_000
    );

    expect(result.allowed).toBe(false);
    expect(result.value?.bidLimit).toBe(0);
    expect(result.decision.rulePath).toBe('onboarding.mode');
  });

  it('requires registration fee before Tier 1 bidding when configured', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.onboarding.mode = 'fee_before_tier1';
    policy.onboarding.registrationFeeRequired = true;

    const result = resolveVendorBidEligibility(
      policy,
      { tier: 'tier1_bvn', bvnVerified: true, registrationFeePaid: false },
      100_000
    );

    expect(result.allowed).toBe(false);
    expect(result.decision.rulePath).toBe('onboarding.mode');
    expect(result.decision.resolvedValue).toBe(policy.onboarding.registrationFeeAmount);
  });
});

