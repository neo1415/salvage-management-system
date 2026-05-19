'use client';

import { useQueries } from '@tanstack/react-query';
import type { Vendor } from '@/hooks/queries/use-vendors';

export type VendorTierTab = 'tier0' | 'tier1' | 'tier2';

const TIER_API_PARAM: Record<VendorTierTab, string> = {
  tier0: 'tier0',
  tier1: 'tier1_bvn',
  tier2: 'tier2_full',
};

const TIER_TABS: VendorTierTab[] = ['tier0', 'tier1', 'tier2'];

async function fetchTierVendors(tier: VendorTierTab): Promise<Vendor[]> {
  const params = new URLSearchParams({
    tier: TIER_API_PARAM[tier],
    page: '1',
    pageSize: '500',
  });

  const response = await fetch(`/api/vendors?${params}`, {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Failed to fetch vendors');

  const data = await response.json();
  return (data.vendors as Vendor[]) || [];
}

/**
 * Prefetch all vendor tiers once; tab/status switches filter client-side (no refetch).
 */
export function useVendorTierCache() {
  const queries = useQueries({
    queries: TIER_TABS.map((tier) => ({
      queryKey: ['vendors', 'tier-cache', tier],
      queryFn: () => fetchTierVendors(tier),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const vendorsByTier: Record<VendorTierTab, Vendor[]> = {
    tier0: queries[0].data ?? [],
    tier1: queries[1].data ?? [],
    tier2: queries[2].data ?? [],
  };

  const hasAnyData = TIER_TABS.some((tier) => vendorsByTier[tier].length > 0);
  const isInitialLoading = !hasAnyData && queries.some((q) => q.isLoading);
  const isFetching = queries.some((q) => q.isFetching);

  const refetchAll = async () => {
    await Promise.all(queries.map((q) => q.refetch()));
  };

  return {
    vendorsByTier,
    isInitialLoading,
    isFetching,
    refetchAll,
    tierErrors: queries.filter((q) => q.error).map((q) => q.error),
  };
}
