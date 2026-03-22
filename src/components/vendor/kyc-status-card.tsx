'use client';

import { useRouter } from 'next/navigation';
import { Crown, ArrowRight } from 'lucide-react';

export type VendorTier = 'tier1_bvn' | 'tier2_full';

interface KYCStatusCardProps {
  currentTier: VendorTier;
  bidLimit?: number;
  className?: string;
}

export function KYCStatusCard({ currentTier, bidLimit, className = '' }: KYCStatusCardProps) {
  const router = useRouter();
  const isTier1 = currentTier === 'tier1_bvn';

  const handleUpgradeClick = () => {
    router.push('/vendor/kyc/tier2');
  };

  // Only show the clean banner for Tier 1 users
  if (!isTier1) {
    return null;
  }

  return (
    <div className={`relative bg-gradient-to-r from-[#800020] to-[#FFD700] text-white rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>

      {/* Content */}
      <div className="relative p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <Crown className="w-6 h-6" />
          </div>

          {/* Text content */}
          <div className="flex-1">
            <h3 className="text-lg md:text-xl font-bold mb-1">
              Unlock Premium Auctions - Upgrade to Tier 2
            </h3>
            <p className="text-white/90 text-sm md:text-base">
              Get unlimited bidding on high-value auctions, priority support, and leaderboard access.
            </p>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleUpgradeClick}
            className="flex-shrink-0 px-6 py-3 bg-white text-[#800020] font-bold rounded-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-2 whitespace-nowrap"
          >
            Upgrade Now
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}