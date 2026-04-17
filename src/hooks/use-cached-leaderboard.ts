/**
 * useCachedLeaderboard Hook
 * 
 * Provides cached leaderboard data with automatic online/offline handling.
 * Fetches from API when online, falls back to cache when offline.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOffline } from '@/hooks/use-offline';
import { CacheService } from '@/features/cache/services/cache.service';

interface LeaderboardEntry {
  rank: number;
  vendorId: string;
  vendorName: string;
  businessName: string | null;
  profilePictureUrl?: string | null;
  tier: string;
  totalBids: number;
  wins: number;
  totalSpent: string;
  onTimePickupRate: number;
  rating: string;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  lastUpdated: string;
  nextUpdate: string;
}

export interface UseCachedLeaderboardReturn {
  data: LeaderboardResponse | null;
  isLoading: boolean;
  isOffline: boolean;
  lastCached: Date | null;
  refresh: () => Promise<void>;
  error: Error | null;
}

export function useCachedLeaderboard(): UseCachedLeaderboardReturn {
  const isOffline = useOffline();
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastCached, setLastCached] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const loadFromCache = useCallback(async () => {
    try {
      const cached = await CacheService.get('leaderboard');
      if (cached) {
        setData(cached.data as LeaderboardResponse);
        setLastCached(cached.cachedAt);
      } else {
        setData(null);
      }
    } catch (err) {
      console.error('Failed to load leaderboard from cache:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAndCache = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/leaderboard');
      
      if (!response.ok) {
        throw new Error('Failed to fetch leaderboard data');
      }

      const leaderboardData: LeaderboardResponse = await response.json();
      setData(leaderboardData);
      setLastCached(new Date());

      // Cache the data
      await CacheService.set('leaderboard', leaderboardData);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setError(err as Error);
      
      // Fall back to cache on error
      await loadFromCache();
    } finally {
      setIsLoading(false);
    }
  }, [loadFromCache]);

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
  }, [isOffline]); // FIXED: Only re-run when online status changes, not when callbacks change

  return {
    data,
    isLoading,
    isOffline,
    lastCached,
    refresh,
    error,
  };
}
