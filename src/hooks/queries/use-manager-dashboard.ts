/**
 * TanStack Query Hook for Manager Dashboard
 * 
 * Provides cached manager dashboard data with automatic background refetching.
 * Reduces 3-10s load times to <500ms on return visits.
 * 
 * Requirements: 5.1, 5.2, 5.3
 */

'use client';

import { useQuery } from '@tanstack/react-query';

interface DashboardKPIs {
  activeAuctions: number;
  totalBidsToday: number;
  averageRecoveryRate: number;
  casesPendingApproval: number;
}

interface RecoveryRateTrend {
  date: string;
  recoveryRate: number;
  totalCases: number;
}

interface TopVendor {
  vendorId: string;
  vendorName: string;
  totalBids: number;
  totalWins: number;
  totalSpent: number;
}

interface PaymentStatusBreakdown {
  status: string;
  count: number;
  percentage: number;
}

export interface ManagerDashboardData {
  kpis: DashboardKPIs;
  charts: {
    recoveryRateTrend: RecoveryRateTrend[];
    topVendors: TopVendor[];
    paymentStatusBreakdown: PaymentStatusBreakdown[];
  };
  lastUpdated: string;
}

/**
 * Fetch manager dashboard data from API
 */
async function fetchManagerDashboard(
  dateRange: string,
  assetType?: string
): Promise<ManagerDashboardData> {
  const params = new URLSearchParams();
  params.append('dateRange', dateRange);
  if (assetType) {
    params.append('assetType', assetType);
  }

  const response = await fetch(`/api/dashboard/manager?${params.toString()}`);
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (response.status === 403) {
      throw new Error('Access denied. Salvage Manager role required.');
    }
    throw new Error('Failed to fetch dashboard data');
  }

  return response.json();
}

/**
 * Hook to fetch manager dashboard data with caching
 * 
 * Features:
 * - 5min staleTime: Data stays fresh for 5 minutes (instant navigation)
 * - Automatic background refetching on window focus
 * - Exponential backoff retry (3 attempts)
 * - Loading and error states
 * - Filter support (dateRange, assetType)
 * 
 * @param dateRange - Date range filter (7, 30, 60, 90 days)
 * @param assetType - Asset type filter (optional)
 * @returns Query result with dashboard data, loading state, and error
 */
export function useManagerDashboard(dateRange = '30', assetType?: string) {
  return useQuery({
    queryKey: ['manager-dashboard', dateRange, assetType],
    queryFn: () => fetchManagerDashboard(dateRange, assetType),
    // Data stays fresh for 5 minutes - instant navigation from cache
    staleTime: 5 * 60 * 1000,
    // Refetch on window focus to keep data fresh
    refetchOnWindowFocus: true,
    // Retry failed requests 3 times with exponential backoff
    retry: 3,
  });
}
