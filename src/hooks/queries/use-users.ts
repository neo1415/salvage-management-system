/**
 * useUsers Hook
 * 
 * Manages user list fetching with TanStack Query
 * Supports filtering, search, and pagination for virtualized lists
 */

import { useQuery } from '@tanstack/react-query';

interface UserFilters {
  role?: string;
  status?: string;
  search?: string;
}

export interface User {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  loginDeviceType: string | null;
  profilePictureUrl: string | null;
}

interface UsersResponse {
  success: boolean;
  users: User[];
  count: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
}

export function useUsers(filters?: UserFilters) {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.role) params.append('role', filters.role);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);
      
      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json() as Promise<UsersResponse>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
