'use client';

import { useState, useCallback } from 'react';

export type VendorTier = 'tier1_bvn' | 'tier2_full';

interface UseTierUpgradeOptions {
  currentTier: VendorTier;
  onUpgradeRequired?: (auctionValue: number) => void;
}

export function useTierUpgrade({ currentTier, onUpgradeRequired }: UseTierUpgradeOptions) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [blockedAuctionValue, setBlockedAuctionValue] = useState<number | undefined>();

  const TIER_1_LIMIT = 500000; // ₦500,000

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

      // Tier 1 vendors can only access auctions up to ₦500k
      return auctionValue <= TIER_1_LIMIT;
    },
    [currentTier]
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
      return TIER_1_LIMIT;
    }
    return null; // Tier 2 has no limit
  }, [currentTier]);

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
    TIER_1_LIMIT,
  };
}
