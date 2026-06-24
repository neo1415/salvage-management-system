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
  const requiresBvn = vendor.role === 'vendor' && policy.kyc.tier1RequiresBvn && policy.onboarding.mode !== 'single_full_kyc';
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
  const tier2HasUnlimitedAccess = vendor.tier === 'tier2_full' && policy.onboarding.requireTier2ForUnlimitedBidding;
  const fullKycRequired = policy.onboarding.mode === 'full_kyc_before_bidding' || policy.onboarding.mode === 'single_full_kyc';
  const limit = tier2HasUnlimitedAccess ? null : fullKycRequired ? 0 : policy.onboarding.tier1BidLimit;

  return {
    allowed: true,
    value: limit,
    message: limit === null
      ? 'Tier 2 vendor has no Tier 1 bid limit.'
      : limit === 0
        ? 'Current onboarding mode requires full KYC approval before bidding.'
        : 'Tier 1 or unverified vendor uses the configured Tier 1 bid limit.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'vendor_bid_limit_resolved',
      rulePath: limit === 0 ? 'onboarding.mode' : vendor.tier === 'tier2_full' ? 'onboarding.requireTier2ForUnlimitedBidding' : 'onboarding.tier1BidLimit',
      outcome: 'value_resolved',
      entityType: 'vendor',
      reason: limit === null ? 'Vendor is Tier 2.' : limit === 0 ? 'Full KYC is required before bidding.' : 'Vendor is not Tier 2.',
      inputs: {
        tier: vendor.tier,
      },
      resolvedValue: limit,
    }),
  };
}

export function resolveVendorBidEligibility(
  policy: BusinessPolicy,
  vendor: Pick<VendorPolicySnapshot, 'tier' | 'bvnVerified'> & Partial<Pick<VendorPolicySnapshot, 'registrationFeePaid'>>,
  bidAmount: number
): PolicyDecision<{ bidLimit: number | null }> {
  if (
    vendor.tier !== 'tier2_full' &&
    policy.onboarding.mode === 'fee_before_tier1' &&
    policy.onboarding.registrationFeeRequired &&
    !vendor.registrationFeePaid
  ) {
    return {
      allowed: false,
      value: { bidLimit: 0 },
      message: 'Vendor must pay the registration fee before bidding under the current onboarding policy.',
      decision: createPolicyDecisionRecord({
        policy,
        decisionType: 'vendor_bid_denied',
        rulePath: 'onboarding.mode',
        outcome: 'deny',
        entityType: 'vendor',
        reason: 'Registration fee is required before Tier 1 bidding.',
        inputs: {
          tier: vendor.tier,
          bvnVerified: vendor.bvnVerified,
          registrationFeePaid: vendor.registrationFeePaid ?? false,
          bidAmount,
        },
        resolvedValue: policy.onboarding.registrationFeeAmount,
      }),
    };
  }

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
  if (bidLimit === 0 && vendor.tier !== 'tier2_full') {
    return {
      allowed: false,
      value: { bidLimit },
      message: 'Vendor must complete full verification before bidding under the current onboarding policy.',
      decision: createPolicyDecisionRecord({
        policy,
        decisionType: 'vendor_bid_denied',
        rulePath: 'onboarding.mode',
        outcome: 'deny',
        entityType: 'vendor',
        reason: 'Current onboarding mode requires full KYC before bidding.',
        inputs: {
          tier: vendor.tier,
          bvnVerified: vendor.bvnVerified,
          registrationFeePaid: vendor.registrationFeePaid ?? false,
          bidAmount,
        },
        resolvedValue: bidLimit,
      }),
    };
  }

  const allowed = bidLimit === null || bidAmount <= bidLimit;

  return {
    allowed,
    value: { bidLimit },
    message: allowed
      ? 'Vendor can place this bid under the current onboarding policy.'
      : `Bid exceeds the configured initial verification limit of ${bidLimit}.`,
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: allowed ? 'vendor_bid_allowed' : 'vendor_bid_denied',
      rulePath: bidLimit === null ? 'onboarding.requireTier2ForUnlimitedBidding' : 'onboarding.tier1BidLimit',
      outcome: allowed ? 'allow' : 'deny',
      entityType: 'vendor',
      reason: allowed ? 'Bid is within configured eligibility.' : 'Bid exceeds configured initial verification limit.',
      inputs: {
        tier: vendor.tier,
        bvnVerified: vendor.bvnVerified,
        bidAmount,
      },
      resolvedValue: bidLimit,
    }),
  };
}

export function isRegistrationFeeRequiredForPolicy(policy: BusinessPolicy): boolean {
  return (
    policy.onboarding.registrationFeeRequired &&
    policy.onboarding.mode !== 'no_registration_fee'
  );
}

export function resolveRegistrationFeePaymentAccess(
  policy: BusinessPolicy,
  vendor: Pick<VendorPolicySnapshot, 'tier' | 'bvnVerified' | 'registrationFeePaid'>
): PolicyDecision<'fee_not_required' | 'already_paid' | 'bvn_required' | 'payment_available'> {
  if (!isRegistrationFeeRequiredForPolicy(policy)) {
    return {
      allowed: false,
      value: 'fee_not_required',
      message: 'Registration fee is not required under the current onboarding policy.',
      decision: createPolicyDecisionRecord({
        policy,
        decisionType: 'registration_fee_payment_resolved',
        rulePath: 'onboarding.registrationFeeRequired',
        outcome: 'not_applicable',
        entityType: 'payment',
        reason: 'Registration fee payment is disabled or not required.',
        inputs: {
          registrationFeeRequired: policy.onboarding.registrationFeeRequired,
          mode: policy.onboarding.mode,
        },
        resolvedValue: 0,
      }),
    };
  }

  if (vendor.registrationFeePaid) {
    return {
      allowed: false,
      value: 'already_paid',
      message: 'Registration fee has already been paid.',
      decision: createPolicyDecisionRecord({
        policy,
        decisionType: 'registration_fee_payment_resolved',
        rulePath: 'onboarding.registrationFeeRequired',
        outcome: 'not_applicable',
        entityType: 'payment',
        reason: 'Vendor has already paid the registration fee.',
        inputs: {
          tier: vendor.tier,
          registrationFeePaid: vendor.registrationFeePaid,
        },
        resolvedValue: policy.onboarding.registrationFeeAmount,
      }),
    };
  }

  const canPayBeforeBvn = policy.onboarding.mode === 'fee_before_tier1' || policy.onboarding.mode === 'single_full_kyc';
  if (policy.kyc.tier1RequiresBvn && !canPayBeforeBvn && !vendor.bvnVerified) {
    return {
      allowed: false,
      value: 'bvn_required',
      message: 'Vendor must complete identity verification before paying the registration fee.',
      decision: createPolicyDecisionRecord({
        policy,
        decisionType: 'registration_fee_payment_resolved',
        rulePath: 'kyc.tier1RequiresBvn',
        outcome: 'deny',
        entityType: 'payment',
        reason: 'Registration fee is configured after identity verification.',
        inputs: {
          tier: vendor.tier,
          bvnVerified: vendor.bvnVerified,
          mode: policy.onboarding.mode,
        },
        resolvedValue: policy.onboarding.registrationFeeAmount,
      }),
    };
  }

  return {
    allowed: true,
    value: 'payment_available',
    message: 'Vendor may pay the registration fee under the current onboarding policy.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'registration_fee_payment_resolved',
      rulePath: 'onboarding.registrationFeeRequired',
      outcome: 'allow',
      entityType: 'payment',
      reason: 'Vendor satisfies the configured prerequisites for registration fee payment.',
      inputs: {
        tier: vendor.tier,
        bvnVerified: vendor.bvnVerified,
        registrationFeePaid: vendor.registrationFeePaid,
        mode: policy.onboarding.mode,
      },
      resolvedValue: policy.onboarding.registrationFeeAmount,
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
      message: 'Vendor already has full verification access.',
      decision: createPolicyDecisionRecord({
        policy,
        decisionType: 'tier2_access_resolved',
        rulePath: 'onboarding.requireTier2ForUnlimitedBidding',
        outcome: 'allow',
        entityType: 'vendor',
        reason: 'Vendor is already fully verified.',
        inputs: { tier: vendor.tier },
        resolvedValue: true,
      }),
    };
  }

  if (policy.kyc.tier1RequiresBvn && policy.onboarding.mode !== 'single_full_kyc' && !vendor.bvnVerified) {
    return {
      allowed: false,
      value: 'bvn_required',
      message: 'Vendor must complete identity verification before full verification.',
      decision: createPolicyDecisionRecord({
        policy,
        decisionType: 'tier2_access_resolved',
        rulePath: 'kyc.tier1RequiresBvn',
        outcome: 'deny',
        entityType: 'vendor',
        reason: 'Full verification requires identity verification under current policy.',
        inputs: {
          tier: vendor.tier,
          bvnVerified: vendor.bvnVerified,
        },
      }),
    };
  }

  const feeRequiredBeforeTier2 = isRegistrationFeeRequiredForPolicy(policy);
  if (feeRequiredBeforeTier2 && !vendor.registrationFeePaid) {
    return {
      allowed: false,
      value: 'registration_fee_required',
      message: 'Vendor must pay the registration fee before full verification.',
      decision: createPolicyDecisionRecord({
        policy,
        decisionType: 'tier2_access_resolved',
        rulePath: 'onboarding.registrationFeeRequired',
        outcome: 'deny',
        entityType: 'vendor',
        reason: 'Registration fee is required before full verification under current policy.',
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
    message: 'Vendor can start full verification.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'tier2_access_resolved',
      rulePath: 'onboarding.mode',
      outcome: 'allow',
      entityType: 'vendor',
      reason: 'Vendor satisfies the configured prerequisites for full verification.',
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

