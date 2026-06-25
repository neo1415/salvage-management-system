import type { BusinessPolicy, BidOtpMode, PolicyDecision, VendorPolicySnapshot } from './types';
import { createPolicyDecisionRecord } from './policy-decisions';

export const BID_OTP_MODE_LABELS: Record<BidOtpMode, string> = {
  none: 'No OTP — bidding never requires SMS verification',
  tier1_only: 'OTP for Tier 1 only — fully verified vendors skip OTP',
  all: 'OTP for all bidders — every bid requires SMS verification',
};

export function isVendorFullyVerifiedForBidOtp(
  vendor: Pick<VendorPolicySnapshot, 'tier'>
): boolean {
  return vendor.tier === 'tier2_full';
}

export function resolveBidOtpRequirement(
  policy: BusinessPolicy,
  vendor: Pick<VendorPolicySnapshot, 'tier'>
): PolicyDecision<{ required: boolean; mode: BidOtpMode }> {
  const mode = policy.auctions.bidOtpMode ?? 'all';
  const fullyVerified = isVendorFullyVerifiedForBidOtp(vendor);

  let required: boolean;
  if (mode === 'none') {
    required = false;
  } else if (mode === 'all') {
    required = true;
  } else {
    required = !fullyVerified;
  }

  return {
    allowed: true,
    value: { required, mode },
    message: required
      ? 'Bid placement requires OTP verification under the current auction policy.'
      : 'Bid placement does not require OTP under the current auction policy.',
    decision: createPolicyDecisionRecord({
      policy,
      decisionType: 'bid_otp_requirement_resolved',
      rulePath: 'auctions.bidOtpMode',
      outcome: required ? 'value_resolved' : 'value_resolved',
      entityType: 'vendor',
      reason: required
        ? mode === 'all'
          ? 'All bidders require OTP.'
          : 'Vendor is not fully verified and tier1_only OTP mode is active.'
        : mode === 'none'
          ? 'Bid OTP is disabled.'
          : 'Vendor is fully verified and tier1_only OTP mode is active.',
      inputs: {
        tier: vendor.tier,
        mode,
        fullyVerified,
      },
      resolvedValue: required,
    }),
  };
}
