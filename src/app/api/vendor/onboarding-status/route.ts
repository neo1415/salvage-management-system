import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/next-auth.config';
import { businessPolicyService } from '@/features/business-policy/business-policy.service';
import {
  loadVendorNavigationSnapshot,
  resolveVendorOnboardingPath,
  resolveVendorBidBlockedMessage,
  resolveKycBannerCopy,
  usesTierLanguage,
  fullVerificationLabel,
} from '@/lib/auth/vendor-onboarding-navigation';
import { resolveVendorBidEligibility } from '@/features/business-policy/onboarding-decisions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await loadVendorNavigationSnapshot(session.user.id);
    if (!snapshot) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 });
    }

    const policy = await businessPolicyService.getEffectivePolicy();
    const redirectPath = resolveVendorOnboardingPath(policy, snapshot);
    const bidDecision = resolveVendorBidEligibility(policy, snapshot, 1);
    const banner = resolveKycBannerCopy(policy, snapshot);

    return NextResponse.json({
      status: 'success',
      data: {
        redirectPath,
        canBid: bidDecision.allowed,
        bidBlockedMessage: resolveVendorBidBlockedMessage(policy, snapshot),
        onboardingMode: policy.onboarding.mode,
        usesTierLanguage: usesTierLanguage(policy),
        fullVerificationLabel: fullVerificationLabel(policy),
        registrationFeeRequired: policy.onboarding.registrationFeeRequired,
        registrationFeeAmount: policy.onboarding.registrationFeeAmount,
        tier1BidLimit: policy.onboarding.tier1BidLimit,
        bannerTitle: banner.title,
        bannerBody: banner.body,
        tier: snapshot.tier,
        registrationFeePaid: snapshot.registrationFeePaid,
        bvnVerified: snapshot.bvnVerified,
      },
    });
  } catch (error) {
    console.error('Vendor onboarding status error:', error);
    return NextResponse.json({ error: 'Failed to load onboarding status' }, { status: 500 });
  }
}
