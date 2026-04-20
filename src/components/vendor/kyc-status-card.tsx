'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, ArrowRight, CheckCircle2, Clock, XCircle, AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import type { KYCStatus } from '@/features/kyc/types/kyc.types';

export type VendorTier = 'tier1_bvn' | 'tier2_full';

interface KYCStatusCardProps {
  currentTier: VendorTier;
  bidLimit?: number;
  className?: string;
}

export function KYCStatusCard({ currentTier, className = '' }: KYCStatusCardProps) {
  const router = useRouter();
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [registrationFeePaid, setRegistrationFeePaid] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/kyc/status').then((r) => r.ok ? r.json() : null),
      fetch('/api/vendors/registration-fee/status').then((r) => r.ok ? r.json() : null),
    ])
      .then(([kycData, feeData]) => {
        setKycStatus(kycData);
        setRegistrationFeePaid(feeData?.data?.paid ?? false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleUpgradeClick = () => {
    // Check if registration fee is paid before allowing Tier 2 KYC
    if (registrationFeePaid) {
      router.push('/vendor/kyc/tier2');
    } else {
      router.push('/vendor/registration-fee');
    }
  };

  // Tier 2 approved — show expiry info if within 30 days
  if (currentTier === 'tier2_full' && kycStatus?.expiresAt) {
    const expiresAt = new Date(kycStatus.expiresAt);
    const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 30) {
      return (
        <div className={`bg-orange-50 border border-orange-200 rounded-lg p-4 ${className}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-orange-900">Tier 2 Verification Expiring Soon</p>
              <p className="text-sm text-orange-700 mt-1">
                Your verification expires in <strong>{daysLeft} days</strong> ({expiresAt.toLocaleDateString()}).
                Renew now to keep unlimited bidding access.
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
              Tier 2 Verified
              <span className="inline-flex items-center gap-1 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Active
              </span>
            </p>
            <p className="text-sm text-green-700">
              Unlimited bidding · Valid until {expiresAt.toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return null;

  // Pending review
  if (kycStatus?.status === 'pending_review') {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-900">Tier 2 Application Under Review</p>
            <p className="text-sm text-yellow-700 mt-1">
              Our team is reviewing your application. You'll be notified within 24–48 hours.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Rejected — allow resubmit
  if (kycStatus?.status === 'rejected') {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-900">Tier 2 Application Not Approved</p>
            {kycStatus.rejectionReason && (
              <p className="text-sm text-red-700 mt-1">{kycStatus.rejectionReason}</p>
            )}
          </div>
          <button
            onClick={handleUpgradeClick}
            className="flex-shrink-0 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Resubmit
          </button>
        </div>
      </div>
    );
  }

  // Tier 1 — show upgrade banner
  if (currentTier === 'tier1_bvn') {
    // If registration fee not paid, show payment prompt
    if (registrationFeePaid === false) {
      return (
        <div className={`relative bg-gradient-to-r from-[#800020] to-[#FFD700] text-white rounded-lg shadow-lg overflow-hidden ${className}`}>
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
                <h3 className="text-lg md:text-xl font-bold mb-1">Complete Your Registration</h3>
                <p className="text-white/90 text-sm md:text-base">
                  Pay the one-time registration fee (₦12,500) to unlock Tier 2 KYC and unlimited bidding.
                </p>
              </div>
              <button
                onClick={handleUpgradeClick}
                className="flex-shrink-0 px-6 py-3 bg-white text-[#800020] font-bold rounded-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-2 whitespace-nowrap min-h-[44px]"
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
      <div className={`relative bg-gradient-to-r from-[#800020] to-[#FFD700] text-white rounded-lg shadow-lg overflow-hidden ${className}`}>
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
              <h3 className="text-lg md:text-xl font-bold mb-1">Unlock Premium Auctions — Upgrade to Tier 2</h3>
              <p className="text-white/90 text-sm md:text-base">
                Get unlimited bidding on high-value auctions, priority support, and leaderboard access.
              </p>
            </div>
            <button
              onClick={handleUpgradeClick}
              className="flex-shrink-0 px-6 py-3 bg-white text-[#800020] font-bold rounded-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-2 whitespace-nowrap min-h-[44px]"
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
