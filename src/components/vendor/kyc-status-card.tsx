'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAppRouter } from '@/hooks/use-app-router';
import { Crown, ArrowRight, CheckCircle2, Clock, XCircle, AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import type { KYCStatus } from '@/features/kyc/types/kyc.types';
import { usePublicBusinessPolicy } from '@/hooks/use-public-business-policy';
import {
  kycVerificationPageTitle,
  kycVerifiedBadgeLabel,
  usesTierLanguage,
  fullVerificationLabel,
} from '@/lib/vendor/onboarding-policy-ui';
import { resolveVendorTier2Path } from '@/lib/kyc/tier2-kyc-provider';
import { useVendorOnboardingStatus } from '@/hooks/use-vendor-onboarding-status';
import { isPendingTier2Review } from '@/features/kyc/utils/tier2-status';

export type VendorTier = 'tier0' | 'tier1_bvn' | 'tier2_full';

interface KYCStatusCardProps {
  currentTier: VendorTier;
  bidLimit?: number;
  className?: string;
}

export function KYCStatusCard({ currentTier, bidLimit, className = '' }: KYCStatusCardProps) {
  const router = useAppRouter();
  const { policy } = usePublicBusinessPolicy();
  const { status: onboardingStatus } = useVendorOnboardingStatus();
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [registrationFeePaid, setRegistrationFeePaid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStatus = useCallback((showLoader = false) => {
    if (showLoader) setLoading(true);
    const noStore = { cache: 'no-store' as const, headers: { 'Cache-Control': 'no-cache' } };
    Promise.all([
      fetch('/api/kyc/status', noStore).then((r) => r.ok ? r.json() : null),
      fetch('/api/vendors/registration-fee/status', noStore).then((r) => r.ok ? r.json() : null),
    ])
      .then(([kycData, feeData]) => {
        setKycStatus(kycData);
        setRegistrationFeePaid(feeData?.data?.paid ?? false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadStatus(true);
  }, [loadStatus]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        loadStatus(false);
      }
    };
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [loadStatus]);

  const tierLanguage = policy ? usesTierLanguage(policy) : true;
  const verifiedLabel = policy ? kycVerifiedBadgeLabel(policy) : 'Tier 2 verified';
  const fullLabel = policy ? fullVerificationLabel(policy) : 'Full verification';

  const handleUpgradeClick = () => {
    const tier2Path = resolveVendorTier2Path();
    if (!policy?.onboarding.registrationFeeRequired) {
      router.push(tier2Path);
      return;
    }

    if (registrationFeePaid) {
      router.push(tier2Path);
    } else {
      router.push('/vendor/registration-fee');
    }
  };

  const tier2Approved = currentTier === 'tier2_full' || kycStatus?.status === 'approved';
  const tier2PendingReview = isPendingTier2Review(kycStatus);

  // Tier 2 approved — show expiry info if within 30 days
  if (tier2Approved && kycStatus?.expiresAt) {
    const expiresAt = new Date(kycStatus.expiresAt);
    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 30) {
      return (
        <div className={`bg-orange-50 border border-orange-200 rounded-lg p-4 ${className}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-orange-900">
                {tierLanguage ? 'Tier 2 verification expiring soon' : `${fullLabel} expiring soon`}
              </p>
              <p className="text-sm text-orange-700 mt-1">
                Your verification expires in <strong>{daysLeft} days</strong> ({expiresAt.toLocaleDateString()}).
                Renew now to keep full bidding access.
              </p>
            </div>
            <button
              onClick={handleUpgradeClick}
              className="flex-shrink-0 px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Renew
            </button>
          </div>
        </div>
      );
    }

    // Tier 2 active and not expiring soon — show badge
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <Shield className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-green-900 flex items-center gap-2">
              {verifiedLabel}
              <span className="inline-flex items-center gap-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Active
              </span>
            </p>
            <p className="text-sm text-green-700">
              Full bidding access
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (tier2Approved && !kycStatus?.expiresAt) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <Shield className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-green-900 flex items-center gap-2">
              {verifiedLabel}
              <span className="inline-flex items-center gap-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Active
              </span>
            </p>
            <p className="text-sm text-green-700">Full bidding access</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return null;

  if (kycStatus?.status === 'rejected') {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-900">
              {tierLanguage ? 'Tier 2 application not approved' : 'KYC application not approved'}
            </p>
            {kycStatus.rejectionReason && (
              <p className="text-sm text-red-700 mt-1">{kycStatus.rejectionReason}</p>
            )}
            {kycStatus.rejectedSections?.length ? (
              <p className="text-xs text-red-600 mt-1">
                Sections: {kycStatus.rejectedSections.join(', ')}
              </p>
            ) : null}
          </div>
          <button
            onClick={() => {
              void (async () => {
                await fetch('/api/kyc/prepare-resubmit', { method: 'POST' });
                handleUpgradeClick();
              })();
            }}
            className="flex-shrink-0 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Resubmit
          </button>
        </div>
      </div>
    );
  }

  // Pending review
  if (tier2PendingReview) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-900">
              {tierLanguage ? 'Tier 2 application under review' : 'KYC application under review'}
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              Our team is reviewing your application. You'll be notified once the review is complete.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Tier 0 / Tier 1 — show upgrade or fee banner
  if (currentTier === 'tier1_bvn' || currentTier === 'tier0') {
    // If registration fee not paid, show payment prompt
    if (policy?.onboarding.registrationFeeRequired !== false && registrationFeePaid === false) {
      return (
        <div className={`relative bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-hover)] text-white rounded-lg shadow-lg overflow-hidden ${className}`}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="relative p-4 md:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Crown className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg md:text-xl font-bold mb-1">
                  {onboardingStatus?.bannerTitle ?? 'Complete your registration'}
                </h3>
                <p className="text-white/90 text-sm md:text-base">
                  {onboardingStatus?.bannerBody ??
                    `Pay the one-time registration fee to continue to ${fullLabel.toLowerCase()}.`}
                  {bidLimit && tierLanguage ? ` Your current Tier 1 limit is ₦${bidLimit.toLocaleString()}.` : ''}
                </p>
              </div>
              <button
                onClick={() => router.push('/vendor/registration-fee')}
                className="flex-shrink-0 px-6 py-3 bg-white text-[var(--brand-primary)] font-bold rounded-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-2 whitespace-nowrap min-h-[44px]"
              >
                Pay Now
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      );
    }

    // If registration fee paid, show Tier 2 upgrade prompt
    return (
      <div className={`relative bg-gradient-to-r from-[var(--brand-primary)] to-[var(--brand-primary-hover)] text-white rounded-lg shadow-lg overflow-hidden ${className}`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative p-4 md:p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
              <Crown className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg md:text-xl font-bold mb-1">
              {onboardingStatus?.bannerTitle ??
                (policy ? kycVerificationPageTitle(policy) : 'Complete full verification')}
              </h3>
              <p className="text-white/90 text-sm md:text-base">
                {onboardingStatus?.bannerBody ??
                  'Complete the configured verification checks for higher auction access, priority support, and leaderboard eligibility.'}
                {bidLimit && onboardingStatus?.canBid ? ` Your current bid limit is ₦${bidLimit.toLocaleString()}.` : ''}
              </p>
            </div>
            <button
              onClick={handleUpgradeClick}
              className="flex-shrink-0 px-6 py-3 bg-white text-[var(--brand-primary)] font-bold rounded-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-2 whitespace-nowrap min-h-[44px]"
            >
              Upgrade Now
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
