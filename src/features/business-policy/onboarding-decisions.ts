import type {
  BusinessPolicy,
  PolicyDecision,
  VendorPolicySnapshot,
} from './types';
import { createPolicyDecisionRecord } from './policy-decisions';

export function resolveVendorBvnGate(
  policy: BusinessPolicy,
  vendor: Pick<VendorPolicySnapshot, 'role' | 'bvnVerified'>
): PolicyDecision {
  const requiresBvn = vendor.role === 'vendor' && policy.kyc.tier1RequiresBvn;
  const allowed = !requiresBvn || vendor.bvnVerified;

  return {
    allowed,
    value: allowed ? 'bvn_gate_clear' : 'bvn_required',
    message: allowed
      ? 'Vendor may continue because BVN gate is satisfied or not required.'
      : 'Vendor must complete Tier 1 BVN verification before continuing.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'vendor_bvn_gate_resolved',
      rulePath: 'kyc.tier1RequiresBvn',
      outcome: allowed ? 'allow' : 'deny',
      entityType: 'vendor',
      reason: allowed ? 'BVN gate satisfied.' : 'BVN verification is required by current policy.',
      inputs: {
        role: vendor.role,
        bvnVerified: vendor.bvnVerified,
      },
      resolvedValue: allowed,
    }),
  };
}

export function resolveVendorBidLimit(
  policy: BusinessPolicy,
  vendor: Pick<VendorPolicySnapshot, 'tier'>
): PolicyDecision<number | null> {
  const limit = vendor.tier === 'tier2_full' ? null : policy.onboarding.tier1BidLimit;

  return {
    allowed: true,
    value: limit,
    message: limit === null ? 'Tier 2 vendor has no Tier 1 bid limit.' : 'Tier 1 or unverified vendor uses the configured Tier 1 bid limit.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'vendor_bid_limit_resolved',
      rulePath: vendor.tier === 'tier2_full' ? 'onboarding.requireTier2ForUnlimitedBidding' : 'onboarding.tier1BidLimit',
      outcome: 'value_resolved',
      entityType: 'vendor',
      reason: limit === null ? 'Vendor is Tier 2.' : 'Vendor is not Tier 2.',
      inputs: {
        tier: vendor.tier,
      },
      resolvedValue: limit,
    }),
  };
}

export function resolveVendorBidEligibility(
  policy: BusinessPolicy,
  vendor: Pick<VendorPolicySnapshot, 'tier' | 'bvnVerified'>,
  bidAmount: number
): PolicyDecision<{ bidLimit: number | null }> {
  const bvnGate = resolveVendorBvnGate(policy, { role: 'vendor', bvnVerified: vendor.bvnVerified });
  if (!bvnGate.allowed) {
    return {
      allowed: false,
      value: { bidLimit: policy.onboarding.tier1BidLimit },
      message: bvnGate.message,
      decision: createPolicyDecisionRecord({
        policy,
        decisionType: 'vendor_bid_denied',
        rulePath: 'kyc.tier1RequiresBvn',
        outcome: 'deny',
        entityType: 'vendor',
        reason: 'Vendor has not satisfied Tier 1 BVN gate.',
        inputs: {
          tier: vendor.tier,
          bvnVerified: vendor.bvnVerified,
          bidAmount,
        },
      }),
    };
  }

  const limitDecision = resolveVendorBidLimit(policy, vendor);
  const bidLimit = limitDecision.value ?? null;
  const allowed = bidLimit === null || bidAmount <= bidLimit;

  return {
    allowed,
    value: { bidLimit },
    message: allowed
      ? 'Vendor can place this bid under the current onboarding policy.'
      : `Bid exceeds the configured Tier 1 limit of ${bidLimit}.`,
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: allowed ? 'vendor_bid_allowed' : 'vendor_bid_denied',
      rulePath: bidLimit === null ? 'onboarding.requireTier2ForUnlimitedBidding' : 'onboarding.tier1BidLimit',
      outcome: allowed ? 'allow' : 'deny',
      entityType: 'vendor',
      reason: allowed ? 'Bid is within configured eligibility.' : 'Bid exceeds configured Tier 1 limit.',
      inputs: {
        tier: vendor.tier,
        bvnVerified: vendor.bvnVerified,
        bidAmount,
      },
      resolvedValue: bidLimit,
    }),
  };
}

export function resolveTier2Access(
  policy: BusinessPolicy,
  vendor: Pick<VendorPolicySnapshot, 'tier' | 'bvnVerified' | 'registrationFeePaid'>
): PolicyDecision {
  if (vendor.tier === 'tier2_full') {
    return {
      allowed: true,
      value: 'already_tier2',
      message: 'Vendor already has Tier 2 access.',
      decision: createPolicyDecisionRecord({
        policy,
        decisionType: 'tier2_access_resolved',
        rulePath: 'onboarding.requireTier2ForUnlimitedBidding',
        outcome: 'allow',
        entityType: 'vendor',
        reason: 'Vendor is already Tier 2.',
        inputs: { tier: vendor.tier },
        resolvedValue: true,
      }),
    };
  }

  if (policy.kyc.tier1RequiresBvn && !vendor.bvnVerified) {
    return {
      allowed: false,
      value: 'bvn_required',
      message: 'Vendor must complete Tier 1 BVN verification before Tier 2.',
      decision: createPolicyDecisionRecord({
        policy,
        decisionType: 'tier2_access_resolved',
        rulePath: 'kyc.tier1RequiresBvn',
        outcome: 'deny',
        entityType: 'vendor',
        reason: 'Tier 2 access requires Tier 1 BVN under current policy.',
        inputs: {
          tier: vendor.tier,
          bvnVerified: vendor.bvnVerified,
        },
      }),
    };
  }

  if (policy.onboarding.registrationFeeRequired && !vendor.registrationFeePaid) {
    return {
      allowed: false,
      value: 'registration_fee_required',
      message: 'Vendor must pay the registration fee before Tier 2 verification.',
      decision: createPolicyDecisionRecord({
        policy,
        decisionType: 'tier2_access_resolved',
        rulePath: 'onboarding.registrationFeeRequired',
        outcome: 'deny',
        entityType: 'vendor',
        reason: 'Registration fee is required before Tier 2 under current policy.',
        inputs: {
          registrationFeePaid: vendor.registrationFeePaid,
          registrationFeeRequired: policy.onboarding.registrationFeeRequired,
        },
        resolvedValue: policy.onboarding.registrationFeeAmount,
      }),
    };
  }

  return {
    allowed: true,
    value: 'tier2_available',
    message: 'Vendor can start Tier 2 verification.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'tier2_access_resolved',
      rulePath: 'onboarding.mode',
      outcome: 'allow',
      entityType: 'vendor',
      reason: 'Vendor satisfies the configured prerequisites for Tier 2.',
      inputs: {
        tier: vendor.tier,
        bvnVerified: vendor.bvnVerified,
        registrationFeePaid: vendor.registrationFeePaid,
      },
      resolvedValue: true,
    }),
  };
}

export function resolveTier2ReviewRequirement(policy: BusinessPolicy): PolicyDecision<'manual_review' | 'provider_pass_can_continue'> {
  const requiresReview = policy.kyc.providerPassRequiresInternalReview || policy.onboarding.finalTier2Decision === 'manual_review';

  return {
    allowed: true,
    value: requiresReview ? 'manual_review' : 'provider_pass_can_continue',
    message: requiresReview
      ? 'Tier 2 provider evidence requires internal manual review.'
      : 'Provider pass can continue under the configured policy.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'tier2_review_requirement_resolved',
      rulePath: 'kyc.providerPassRequiresInternalReview',
      outcome: requiresReview ? 'require_review' : 'allow',
      entityType: 'kyc',
      reason: requiresReview ? 'Current policy keeps Tier 2 as internal manual review.' : 'Current policy allows provider result to continue.',
      inputs: {
        providerPassRequiresInternalReview: policy.kyc.providerPassRequiresInternalReview,
        finalTier2Decision: policy.onboarding.finalTier2Decision,
      },
      resolvedValue: requiresReview,
    }),
  };
}

