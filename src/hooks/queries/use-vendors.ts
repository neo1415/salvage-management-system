/**
 * useVendors Hook
 * 
 * Manages vendor list fetching with TanStack Query
 * Supports filtering and pagination for virtualized lists
 */

import { useQuery } from '@tanstack/react-query';

interface VendorFilters {
  status?: string;
  tier?: string;
}

interface VendorUser {
  fullName: string;
  email: string;
  phone: string;
}

export interface Vendor {
  id: string;
  userId: string;
  businessName: string;
  cacNumber: string;
  tin: string;
  bankAccountNumber: string;
  bankName: string;
  bankAccountName: string;
  tier: string;
  status: string;
  bvnVerified: boolean;
  ninVerified: boolean;
  bankAccountVerified: boolean;
  cacVerified: boolean;
  cacCertificateUrl: string;
  bankStatementUrl: string;
  ninCardUrl: string;
  createdAt: string;
  user: VendorUser;
}

interface VendorsResponse {
  success: boolean;
  vendors: Vendor[];
  count: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
}

export function useVendors(filters?: VendorFilters) {
  return useQuery({
    queryKey: ['vendors', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.tier) params.append('tier', filters.tier);
      
      const response = await fetch(`/api/vendors?${params}`);
      if (!response.ok) throw new Error('Failed to fetch vendors');
      return response.json() as Promise<VendorsResponse>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
