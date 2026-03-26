/**
 * useCachedAuctions Hook
 * 
 * Provides cached auction data with automatic online/offline handling.
 * Fetches from API when online, falls back to cache when offline.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOffline } from '@/hooks/use-offline';
import { CacheService } from '@/features/cache/services/cache.service';

export interface UseCachedAuctionsReturn {
  auctions: Array<Record<string, unknown>>;
  isLoading: boolean;
  isOffline: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  error: Error | null;
}

export function useCachedAuctions(fetchFn?: () => Promise<Array<Record<string, unknown>>>): UseCachedAuctionsReturn {
  const isOffline = useOffline();
  const [auctions, setAuctions] = useState<Array<Record<string, unknown>>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const loadFromCache = useCallback(async () => {
    try {
      const cached = await CacheService.getCachedAuctions();
      if (cached.length > 0) {
        setAuctions(cached.map(c => c.data));
        setLastUpdated(cached[0]?.cachedAt || null);
      } else {
        setAuctions([]);
      }
    } catch (err) {
      console.error('Failed to load from cache:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAndCache = useCallback(async () => {
    if (!fetchFn) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const data = await fetchFn();
      setAuctions(data);
      setLastUpdated(new Date());

      // Cache each auction
      for (const auction of data) {
        await CacheService.cacheAuction(auction);
      }
    } catch (err) {
      console.error('Failed to fetch auctions:', err);
      setError(err as Error);
      
      // Fall back to cache on error
      await loadFromCache();
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, loadFromCache]);

  const refresh = useCallback(async () => {
    if (isOffline) {
      await loadFromCache();
    } else {
      await fetchAndCache();
    }
  }, [isOffline, loadFromCache, fetchAndCache]);

  // Initial load
  useEffect(() => {
    // Load data based on online status
    const loadData = async () => {
      if (isOffline) {
        await loadFromCache();
      } else {
        await fetchAndCache();
      }
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOffline]); // Only re-run when online status changes

  return {
    auctions,
    isLoading,
    isOffline,
    lastUpdated,
    refresh,
    error,
  };
}
