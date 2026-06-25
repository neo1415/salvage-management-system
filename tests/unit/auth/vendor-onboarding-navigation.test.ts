import { describe, expect, it } from 'vitest';
import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy/default-policy';
import { resolveVendorOnboardingPath } from '@/lib/auth/vendor-onboarding-navigation';
import {
  VENDOR_REGISTRATION_FEE_PATH,
  VENDOR_VERIFY_ACCOUNT_PATH,
} from '@/lib/auth/vendor-onboarding-paths';

const baseVendor = {
  role: 'vendor' as const,
  tier: 'tier0' as const,
  bvnVerified: false,
  registrationFeePaid: false,
};

describe('resolveVendorOnboardingPath', () => {
  it('redirects to registration fee before BVN when fee-before-tier1 is configured', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.onboarding.mode = 'fee_before_tier1';
    policy.onboarding.registrationFeeRequired = true;

    const path = resolveVendorOnboardingPath(policy, baseVendor);

    expect(path).toBe(VENDOR_REGISTRATION_FEE_PATH);
  });

  it('redirects to Tier 1 after fee is paid under fee-before-tier1', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.onboarding.mode = 'fee_before_tier1';
    policy.onboarding.registrationFeeRequired = true;

    const path = resolveVendorOnboardingPath(policy, {
      ...baseVendor,
      registrationFeePaid: true,
    });

    expect(path).toBe('/vendor/kyc/tier1');
  });

  it('allows browsing without forcing full KYC when full KYC is required before bidding', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.onboarding.mode = 'full_kyc_before_bidding';
    policy.onboarding.registrationFeeRequired = true;
    policy.onboarding.allowBrowseBeforeKyc = true;

    const path = resolveVendorOnboardingPath(policy, {
      ...baseVendor,
      tier: 'tier1_bvn',
      bvnVerified: true,
      registrationFeePaid: true,
    });

    expect(path).toBeNull();
  });

  it('allows browsing before BVN when allowBrowseBeforeKyc is enabled', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.onboarding.mode = 'full_kyc_before_bidding';
    policy.onboarding.allowBrowseBeforeKyc = true;
    policy.onboarding.registrationFeeRequired = true;

    const path = resolveVendorOnboardingPath(policy, baseVendor);

    expect(path).toBeNull();
  });

  it('allows browsing for single full KYC after registration fee is paid', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.onboarding.mode = 'single_full_kyc';
    policy.onboarding.registrationFeeRequired = true;

    const path = resolveVendorOnboardingPath(policy, {
      ...baseVendor,
      registrationFeePaid: true,
    });

    expect(path).toBeNull();
  });

  it('still gates account verification before onboarding steps', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);

    const path = resolveVendorOnboardingPath(policy, {
      ...baseVendor,
      needsAccountVerification: true,
    });

    expect(path).toBe(VENDOR_VERIFY_ACCOUNT_PATH);
  });
});
