import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_POLICY,
  resolveDepositAmountRequired,
  resolveDocumentDeadlineHours,
  resolveFallbackBufferHours,
  resolveForfeiturePercentage,
  resolveGraceExtensionDurationHours,
  resolveGraceExtensionLimit,
  resolvePaymentDeadlineHours,
  resolveReservePrice,
  resolveTier2Access,
  resolveTier2ReviewRequirement,
  resolveVendorBidEligibility,
  resolveVendorBidLimit,
  resolveVendorBvnGate,
} from '@/features/business-policy';

describe('current NEM policy compatibility contracts', () => {
  const policy = DEFAULT_BUSINESS_POLICY;

  it('keeps the current vendor BVN gate behavior', () => {
    expect(resolveVendorBvnGate(policy, { role: 'vendor', bvnVerified: false })).toMatchObject({
      allowed: false,
      value: 'bvn_required',
    });

    expect(resolveVendorBvnGate(policy, { role: 'vendor', bvnVerified: true })).toMatchObject({
      allowed: true,
      value: 'bvn_gate_clear',
    });

    expect(resolveVendorBvnGate(policy, { role: 'system_admin', bvnVerified: false })).toMatchObject({
      allowed: true,
    });
  });

  it('keeps the Tier 1 bid cap and Tier 2 unlimited behavior', () => {
    expect(resolveVendorBidLimit(policy, { tier: 'tier1_bvn' }).value).toBe(500000);
    expect(resolveVendorBidLimit(policy, { tier: 'tier2_full' }).value).toBeNull();

    expect(resolveVendorBidEligibility(policy, { tier: 'tier1_bvn', bvnVerified: true }, 500000)).toMatchObject({
      allowed: true,
      value: { bidLimit: 500000 },
    });

    expect(resolveVendorBidEligibility(policy, { tier: 'tier1_bvn', bvnVerified: true }, 500001)).toMatchObject({
      allowed: false,
      value: { bidLimit: 500000 },
    });

    expect(resolveVendorBidEligibility(policy, { tier: 'tier2_full', bvnVerified: true }, 50_000_000)).toMatchObject({
      allowed: true,
      value: { bidLimit: null },
    });
  });

  it('keeps the current Tier 2 unlock prerequisites', () => {
    expect(resolveTier2Access(policy, {
      tier: 'tier1_bvn',
      bvnVerified: false,
      registrationFeePaid: false,
    })).toMatchObject({
      allowed: false,
      value: 'bvn_required',
    });

    expect(resolveTier2Access(policy, {
      tier: 'tier1_bvn',
      bvnVerified: true,
      registrationFeePaid: false,
    })).toMatchObject({
      allowed: false,
      value: 'registration_fee_required',
    });

    expect(resolveTier2Access(policy, {
      tier: 'tier1_bvn',
      bvnVerified: true,
      registrationFeePaid: true,
    })).toMatchObject({
      allowed: true,
      value: 'tier2_available',
    });

    expect(resolveTier2ReviewRequirement(policy)).toMatchObject({
      allowed: true,
      value: 'manual_review',
    });
  });

  it('keeps the current deposit calculation behavior', () => {
    expect(resolveDepositAmountRequired(policy, 200000).value).toEqual({
      totalDeposit: 100000,
      incrementalDeposit: 100000,
    });

    expect(resolveDepositAmountRequired(policy, 2_000_000).value).toEqual({
      totalDeposit: 200000,
      incrementalDeposit: 200000,
    });

    expect(resolveDepositAmountRequired(policy, 2_500_000, 2_000_000).value).toEqual({
      totalDeposit: 250000,
      incrementalDeposit: 50000,
    });
  });

  it('keeps auction deadline, grace, fallback, and forfeiture defaults', () => {
    expect(resolveDocumentDeadlineHours(policy).value).toBe(48);
    expect(resolvePaymentDeadlineHours(policy).value).toBe(72);
    expect(resolveFallbackBufferHours(policy).value).toBe(24);
    expect(resolveForfeiturePercentage(policy).value).toBe(100);
    expect(resolveGraceExtensionDurationHours(policy).value).toBe(24);

    expect(resolveGraceExtensionLimit(policy, 0).allowed).toBe(true);
    expect(resolveGraceExtensionLimit(policy, 1).allowed).toBe(true);
    expect(resolveGraceExtensionLimit(policy, 2).allowed).toBe(false);
  });

  it('keeps the current reserve price rule as 70 percent of salvage value', () => {
    expect(resolveReservePrice(policy, 1_000_000).value).toBe(700000);
    expect(resolveReservePrice(policy, 333_333).value).toBe(233333);
  });

  it('records policy version and rule path for every compatibility decision', () => {
    const decisions = [
      resolveVendorBvnGate(policy, { role: 'vendor', bvnVerified: false }).decision,
      resolveVendorBidEligibility(policy, { tier: 'tier1_bvn', bvnVerified: true }, 500001).decision,
      resolveDepositAmountRequired(policy, 2_000_000).decision,
      resolveDocumentDeadlineHours(policy).decision,
      resolvePaymentDeadlineHours(policy).decision,
      resolveFallbackBufferHours(policy).decision,
      resolveForfeiturePercentage(policy).decision,
      resolveGraceExtensionLimit(policy, 2).decision,
      resolveGraceExtensionDurationHours(policy).decision,
      resolveReservePrice(policy, 1_000_000).decision,
    ];

    for (const decision of decisions) {
      expect(decision.policyVersion).toBe(policy.version);
      expect(decision.rulePath).toEqual(expect.any(String));
      expect(decision.reason).toEqual(expect.any(String));
    }
  });
});
