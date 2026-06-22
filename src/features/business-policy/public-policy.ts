import type { BusinessPolicy, PublicBusinessPolicy } from './types';

export function toPublicBusinessPolicy(policy: BusinessPolicy): PublicBusinessPolicy {
  return {
    version: policy.version,
    branding: policy.branding,
    auth: {
      emailPasswordEnabled: policy.auth.emailPasswordEnabled,
      googleOAuthEnabled: policy.auth.googleOAuthEnabled,
      businessEmailOnly: policy.auth.businessEmailOnly,
    },
    onboarding: {
      mode: policy.onboarding.mode,
      tier1BidLimit: policy.onboarding.tier1BidLimit,
      registrationFeeRequired: policy.onboarding.registrationFeeRequired,
      registrationFeeAmount: policy.onboarding.registrationFeeAmount,
      allowBrowseBeforeKyc: policy.onboarding.allowBrowseBeforeKyc,
      allowBidAfterTier1: policy.onboarding.allowBidAfterTier1,
      requireTier2ForUnlimitedBidding: policy.onboarding.requireTier2ForUnlimitedBidding,
    },
    payments: {
      walletEnabled: policy.payments.walletEnabled,
      paystackEnabled: policy.payments.paystackEnabled,
      flutterwaveEnabled: policy.payments.flutterwaveEnabled,
      hybridPaymentEnabled: policy.payments.hybridPaymentEnabled,
      manualPaymentEnabled: policy.payments.manualPaymentEnabled,
      paymentDeadlineAfterSigningHours: policy.payments.paymentDeadlineAfterSigningHours,
    },
    auctions: {
      minimumBidIncrement: policy.auctions.minimumBidIncrement,
    },
    cases: {
      enabledAssetTypes: policy.cases.enabledAssetTypes,
      insuranceClasses: policy.cases.insuranceClasses,
      voiceNotesEnabled: policy.cases.voiceNotesEnabled,
    },
    documents: {
      requiredAuctionDocuments: policy.documents.requiredAuctionDocuments,
    },
  };
}
