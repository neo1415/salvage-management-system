/**
 * TanStack Query Client Configuration
 * 
 * Configures React Query for optimal caching and performance.
 * This is the ROOT CAUSE FIX for 3-10 second load times.
 * 
 * Key Configuration:
 * - 5min staleTime: Data stays fresh for 5 minutes (instant navigation)
 * - 10min gcTime: Unused cache entries garbage collected after 10 minutes
 * - Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s max
 * - Automatic retry: 3 attempts with exponential backoff
 * - Background refetch: Keeps data fresh while serving from cache
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 5 minutes - instant navigation from cache
      staleTime: 5 * 60 * 1000, // 5 minutes
      
      // Unused cache entries garbage collected after 10 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime in v4)
      
      // Refetch on window focus to keep data fresh
      refetchOnWindowFocus: true,
      
      // Refetch when connection is restored
      refetchOnReconnect: true,
      
      // Retry failed requests 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // Retry failed mutations 3 times with exponential backoff
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});
