/**
 * useCachedDocuments Hook
 * 
 * Provides cached document data with automatic online/offline handling.
 * Fetches from API when online, falls back to cache when offline.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOffline } from '@/hooks/use-offline';
import { CacheService } from '@/features/cache/services/cache.service';

export interface UseCachedDocumentsReturn {
  documents: Array<Record<string, unknown>>;
  isLoading: boolean;
  isOffline: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  error: Error | null;
}

export function useCachedDocuments(
  auctionId: string | null,
  fetchFn?: () => Promise<Array<Record<string, unknown>>>
): UseCachedDocumentsReturn {
  const isOffline = useOffline();
  const [documents, setDocuments] = useState<Array<Record<string, unknown>>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const loadFromCache = useCallback(async () => {
    // CRITICAL FIX: Allow loading from cache even without auctionId
    // This is needed for pages that fetch multiple auctions
    if (!auctionId) {
      // When no auctionId, just set empty and let fetchFn handle it
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    try {
      const cached = await CacheService.getCachedDocuments(auctionId);
      if (cached.length > 0) {
        setDocuments(cached.map(c => c.data));
        setLastUpdated(cached[0]?.cachedAt || null);
      } else {
        setDocuments([]);
      }
    } catch (err) {
      console.error('Failed to load from cache:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [auctionId]);

  const fetchAndCache = useCallback(async () => {
    // CRITICAL FIX: Allow fetching even without auctionId when fetchFn is provided
    // This enables pages to fetch multiple auctions/documents
    if (!fetchFn) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const data = await fetchFn();
      setDocuments(data);
      setLastUpdated(new Date());

      // Cache each document only if we have an auctionId
      if (auctionId) {
        for (const document of data) {
          await CacheService.cacheDocument(document, auctionId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError(err as Error);
      
      // Fall back to cache on error only if we have an auctionId
      if (auctionId) {
        await loadFromCache();
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, auctionId, loadFromCache]);

  const refresh = useCallback(async () => {
    if (isOffline) {
      await loadFromCache();
    } else {
      await fetchAndCache();
    }
  }, [isOffline, loadFromCache, fetchAndCache]);

  // Initial load
  useEffect(() => {
    // CRITICAL FIX: Allow loading even without auctionId when fetchFn is provided
    // This enables pages to fetch all documents/auctions
    
    // Load data based on online status
    const loadData = async () => {
      if (isOffline) {
        // Only load from cache if we have an auctionId
        if (auctionId) {
          await loadFromCache();
        } else {
          setIsLoading(false);
        }
      } else {
        // When online, always try to fetch if we have a fetchFn
        await fetchAndCache();
      }
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId, isOffline]); // Only re-run when auctionId or online status changes

  return {
    documents,
    isLoading,
    isOffline,
    lastUpdated,
    refresh,
    error,
  };
}
