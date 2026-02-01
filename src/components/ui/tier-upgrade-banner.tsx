'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Crown, ArrowRight } from 'lucide-react';

interface TierUpgradeBannerProps {
  highValueAuctionCount?: number;
}

const BANNER_DISMISS_KEY = 'tier-upgrade-banner-dismissed';
const DISMISS_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds

export function TierUpgradeBanner({ highValueAuctionCount = 0 }: TierUpgradeBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if banner was dismissed and if 3 days have passed
    const dismissedAt = localStorage.getItem(BANNER_DISMISS_KEY);
    
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const currentTime = Date.now();
      const timeSinceDismiss = currentTime - dismissedTime;
      
      // Show banner again if 3 days have passed
      if (timeSinceDismiss >= DISMISS_DURATION_MS) {
        setIsVisible(true);
        localStorage.removeItem(BANNER_DISMISS_KEY);
      }
    } else {
      // Banner was never dismissed, show it
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(BANNER_DISMISS_KEY, Date.now().toString());
  };

  const handleUpgradeClick = () => {
    router.push('/vendor/kyc/tier2');
  };

  if (!isVisible) return null;

  return (
    <div className="relative bg-gradient-to-r from-[#800020] to-[#FFD700] text-white rounded-lg shadow-lg overflow-hidden mb-6">
      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
      </div>

      {/* Content */}
      <div className="relative p-4 md:p-6">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-2 rounded-full hover:bg-white/20 transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 pr-8">
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
              {highValueAuctionCount > 0 ? (
                <>
                  <span className="font-semibold">{highValueAuctionCount}</span> high-value auction
                  {highValueAuctionCount !== 1 ? 's' : ''} available. 
                  Get unlimited bidding, priority support, and leaderboard access.
                </>
              ) : (
                'Get unlimited bidding on high-value auctions, priority support, and leaderboard access.'
              )}
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
