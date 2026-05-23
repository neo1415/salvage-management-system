'use client';

import { useState, useCallback, useEffect } from 'react';

export type VendorTier = 'tier1_bvn' | 'tier2_full' | 'tier0';

interface UseTierUpgradeOptions {
  currentTier: VendorTier;
  onUpgradeRequired?: (auctionValue: number) => void;
}

export function useTierUpgrade({ currentTier, onUpgradeRequired }: UseTierUpgradeOptions) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [blockedAuctionValue, setBlockedAuctionValue] = useState<number | undefined>();
  const [tier1Limit, setTier1Limit] = useState<number>(500000); // Default fallback

  // Fetch tier1Limit from system configuration
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config/system');
        if (response.ok) {
          const data = await response.json();
          if (data.config?.tier1Limit) {
            setTier1Limit(data.config.tier1Limit);
            console.log(`✅ Tier 1 limit loaded from config: ₦${data.config.tier1Limit.toLocaleString()}`);
          }
        }
      } catch (error) {
        console.error('Failed to fetch tier1Limit from config, using default:', error);
      }
    };

    fetchConfig();
  }, []);

  /**
   * Check if vendor can access an auction based on their tier
   * @param auctionValue - The value of the auction in Naira
   * @returns true if vendor can access, false otherwise
   */
  const canAccessAuction = useCallback(
    (auctionValue: number): boolean => {
      if (currentTier === 'tier2_full') {
        return true; // Tier 2 vendors have unlimited access
      }

      // Tier 1 vendors can only access auctions up to the configured limit
      return auctionValue <= tier1Limit;
    },
    [currentTier, tier1Limit]
  );

  /**
   * Check auction access and show upgrade modal if needed
   * @param auctionValue - The value of the auction in Naira
   * @returns true if access granted, false if upgrade required
   */
  const checkAuctionAccess = useCallback(
    (auctionValue: number): boolean => {
      const hasAccess = canAccessAuction(auctionValue);

      if (!hasAccess) {
        setBlockedAuctionValue(auctionValue);
        setShowUpgradeModal(true);
        onUpgradeRequired?.(auctionValue);
      }

      return hasAccess;
    },
    [canAccessAuction, onUpgradeRequired]
  );

  /**
   * Close the upgrade modal
   */
  const closeUpgradeModal = useCallback(() => {
    setShowUpgradeModal(false);
    setBlockedAuctionValue(undefined);
  }, []);

  /**
   * Get the tier limit for display purposes
   */
  const getTierLimit = useCallback((): number | null => {
    if (currentTier === 'tier1_bvn') {
      return tier1Limit;
    }
    return null; // Tier 2 has no limit
  }, [currentTier, tier1Limit]);

  /**
   * Check if vendor is Tier 1
   */
  const isTier1 = currentTier === 'tier1_bvn';

  /**
   * Check if vendor is Tier 2
   */
  const isTier2 = currentTier === 'tier2_full';

  return {
    canAccessAuction,
    checkAuctionAccess,
    showUpgradeModal,
    closeUpgradeModal,
    blockedAuctionValue,
    getTierLimit,
    isTier1,
    isTier2,
    TIER_1_LIMIT: tier1Limit,
  };
}
