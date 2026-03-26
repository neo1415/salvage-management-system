/**
 * useCachedBidHistory Hook
 * 
 * Provides cached bid history data with automatic online/offline handling.
 * Fetches from API when online, falls back to cache when offline.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOffline } from '@/hooks/use-offline';
import { CacheService } from '@/features/cache/services/cache.service';

export interface UseCachedBidHistoryReturn {
  data: any[];
  isLoading: boolean;
  isOffline: boolean;
  lastCached: Date | null;
  refresh: () => Promise<void>;
  error: Error | null;
  totalPages: number;
}

export function useCachedBidHistory(
  activeTab: 'active' | 'completed',
  page: number,
  limit: number = 10
): UseCachedBidHistoryReturn {
  const isOffline = useOffline();
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCached, setLastCached] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [totalPages, setTotalPages] = useState(1);

  const cacheKey = `bid-history-${activeTab}-${page}`;

  const loadFromCache = useCallback(async () => {
    try {
      const cached = await CacheService.get(cacheKey);
      if (cached) {
        setData(cached.data.items || []);
        setTotalPages(cached.data.totalPages || 1);
        setLastCached(cached.cachedAt);
      } else {
        setData([]);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Failed to load bid history from cache:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey]);

  const fetchAndCache = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/bid-history?tab=${activeTab}&page=${page}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch bid history');
      }

      const result = await response.json();
      setData(result.data);
      setTotalPages(result.pagination.totalPages);
      setLastCached(new Date());

      // Cache the data
      await CacheService.set(cacheKey, {
        items: result.data,
        totalPages: result.pagination.totalPages,
      });
    } catch (err) {
      console.error('Failed to fetch bid history:', err);
      setError(err as Error);
      
      // Fall back to cache on error
      await loadFromCache();
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, page, limit, cacheKey, loadFromCache]);

  const refresh = useCallback(async () => {
    if (isOffline) {
      await loadFromCache();
    } else {
      await fetchAndCache();
    }
  }, [isOffline, loadFromCache, fetchAndCache]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      if (isOffline) {
        await loadFromCache();
      } else {
        await fetchAndCache();
      }
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, page, isOffline]); // FIXED: Only re-run when tab, page, or online status changes, not when callbacks change

  return {
    data,
    isLoading,
    isOffline,
    lastCached,
    refresh,
    error,
    totalPages,
  };
}
