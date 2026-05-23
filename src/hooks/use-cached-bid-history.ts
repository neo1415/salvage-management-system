/**
 * useCachedBidHistory Hook
 *
 * Bid history with in-memory tab cache so Active/Completed switches do not
 * blank the whole page. Prefetches both tabs (page 1) on first load.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOffline } from '@/hooks/use-offline';
import { CacheService } from '@/features/cache/services/cache.service';

type BidHistoryTab = 'active' | 'completed';

type CacheEntry = {
  items: unknown[];
  totalPages: number;
  fetchedAt: Date;
};

export interface UseCachedBidHistoryReturn {
  data: unknown[];
  isLoading: boolean;
  isRefreshing: boolean;
  isOffline: boolean;
  lastCached: Date | null;
  refresh: () => Promise<void>;
  error: Error | null;
  totalPages: number;
}

function cacheKey(tab: BidHistoryTab, page: number) {
  return `bid-history-${tab}-${page}`;
}

function memoryKey(tab: BidHistoryTab, page: number) {
  return `${tab}:${page}`;
}

export function useCachedBidHistory(
  activeTab: BidHistoryTab,
  page: number,
  limit: number = 10
): UseCachedBidHistoryReturn {
  const isOffline = useOffline();
  const [data, setData] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCached, setLastCached] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const memoryCache = useRef<Map<string, CacheEntry>>(new Map());
  const prefetchedTabs = useRef(false);

  const applyEntry = useCallback((entry: CacheEntry) => {
    setData(entry.items);
    setTotalPages(entry.totalPages);
    setLastCached(entry.fetchedAt);
  }, []);

  const loadFromPersistentCache = useCallback(
    async (tab: BidHistoryTab, pageNum: number): Promise<CacheEntry | null> => {
      try {
        const cached = await CacheService.get<{ items?: unknown[]; totalPages?: number }>(cacheKey(tab, pageNum));
        if (!cached?.data) return null;
        return {
          items: cached.data.items || [],
          totalPages: cached.data.totalPages || 1,
          fetchedAt: cached.cachedAt ? new Date(cached.cachedAt) : new Date(),
        };
      } catch {
        return null;
      }
    },
    []
  );

  const fetchTabPage = useCallback(
    async (tab: BidHistoryTab, pageNum: number, options: { blockUI?: boolean } = {}) => {
      const { blockUI = false } = options;
      const mKey = memoryKey(tab, pageNum);
      const isCurrentView = tab === activeTab && pageNum === page;

      const cachedEntry = memoryCache.current.get(mKey);
      if (cachedEntry && isCurrentView) {
        applyEntry(cachedEntry);
        setIsLoading(false);
      } else if (blockUI && isCurrentView) {
        setIsLoading(true);
      } else if (isCurrentView && !cachedEntry) {
        setIsRefreshing(true);
      }

      if (isOffline) {
        const persisted = await loadFromPersistentCache(tab, pageNum);
        if (persisted) {
          memoryCache.current.set(mKey, persisted);
          if (isCurrentView) applyEntry(persisted);
        }
        if (isCurrentView) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
        return;
      }

      try {
        if (isCurrentView) setError(null);

        const response = await fetch(
          `/api/bid-history?tab=${tab}&page=${pageNum}&limit=${limit}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch bid history');
        }

        const result = await response.json();
        const entry: CacheEntry = {
          items: result.data ?? [],
          totalPages: result.pagination?.totalPages ?? 1,
          fetchedAt: new Date(),
        };

        memoryCache.current.set(mKey, entry);

        await CacheService.set(cacheKey(tab, pageNum), {
          items: entry.items,
          totalPages: entry.totalPages,
        });

        if (isCurrentView) {
          applyEntry(entry);
        }
      } catch (err) {
        if (isCurrentView) {
          setError(err instanceof Error ? err : new Error('Failed to fetch bid history'));
          const persisted = await loadFromPersistentCache(tab, pageNum);
          if (persisted) {
            memoryCache.current.set(mKey, persisted);
            applyEntry(persisted);
          }
        }
      } finally {
        if (isCurrentView) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [activeTab, page, limit, isOffline, applyEntry, loadFromPersistentCache]
  );

  const refresh = useCallback(async () => {
    memoryCache.current.delete(memoryKey(activeTab, page));
    await fetchTabPage(activeTab, page, { blockUI: data.length === 0 });
  }, [activeTab, page, data.length, fetchTabPage]);

  useEffect(() => {
    const hasMemory = memoryCache.current.has(memoryKey(activeTab, page));
    void fetchTabPage(activeTab, page, { blockUI: !hasMemory });
  }, [activeTab, page, isOffline, fetchTabPage]);

  useEffect(() => {
    if (prefetchedTabs.current || isOffline) return;
    prefetchedTabs.current = true;

    const otherTab: BidHistoryTab = activeTab === 'active' ? 'completed' : 'active';
    if (!memoryCache.current.has(memoryKey(otherTab, 1))) {
      void fetchTabPage(otherTab, 1);
    }
  }, [activeTab, isOffline, fetchTabPage]);

  return {
    data,
    isLoading,
    isRefreshing,
    isOffline,
    lastCached,
    refresh,
    error,
    totalPages,
  };
}
