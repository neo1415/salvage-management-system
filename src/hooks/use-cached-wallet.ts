/**
 * useCachedWallet Hook
 * 
 * Provides cached wallet data with automatic online/offline handling.
 * Fetches from API when online, falls back to cache when offline.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOffline } from '@/hooks/use-offline';
import { CacheService } from '@/features/cache/services/cache.service';

export interface WalletData {
  balance: number;
  transactions: Array<Record<string, unknown>>;
}

export interface UseCachedWalletReturn {
  wallet: WalletData | null;
  isLoading: boolean;
  isOffline: boolean;
  lastSynced: Date | null;
  refresh: () => Promise<void>;
  error: Error | null;
}

export function useCachedWallet(
  userId: string | null,
  fetchFn?: () => Promise<WalletData>
): UseCachedWalletReturn {
  const isOffline = useOffline();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const loadFromCache = useCallback(async () => {
    if (!userId) {
      setWallet(null);
      setIsLoading(false);
      return;
    }

    try {
      const cached = await CacheService.getCachedWallet(userId);
      if (cached) {
        setWallet(cached.data);
        setLastSynced(cached.cachedAt);
      } else {
        setWallet(null);
      }
    } catch (err) {
      console.error('Failed to load from cache:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const fetchAndCache = useCallback(async () => {
    if (!fetchFn || !userId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const data = await fetchFn();
      setWallet(data);
      setLastSynced(new Date());

      // Cache wallet data
      await CacheService.cacheWallet(userId, data.balance, data.transactions);
    } catch (err) {
      console.error('Failed to fetch wallet:', err);
      setError(err as Error);
      
      // Fall back to cache on error
      await loadFromCache();
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, userId, loadFromCache]);

  const refresh = useCallback(async () => {
    if (isOffline) {
      await loadFromCache();
    } else {
      await fetchAndCache();
    }
  }, [isOffline, loadFromCache, fetchAndCache]);

  // Initial load
  useEffect(() => {
    if (!userId) {
      setWallet(null);
      setIsLoading(false);
      return;
    }
    
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
  }, [userId, isOffline]); // FIXED: Only re-run when userId or online status changes, not when callbacks change

  return {
    wallet,
    isLoading,
    isOffline,
    lastSynced,
    refresh,
    error,
  };
}
