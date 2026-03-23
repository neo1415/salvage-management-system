/**
 * TanStack Query Hook for Adjuster Cases
 * 
 * Provides cached cases data with server-side filtering.
 * Fixes tab switching flicker by using query keys with filters.
 * 
 * Requirements: 5.1, 5.2, 5.3, 2.2
 */

'use client';

import { useQuery } from '@tanstack/react-query';

export interface Case {
  id: string;
  claimReference: string;
  assetType: 'vehicle' | 'property' | 'electronics';
  assetDetails: Record<string, unknown>;
  marketValue: number;
  estimatedSalvageValue: number | null;
  reservePrice: number | null;
  damageSeverity: 'none' | 'minor' | 'moderate' | 'severe' | null;
  aiAssessment: Record<string, unknown> | null;
  gpsLocation: { latitude: number; longitude: number };
  locationName: string;
  photos: string[];
  status: 'draft' | 'pending_approval' | 'approved' | 'active_auction' | 'sold' | 'cancelled';
  createdAt: string;
  adjusterName: string | null;
}

export type StatusFilter = 'all' | 'pending_approval' | 'approved' | 'draft';

interface CasesFilters {
  status?: StatusFilter;
  createdByMe?: boolean;
  limit?: number;
  offset?: number;
}

interface CasesResponse {
  success: boolean;
  data: Case[];
  error?: string;
  meta: {
    limit: number;
    offset: number;
    count: number;
  };
}

/**
 * Fetch cases from API with server-side filtering
 */
async function fetchCases(filters: CasesFilters): Promise<Case[]> {
  const params = new URLSearchParams();
  
  // Add filters to query params
  if (filters.status && filters.status !== 'all') {
    params.append('status', filters.status);
  }
  
  if (filters.createdByMe) {
    params.append('createdByMe', 'true');
  }
  
  if (filters.limit) {
    params.append('limit', filters.limit.toString());
  }
  
  if (filters.offset) {
    params.append('offset', filters.offset.toString());
  }

  const url = `/api/cases${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to fetch cases');
  }

  const result: CasesResponse = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch cases');
  }

  return result.data;
}

/**
 * Hook to fetch cases with server-side filtering and caching
 * 
 * Features:
 * - Server-side filtering (fixes tab switching flicker)
 * - Query key includes filters for proper cache separation
 * - 5min staleTime: Data stays fresh for 5 minutes
 * - Automatic background refetching on window focus
 * - Exponential backoff retry (3 attempts)
 * 
 * @param filters - Filter options for cases
 * @returns Query result with cases data, loading state, and error
 */
export function useCases(filters: CasesFilters = {}) {
  return useQuery({
    // Query key includes filters for proper cache separation
    queryKey: ['cases', filters],
    queryFn: () => fetchCases(filters),
    // Data stays fresh for 5 minutes - instant tab switching
    staleTime: 5 * 60 * 1000,
    // Refetch on window focus to keep data fresh
    refetchOnWindowFocus: true,
    // Retry failed requests 3 times with exponential backoff
    retry: 3,
  });
}
