'use client';

import { useState, useCallback, useEffect } from 'react';

export type VendorTier = 'tier1_bvn' | 'tier2_full' | 'tier0';

interface UseTierUpgradeOptions {
  currentTier: VendorTier;
  onUpgradeRequired?: (auctionValue: number) => void;
}

const DEFAULT_TIER_1_LIMIT = 500000;

async function loadTier1Limit(): Promise<number | null> {
  const policyResponse = await fetch('/api/business-policy/public');
  if (policyResponse.ok) {
    const data = await policyResponse.json();
    const policyLimit = data.policy?.onboarding?.tier1BidLimit;

    if (typeof policyLimit === 'number') {
      return policyLimit;
    }
  }

  const legacyResponse = await fetch('/api/config/system');
  if (!legacyResponse.ok) {
    return null;
  }

  const legacyData = await legacyResponse.json();
  const legacyLimit = legacyData.config?.tier1Limit;

  return typeof legacyLimit === 'number' ? legacyLimit : null;
}

export function useTierUpgrade({ currentTier, onUpgradeRequired }: UseTierUpgradeOptions) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [blockedAuctionValue, setBlockedAuctionValue] = useState<number | undefined>();
  const [tier1Limit, setTier1Limit] = useState<number>(DEFAULT_TIER_1_LIMIT);

  // Prefer the public business policy layer, with the legacy config endpoint as a compatibility fallback.
  useEffect(() => {
    let cancelled = false;

    const fetchConfig = async () => {
      try {
        const configuredLimit = await loadTier1Limit();

        if (!cancelled && typeof configuredLimit === 'number') {
          setTier1Limit(configuredLimit);
        }
      } catch (error) {
        console.error('Failed to fetch Tier 1 policy, using default:', error);
      }
    };

    fetchConfig();

    return () => {
      cancelled = true;
    };
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
