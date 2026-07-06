import type { BusinessPolicy, VendorPolicySnapshot } from '@/features/business-policy/types';
import {
  resolveVendorBvnGate,
  resolveVendorBidEligibility,
} from '@/features/business-policy/onboarding-decisions';
import { businessPolicyService } from '@/features/business-policy/business-policy.service';
import { db } from '@/lib/db/drizzle';
import { vendors } from '@/lib/db/schema/vendors';
import { users } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import {
  CHANGE_PASSWORD_PATH,
  VENDOR_REGISTRATION_FEE_PATH,
  VENDOR_VERIFY_ACCOUNT_PATH,
} from '@/lib/auth/vendor-onboarding-paths';
import { hasRealVendorPhone } from '@/lib/auth/vendor-phone';
import { fullVerificationLabel } from '@/lib/vendor/onboarding-policy-ui';
import {
  isRegistrationFeeRequiredForPolicy,
  vendorMustPayRegistrationFeeBeforeTier1,
} from '@/features/business-policy/onboarding-decisions';

export {
  CHANGE_PASSWORD_PATH,
  VENDOR_PROFILE_PHONE_PATH,
  VENDOR_REGISTRATION_FEE_PATH,
  VENDOR_TIER1_PATH,
  VENDOR_TIER2_PATH,
  isVendorOnboardingPage,
  isVendorOnboardingApi,
} from '@/lib/auth/vendor-onboarding-paths';
export {
  usesSingleFullKycFlow,
  usesTierLanguage,
  fullVerificationLabel,
  kycVerificationPageTitle,
  kycVerifiedBadgeLabel,
  tier1SuccessRedirectPath,
} from '@/lib/vendor/onboarding-policy-ui';

export type VendorNavigationSnapshot = VendorPolicySnapshot & {
  role: string;
  requirePasswordChange?: boolean;
  needsPhoneNumber?: boolean;
  needsAccountVerification?: boolean;
  accountStatus?: string;
};

export function resolveVendorOnboardingPath(
  policy: BusinessPolicy,
  vendor: VendorNavigationSnapshot
): string | null {
  if (vendor.role !== 'vendor') {
    return null;
  }

  if (vendor.requirePasswordChange) {
    return CHANGE_PASSWORD_PATH;
  }

  if (vendor.needsPhoneNumber) {
    return VENDOR_VERIFY_ACCOUNT_PATH;
  }

  if (vendor.tier === 'tier2_full') {
    return null;
  }

  const mode = policy.onboarding.mode;
  const feeUnpaid = isRegistrationFeeRequiredForPolicy(policy) && !vendor.registrationFeePaid;

  if (vendorMustPayRegistrationFeeBeforeTier1(policy, vendor)) {
    return VENDOR_REGISTRATION_FEE_PATH;
  }

  if (vendor.needsAccountVerification) {
    return VENDOR_VERIFY_ACCOUNT_PATH;
  }

  if (mode === 'single_full_kyc') {
    if (feeUnpaid && !policy.onboarding.allowBrowseBeforeKyc) {
      return VENDOR_REGISTRATION_FEE_PATH;
    }
    return null;
  }

  const bvnGate = resolveVendorBvnGate(policy, {
    role: 'vendor',
    bvnVerified: vendor.bvnVerified,
  });

  if (!bvnGate.allowed) {
    return '/vendor/kyc/tier1';
  }

  if (mode === 'full_kyc_before_bidding') {
    return null;
  }

  return null;
}

export function vendorRequiresOnboardingGate(
  policy: BusinessPolicy,
  vendor: VendorNavigationSnapshot
): boolean {
  return resolveVendorOnboardingPath(policy, vendor) !== null;
}

export function resolveVendorBidBlockedMessage(
  policy: BusinessPolicy,
  vendor: VendorPolicySnapshot
): string | null {
  const decision = resolveVendorBidEligibility(policy, vendor, 1);
  if (decision.allowed) {
    return null;
  }

  const mode = policy.onboarding.mode;
  if (vendor.tier !== 'tier2_full' && mode === 'single_full_kyc') {
    return 'Complete your KYC before placing a bid. Start verification from your dashboard, or contact support if you need help.';
  }
  if (vendor.tier !== 'tier2_full' && mode === 'full_kyc_before_bidding') {
    return 'Complete business verification before placing a bid. You can browse auctions until your verification is approved.';
  }

  return decision.message;
}

export function resolveKycBannerCopy(
  policy: BusinessPolicy,
  vendor: VendorPolicySnapshot
): { title: string; body: string } {
  const mode = policy.onboarding.mode;
  const fullLabel = fullVerificationLabel(policy);

  if (
    policy.onboarding.registrationFeeRequired &&
    !vendor.registrationFeePaid &&
    mode !== 'no_registration_fee'
  ) {
    if (mode === 'fee_before_tier1') {
      return {
        title: 'Pay registration fee to continue',
        body: 'Pay the registration fee before identity verification (Tier 1 BVN) under your account policy.',
      };
    }
    if (mode === 'full_kyc_before_bidding' || mode === 'single_full_kyc') {
      return {
        title: 'Pay registration fee to start verification',
        body: `Pay the registration fee before you begin ${fullLabel.toLowerCase()}. You can browse auctions while you complete setup.`,
      };
    }
    return {
      title: 'Pay registration fee to bid',
      body: 'Pay the registration fee to unlock initial bidding access under your account policy.',
    };
  }

  if (mode === 'full_kyc_before_bidding' || mode === 'single_full_kyc') {
    return {
      title: mode === 'full_kyc_before_bidding' ? 'Complete verification to bid' : `Complete ${fullLabel.toLowerCase()}`,
      body:
        mode === 'full_kyc_before_bidding'
          ? 'Browsing is allowed, but you must finish business verification before placing any bid.'
          : `Finish ${fullLabel.toLowerCase()} (including identity checks) before you can bid on auctions.`,
    };
  }

  if (mode === 'fee_before_tier1' && policy.onboarding.registrationFeeRequired && !vendor.registrationFeePaid) {
    return {
      title: 'Pay registration fee to bid',
      body: 'Pay the registration fee to unlock initial bidding access under your account policy.',
    };
  }

  return {
    title: `Complete ${fullLabel}`,
    body: `Complete the configured verification checks for higher auction access, priority support, and leaderboard eligibility.`,
  };
}

export async function loadVendorNavigationSnapshot(userId: string): Promise<VendorNavigationSnapshot | null> {
  const [user] = await db
    .select({
      role: users.role,
      requirePasswordChange: users.requirePasswordChange,
      phone: users.phone,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.role !== 'vendor') {
    return null;
  }

  const [vendor] = await db
    .select({
      tier: vendors.tier,
      registrationFeePaid: vendors.registrationFeePaid,
      bvnVerifiedAt: vendors.bvnVerifiedAt,
    })
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);

  const tier = vendor?.tier === 'tier2_full' ? 'tier2_full' : vendor?.tier === 'tier1_bvn' ? 'tier1_bvn' : 'tier0';
  const needsPhoneNumber = !hasRealVendorPhone(user.phone);
  const needsAccountVerification =
    user.status === 'unverified_tier_0' && hasRealVendorPhone(user.phone);

  return {
    role: 'vendor',
    tier,
    bvnVerified: !!vendor?.bvnVerifiedAt,
    registrationFeePaid: vendor?.registrationFeePaid ?? false,
    requirePasswordChange: user.requirePasswordChange === 'true',
    needsPhoneNumber,
    needsAccountVerification,
    accountStatus: user.status,
  };
}

export function resolvePostRegistrationFeePath(policy: BusinessPolicy): string {
  if (policy.onboarding.mode === 'fee_before_tier1') {
    return '/vendor/kyc/tier1';
  }
  return '/vendor/dashboard';
}

export async function resolveVendorOnboardingRedirectForUser(userId: string): Promise<string | null> {
  const snapshot = await loadVendorNavigationSnapshot(userId);
  if (!snapshot) {
    return null;
  }
  const policy = await businessPolicyService.getEffectivePolicy();
  return resolveVendorOnboardingPath(policy, snapshot);
}
