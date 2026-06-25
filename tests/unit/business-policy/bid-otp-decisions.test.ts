import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_POLICY,
  resolveBidOtpRequirement,
  isVendorFullyVerifiedForBidOtp,
} from '@/features/business-policy';

describe('bid OTP policy decisions', () => {
  it('requires OTP for all bidders when mode is all', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.auctions.bidOtpMode = 'all';

    const tier1 = resolveBidOtpRequirement(policy, { tier: 'tier1_bvn' });
    const tier2 = resolveBidOtpRequirement(policy, { tier: 'tier2_full' });

    expect(tier1.value?.required).toBe(true);
    expect(tier2.value?.required).toBe(true);
    expect(tier1.decision.rulePath).toBe('auctions.bidOtpMode');
  });

  it('skips OTP for fully verified vendors when mode is tier1_only', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.auctions.bidOtpMode = 'tier1_only';

    const tier1 = resolveBidOtpRequirement(policy, { tier: 'tier1_bvn' });
    const tier2 = resolveBidOtpRequirement(policy, { tier: 'tier2_full' });
    const tier0 = resolveBidOtpRequirement(policy, { tier: 'tier0' });

    expect(tier1.value?.required).toBe(true);
    expect(tier0.value?.required).toBe(true);
    expect(tier2.value?.required).toBe(false);
  });

  it('never requires OTP when mode is none', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.auctions.bidOtpMode = 'none';

    const tier1 = resolveBidOtpRequirement(policy, { tier: 'tier1_bvn' });
    const tier2 = resolveBidOtpRequirement(policy, { tier: 'tier2_full' });

    expect(tier1.value?.required).toBe(false);
    expect(tier2.value?.required).toBe(false);
  });

  it('defaults to all bidders in the default policy', () => {
    expect(DEFAULT_BUSINESS_POLICY.auctions.bidOtpMode).toBe('all');
    expect(
      resolveBidOtpRequirement(DEFAULT_BUSINESS_POLICY, { tier: 'tier2_full' }).value?.required
    ).toBe(true);
  });

  it('treats tier2_full as fully verified for bid OTP', () => {
    expect(isVendorFullyVerifiedForBidOtp({ tier: 'tier2_full' })).toBe(true);
    expect(isVendorFullyVerifiedForBidOtp({ tier: 'tier1_bvn' })).toBe(false);
    expect(isVendorFullyVerifiedForBidOtp({ tier: 'tier0' })).toBe(false);
  });
});
