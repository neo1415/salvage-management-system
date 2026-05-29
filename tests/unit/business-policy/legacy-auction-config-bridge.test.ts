import { describe, expect, it } from 'vitest';
import { DEFAULT_BUSINESS_POLICY } from '@/features/business-policy';
import {
  normalizeLegacyAuctionConfigParameter,
  patchLegacyAuctionConfigPolicy,
  policyToLegacyAuctionConfig,
} from '@/features/business-policy/legacy-auction-config-bridge';

describe('legacy auction config bridge', () => {
  it('projects business policy values into the auction config shape', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    policy.onboarding.registrationFeeAmount = 15_000;
    policy.escrow.depositRatePercent = 12;
    policy.escrow.minimumDepositFloor = 120_000;
    policy.onboarding.tier1BidLimit = 750_000;
    policy.auctions.minimumBidIncrement = 25_000;
    policy.auctions.documentValidityHours = 36;
    policy.auctions.maxGraceExtensions = 3;
    policy.auctions.graceExtensionDurationHours = 12;
    policy.auctions.fallbackBufferHours = 18;
    policy.escrow.topBiddersToKeepFrozen = 4;
    policy.escrow.forfeiturePercentage = 80;
    policy.payments.paymentDeadlineAfterSigningHours = 60;

    expect(policyToLegacyAuctionConfig(policy)).toEqual({
      registrationFee: 15_000,
      depositRate: 12,
      minimumDepositFloor: 120_000,
      tier1Limit: 750_000,
      minimumBidIncrement: 25_000,
      documentValidityPeriod: 36,
      maxGraceExtensions: 3,
      graceExtensionDuration: 12,
      fallbackBufferPeriod: 18,
      topBiddersToKeepFrozen: 4,
      forfeiturePercentage: 80,
      paymentDeadlineAfterSigning: 60,
    });
  });

  it('normalizes the existing tier1_limit form parameter alias', () => {
    expect(normalizeLegacyAuctionConfigParameter('tier1_limit')).toBe('tier_1_limit');
    expect(normalizeLegacyAuctionConfigParameter('tier1Limit')).toBe('tier_1_limit');
  });

  it('patches only the targeted policy field and bumps the policy version', () => {
    const policy = structuredClone(DEFAULT_BUSINESS_POLICY);
    const beforeDepositRate = policy.escrow.depositRatePercent;

    const result = patchLegacyAuctionConfigPolicy(policy, 'minimum_bid_increment', 30_000);

    expect(result.canonicalParameter).toBe('minimum_bid_increment');
    expect(result.policy.auctions.minimumBidIncrement).toBe(30_000);
    expect(result.policy.escrow.depositRatePercent).toBe(beforeDepositRate);
    expect(result.policy.version).toContain('-auction-config-');
    expect(policy.auctions.minimumBidIncrement).toBe(DEFAULT_BUSINESS_POLICY.auctions.minimumBidIncrement);
  });
});
